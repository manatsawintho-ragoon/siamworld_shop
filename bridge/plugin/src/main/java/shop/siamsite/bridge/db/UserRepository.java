package shop.siamsite.bridge.db;

import java.sql.SQLException;

public interface UserRepository {

    BridgeUser findByUsername(String username) throws SQLException;

    void updatePassword(String username, String plaintext) throws SQLException;

    long rowCount() throws SQLException;

    long uptimeMs();

    void close();

    String backendName();

    String tableName();
}
