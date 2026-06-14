import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { pool } from '../database/connection';
import { config } from '../config';
import { npmService } from './npm.service';
import { cloudflareService } from './cloudflare.service';
import { emailService } from './email.service';
import { withRedisLock } from './cron.service';
import { RowDataPacket } from 'mysql2';

const execAsync = promisify(exec);

/** Run a command on the HOST via nsenter into PID 1 (requires privileged container) */
async function hostExec(cmd: string): Promise<void> {
  await execAsync(`nsenter -t 1 -m -u -i -n -p -- sh -c ${JSON.stringify(cmd)}`);
}

async function ufwAllow(mcIp: string, port: number): Promise<void> {
  // Insert ACCEPT rule at top of DOCKER-USER chain (before DROP rules)
  await hostExec(`/usr/sbin/iptables -I DOCKER-USER 1 -p tcp --dport ${port} -s "${mcIp}" -j ACCEPT 2>/dev/null || true`);
  await hostExec(`/usr/sbin/netfilter-persistent save 2>/dev/null || true`);
}

async function ufwDelete(mcIp: string, port: number): Promise<void> {
  await hostExec(`/usr/sbin/iptables -D DOCKER-USER -p tcp --dport ${port} -s "${mcIp}" -j ACCEPT 2>/dev/null || true`);
  await hostExec(`/usr/sbin/netfilter-persistent save 2>/dev/null || true`);
}

class DeployService {
  private async updateStatus(subscriptionId: number, status: string, log?: string) {
    await pool.execute(
      'UPDATE subscriptions SET status = ?, deploy_log = COALESCE(?, deploy_log) WHERE id = ?',
      [status, log ?? null, subscriptionId]
    );
  }

  /**
   * Deploy a new customer shop.
   * Runs new-customer.sh, then sets up Nginx Proxy Manager.
   * Runs async — does not block the HTTP request.
   */
  async deployAsync(subscriptionId: number, shopName: string, domain: string, mcIp?: string): Promise<void> {
    await this.updateStatus(subscriptionId, 'deploying', 'เริ่มต้นการ deploy...');

    // Save mc_ip if provided
    if (mcIp) {
      await pool.execute('UPDATE subscriptions SET mc_ip = ? WHERE id = ?', [mcIp, subscriptionId]);
    }

    // Run in background
    this.runDeploy(subscriptionId, shopName, domain, mcIp).catch(async (err) => {
      console.error('[Deploy]', err);
      await this.updateStatus(subscriptionId, 'pending', `Deploy failed: ${(err as Error).message}`);
    });
  }

