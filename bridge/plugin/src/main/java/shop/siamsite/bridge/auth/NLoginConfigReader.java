package shop.siamsite.bridge.auth;

import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.util.logging.Logger;

/**
 * Reads MySQL credentials + column mapping directly from nLogin's
 * {@code config.yml}. We deliberately use Bukkit's YamlConfiguration loader
 * (already on the classpath) rather than reflecting into the nLogin plugin
 * instance — that way we don't depend on nLogin's internal class layout.
 *
 * nLogin layout (all 2.x versions):
 * <pre>
 *   database:
 *     type: MySQL
 *     remote:
 *       hostname: "127.0.0.1:3306"
 *       database: "nlogin"
 *       username: "nlogin"
 *       password: "secret"
 *     table:
 *       account:
 *         table-name: "nlogin"
 *         columns:
 *           ai: "ai"
 *           last-name: "last_name"
 *           password: "password"
 *           email: "email"
 *           creation-date: "creation_date"
 *           last-seen: "last_seen"
 * </pre>
 */
public final class NLoginConfigReader {

    private NLoginConfigReader() {}

    public static NLoginCredentials read(File configFile, Logger logger) {
        if (!configFile.isFile()) {
            logger.warning("nLogin config not found at " + configFile.getPath());
            return null;
        }
        YamlConfiguration y = YamlConfiguration.loadConfiguration(configFile);

        String type = y.getString("database.type", "SQLite");
        if (!"MySQL".equalsIgnoreCase(type) && !"MariaDB".equalsIgnoreCase(type)) {
            logger.warning("nLogin database.type = " + type
                    + ". The bridge only supports MySQL/MariaDB; set nlogin.auto: false and configure manually.");
            return null;
        }

        String rawHost = y.getString("database.remote.hostname", "127.0.0.1:3306");
        HostPort hp = parseHostPort(rawHost);
        String db = y.getString("database.remote.database", "nlogin");
        String user = y.getString("database.remote.username", "nlogin");
        String pass = y.getString("database.remote.password", "");

        String table = y.getString("database.table.account.table-name", "nlogin");
        String colId = y.getString("database.table.account.columns.ai", "ai");
        // nLogin's stock default for the last-known nickname column is `username`,
        // not `last_name`. Match the plugin's actual default so auto-detect works
        // on fresh installs that haven't renamed columns.
        String colLastName = y.getString("database.table.account.columns.last-name", "username");
        String colPassword = y.getString("database.table.account.columns.password", "password");
        String colEmail = y.getString("database.table.account.columns.email", "email");
        String colCreation = y.getString("database.table.account.columns.creation-date", "creation_date");
        String colLastSeen = y.getString("database.table.account.columns.last-seen", "last_seen");

        return new NLoginCredentials(hp.host, hp.port, db, user, pass, table,
                colId, colLastName, colPassword, colEmail, colCreation, colLastSeen);
    }

    static HostPort parseHostPort(String raw) {
        if (raw == null || raw.isEmpty()) return new HostPort("127.0.0.1", 3306);
        // IPv6 not expected here; nLogin docs only show host or host:port.
        int colon = raw.lastIndexOf(':');
        if (colon < 0) return new HostPort(raw.trim(), 3306);
        String host = raw.substring(0, colon).trim();
        String portStr = raw.substring(colon + 1).trim();
        int port;
        try { port = Integer.parseInt(portStr); }
        catch (Exception e) { port = 3306; }
        if (host.isEmpty()) host = "127.0.0.1";
        return new HostPort(host, port);
    }

    static final class HostPort {
        final String host;
        final int port;
        HostPort(String host, int port) { this.host = host; this.port = port; }
    }
}
