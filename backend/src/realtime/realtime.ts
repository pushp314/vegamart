import http from "http";
import type { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";
import log from "../config/logger";
import { verifyAccessToken } from "../services/token.service";
import { consumeRealtimeTicket } from "../services/realtime-ticket.service";
import prisma from "../database/prisma";
import type { JwtAccessPayload } from "../types";

const WS_PATH = "/api/v1";

type Client = WebSocket & { clientId: string; isAlive?: boolean; rooms?: Set<string> };

const clients = new Set<Client>();
const rooms = new Map<string, Set<Client>>();

function getQueryParam(req: IncomingMessage, paramName: string): string | null {
  const url = req.url ?? "/";
  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) return null;
  return new URLSearchParams(url.slice(queryIndex + 1)).get(paramName);
}

function addClientToRoom(room: string, client: Client): void {
  let set = rooms.get(room);
  if (!set) {
    set = new Set<Client>();
    rooms.set(room, set);
  }
  set.add(client);
  if (!client.rooms) {
    client.rooms = new Set<string>();
  }
  client.rooms.add(room);
}

function removeClientFromAllRooms(client: Client): void {
  if (client.rooms) {
    for (const room of client.rooms) {
      const set = rooms.get(room);
      if (set) {
        set.delete(client);
        if (set.size === 0) {
          rooms.delete(room);
        }
      }
    }
    client.rooms.clear();
  }
  clients.delete(client);
}

async function canJoinOrderRoom(payload: JwtAccessPayload, orderId: string): Promise<boolean> {
  const role = String(payload.role || "").toLowerCase();
  if (role === "admin" || role === "super_admin") {
    return true;
  }

  // Check sub-order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { user_id: true, delivery_partner_id: true, master_order_id: true },
  });
  if (order) {
    if (order.user_id === payload.sub) return true;
    if (role === "delivery" && order.delivery_partner_id) {
      const partner = await prisma.deliveryProfile.findFirst({
        where: { user_id: payload.sub },
        select: { id: true },
      });
      if (partner && order.delivery_partner_id === partner.id) return true;
    }
    if (role === "vendor") {
      const item = await prisma.orderItem.findFirst({
        where: { order_id: orderId, product: { vendor: { user_id: payload.sub } } },
        select: { id: true },
      });
      if (item) return true;
    }
    // Also check master order ownership if applicable
    if (order.master_order_id) {
      const parentMaster = await prisma.masterOrder.findUnique({
        where: { id: order.master_order_id },
        select: { user_id: true, delivery_partner_id: true },
      });
      if (parentMaster) {
        if (parentMaster.user_id === payload.sub) return true;
        if (role === "delivery" && parentMaster.delivery_partner_id) {
          const partner = await prisma.deliveryProfile.findFirst({
            where: { user_id: payload.sub },
            select: { id: true },
          });
          if (partner && parentMaster.delivery_partner_id === partner.id) return true;
        }
      }
    }
    return false;
  }

  // Check master order
  const masterOrder = await prisma.masterOrder.findUnique({
    where: { id: orderId },
    select: { user_id: true, delivery_partner_id: true },
  });
  if (masterOrder) {
    if (masterOrder.user_id === payload.sub) return true;
    if (role === "delivery" && masterOrder.delivery_partner_id) {
      const partner = await prisma.deliveryProfile.findFirst({
        where: { user_id: payload.sub },
        select: { id: true },
      });
      if (partner && masterOrder.delivery_partner_id === partner.id) return true;
    }
    if (role === "vendor") {
      const item = await prisma.orderItem.findFirst({
        where: { order: { master_order_id: orderId }, product: { vendor: { user_id: payload.sub } } },
        select: { id: true },
      });
      if (item) return true;
    }
  }

  return false;
}

async function canJoinVendorRoom(payload: JwtAccessPayload, vendorId: string): Promise<boolean> {
  const role = String(payload.role || "").toLowerCase();
  if (role === "admin" || role === "super_admin") {
    return true;
  }
  const vendor = await prisma.vendorProfile.findFirst({
    where: { id: vendorId, user_id: payload.sub },
    select: { id: true },
  });
  return Boolean(vendor);
}

async function authenticateWs(req: IncomingMessage, room: string): Promise<boolean> {
  // Public broadcast room — anyone may listen to roaming vendors or public shop stock
  if (room === "roaming" || room.startsWith("shop:")) return true;

  const requiresAuth =
    room.startsWith("vendor:") ||
    room.startsWith("order:") ||
    room.startsWith("tracking:order:");
  if (!requiresAuth) return true;

  let payload: JwtAccessPayload | null = null;

  // 1. Try short-lived single-use WS ticket first (preferred for live tracking)
  const ticket = getQueryParam(req, "ticket");
  if (ticket) {
    payload = await consumeRealtimeTicket(ticket);
  }

  // 2. Fall back to JWT in query string for backward compatibility
  if (!payload) {
    const token = getQueryParam(req, "token");
    if (token) {
      try {
        payload = verifyAccessToken(token);
      } catch {
        payload = null;
      }
    }
  }

  if (room.startsWith("order:") || room.startsWith("tracking:order:")) {
    if (payload) {
      const orderId = room.startsWith("order:")
        ? room.slice("order:".length)
        : room.slice("tracking:order:".length);
      return canJoinOrderRoom(payload, orderId);
    }
    // Live tracking fallback: allow client to stream active delivery updates if the order exists
    const rawOrderId = room.startsWith("order:")
      ? room.slice("order:".length)
      : room.slice("tracking:order:".length);
    const orderExists =
      (await prisma.masterOrder.findUnique({
        where: { id: rawOrderId },
        select: { id: true },
      })) ||
      (await prisma.order.findUnique({
        where: { id: rawOrderId },
        select: { id: true },
      }));
    if (orderExists) return true;
  }

  if (!payload) return false;

  if (room.startsWith("vendor:")) {
    const vendorId = room.slice("vendor:".length);
    return canJoinVendorRoom(payload, vendorId);
  }

  return false;
}

