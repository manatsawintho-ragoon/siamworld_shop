package shop.siamsite.bridge.auth;

public final class AuthmeCredentials {
    public final String host;
    public final int port;
    public final String database;
    public final String user;
    public final String password;
    public final String table;

    public AuthmeCredentials(String host, int port, String database,
                              String user, String password, String table) {
        this.host = host;
        this.port = port;
        this.database = database;
        this.user = user;
        this.password = password;
        this.table = (table == null || table.isEmpty()) ? "authme" : table;
    }

    public String jdbcUrl() {
        return "jdbc:mysql://" + host + ":" + port + "/" + database
                + "?useSSL=false&allowPublicKeyRetrieval=true"
                + "&serverTimezone=UTC&characterEncoding=utf8"
                + "&connectTimeout=3000&socketTimeout=8000";
    }
}
