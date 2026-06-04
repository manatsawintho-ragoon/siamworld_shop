package shop.siamsite.bridge.opcode;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import shop.siamsite.bridge.SiamsiteBridgePlugin;
import shop.siamsite.bridge.auth.PasswordVerifier;
import shop.siamsite.bridge.db.BridgeUser;
import shop.siamsite.bridge.db.UserRepository;
import shop.siamsite.bridge.util.AsyncExecutor;
import shop.siamsite.bridge.ws.Frame;

/**
 * Dispatches a panel request frame to the correct handler and returns the
 * response frame. Invoked from the WS read loop on the AsyncExecutor pool —
 * synchronous from the caller's POV. The exec param is reserved for handlers
 * that need to fan out further; current opcodes do all their work inline.
 */
public final class OpcodeRouter {

    private final SiamsiteBridgePlugin plugin;
    private final UserRepository repo;
    @SuppressWarnings("unused") private final AsyncExecutor executor;

    public OpcodeRouter(SiamsiteBridgePlugin plugin, UserRepository repo, AsyncExecutor executor) {
        this.plugin = plugin;
        this.repo = repo;
        this.executor = executor;
    }

    public Frame dispatch(Frame in) {
        if (repo == null) {
            return Frame.errorResponse(in.id, in.op, "db_error",
                    "User repository not initialized — check plugin startup logs");
        }
        try {
            switch (in.op) {
                case "verify_authme":   return verify(in);
                case "lookup_user":     return lookup(in);
                case "update_password": return updatePassword(in);
                case "health":          return health(in);
                default:
                    return Frame.errorResponse(in.id, in.op, "unsupported",
                            "Unknown opcode: " + in.op);
            }
        } catch (Exception e) {
            return Frame.errorResponse(in.id, in.op, "db_error",
                    e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
        }
    }

    private Frame verify(Frame in) throws Exception {
        JsonObject d = data(in);
        String username = str(d, "username");
        String password = str(d, "password");
        if (username == null || password == null) {
            return Frame.errorResponse(in.id, in.op, "bad_request", "username/password required");
        }
        BridgeUser u = repo.findByUsername(username);
        if (u == null) {
            return Frame.response(in.id, in.op, failResp("unknown_user"));
        }
        // nLogin stores NULL password for premium-only / not-yet-registered accounts.
        // Treat as unknown_user — there's nothing to verify against.
        if (u.passwordHash == null || u.passwordHash.isEmpty()) {
            return Frame.response(in.id, in.op, failResp("unknown_user"));
        }
        boolean ok;
        try {
            ok = PasswordVerifier.verify(password, u.passwordHash);
        } catch (PasswordVerifier.UnsupportedAlgorithmException uae) {
            return Frame.errorResponse(in.id, in.op, "unsupported",
                    "Password hash algorithm '" + uae.algorithm + "' not supported by bridge");
        }
        if (!ok) return Frame.response(in.id, in.op, failResp("bad_password"));

        JsonObject ok2 = new JsonObject();
        ok2.addProperty("ok", true);
        ok2.addProperty("userId", u.id);
        ok2.addProperty("email", u.email);
        return Frame.response(in.id, in.op, ok2);
    }

    private Frame lookup(Frame in) throws Exception {
        JsonObject d = data(in);
        String username = str(d, "username");
        if (username == null) return Frame.errorResponse(in.id, in.op, "bad_request", "username required");
        BridgeUser u = repo.findByUsername(username);
        JsonObject out = new JsonObject();
        if (u == null) {
            out.addProperty("exists", false);
            return Frame.response(in.id, in.op, out);
        }
        out.addProperty("exists", true);
        out.addProperty("userId", u.id);
        out.addProperty("email", u.email);
        out.addProperty("regdate", u.regDate);
        out.addProperty("lastLogin", u.lastLogin);
        return Frame.response(in.id, in.op, out);
    }

    private Frame updatePassword(Frame in) throws Exception {
        JsonObject d = data(in);
        String username = str(d, "username");
        String newPassword = str(d, "newPassword");
        if (username == null || newPassword == null) {
            return Frame.errorResponse(in.id, in.op, "bad_request", "username/newPassword required");
        }
        if (newPassword.length() < 6) {
            return Frame.errorResponse(in.id, in.op, "bad_request", "password too short");
        }
        repo.updatePassword(username, newPassword);
        JsonObject ok = new JsonObject();
        ok.addProperty("ok", true);
        return Frame.response(in.id, in.op, ok);
    }

    private Frame health(Frame in) {
        JsonObject out = new JsonObject();
        try {
            long rows = repo.rowCount();
            out.addProperty("dbReachable", true);
            out.addProperty("tableRows", rows);
            // Backward-compat alias for older panel builds that read `authmeRows`.
            out.addProperty("authmeRows", rows);
            out.add("lastError", null);
        } catch (Exception e) {
            out.addProperty("dbReachable", false);
            out.addProperty("tableRows", 0);
            out.addProperty("authmeRows", 0);
            out.addProperty("lastError", e.getMessage());
        }
        out.addProperty("uptimeMs", repo.uptimeMs());
        out.addProperty("pluginVersion", SiamsiteBridgePlugin.PLUGIN_VERSION);
        out.addProperty("backend", repo.backendName());
        out.addProperty("table", repo.tableName());
        out.addProperty("mcServer", plugin.getServer().getName() + "-" + plugin.getServer().getBukkitVersion());
        return Frame.response(in.id, in.op, out);
    }

    private static JsonObject failResp(String reason) {
        JsonObject o = new JsonObject();
        o.addProperty("ok", false);
        o.addProperty("reason", reason);
        return o;
    }

    private static JsonObject data(Frame in) {
        if (in.data == null || !in.data.isJsonObject()) return new JsonObject();
        return in.data.getAsJsonObject();
    }

    private static String str(JsonObject o, String key) {
        JsonElement v = o.get(key);
        return (v == null || v.isJsonNull()) ? null : v.getAsString();
    }
}