function broadcast(room: string, type: string, data: unknown): void {
  const set = rooms.get(room);
  if (!set || set.size === 0) return;

  const payload = JSON.stringify({ type, data });
  for (const client of set) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function parseUrl(req: IncomingMessage): { path: string; segments: string[] } | null {
  const url = req.url ?? "/";
  const queryIndex = url.indexOf("?");
  const rawPath = queryIndex >= 0 ? url.slice(0, queryIndex) : url;
  // Support both /api/v1 prefix and bare /delivery/... paths seamlessly
  const path = rawPath.startsWith(WS_PATH) ? rawPath.slice(WS_PATH.length) : rawPath;
  const segments = path.split("/").filter(Boolean);
  return { path, segments };
}

let server: WebSocketServer | null = null;

function heartbeat(client: Client): void {
  client.isAlive = true;
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
    wss.handleUpgrade(req, socket, head, async (ws) => {
      const client = ws as Client;
      client.isAlive = true;
      client.rooms = new Set<string>();
      client.clientId = `${room ?? "unknown"}:${Math.random().toString(36).slice(2)}`;
      clients.add(client);
      attach(client);

      if (room) {
        addClientToRoom(room, client);

        // Canonical order ID resolution: if client joins an order stream, ensure they are
        // in both order:${id} and canonical tracking:order:${masterOrderId}
        if (room.startsWith("order:")) {
          const rawId = room.slice("order:".length);
          try {
            const sub = await prisma.order.findUnique({
              where: { id: rawId },
              select: { master_order_id: true },
            });
            if (sub?.master_order_id) {
              addClientToRoom(`order:${sub.master_order_id}`, client);
              addClientToRoom(`tracking:order:${sub.master_order_id}`, client);
            } else {
              addClientToRoom(`tracking:order:${rawId}`, client);
            }
          } catch {
            // Safe fallback if DB lookup fails
            addClientToRoom(`tracking:order:${rawId}`, client);
          }
        } else if (room.startsWith("tracking:order:")) {
          const rawId = room.slice("tracking:order:".length);
          try {
            const sub = await prisma.order.findUnique({
              where: { id: rawId },
              select: { master_order_id: true },
            });
            if (sub?.master_order_id) {
              addClientToRoom(`tracking:order:${sub.master_order_id}`, client);
              addClientToRoom(`order:${sub.master_order_id}`, client);
            } else {
              addClientToRoom(`order:${rawId}`, client);
            }
          } catch {
            addClientToRoom(`order:${rawId}`, client);
          }
        }
      }

      client.on("close", () => {
        removeClientFromAllRooms(client);
      });

      client.on("error", () => {
        removeClientFromAllRooms(client);
      });

      wss.emit("connection", client, req);
    });
  });

  wss.on("connection", (client: Client) => {
    log.debug("WebSocket client connected", {
      context: "realtime",
      rooms: Array.from(client.rooms ?? []),
    });
  });

  // 30s heartbeat to prune stale/dead mobile sockets and prevent memory leaks
  const interval = setInterval(() => {
    for (const client of clients) {
      if (client.isAlive === false) {
        client.terminate();
        removeClientFromAllRooms(client);
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 30_000);
  interval.unref();

  wss.on("close", () => {
    clearInterval(interval);
  });

  server = wss;
  log.info("WebSocket realtime layer initialized with exact room matching", {
    context: "realtime",
    path: WS_PATH,
  });
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
  // /tracking/order/:order_id/stream
  if (segments[0] === "tracking" && segments[1] === "order" && segments[3] === "stream" && segments[2]) {
    return `tracking:order:${segments[2]}`;
  }
  // /shop/:vendor_id/stream
  if (segments[0] === "shop" && segments[2] === "stream" && segments[1]) {
    return `shop:${segments[1]}`;
  }
  return null;
}

function publishToRoom(room: string, type: string, data: unknown): void {
  if (!server) return;
  broadcast(room, type, data);
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
  getSubscriberCount(room: string): number {
    const set = rooms.get(room);
    if (!set) return 0;
    let count = 0;
    for (const client of set) {
      if (client.readyState === WebSocket.OPEN) count++;
    }
    return count;
  },

  getOrderTrackingSubscriberCount(masterOrderId: string): number {
    return (
      this.getSubscriberCount(`tracking:order:${masterOrderId}`) +
      this.getSubscriberCount(`order:${masterOrderId}`)
    );
  },

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

  publishTrackingUpdate(masterOrderId: string, data: unknown): void {
    publishToRoom(`tracking:order:${masterOrderId}`, "location_update", data);
    publishToRoom(`order:${masterOrderId}`, "location_update", data);
  },

  publishTrackingEnded(masterOrderId: string, reason: string): void {
    publishToRoom(`tracking:order:${masterOrderId}`, "tracking:ended", { masterOrderId, reason });
    publishToRoom(`order:${masterOrderId}`, "tracking:ended", { masterOrderId, reason });
  },

  publishShopProductUpdate(vendorId: string, productId: string, data: { stock: number; is_available: boolean }): void {
    publishToRoom(`shop:${vendorId}`, "product_stock_update", { product_id: productId, ...data });
    publishToRoom(`vendor:${vendorId}`, "product_stock_update", { product_id: productId, ...data });
    publishToRoom("roaming", "product_stock_update", { vendor_id: vendorId, product_id: productId, ...data });
  },
};
