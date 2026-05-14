package shop.siamsite.bridge.ws;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

/**
 * Bridge wire frame: { id, op, kind, data?, err? }. We keep the payload as a
 * raw JsonElement so opcode handlers can re-serialize without us needing a
 * generated class for every variant.
 */
public final class Frame {

    public final String id;
    public final String op;
    public final String kind;       // "req" | "res" | "evt"
    public final JsonElement data;
    public final JsonObject err;

    public Frame(String id, String op, String kind, JsonElement data, JsonObject err) {
        this.id = id;
        this.op = op;
        this.kind = kind;
        this.data = data;
        this.err = err;
    }

    public static Frame parse(String text) {
        JsonObject o = JsonParser.parseString(text).getAsJsonObject();
        return new Frame(
                getStr(o, "id"),
                getStr(o, "op"),
                getStr(o, "kind"),
                o.has("data") ? o.get("data") : null,
                o.has("err") && o.get("err").isJsonObject() ? o.getAsJsonObject("err") : null);
    }

    public String toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("id", id);
        o.addProperty("op", op);
        o.addProperty("kind", kind);
        if (data != null) o.add("data", data);
        if (err != null) o.add("err", err);
        return o.toString();
    }

    public static Frame response(String id, String op, JsonElement data) {
        return new Frame(id, op, "res", data, null);
    }

    public static Frame errorResponse(String id, String op, String code, String message) {
        JsonObject err = new JsonObject();
        err.addProperty("code", code);
        err.addProperty("message", message);
        return new Frame(id, op, "res", null, err);
    }

    public static Frame event(String id, String op, JsonElement data) {
        return new Frame(id, op, "evt", data, null);
    }

    private static String getStr(JsonObject o, String key) {
        return o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : null;
    }
}
