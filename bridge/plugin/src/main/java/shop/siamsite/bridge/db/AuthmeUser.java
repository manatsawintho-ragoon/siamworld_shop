package shop.siamsite.bridge.db;

public final class AuthmeUser {
    public final int id;
    public final String realName;
    public final String passwordHash;
    public final String email;
    public final long regDate;
    public final long lastLogin;

    public AuthmeUser(int id, String realName, String passwordHash,
                      String email, long regDate, long lastLogin) {
        this.id = id;
        this.realName = realName;
        this.passwordHash = passwordHash;
        this.email = email;
        this.regDate = regDate;
        this.lastLogin = lastLogin;
    }
}
