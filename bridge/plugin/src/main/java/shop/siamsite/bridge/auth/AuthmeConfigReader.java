package shop.siamsite.bridge.auth;

import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.util.logging.Logger;

/**
 * Reads MySQL credentials directly from AuthMe's config.yml. We deliberately
 * use Bukkit's YamlConfiguration loader (already on the classpath) rather
 * than reflecting into the AuthMe plugin instance — that way we don't
 * depend on AuthMe's internal class layout, and the plugin still works if
 * AuthMe is loaded later or hot-reloaded.
 *
 * AuthMe layout (all versions 5.x+):
 *   DataSource:
 *     backend: MYSQL
 *     mySQLHost: 127.0.0.1
 *     mySQLPort: '3306'
 *     mySQLDatabase: authme
 *     mySQLUsername: authme
 *     mySQLPassword: secret
 *     mySQLTablename: authme
 */
public final class AuthmeConfigReader {

    private AuthmeConfigReader() {}

    public static AuthmeCredentials read(File configFile, Logger logger) {
        if (!configFile.isFile()) {
            logger.warning("AuthMe config not found at " + configFile.getPath());
            return null;
        }
        YamlConfiguration y = YamlConfiguration.loadConfiguration(configFile);
        String backend = y.getString("DataSource.backend", "SQLITE");
        if (!"MYSQL".equalsIgnoreCase(backend)) {
            logger.warning("AuthMe DataSource.backend = " + backend
                    + ". The bridge only supports MYSQL; set authme.auto: false and configure manually.");
            return null;
        }
        String host = y.getString("DataSource.mySQLHost", "127.0.0.1");
        int port = parsePort(y.getString("DataSource.mySQLPort", "3306"));
        String db = y.getString("DataSource.mySQLDatabase", "authme");
        String user = y.getString("DataSource.mySQLUsername", "authme");
        String pass = y.getString("DataSource.mySQLPassword", "");
        String table = y.getString("DataSource.mySQLTablename", "authme");
        return new AuthmeCredentials(host, port, db, user, pass, table);
    }

    private static int parsePort(String s) {
        try { return Integer.parseInt(s.trim()); }
        catch (Exception e) { return 3306; }
    }
}