  async getAvailablePorts(): Promise<{ frontendPort: number; backendPort: number }> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT frontend_port, backend_port FROM subscriptions ORDER BY frontend_port ASC'
    );
    let fp = 3001;
    let bp = 4001;
    const usedFp = new Set(rows.map(r => Number(r.frontend_port)));
    const usedBp = new Set(rows.map(r => Number(r.backend_port)));

    // Also check customers.json to be safe (in case of sync issues)
    const jsonFile = path.join(config.deployDir, 'customers.json');
    if (fs.existsSync(jsonFile)) {
      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      for (const c of data.customers || []) {
        usedFp.add(Number(c.frontend_port));
        usedBp.add(Number(c.backend_port));
      }
    }

    while (usedFp.has(fp)) fp++;
    while (usedBp.has(bp)) bp++;

    return { frontendPort: fp, backendPort: bp };
  }

  private async runDeploy(subscriptionId: number, shopName: string, domain: string, mcIp?: string): Promise<void> {
    const deployDir = config.deployDir;
    const script = path.join(deployDir, 'new-customer.sh');

    // If mcIp not passed, try reading from DB (e.g. redeploy)
    if (!mcIp) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT mc_ip FROM subscriptions WHERE id = ?', [subscriptionId]
      );
      mcIp = rows[0]?.mc_ip || undefined;
    }

    let log = '';
    try {
      // 0. Allocate available ports under a Redis lock so two parallel deploys can't claim
      //    the same pair. The lock spans only the port-resolve + customers.json write.
      log += `[${new Date().toISOString()}] Allocating available ports...\n`;
      const jsonFile = path.join(deployDir, 'customers.json');
      let ports!: { frontendPort: number; backendPort: number };
      let lockSucceeded = false;
      await withRedisLock('panel_deploy_port_alloc', 60, async () => {
        lockSucceeded = true;
        ports = await this.getAvailablePorts();
        if (fs.existsSync(jsonFile)) {
          const data = JSON.parse(await fsp.readFile(jsonFile, 'utf8'));
          data.next_frontend_port = ports.frontendPort;
          data.next_backend_port = ports.backendPort;
          await fsp.writeFile(jsonFile, JSON.stringify(data, null, 2));
        } else {
          await fsp.writeFile(jsonFile, JSON.stringify({
            next_frontend_port: ports.frontendPort,
            next_backend_port: ports.backendPort,
            customers: []
          }, null, 2));
        }
      });
      if (!lockSucceeded) throw new Error('Port allocation lock unavailable, retry shortly');

      // 1. Run shell script
      log += `[${new Date().toISOString()}] Running new-customer.sh...\n`;
      await this.updateStatus(subscriptionId, 'deploying', log);

      const mcIpArg = mcIp ? ` --mc-ip "${mcIp}"` : '';
      const { stdout, stderr } = await execAsync(
        `bash "${script}" --name "${shopName}" --domain "${domain}"${mcIpArg}`,
        // Cold first builds compile both backend + a full Next.js frontend with no Docker
        // cache. On a busy host this regularly exceeds 10 min and the script gets killed
        // mid-build, leaving a half-provisioned shop stuck in "deploying" (see cyoriasmp).
        // 25 min gives an uncached first build comfortable headroom.
        { timeout: 25 * 60 * 1000, cwd: deployDir }
      );
      log += stdout;
      if (stderr) log += `STDERR: ${stderr}`;
      log += `\n[${new Date().toISOString()}] Script completed.\n`;

      // 2. Read assigned ports from customers.json
      const registry = JSON.parse(await fsp.readFile(jsonFile, 'utf8'));
      const customer = registry.customers.find((c: { name: string }) => c.name === shopName);
      if (!customer) throw new Error('Customer not found in customers.json after deploy');

      // Update ports in DB
      await pool.execute(
        'UPDATE subscriptions SET frontend_port=?, backend_port=?, mysql_exposed_port=? WHERE id=?',
        [customer.frontend_port, customer.backend_port,
         33000 + customer.frontend_port - 3001, subscriptionId]
      );

      // 3. Setup NPM proxy
      log += `[${new Date().toISOString()}] Setting up Nginx Proxy Manager...\n`;
      await this.updateStatus(subscriptionId, 'deploying', log);
      await npmService.createProxyHost(domain, customer.frontend_port, customer.backend_port);
      log += `[${new Date().toISOString()}] NPM proxy configured.\n`;

      // 4. Cloudflare DNS — PROXIED (orange). The web domain MUST go through Cloudflare:
      //    harden-web-ports.sh DROPs non-CF IPs on 80/443, so a dns-only record is
      //    unreachable ("took too long to respond"). MySQL/AuthMe uses the separate
      //    dns-only db.siamsite.shop subdomain, so this never affects the DB connection.
      //    Retry once on transient failure so a flaky API call doesn't leave a shop without DNS.
      let cfOk = false;
      for (let attempt = 1; attempt <= 2 && !cfOk; attempt++) {
        try {
          await cloudflareService.ensureWebDnsRecord(domain);
          log += `[${new Date().toISOString()}] Cloudflare proxied A record ready for ${domain}.\n`;
          cfOk = true;
        } catch (cfErr) {
          const msg = (cfErr as Error).message || 'unknown';
          log += `[${new Date().toISOString()}] Cloudflare DNS attempt ${attempt} failed: ${msg}\n`;
          if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
        }
      }
      if (!cfOk) {
        log += `[${new Date().toISOString()}] ⚠️  Cloudflare DNS not created: check panel admin → Settings → Cloudflare. Shop will not be reachable until DNS exists for ${domain}.\n`;
      }

      // 4c. Add firewall DROP + subnet ACCEPT rules for new frontend/backend ports
      try {
        const fp = customer.frontend_port;
        const bp = customer.backend_port;
        const DOCKER_SUBNETS = ['172.17.0.0/16','172.18.0.0/16','172.19.0.0/16','172.20.0.0/16','172.21.0.0/16','172.22.0.0/16'];
        for (const port of [fp, bp]) {
          for (const subnet of DOCKER_SUBNETS) {
            await hostExec(`/usr/sbin/iptables -I DOCKER-USER 1 -p tcp --dport ${port} -s "${subnet}" -j ACCEPT 2>/dev/null || true`);
          }
          // Find position of blanket ACCEPT-all and insert DROP just before it
          await hostExec(`POS=$(/usr/sbin/iptables -L DOCKER-USER -n --line-numbers | awk 'NR>2 && $2=="ACCEPT" && $3=="0" && $4=="--" && $5=="0.0.0.0/0" && $6=="0.0.0.0/0" && !/ ctstate/ {print $1; exit}'); /usr/sbin/iptables -I DOCKER-USER "$POS" -p tcp --dport ${port} -j DROP 2>/dev/null || true`);
        }
        // Ensure Docker subnets can reach NPM admin (81), outbound HTTPS/HTTP (443/80),
        // and panel backend (5000). These are idempotent — iptables rejects duplicate rules.
        for (const subnet of DOCKER_SUBNETS) {
          await hostExec(`/usr/sbin/iptables -C DOCKER-USER -p tcp -s "${subnet}" --dport 443 -j ACCEPT 2>/dev/null || /usr/sbin/iptables -I DOCKER-USER 1 -p tcp -s "${subnet}" --dport 443 -j ACCEPT 2>/dev/null || true`);
          await hostExec(`/usr/sbin/iptables -C DOCKER-USER -p tcp -s "${subnet}" --dport 80 -j ACCEPT 2>/dev/null || /usr/sbin/iptables -I DOCKER-USER 1 -p tcp -s "${subnet}" --dport 80 -j ACCEPT 2>/dev/null || true`);
          await hostExec(`/usr/sbin/iptables -C DOCKER-USER -p tcp -s "${subnet}" --dport 81 -j ACCEPT 2>/dev/null || /usr/sbin/iptables -I DOCKER-USER 1 -p tcp -s "${subnet}" --dport 81 -j ACCEPT 2>/dev/null || true`);
        }
        await hostExec(`/usr/sbin/netfilter-persistent save 2>/dev/null || true`);
        log += `[${new Date().toISOString()}] Firewall rules added for ports ${fp} and ${bp}.\n`;
      } catch (fwErr) {
        log += `[${new Date().toISOString()}] Firewall rules skipped: ${(fwErr as Error).message}\n`;
      }

      // 5. Mark active
      await pool.execute(
        'UPDATE subscriptions SET status = "active", deploy_log = ? WHERE id = ?',
        [log, subscriptionId]
      );

      // 6. Send Thai welcome email (non-blocking — failure doesn't fail the deploy)
      try {
        const [subRows] = await pool.execute<RowDataPacket[]>(
          `SELECT s.id, s.shop_name, s.domain, s.kind, s.package_months, s.price_paid, s.expires_at, s.mc_ip,
                  pu.id AS user_id, pu.email, pu.display_name
           FROM subscriptions s
           JOIN panel_users pu ON pu.id = s.user_id
           WHERE s.id = ?`,
          [subscriptionId]
        );
        const row = subRows[0];
        if (row) {
          await emailService.sendDeployWelcome(
            { id: row.id, shop_name: row.shop_name, domain: row.domain, kind: row.kind,
              package_months: row.package_months, price_paid: row.price_paid,
              expires_at: row.expires_at, mc_ip: row.mc_ip } as never,
            { id: row.user_id, email: row.email, display_name: row.display_name } as never
          );
        }
      } catch (emailErr) {
        console.warn('[Deploy] Welcome email failed (non-critical):', (emailErr as Error).message);
      }
    } catch (err) {
      log += `\n[ERROR] ${(err as Error).message}`;
      await this.updateStatus(subscriptionId, 'pending', log);
      throw err;
    }
  }

  async stopShop(shopName: string): Promise<void> {
    const deployDir = config.deployDir;
    const envFile = path.join(deployDir, 'customers', shopName, '.env');
    const composeFile = path.join(deployDir, 'docker-compose.customer.yml');
    if (!fs.existsSync(envFile)) return; // no containers to stop
    await execAsync(
      `docker compose --project-name "sw-${shopName}" --env-file "${envFile}" -f "${composeFile}" stop`,
      { timeout: 60000 }
    );
  }

  async startShop(shopName: string): Promise<void> {
    const deployDir = config.deployDir;
    const envFile = path.join(deployDir, 'customers', shopName, '.env');
    const composeFile = path.join(deployDir, 'docker-compose.customer.yml');
    if (!fs.existsSync(envFile)) throw new Error(`ไม่พบไฟล์ .env สำหรับร้าน ${shopName}: กรุณา Deploy ก่อน`);
    await execAsync(
      `docker compose --project-name "sw-${shopName}" --env-file "${envFile}" -f "${composeFile}" start`,
      { timeout: 60000 }
    );
  }

  async restartShop(shopName: string): Promise<void> {
    const deployDir = config.deployDir;
    const envFile = path.join(deployDir, 'customers', shopName, '.env');
    const composeFile = path.join(deployDir, 'docker-compose.customer.yml');
    await execAsync(
      `docker compose --project-name "sw-${shopName}" --env-file "${envFile}" -f "${composeFile}" restart`,
      { timeout: 60000 }
    );
  }

  async removeShop(shopName: string, domain: string, mcIp?: string, mysqlExposedPort?: number): Promise<void> {
    const deployDir = config.deployDir;
    const envFile = path.join(deployDir, 'customers', shopName, '.env');
    const composeFile = path.join(deployDir, 'docker-compose.customer.yml');
    // Only run docker compose down if env file exists (shop was actually deployed)
    if (fs.existsSync(envFile)) {
      await execAsync(
        `docker compose --project-name "sw-${shopName}" --env-file "${envFile}" -f "${composeFile}" down -v`,
        { timeout: 120000 }
      );
    }
    // shopName is regex-validated upstream, but use fs.rm to avoid any reliance on shell quoting.
    await fsp.rm(path.join(deployDir, 'customers', shopName), { recursive: true, force: true });
    // Remove from customers.json
    const jsonFile = path.join(deployDir, 'customers.json');
    const raw = await fsp.readFile(jsonFile, 'utf8');
    const reg = JSON.parse(raw);
    reg.customers = reg.customers.filter((c: { name: string }) => c.name !== shopName);
    await fsp.writeFile(jsonFile, JSON.stringify(reg, null, 2));
    // Remove NPM proxy
    try { await npmService.deleteProxyHost(domain); } catch { /* non-critical */ }
    // Remove Cloudflare DNS
    try { await cloudflareService.deleteDnsRecord(domain); } catch { /* non-critical */ }
    // Remove UFW rule if mc_ip was set
    if (mcIp && mysqlExposedPort) {
      try {
        await ufwDelete(mcIp, mysqlExposedPort);
        console.log(`[FW] Removed DOCKER-USER rule for ${shopName}: ${mcIp}:${mysqlExposedPort}`);
      } catch { /* non-critical */ }
    }
  }

  async getShopStatus(shopName: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `docker inspect sw-${shopName}-frontend-1 --format '{{.State.Status}}' 2>/dev/null || echo stopped`
      );
      return stdout.trim();
    } catch { return 'stopped'; }
  }

  async getLogs(shopName: string, lines = 100): Promise<string> {
    const deployDir = config.deployDir;
    const envFile = path.join(deployDir, 'customers', shopName, '.env');
    const composeFile = path.join(deployDir, 'docker-compose.customer.yml');
    const { stdout } = await execAsync(
      `docker compose --project-name "sw-${shopName}" --env-file "${envFile}" -f "${composeFile}" logs --tail=${lines} 2>&1`,
      { timeout: 30000 }
    );
    return stdout;
  }

  async getStats(shopName: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" sw-${shopName}-frontend-1 sw-${shopName}-backend-1 sw-${shopName}-mysql-1 sw-${shopName}-redis-1 2>/dev/null || echo "No stats available"`
      );
      return stdout;
    } catch { return 'No stats available'; }
  }

  async getCustomerEnv(shopName: string): Promise<Record<string, string>> {
    const deployDir = config.deployDir;
    const envFile = path.join(deployDir, 'customers', shopName, '.env');
    try {
      const content = await fsp.readFile(envFile, 'utf8');
      const result: Record<string, string> = {};
      for (const line of content.split('\n')) {
        if (line.startsWith('#') || !line.includes('=')) continue;
        const [k, ...v] = line.split('=');
        result[k.trim()] = v.join('=').trim();
      }
      return result;
    } catch { return {}; }
  }
}

export const deployService = new DeployService();
