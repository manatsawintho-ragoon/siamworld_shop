package shop.siamsite.bridge.db;

import at.favre.lib.crypto.bcrypt.BCrypt;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import shop.siamsite.bridge.auth.NLoginCredentials;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * JDBC access to the nLogin MySQL/MariaDB table. Same threading rules as
 * {@link AuthmeRepository} — never called from the MC main thread.
 *
 * <p>nLogin's schema differs from AuthMe in a few important ways:
 * <ul>
 *   <li>No {@code realname} column — nLogin stores the last-known nickname
 *       in {@code last_name}.</li>
 *   <li>{@code password} can be {@code NULL} for premium-only accounts; we
 *       surface that as a normal user row and let the router map it to
 *       {@code unknown_user}.</li>
 *   <li>{@code last_seen} / {@code creation_date} are documented as TIMESTAMP
 *       in some versions but stored as Unix millis (BIGINT) in others.
 *       {@link #readEpochMillis} handles both.</li>
 *   <li>Column names are operator-configurable; the SQL is built from
 *       {@link NLoginCredentials}.</li>
 * </ul>
 */
public final class NLoginRepository implements UserRepository {

    private final HikariDataSource ds;
    private final String table;
    private final String colId, colLastName, colPassword, colEmail, colCreation, colLastSeen;
    private final Logger logger;
    private volatile long startedAt = System.currentTimeMillis();

    public NLoginRepository(NLoginCredentials creds, int poolSize, Logger logger) {
        this.logger = logger;
        this.table = sanitizeIdent(creds.table, "table");
        this.colId = sanitizeIdent(creds.columnId, "id");
        this.colLastName = sanitizeIdent(creds.columnLastName, "last_name");
        this.colPassword = sanitizeIdent(creds.columnPassword, "password");
        this.colEmail = sanitizeIdent(creds.columnEmail, "email");
        this.colCreation = sanitizeIdent(creds.columnCreationDate, "creation_date");
        this.colLastSeen = sanitizeIdent(creds.columnLastSeen, "last_seen");

        HikariConfig hc = new HikariConfig();
        hc.setJdbcUrl(creds.jdbcUrl());
        hc.setUsername(creds.user);
        hc.setPassword(creds.password);
        hc.setMaximumPoolSize(poolSize);
        hc.setMinimumIdle(1);
        hc.setPoolName("siamsite-bridge-nlogin");
        hc.setConnectionTimeout(3000);
        hc.setIdleTimeout(60_000);
        hc.setMaxLifetime(1_800_000);
        hc.setLeakDetectionThreshold(15_000);
        this.ds = new HikariDataSource(hc);
    }

    @Override
    public BridgeUser findByUsername(String username) throws SQLException {
        String key = username == null ? "" : username.toLowerCase();
        String sql = "SELECT `" + colId + "` AS id, "
                + "`" + colLastName + "` AS last_name, "
                + "`" + colPassword + "` AS password, "
                + "`" + colEmail + "` AS email, "
                + "`" + colCreation + "` AS creation_date, "
                + "`" + colLastSeen + "` AS last_seen "
                + "FROM `" + table + "` WHERE LOWER(`" + colLastName + "`) = ? LIMIT 1";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, key);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                return new BridgeUser(
                        rs.getInt("id"),
                        rs.getString("last_name"),
                        rs.getString("password"),
                        rs.getString("email"),
                        readEpochMillis(rs, "creation_date"),
                        readEpochMillis(rs, "last_seen"));
            }
        }
    }

    @Override
    public void updatePassword(String username, String plaintext) throws SQLException {
        // Always write bcrypt 2a — matches nLogin's BCRYPT2A default which
        // covers virtually all stock installs. On servers configured for a
        // non-bcrypt algorithm (argon2, pbkdf2, sha-*), nLogin may refuse the
        // hash; if support sees post-reset login failures, ask the operator
        // to set security.hashing.algorithm to BCRYPT2A or rehash manually.
        String hashed = BCrypt.withDefaults().hashToString(10, plaintext.toCharArray());
        String sql = "UPDATE `" + table + "` SET `" + colPassword + "` = ? "
                + "WHERE LOWER(`" + colLastName + "`) = ?";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, hashed);
            ps.setString(2, username.toLowerCase());
            ps.executeUpdate();
        }
    }

    @Override
    public long rowCount() throws SQLException {
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM `" + table + "`");
             ResultSet rs = ps.executeQuery()) {
            return rs.next() ? rs.getLong(1) : 0L;
        }
    }

    @Override
    public long uptimeMs() { return System.currentTimeMillis() - startedAt; }

    @Override
    public void close() {
        try { ds.close(); }
        catch (Exception e) { logger.log(Level.WARNING, "Closing nLogin pool failed", e); }
    }

    @Override
    public String backendName() { return "nlogin"; }

    @Override
    public String tableName() { return table; }

    private static long readEpochMillis(ResultSet rs, String column) throws SQLException {
        Object v = rs.getObject(column);
        if (v == null) return 0L;
        if (v instanceof Number) return ((Number) v).longValue();
        if (v instanceof Timestamp) return ((Timestamp) v).getTime();
        if (v instanceof java.sql.Date) return ((java.sql.Date) v).getTime();
        try { return Long.parseLong(v.toString()); }
        catch (NumberFormatException e) { return 0L; }
    }

    private static String sanitizeIdent(String name, String label) {
        if (name == null || !name.matches("[A-Za-z0-9_]+")) {
            throw new IllegalArgumentException("Invalid nLogin " + label + " identifier: " + name);
        }
        return name;
    }
}
