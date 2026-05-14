package shop.siamsite.bridge.ws;

import com.google.gson.JsonObject;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import shop.siamsite.bridge.SiamsiteBridgePlugin;
import shop.siamsite.bridge.opcode.OpcodeRouter;
import shop.siamsite.bridge.util.AsyncExecutor;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Outbound WSS client to the panel. Single connection at a time. On any
 * close/error we re-schedule a reconnect using exponential backoff with
 * jitter. Inbound frames are dispatched to {@link OpcodeRouter} which
 * does its DB / bcrypt work on the supplied {@link AsyncExecutor} —
 * <b>never</b> the MC main thread.
 */
public final class BridgeClient {

    private final SiamsiteBridgePlugin plugin;
    private final String url;
    private final String token;
    private final String pluginVersion;
    private final long initialBackoff;
    private final long maxBackoff;
    private final int maxInflight;
    private final OpcodeRouter router;
    private final AsyncExecutor executor;
    private final Logger logger;

    private final ScheduledExecutorService scheduler;
    private final AtomicLong requestsHandled = new AtomicLong();
    private final AtomicLong errorCount = new AtomicLong();
    private final AtomicLong reconnectCount = new AtomicLong();
    private final AtomicInteger inflight = new AtomicInteger();
    private final long createdAt = System.currentTimeMillis();

    private volatile WebSocketClient socket;
    private volatile ConnectionState state = ConnectionState.IDLE;
    private volatile long currentBackoff;
    private volatile boolean shuttingDown;
    private volatile String lastError;
    private ScheduledFuture<?> pendingReconnect;

    public BridgeClient(SiamsiteBridgePlugin plugin, String url, String token, String pluginVersion,
                        long initialBackoff, long maxBackoff, int maxInflight,
                        OpcodeRouter router, AsyncExecutor executor, Logger logger) {
        this.plugin = plugin;
        this.url = url;
        this.token = token;
        this.pluginVersion = pluginVersion;
        this.initialBackoff = initialBackoff;
        this.maxBackoff = maxBackoff;
        this.maxInflight = maxInflight;
        this.router = router;
        this.executor = executor;
        this.logger = logger;
        this.currentBackoff = initialBackoff;
        this.scheduler = new ScheduledThreadPoolExecutor(1, r -> {
            Thread t = new Thread(r, "siamsite-bridge-scheduler");
            t.setDaemon(true);
            return t;
        });
    }

    public void connect() {
        if (shuttingDown) return;
        if (state == ConnectionState.OPEN || state == ConnectionState.CONNECTING) return;
        state = ConnectionState.CONNECTING;

        URI uri;
        try {
            String q = "?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8)
                    + "&v=" + URLEncoder.encode(pluginVersion, StandardCharsets.UTF_8);
            uri = new URI(url + q);
        } catch (Exception e) {
            recordError("Invalid panel URL: " + e.getMessage());
            scheduleReconnect();
            return;
        }

        socket = new WebSocketClient(uri) {
            @Override public void onOpen(ServerHandshake handshake) {
                state = ConnectionState.OPEN;
                currentBackoff = initialBackoff;
                logger.info("Connected to " + url);
            }
            @Override public void onMessage(String message) {
                executor.submit(() -> handleFrame(message));
            }
            @Override public void onClose(int code, String reason, boolean remote) {
                handleDisconnect(code, reason);
            }
            @Override public void onError(Exception ex) {
                recordError(ex.getMessage());
            }
        };
        // 8s open timeout
        socket.setConnectionLostTimeout(40);
        try {
            socket.connect();
        } catch (Exception e) {
            recordError("connect() threw: " + e.getMessage());
            scheduleReconnect();
        }
    }

