package shop.siamsite.bridge.ws;

public enum ConnectionState {
    IDLE,        // shutdown / not started
    CONNECTING,  // socket opening
    OPEN,        // handshake complete, ready for traffic
    BACKOFF,     // disconnected, waiting to retry
    CLOSED       // terminal — only after shutdown()
}
