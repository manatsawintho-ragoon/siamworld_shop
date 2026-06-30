package shop.siamsite.bridge;

import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import shop.siamsite.bridge.auth.AuthmeConfigReader;
import shop.siamsite.bridge.auth.AuthmeCredentials;
import shop.siamsite.bridge.auth.NLoginConfigReader;
import shop.siamsite.bridge.auth.NLoginCredentials;
import shop.siamsite.bridge.cmd.BridgeCommand;
import shop.siamsite.bridge.db.AuthmeRepository;
import shop.siamsite.bridge.db.NLoginRepository;
import shop.siamsite.bridge.db.UserRepository;
import shop.siamsite.bridge.opcode.OpcodeRouter;
import shop.siamsite.bridge.util.AsyncExecutor;
import shop.siamsite.bridge.ws.BridgeClient;

import java.io.File;
import java.util.logging.Level;

public final class SiamsiteBridgePlugin extends JavaPlugin {

    public static final String PLUGIN_VERSION = "1.1.0";
    public static final String PROTOCOL_VERSION = "v1";

    private AsyncExecutor executor;
    private UserRepository repository;
    private BridgeClient client;
    private OpcodeRouter router;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        try {
            startAll();
            getLogger().info("SiamsiteBridge " + PLUGIN_VERSION + " enabled.");
        } catch (Exception e) {
            getLogger().log(Level.SEVERE, "Failed to enable SiamsiteBridge: " + e.getMessage(), e);
            // Don't disable the whole server. Stay enabled so /siamsite-bridge
            // commands work and the operator can fix config + reload.
        }
    }

    @Override
    public void onDisable() {
        shutdownAll();
        getLogger().info("SiamsiteBridge disabled.");
    }

    private void startAll() {
        reloadConfig();
        FileConfiguration cfg = getConfig();

        int poolSize = Math.max(1, cfg.getInt("bridge.connection_pool_size", 4));
        int workerThreads = Math.max(1, cfg.getInt("bridge.worker_threads", 4));
        executor = new AsyncExecutor(workerThreads, getLogger());

        repository = resolveRepository(cfg, poolSize);
        if (repository == null) {
            getLogger().severe("No auth backend configured — bridge will stay in /status-only mode.");
            return;
        }
        router = new OpcodeRouter(this, repository, executor);

        String url = cfg.getString("panel.url", "wss://panel.siamsite.shop/bridge");
        String token = cfg.getString("panel.token", "");
        long initialBackoff = cfg.getLong("bridge.reconnect_initial_ms", 1000L);
        long maxBackoff = cfg.getLong("bridge.reconnect_max_ms", 60000L);
        int maxInflight = cfg.getInt("bridge.max_inflight", 256);

        if (token == null || token.isEmpty() || token.startsWith("PASTE-")) {
            getLogger().warning("panel.token is not set. Edit plugins/SiamsiteBridge/config.yml and /siamsite-bridge reload.");
            return;
        }

        client = new BridgeClient(this, url, token, PLUGIN_VERSION,
                initialBackoff, maxBackoff, maxInflight, router, executor, getLogger());
        client.connect();
    }

    private void shutdownAll() {
        if (client != null) {
            client.shutdown();
            client = null;
        }
        if (repository != null) {
            repository.close();
            repository = null;
        }
        if (executor != null) {
            executor.shutdown();
            executor = null;
        }
        router = null;
    }

    private UserRepository resolveRepository(FileConfiguration cfg, int poolSize) {
        String backend = pickBackend(cfg);
        if ("nlogin".equals(backend)) {
            NLoginCredentials c = resolveNLoginCredentials(cfg);
            getLogger().info("Auth backend = nLogin (table " + c.table + " on " + c.host + ":" + c.port + ")");
            return new NLoginRepository(c, poolSize, getLogger());
        }
        if ("authme".equals(backend)) {
            AuthmeCredentials c = resolveAuthmeCredentials(cfg);
            getLogger().info("Auth backend = AuthMe (table " + c.table + " on " + c.host + ":" + c.port + ")");
            return new AuthmeRepository(c, poolSize, getLogger());
        }
        return null;
    }

    /**
     * Decide which auth plugin to read from. Honors `bridge.backend` if set
     * explicitly to authme/nlogin; otherwise auto-detects by which plugin
     * folder exists. If both exist, prefer AuthMe (backward compat) and warn.
     */
    private String pickBackend(FileConfiguration cfg) {
        String configured = cfg.getString("bridge.backend", "auto");
        if (configured != null) configured = configured.trim().toLowerCase();
        if ("authme".equals(configured) || "nlogin".equals(configured)) {
            return configured;
        }
        File pluginsDir = getDataFolder().getParentFile();
        boolean hasAuthme = findPluginDir(pluginsDir, "AuthMe") != null;
        boolean hasNlogin = findPluginDir(pluginsDir, "nLogin") != null;
        if (hasAuthme && hasNlogin) {
            getLogger().warning("Both AuthMe and nLogin plugins detected. Defaulting to AuthMe — "
                    + "set bridge.backend: nlogin in config.yml to switch.");
            return "authme";
        }
        if (hasNlogin) return "nlogin";
        if (hasAuthme) return "authme";
        getLogger().warning("Neither AuthMe nor nLogin plugin folder found. "
                + "Set bridge.backend explicitly and configure credentials manually.");
        return "authme"; // fall through so manual authme.* config still works
    }

    /**
     * Locate a plugin's data folder case-insensitively. Bukkit creates the
     * folder from the plugin.yml {@code name:} field — most installs end up
     * with the canonical case (e.g. "AuthMe", "nLogin") but some operators
     * end up with lowercase variants ("nlogin") after a manual rename. We
     * match on equalsIgnoreCase so auto-detect works either way.
     */
    private static File findPluginDir(File pluginsDir, String pluginName) {
        File exact = new File(pluginsDir, pluginName);
        if (exact.isDirectory()) return exact;
        File[] children = pluginsDir.listFiles();
        if (children == null) return null;
        for (File f : children) {
            if (f.isDirectory() && f.getName().equalsIgnoreCase(pluginName)) return f;
        }
        return null;
    }

    private AuthmeCredentials resolveAuthmeCredentials(FileConfiguration cfg) {
        boolean auto = cfg.getBoolean("authme.auto", true);
        if (auto) {
            File pluginDir = findPluginDir(getDataFolder().getParentFile(), "AuthMe");
            File authmeFile = new File(pluginDir != null ? pluginDir
                    : new File(getDataFolder().getParentFile(), "AuthMe"), "config.yml");
            AuthmeCredentials detected = AuthmeConfigReader.read(authmeFile, getLogger());
            if (detected != null) {
                getLogger().info("Loaded AuthMe MySQL credentials from " + authmeFile.getPath());
                return detected;
            }
            getLogger().warning("Could not auto-detect AuthMe config. Falling back to bridge config.yml values.");
        }
        return new AuthmeCredentials(
                cfg.getString("authme.host", "127.0.0.1"),
                cfg.getInt("authme.port", 3306),
                cfg.getString("authme.database", "authme"),
                cfg.getString("authme.user", "authme"),
                cfg.getString("authme.password", ""),
                cfg.getString("authme.table", "authme")
        );
    }

    private NLoginCredentials resolveNLoginCredentials(FileConfiguration cfg) {
        boolean auto = cfg.getBoolean("nlogin.auto", true);
        if (auto) {
            File pluginDir = findPluginDir(getDataFolder().getParentFile(), "nLogin");
            File nloginFile = new File(pluginDir != null ? pluginDir
                    : new File(getDataFolder().getParentFile(), "nLogin"), "config.yml");
            NLoginCredentials detected = NLoginConfigReader.read(nloginFile, getLogger());
            if (detected != null) {
                getLogger().info("Loaded nLogin MySQL credentials from " + nloginFile.getPath());
                return detected;
            }
            getLogger().warning("Could not auto-detect nLogin config. Falling back to bridge config.yml values.");
        }
        return new NLoginCredentials(
                cfg.getString("nlogin.host", "127.0.0.1"),
                cfg.getInt("nlogin.port", 3306),
                cfg.getString("nlogin.database", "nlogin"),
                cfg.getString("nlogin.user", "nlogin"),
                cfg.getString("nlogin.password", ""),
                cfg.getString("nlogin.table", "nlogin"),
                cfg.getString("nlogin.columns.id", "ai"),
                cfg.getString("nlogin.columns.last_name", "username"),
                cfg.getString("nlogin.columns.password", "password"),
                cfg.getString("nlogin.columns.email", "email"),
                cfg.getString("nlogin.columns.creation_date", "creation_date"),
                cfg.getString("nlogin.columns.last_seen", "last_seen")
        );
    }

    /** Re-entrant restart used by /siamsite-bridge reload. */
    public void restart() {
        shutdownAll();
        startAll();
    }

    public BridgeClient getClient() { return client; }
    public UserRepository getRepository() { return repository; }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        return BridgeCommand.handle(this, sender, args);
    }
}
