package shop.siamsite.bridge.util;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Dedicated thread pool for all bridge work. Sized small so we never starve
 * the MC server's own threads; bounded queue ensures back-pressure rather
 * than unlimited memory growth.
 */
public final class AsyncExecutor {

    private final ExecutorService executor;
    private final Logger logger;

    public AsyncExecutor(int threads, Logger logger) {
        this.logger = logger;
        AtomicInteger n = new AtomicInteger(1);
        ThreadFactory factory = r -> {
            Thread t = new Thread(r, "siamsite-bridge-" + n.getAndIncrement());
            t.setDaemon(true);
            return t;
        };
        // Fixed-size pool with a bounded queue. 1024 is generous — protocol caps
        // in-flight at 256 anyway, so anything over that is bridge bookkeeping.
        this.executor = new ThreadPoolExecutor(
                threads, threads, 0, TimeUnit.MILLISECONDS,
                new LinkedBlockingQueue<>(1024),
                factory,
                (r, ex) -> logger.warning("Bridge task rejected: queue full"));
    }

    public void submit(Runnable r) {
        executor.submit(() -> {
            try { r.run(); }
            catch (Throwable t) {
                logger.log(Level.SEVERE, "Bridge async task failed", t);
            }
        });
    }

    public void shutdown() {
        executor.shutdownNow();
    }
}
