import http from "http";
import type { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";
import log from "../config/logger";
import { verifyAccessToken } from "../services/token.service";

const WS_PATH = "/api/v1";

type Client = WebSocket & { clientId: string };

const clients = new Set<Client>();

function roomKey(name: string): string {
  return `vegamart:room:${name}`;
}

function tokenFromQuery(req: IncomingMessage): string | null {
  const url = req.url ?? "/";
  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) return null;
  return new URLSearchParams(url.slice(queryIndex + 1)).get("token");
}

function authenticateWs(req: IncomingMessage, room: string): boolean {
  // Public broadcast room — anyone may listen to the roaming vendor map.
  if (room === "roaming") return true;
  // Vendor alerts and delivery order streams expose user-specific data.
  const requiresAuth = room.startsWith("vendor:") || room.startsWith("order:");
  if (!requiresAuth) return true;
  const token = tokenFromQuery(req);
  if (!token) return false;
  try {
    verifyAccessToken(token);
    return true;
  } catch {
    return false;
  }
}

function broadcast(room: string, type: string, data: unknown): void {
  const payload = JSON.stringify({ type, data });
  for (const client of clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    if (client.clientId.startsWith(room)) {
      client.send(payload);
    }
  }
}

function clientIdFor(room: string): string {
  return `${roomKey(room)}:${Math.random().toString(36).slice(2)}`;
}

function parseUrl(req: IncomingMessage): { path: string; segments: string[] } | null {
  const url = req.url ?? "/";
  const queryIndex = url.indexOf("?");
  const path = queryIndex >= 0 ? url.slice(0, queryIndex) : url;
  if (!path.startsWith(WS_PATH)) return null;
  const segments = path.slice(WS_PATH.length).split("/").filter(Boolean);
  return { path, segments };
}

let server: WebSocketServer | null = null;

function heartbeat(client: Client): void {
  (client as Client & { isAlive?: boolean }).isAlive = true;
}

function attach(client: Client): void {
  client.on("pong", () => heartbeat(client));
}

export function initRealtime(httpServer: http.Server): WebSocketServer {
  if (server) return server;

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const parsed = parseUrl(req);
    if (!parsed) {
      socket.destroy();
      return;
    }
    const room = resolveRoom(parsed.segments);
    if (room && !authenticateWs(req, room)) {
      socket.write(
        "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nWWW-Authenticate: Bearer\r\n\r\n"
      );
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const client = ws as Client;
      client.clientId = room ? clientIdFor(room) : `unknown:${Math.random().toString(36).slice(2)}`;
      clients.add(client);
      attach(client);
      wss.emit("connection", client, req);
    });
  });

  wss.on("connection", (client: Client) => {
    log.debug("WebSocket client connected", { context: "realtime", room: client.clientId.split(":")[2] ?? "none" });
  });

  const interval = setInterval(() => {
    for (const client of clients) {
      if ((client as Client & { isAlive?: boolean }).isAlive === false) {
        client.terminate();
        clients.delete(client);
        continue;
      }
      (client as Client & { isAlive?: boolean }).isAlive = false;
      client.ping();
    }
  }, 30_000);
  interval.unref();

  wss.on("close", () => {
    clearInterval(interval);
  });

  server = wss;
  log.info("WebSocket realtime layer initialized", { context: "realtime", path: WS_PATH });
  return wss;
}

function resolveRoom(segments: string[]): string | null {
  // /vendors/stream-roaming
  if (segments[0] === "vendors" && segments[1] === "stream-roaming") {
    return "roaming";
  }
  // /vendors/:vendor_id/stream-alerts
  if (segments[0] === "vendors" && segments[2] === "stream-alerts" && segments[1]) {
    return `vendor:${segments[1]}`;
  }
  // /delivery/order/:order_id/stream
  if (segments[0] === "delivery" && segments[1] === "order" && segments[3] === "stream" && segments[2]) {
    return `order:${segments[2]}`;
  }
  return null;
}

function publishToRoom(room: string, type: string, data: unknown): void {
  if (!server) return;
  broadcast(roomKey(room), type, data);
}

export const realtime = {
  publishRoamingVendor(vendorId: string, latitude: number, longitude: number): void {
    publishToRoom("roaming", "roaming_vendor_location", { vendor_id: vendorId, lat: latitude, lng: longitude });
  },
  publishVendorAlert(
    vendorId: string,
    data: { address: string; note?: string | null; customer_name: string }
  ): void {
    publishToRoom(`vendor:${vendorId}`, "gali_bell_alert", data);
  },
  publishOrderLocation(orderId: string, latitude: number, longitude: number): void {
    publishToRoom(`order:${orderId}`, "location_update", { lat: latitude, lng: longitude });
  },
  publishOrderEta(orderId: string, etaMinutes: number): void {
    publishToRoom(`order:${orderId}`, "order_eta_update", { eta: etaMinutes });
  },
  publishOrderStatus(orderId: string, status: string): void {
    publishToRoom(`order:${orderId}`, "order_status_update", { status });
  },
};
