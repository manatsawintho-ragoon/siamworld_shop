import dns from 'dns/promises';
import net from 'net';
import { ValidationError } from './errors';

/**
 * Guard for RCON targets, which are supplied by the shop owner.
 *
 * In this SaaS the shop owner is a CUSTOMER, not an operator. `POST
 * /api/setup/test-rcon` and `POST /api/admin/servers/:id/test` take an arbitrary
 * host and port and open a TCP connection from inside the backend container, and
 * the reply distinguishes refused / timed out / authentication-failed. That is a
 * working port scanner pointed at our own infrastructure and at sibling tenants,
 * driven by anyone who can buy a shop.
 *
 * Minecraft servers live on the public internet, so refusing private space costs
 * a normal customer nothing. The exception is the deliberate localhost mapping in
 * setup.service.resolveHost (127.0.0.1 -> host.docker.internal) used when the MC
 * server runs on the same box; ALLOW_PRIVATE_RCON_HOSTS=true re-enables that for
 * an operator who knowingly runs such a deployment.
 */

/**
 * Private, loopback, link-local (incl. cloud metadata), multicast.
 *
 * 100.64.0.0/10 is deliberately NOT blocked. It is nominally CGNAT, but here it
 * is the Tailscale range, and Tailscale is the sanctioned RCON transport for
 * customers whose anti-DDoS provider mangles raw RCON (yokaicraft currently sits
 * on 100.119.2.16). Blocking it would break a supported deployment. It also
 * costs us nothing: tailnet addresses route only over the tailnet, so they reach
 * none of the Docker-internal services this guard exists to protect.
 */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 0) return true;
    if (p[0] === 10) return true;
    if (p[0] === 127) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 169 && p[1] === 254) return true;   // link-local + 169.254.169.254
    if (p[0] >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return true;
    if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('ff')) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  // Not an IP literal — the caller resolves the name first, so reaching here
  // means something unparseable.
  return true;
}

/** Container-internal service names an owner has no business pointing RCON at. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost', 'host.docker.internal', 'backend', 'frontend',
  'mysql', 'redis', 'panel-backend', 'panel-frontend', 'panel-mysql',
]);

/**
 * Throws unless `host` resolves exclusively to public addresses.
 * No-op when ALLOW_PRIVATE_RCON_HOSTS=true.
 */
export async function assertPublicRconHost(host: string): Promise<void> {
  if (process.env.ALLOW_PRIVATE_RCON_HOSTS === 'true') return;

  const name = host.trim().toLowerCase();
  if (!name) throw new ValidationError('ต้องระบุที่อยู่เซิร์ฟเวอร์');
  if (BLOCKED_HOSTNAMES.has(name)) {
    throw new ValidationError('ที่อยู่เซิร์ฟเวอร์นี้ไม่ได้รับอนุญาต กรุณาใช้ IP หรือโดเมนสาธารณะของเซิร์ฟเวอร์ Minecraft');
  }

  // An IP literal is judged directly; a name is resolved and EVERY answer must be
  // public, so a hostname that also points at an internal address is refused.
  let addresses: string[];
  if (net.isIP(name)) {
    addresses = [name];
  } else {
    try {
      addresses = (await dns.lookup(name, { all: true })).map(r => r.address);
    } catch {
      throw new ValidationError('ไม่พบที่อยู่เซิร์ฟเวอร์นี้ (DNS ไม่ตอบกลับ) กรุณาตรวจสอบอีกครั้ง');
    }
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new ValidationError('ที่อยู่เซิร์ฟเวอร์นี้ไม่ได้รับอนุญาต กรุณาใช้ IP หรือโดเมนสาธารณะของเซิร์ฟเวอร์ Minecraft');
  }
}