    private void handleFrame(String text) {
        Frame in;
        try {
            in = Frame.parse(text);
        } catch (Exception e) {
            errorCount.incrementAndGet();
            logger.warning("Malformed frame from panel: " + e.getMessage());
            return;
        }

        if ("ping".equals(in.op) && "evt".equals(in.kind)) {
            sendFrame(Frame.event(UUID.randomUUID().toString(), "pong", null));
            return;
        }
        if ("hello".equals(in.op) && "evt".equals(in.kind)) {
            JsonObject ack = new JsonObject();
            ack.addProperty("pluginVersion", pluginVersion);
            ack.addProperty("javaVersion", System.getProperty("java.version", "?"));
            ack.addProperty("mcServer", plugin.getServer().getName() + "-" + plugin.getServer().getBukkitVersion());
            ack.addProperty("authmeTable", "authme");
            ack.addProperty("tz", java.util.TimeZone.getDefault().getID());
            sendFrame(Frame.event(UUID.randomUUID().toString(), "hello_ack", ack));
            return;
        }

        if ("req".equals(in.kind)) {
            if (inflight.get() >= maxInflight) {
                sendFrame(Frame.errorResponse(in.id, in.op, "rate_limited", "Too many in-flight requests"));
                return;
            }
            inflight.incrementAndGet();
            requestsHandled.incrementAndGet();
            try {
                Frame out = router.dispatch(in);
                sendFrame(out);
            } catch (Throwable t) {
                errorCount.incrementAndGet();
                logger.log(Level.WARNING, "Dispatch failed for op=" + in.op, t);
                sendFrame(Frame.errorResponse(in.id, in.op, "db_error", safeMessage(t)));
            } finally {
                inflight.decrementAndGet();
            }
            return;
        }
        // Unknown evt — log and ignore.
        logger.fine("Ignored frame op=" + in.op + " kind=" + in.kind);
    }

    private void handleDisconnect(int code, String reason) {
        state = ConnectionState.BACKOFF;
        if (code == 4401) {
            recordError("Token rejected (4401). Issue a new token in the panel and run /siamsite-bridge reload.");
            // No use retrying with the same bad token — backoff to max so we
            // don't hammer the panel, but keep trying in case the operator
            // rotates the token without restarting.
            currentBackoff = maxBackoff;
        } else if (code == 4403) {
            recordError("Subscription inactive (4403). Renew your subscription in the panel.");
            currentBackoff = maxBackoff;
        } else {
            logger.info("Disconnected (code=" + code + ", reason=" + reason + ")");
        }
        scheduleReconnect();
    }

    private synchronized void scheduleReconnect() {
        if (shuttingDown) return;
        if (pendingReconnect != null && !pendingReconnect.isDone()) return;
        long jitter = (long) (Math.random() * 0.3 * currentBackoff);
        long delay = Math.min(maxBackoff, currentBackoff + jitter);
        pendingReconnect = scheduler.schedule(() -> {
            currentBackoff = Math.min(maxBackoff, currentBackoff * 2);
            reconnectCount.incrementAndGet();
            connect();
        }, delay, TimeUnit.MILLISECONDS);
    }

    public void forceReconnect() {
        try { if (socket != null) socket.close(); } catch (Exception ignored) {}
        currentBackoff = initialBackoff;
        connect();
    }

    private void sendFrame(Frame f) {
        WebSocketClient s = socket;
        if (s == null || !s.isOpen()) return;
        try { s.send(f.toJson()); }
        catch (Exception e) { errorCount.incrementAndGet(); logger.warning("Send failed: " + e.getMessage()); }
    }

    public void shutdown() {
        shuttingDown = true;
        state = ConnectionState.CLOSED;
        if (pendingReconnect != null) pendingReconnect.cancel(false);
        scheduler.shutdownNow();
        try { if (socket != null) socket.close(); } catch (Exception ignored) {}
    }

    private void recordError(String msg) {
        errorCount.incrementAndGet();
        lastError = msg;
        logger.warning("Bridge error: " + msg);
    }

    public ConnectionState state() { return state; }
    public long requestsHandled() { return requestsHandled.get(); }
    public long errorCount() { return errorCount.get(); }
    public long reconnectCount() { return reconnectCount.get(); }
    public long uptimeMs() { return System.currentTimeMillis() - createdAt; }
    public String lastErrorMessage() { return lastError; }

    private static String safeMessage(Throwable t) {
        String m = t.getMessage();
        return m == null ? t.getClass().getSimpleName() : m;
    }
}
