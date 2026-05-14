package shop.siamsite.bridge.cmd;

import org.bukkit.ChatColor;
import org.bukkit.command.CommandSender;
import shop.siamsite.bridge.SiamsiteBridgePlugin;
import shop.siamsite.bridge.ws.BridgeClient;
import shop.siamsite.bridge.ws.ConnectionState;

public final class BridgeCommand {

    private BridgeCommand() {}

    public static boolean handle(SiamsiteBridgePlugin plugin, CommandSender sender, String[] args) {
        if (args.length == 0) {
            sendUsage(sender);
            return true;
        }
        String sub = args[0].toLowerCase();
        switch (sub) {
            case "status": return status(plugin, sender);
            case "stats": return stats(plugin, sender);
            case "reload": return reload(plugin, sender);
            case "reconnect": return reconnect(plugin, sender);
            default:
                sendUsage(sender);
                return true;
        }
    }

    private static boolean status(SiamsiteBridgePlugin plugin, CommandSender sender) {
        BridgeClient c = plugin.getClient();
        ConnectionState s = c == null ? ConnectionState.IDLE : c.state();
        send(sender, ChatColor.AQUA + "SiamsiteBridge v" + SiamsiteBridgePlugin.PLUGIN_VERSION
                + " (" + SiamsiteBridgePlugin.PROTOCOL_VERSION + ")");
        send(sender, "  Connection: " + colorState(s) + s.name());
        send(sender, "  Endpoint:   " + plugin.getConfig().getString("panel.url"));
        if (c != null && c.lastErrorMessage() != null) {
            send(sender, ChatColor.RED + "  Last error: " + c.lastErrorMessage());
        }
        return true;
    }

    private static boolean stats(SiamsiteBridgePlugin plugin, CommandSender sender) {
        BridgeClient c = plugin.getClient();
        if (c == null) { send(sender, ChatColor.YELLOW + "Bridge client not started."); return true; }
        send(sender, ChatColor.AQUA + "Bridge stats");
        send(sender, "  Requests handled: " + c.requestsHandled());
        send(sender, "  Errors:           " + c.errorCount());
        send(sender, "  Reconnects:       " + c.reconnectCount());
        send(sender, "  Uptime:           " + (c.uptimeMs() / 1000) + "s");
        return true;
    }

    private static boolean reload(SiamsiteBridgePlugin plugin, CommandSender sender) {
        send(sender, ChatColor.AQUA + "Reloading SiamsiteBridge...");
        plugin.restart();
        send(sender, ChatColor.GREEN + "Reloaded. Run /siamsite-bridge status to verify.");
        return true;
    }

    private static boolean reconnect(SiamsiteBridgePlugin plugin, CommandSender sender) {
        BridgeClient c = plugin.getClient();
        if (c == null) { send(sender, ChatColor.YELLOW + "Bridge client not started."); return true; }
        c.forceReconnect();
        send(sender, ChatColor.GREEN + "Reconnect triggered.");
        return true;
    }

    private static void sendUsage(CommandSender s) {
        send(s, ChatColor.AQUA + "Usage:");
        send(s, "  /siamsite-bridge status");
        send(s, "  /siamsite-bridge stats");
        send(s, "  /siamsite-bridge reload");
        send(s, "  /siamsite-bridge reconnect");
    }

    private static void send(CommandSender s, String msg) { s.sendMessage(msg); }

    private static String colorState(ConnectionState s) {
        switch (s) {
            case OPEN: return ChatColor.GREEN.toString();
            case CONNECTING: return ChatColor.YELLOW.toString();
            case BACKOFF: return ChatColor.GOLD.toString();
            default: return ChatColor.RED.toString();
        }
    }
}
