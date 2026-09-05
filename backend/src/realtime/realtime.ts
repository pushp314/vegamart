import http from "http";
import type { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";
import log from "../config/logger";
import { verifyAccessToken } from "../services/token.service";
import prisma from "../database/prisma";
import type { JwtAccessPayload } from "../types";

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

async function canJoinOrderRoom(payload: JwtAccessPayload, orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { user_id: true, delivery_partner_id: true },
  });
  if (!order) return false;
  if (order.user_id === payload.sub) return true;
  if (payload.role === "delivery" && order.delivery_partner_id) {
    const partner = await prisma.deliveryProfile.findFirst({
      where: { user_id: payload.sub },
      select: { id: true },
    });
    if (partner && order.delivery_partner_id === partner.id) return true;
  }
  if (payload.role === "vendor") {
    const item = await prisma.orderItem.findFirst({
      where: { order_id: orderId, product: { vendor: { user_id: payload.sub } } },
      select: { id: true },
    });
    if (item) return true;
  }
  return false;
}

async function canJoinVendorRoom(payload: JwtAccessPayload, vendorId: string): Promise<boolean> {
  const vendor = await prisma.vendorProfile.findFirst({
    where: { id: vendorId, user_id: payload.sub },
    select: { id: true },
  });
  return Boolean(vendor);
}

async function authenticateWs(req: IncomingMessage, room: string): Promise<boolean> {
  // Public broadcast room — anyone may listen to the roaming vendor map.
  if (room === "roaming" || room.startsWith("shop:")) return true;
  // Vendor alerts and delivery order streams expose user-specific data.
  const requiresAuth = room.startsWith("vendor:") || room.startsWith("order:");
  if (!requiresAuth) return true;
  const token = tokenFromQuery(req);
  if (!token) return false;
  let payload: JwtAccessPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return false;
  }
  if (room.startsWith("order:")) {
    return canJoinOrderRoom(payload, room.slice("order:".length));
  }
  if (room.startsWith("vendor:")) {
    return canJoinVendorRoom(payload, room.slice("vendor:".length));
  }
  return false;
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

  httpServer.on("upgrade", async (req, socket, head) => {
    const parsed = parseUrl(req);
    if (!parsed) {
      socket.destroy();
      return;
    }
    const room = resolveRoom(parsed.segments);
    const allowed = await authenticateWs(req, room ?? "");
    if (room && !allowed) {
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
  // /shop/:vendor_id/stream
  if (segments[0] === "shop" && segments[2] === "stream" && segments[1]) {
    return `shop:${segments[1]}`;
  }
  return null;
}

function publishToRoom(room: string, type: string, data: unknown): void {
  if (!server) return;
  broadcast(roomKey(room), type, data);
}

export interface VendorOrderEventData {
  order_id: string;
  order_number: string;
  total: number;
  items_count: number;
  customer_name?: string;
  customer_phone?: string;
  delivery_slot?: string;
  payment_method?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  created_at?: string;
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
  publishDeliveryAssigned(
    vendorId: string,
    data: {
      order_id: string;
      order_number: string;
      eta_minutes: number;
      delivery_partner: {
        id: string;
        name: string | null;
        phone: string | null;
        vehicle_type?: string | null;
        vehicle_number?: string | null;
      };
    }
  ): void {
    publishToRoom(`vendor:${vendorId}`, "delivery_partner_assigned", data);
  },
  publishVendorOrder(vendorId: string, data: VendorOrderEventData): void {
    publishToRoom(`vendor:${vendorId}`, "new_order_received", data);
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
  publishShopProductUpdate(vendorId: string, productId: string, data: { stock: number; is_available: boolean }): void {
    publishToRoom(`shop:${vendorId}`, "product_stock_update", { product_id: productId, ...data });
    publishToRoom(`vendor:${vendorId}`, "product_stock_update", { product_id: productId, ...data });
    publishToRoom("roaming", "product_stock_update", { vendor_id: vendorId, product_id: productId, ...data });
  },
};

