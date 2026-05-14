package shop.siamsite.bridge.auth;

import at.favre.lib.crypto.bcrypt.BCrypt;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Verifies a plaintext password against an AuthMe hash. Supports the two
 * algorithms 99% of AuthMe deployments use:
 *
 *   - Bcrypt ($2a$ / $2b$ / $2y$) — recommended/default in AuthMe 5.6+
 *   - AuthMe SHA256 ($SHA$salt$hash) — historical default; hash =
 *       sha256( sha256(password) + salt )
 *
 * Unknown algorithms throw UnsupportedAlgorithmException so the bridge can
 * return a clear `unsupported` error rather than silently saying "wrong password".
 */
public final class PasswordVerifier {

    private PasswordVerifier() {}

    public static boolean verify(String password, String storedHash) {
        if (storedHash == null || storedHash.isEmpty()) return false;

        if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
            return verifyBcrypt(password, storedHash);
        }
        if (storedHash.startsWith("$SHA$")) {
            return verifyAuthmeSha256(password, storedHash);
        }
        throw new UnsupportedAlgorithmException(detectAlgorithm(storedHash));
    }

    private static boolean verifyBcrypt(String password, String hash) {
        // BCrypt only handles the first 72 bytes; AuthMe does the same so behavior matches.
        return BCrypt.verifyer().verify(password.toCharArray(), hash).verified;
    }

    private static boolean verifyAuthmeSha256(String password, String hash) {
        String[] parts = hash.split("\\$");
        // Format: ["", "SHA", salt, hashHex]
        if (parts.length != 4) return false;
        String salt = parts[2];
        String expected = parts[3];
        String inner = sha256Hex(password);
        String outer = sha256Hex(inner + salt);
        return constantTimeEquals(outer, expected);
    }

    private static String detectAlgorithm(String hash) {
        if (hash.startsWith("$argon2")) return "argon2";
        if (hash.startsWith("$pbkdf2")) return "pbkdf2";
        if (hash.startsWith("$1$"))     return "md5crypt";
        if (hash.startsWith("$6$"))     return "sha512crypt";
        // Fall back to a stable prefix tag for the error message.
        int dollar = hash.indexOf('$', 1);
        return dollar > 0 ? hash.substring(0, dollar) : "unknown";
    }

    private static String sha256Hex(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] out = md.digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(out.length * 2);
            for (byte b : out) sb.append(Character.forDigit((b >> 4) & 0xF, 16))
                                 .append(Character.forDigit(b & 0xF, 16));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable in JVM", e);
        }
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null || a.length() != b.length()) return false;
        int diff = 0;
        for (int i = 0; i < a.length(); i++) diff |= a.charAt(i) ^ b.charAt(i);
        return diff == 0;
    }

    public static final class UnsupportedAlgorithmException extends RuntimeException {
        public final String algorithm;
        public UnsupportedAlgorithmException(String algorithm) {
            super("Unsupported AuthMe password algorithm: " + algorithm);
            this.algorithm = algorithm;
        }
    }
}
