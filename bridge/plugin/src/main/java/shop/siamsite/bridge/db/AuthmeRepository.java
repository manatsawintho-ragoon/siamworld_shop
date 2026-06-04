package shop.siamsite.bridge.db;

import at.favre.lib.crypto.bcrypt.BCrypt;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import shop.siamsite.bridge.auth.AuthmeCredentials;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * JDBC access to the local AuthMe MySQL table. All public methods are
 * synchronous and intended to be invoked from a worker thread — never the
 * MC main thread. AuthMe column names are stable across recent versions:
 * {@code username, realname, password, email, regdate, lastlogin}.
 */
public final class AuthmeRepository implements UserRepository {

    private final HikariDataSource ds;
    private final String table;
    private final Logger logger;
    private volatile long startedAt = System.currentTimeMillis();

    public AuthmeRepository(AuthmeCredentials creds, int poolSize, Logger logger) {
        this.logger = logger;
        this.table = sanitizeTable(creds.table);
        HikariConfig hc = new HikariConfig();
        hc.setJdbcUrl(creds.jdbcUrl());
        hc.setUsername(creds.user);
        hc.setPassword(creds.password);
        hc.setMaximumPoolSize(poolSize);
        hc.setMinimumIdle(1);
        hc.setPoolName("siamsite-bridge-authme");
        hc.setConnectionTimeout(3000);
        hc.setIdleTimeout(60_000);
        hc.setMaxLifetime(1_800_000);
        hc.setLeakDetectionThreshold(15_000);
        this.ds = new HikariDataSource(hc);
    }

    @Override
    public BridgeUser findByUsername(String username) throws SQLException {
        // AuthMe lowercases the lookup name; we match that behavior.
        String key = username == null ? "" : username.toLowerCase();
        String sql = "SELECT id, username, realname, password, email, regdate, lastlogin "
                + "FROM " + table + " WHERE LOWER(username) = ? LIMIT 1";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, key);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                return new BridgeUser(
                        rs.getInt("id"),
                        rs.getString("realname"),
                        rs.getString("password"),
                        rs.getString("email"),
                        rs.getLong("regdate"),
                        rs.getLong("lastlogin"));
            }
        }
    }

    @Override
    public void updatePassword(String username, String plaintext) throws SQLException {
        String hashed = BCrypt.withDefaults().hashToString(10, plaintext.toCharArray());
        String sql = "UPDATE " + table + " SET password = ? WHERE LOWER(username) = ?";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, hashed);
            ps.setString(2, username.toLowerCase());
            ps.executeUpdate();
        }
    }

    /**
     * Cheap sanity probe used by the {@code health} opcode. Returns the
     * row count of the authme table; throws if the DB is unreachable.
     */
    @Override
    public long rowCount() throws SQLException {
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM " + table);
             ResultSet rs = ps.executeQuery()) {
            return rs.next() ? rs.getLong(1) : 0L;
        }
    }

    @Override
    public long uptimeMs() { return System.currentTimeMillis() - startedAt; }

    @Override
    public void close() {
        try { ds.close(); }
        catch (Exception e) { logger.log(Level.WARNING, "Closing AuthMe pool failed", e); }
    }

    @Override
    public String backendName() { return "authme"; }

    @Override
    public String tableName() { return table; }

    /**
     * Only allow word chars in the table name. We interpolate this into SQL
     * because JDBC can't parameterize identifiers; the regex check prevents
     * any injection vector from a tampered config file.
     */
    private static String sanitizeTable(String name) {
        if (name == null || !name.matches("[A-Za-z0-9_]+")) {
            throw new IllegalArgumentException("Invalid AuthMe table name: " + name);
        }
        return name;
    }
}
