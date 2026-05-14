package shop.siamsite.bridge;

import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import shop.siamsite.bridge.auth.AuthmeConfigReader;
import shop.siamsite.bridge.auth.AuthmeCredentials;
import shop.siamsite.bridge.cmd.BridgeCommand;
import shop.siamsite.bridge.db.AuthmeRepository;
import shop.siamsite.bridge.opcode.OpcodeRouter;
import shop.siamsite.bridge.util.AsyncExecutor;
import shop.siamsite.bridge.ws.BridgeClient;

import java.io.File;
import java.util.logging.Level;

public final class SiamsiteBridgePlugin extends JavaPlugin {

    public static final String PLUGIN_VERSION = "1.0.0";
    public static final String PROTOCOL_VERSION = "v1";

    private AsyncExecutor executor;
    private AuthmeRepository repository;
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

        AuthmeCredentials creds = resolveCredentials(cfg);
        repository = new AuthmeRepository(creds, poolSize, getLogger());
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

    private AuthmeCredentials resolveCredentials(FileConfiguration cfg) {
        boolean auto = cfg.getBoolean("authme.auto", true);
        if (auto) {
            File authmeFile = new File(getDataFolder().getParentFile(), "AuthMe/config.yml");
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

    /** Re-entrant restart used by /siamsite-bridge reload. */
    public void restart() {
        shutdownAll();
        startAll();
    }

    public BridgeClient getClient() { return client; }
    public AuthmeRepository getRepository() { return repository; }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        return BridgeCommand.handle(this, sender, args);
    }
}
