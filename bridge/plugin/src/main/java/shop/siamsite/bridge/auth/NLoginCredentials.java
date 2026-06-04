package shop.siamsite.bridge.auth;

/**
 * MySQL credentials + column mapping for the nLogin plugin.
 *
 * Unlike AuthMe, nLogin lets operators rename every column. We carry the
 * mapping alongside the credentials so the repository can build SQL
 * against the operator's actual schema.
 */
public final class NLoginCredentials {
    public final String host;
    public final int port;
    public final String database;
    public final String user;
    public final String password;
    public final String table;

    /** Column holding the last-known nickname (default: {@code last_name}). */
    public final String columnLastName;
    public final String columnPassword;
    public final String columnEmail;
    public final String columnCreationDate;
    public final String columnLastSeen;
    public final String columnId;

    public NLoginCredentials(String host, int port, String database,
                             String user, String password, String table,
                             String columnId,
                             String columnLastName, String columnPassword,
                             String columnEmail, String columnCreationDate,
                             String columnLastSeen) {
        this.host = host;
        this.port = port;
        this.database = database;
        this.user = user;
        this.password = password;
        this.table = nonEmpty(table, "nlogin");
        this.columnId = nonEmpty(columnId, "ai");
        // nLogin's stock default column is `username` (case-preserved nickname).
        this.columnLastName = nonEmpty(columnLastName, "username");
        this.columnPassword = nonEmpty(columnPassword, "password");
        this.columnEmail = nonEmpty(columnEmail, "email");
        this.columnCreationDate = nonEmpty(columnCreationDate, "creation_date");
        this.columnLastSeen = nonEmpty(columnLastSeen, "last_seen");
    }

    public String jdbcUrl() {
        return "jdbc:mysql://" + host + ":" + port + "/" + database
                + "?useSSL=false&allowPublicKeyRetrieval=true"
                + "&serverTimezone=UTC&useUnicode=true&characterEncoding=utf8"
                + "&connectTimeout=3000&socketTimeout=8000";
    }

    private static String nonEmpty(String s, String fallback) {
        return (s == null || s.isEmpty()) ? fallback : s;
    }
}
