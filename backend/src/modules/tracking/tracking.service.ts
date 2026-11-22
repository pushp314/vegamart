import prisma from "../../database/prisma";
import { redis, isRedisAvailable } from "../../database/redis";
import { memoryCacheGet, memoryCacheSet, memoryCacheDel } from "../../database/cache-memory";
import log from "../../config/logger";
import { loadEnv } from "../../config/env";
import { realtime } from "../../realtime/realtime";
import {
  validateGpsPing,
  smoothSpeedEma,
  snapToPolyline,
  computeRemainingDistanceAndEta,
  detectOffRoute,
} from "./tracking.algo";
import { routingService } from "./route.provider";
import type {
  GPSPingPayload,
  LiveTrackingState,
  LiveTrackingSnapshot,
  DecodedRoadRoute,
  CompactLocationUpdate,
} from "./tracking.types";
import { isVegaMartDeliveryPartnerOrder } from "../../services/delivery.service";
import { trackingCreditService } from "../../services/tracking-credit.service";

const LIVE_PREFIX = "vegamart:tracking:live:";
const ROUTE_PREFIX = "vegamart:tracking:route:";
const RIDER_RATE_PREFIX = "vegamart:tracking:rider_rate:";

const LIVE_TTL_SECONDS = 120;
const ROUTE_TTL_SECONDS = 7200;
const DB_PERSIST_INTERVAL_MS = 45_000;
const STATIONARY_REFRESH_INTERVAL_MS = 20_000;
const REROUTE_COOLDOWN_MS = 60_000;

export class TrackingService {
  // ── Redis / Memory hot store helpers ──────────────────────────────────────────

  private async getCacheJson<T>(key: string): Promise<T | null> {
    if (isRedisAvailable() && redis) {
      try {
        const data = await redis.get(key);
        if (data) return JSON.parse(data) as T;
      } catch (err) {
        log.warn("Redis error on get, falling back to memory", {
          context: "tracking-service",
          key,
          error: (err as Error).message,
        });
      }
    }
    const mem = memoryCacheGet(key);
    if (mem) {
      try {
        return JSON.parse(mem) as T;
      } catch {
        return null;
      }
    }
    return null;
  }

  private async setCacheJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (isRedisAvailable() && redis) {
      try {
        await redis.set(key, serialized, "EX", ttlSeconds);
        return;
      } catch (err) {
        log.warn("Redis error on set, falling back to memory", {
          context: "tracking-service",
          key,
          error: (err as Error).message,
        });
      }
    }
    memoryCacheSet(key, serialized, ttlSeconds);
  }

  private async delCache(key: string): Promise<void> {
    if (isRedisAvailable() && redis) {
      try {
        await redis.del(key);
      } catch (err) {
        log.warn("Redis error on del", {
          context: "tracking-service",
          key,
          error: (err as Error).message,
        });
      }
    }
    memoryCacheDel(key);
  }

  // ── Route Cache & Waypoint Calculation ────────────────────────────────────────

  async getOrCalculateRoadRoute(
    masterOrderId: string,
    riderPos: { lat: number; lng: number },
    forceRecalculate = false
  ): Promise<DecodedRoadRoute | null> {
    const routeKey = `${ROUTE_PREFIX}${masterOrderId}`;
    if (!forceRecalculate) {
      const cached = await this.getCacheJson<DecodedRoadRoute>(routeKey);
      if (cached && cached.points.length > 0) {
        return cached;
      }
    }

    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: masterOrderId },
      include: {
        orders: {
          include: {
            vendor: true,
          },
        },
      },
    });

    if (!masterOrder) return null;

    // Resolve delivery address coordinates
    let deliveryCoords: { lat: number; lng: number } | null = null;
    if (masterOrder.address_id) {
      const addr = await prisma.address.findUnique({
        where: { id: masterOrder.address_id },
        select: { latitude: true, longitude: true },
      });
      if (addr?.latitude && addr?.longitude) {
        deliveryCoords = { lat: addr.latitude, lng: addr.longitude };
      }
    }

    if (!deliveryCoords) {
      // Fallback: try raw json address
      const rawAddr = (masterOrder as any).delivery_address;
      if (rawAddr?.latitude && rawAddr?.longitude) {
        deliveryCoords = { lat: Number(rawAddr.latitude), lng: Number(rawAddr.longitude) };
      }
    }

    if (!deliveryCoords) {
      log.warn("No valid delivery coordinates found for order routing", {
        context: "tracking-service",
        masterOrderId,
      });
      return null;
    }

    // Waypoints sequence: [riderPos, ...unpickedVendors, deliveryCoords]
    const waypoints: Array<{ lat: number; lng: number }> = [{ ...riderPos }];

    // Check which sub-orders still need pickup
    for (const sub of masterOrder.orders) {
      const isPickedUp = sub.status === "PICKED_UP" || sub.status === "OUT_FOR_DELIVERY";
      if (!isPickedUp && sub.vendor?.latitude && sub.vendor?.longitude) {
        waypoints.push({
          lat: sub.vendor.latitude,
          lng: sub.vendor.longitude,
        });
      }
    }

    waypoints.push(deliveryCoords);

    const calculated = await routingService.calculateRoute(waypoints);
    const existing = await this.getCacheJson<DecodedRoadRoute>(routeKey);
    const newVersion = (existing?.version ?? 0) + 1;

    const roadRoute: DecodedRoadRoute = {
      points: calculated.points,
      distanceMeters: calculated.distanceMeters,
      durationSeconds: calculated.durationSeconds,
      version: newVersion,
      updatedAt: Date.now(),
      provider: calculated.provider,
    };

    await this.setCacheJson(routeKey, roadRoute, ROUTE_TTL_SECONDS);
    return roadRoute;
  }

  // ── Canonical Ingestion Path ──────────────────────────────────────────────────

  async ingestLocation(
    userId: string,
    payload: GPSPingPayload
  ): Promise<{ success: boolean; dropped?: boolean; reason?: string }> {
    const env = loadEnv();
    if (!env.LIVE_TRACKING_ENABLED) {
      return { success: true, dropped: true, reason: "LIVE_TRACKING_DISABLED" };
    }

    const partner = await prisma.deliveryProfile.findFirst({
      where: { user_id: userId },
      select: { id: true, is_available: true },
    });

    if (!partner) {
      return { success: false, dropped: true, reason: "DELIVERY_PROFILE_NOT_FOUND" };
    }

    const now = Date.now();
    const rateLimitKey = `${RIDER_RATE_PREFIX}${partner.id}`;

    // Rate limiter: max 1 accepted GPS ping per 2 seconds
    if (isRedisAvailable() && redis) {
      const exists = await redis.get(rateLimitKey);
      if (exists) {
        return { success: true, dropped: true, reason: "RATE_LIMITED_2S" };
      }
      await redis.set(rateLimitKey, "1", "EX", 2);
    } else {
      const exists = memoryCacheGet(rateLimitKey);
      if (exists) {
        return { success: true, dropped: true, reason: "RATE_LIMITED_2S" };
      }
      memoryCacheSet(rateLimitKey, "1", 2);
    }

    // Find active Master Orders assigned to this partner
    const activeMasterOrders = await prisma.masterOrder.findMany({
      where: {
        delivery_partner_id: partner.id,
        status: {
          notIn: ["DELIVERED", "CANCELLED", "REFUNDED", "FAILED"],
        },
      },
      include: {
        orders: {
          select: { id: true, status: true, delivery_note: true },
        },
      },
    });

    // Filter to VegaMart Delivery Partner orders only
    const validOrders = activeMasterOrders.filter((mo) => {
      const allNotes = mo.orders.map((o) => o.delivery_note).filter(Boolean);
      return allNotes.length === 0 || allNotes.every((n) => isVegaMartDeliveryPartnerOrder(n));
    });

    if (validOrders.length === 0) {
      // Idle rider or non-partner delivery: update rider coordinates without order broadcast
      await prisma.deliveryProfile.update({
        where: { id: partner.id },
        data: { current_lat: payload.lat, current_lng: payload.lng },
      });
      return { success: true, dropped: false, reason: "NO_ACTIVE_ORDERS" };
    }

    for (const masterOrder of validOrders) {
      // Deduct 1 credit per tracked delivery order (idempotent, never blocks tracking)
      trackingCreditService.deductCreditForOrder(masterOrder.id).catch(() => {});

      const liveKey = `${LIVE_PREFIX}${masterOrder.id}`;
      const hotState = await this.getCacheJson<LiveTrackingState>(liveKey);

      // 1. Validate GPS Ping
      const validation = validateGpsPing(payload, hotState?.lastPing, now);
      if (!validation.valid) {
        log.debug("GPS ping rejected by noise/jump filter", {
          context: "tracking-service",
          masterOrderId: masterOrder.id,
          reason: validation.reason,
        });
        continue;
      }

      // 2. Stationary Handling (< 1m moved)
      if (validation.isStationary && hotState) {
        const timeSinceLastAccepted = now - hotState.lastPing.ts;
        if (timeSinceLastAccepted >= STATIONARY_REFRESH_INTERVAL_MS) {
          // Refresh ts and 120s TTL so the customer UI doesn't show "waiting for signal"
          hotState.lastPing.ts = now;
          hotState.updatedAt = now;
          await this.setCacheJson(liveKey, hotState, LIVE_TTL_SECONDS);

          // Broadcast stationary refresh if subscribers exist
          if (realtime.getOrderTrackingSubscriberCount(masterOrder.id) > 0) {
            const compact: CompactLocationUpdate = {
              lat: payload.lat,
              lng: payload.lng,
              snappedLat: hotState.lastPing.snappedLat,
              snappedLng: hotState.lastPing.snappedLng,
              heading: hotState.lastPing.heading,
              speedKmh: 0,
              accuracy: payload.accuracy ?? hotState.lastPing.accuracy,
              seq:
                payload.sequence != null && !isNaN(payload.sequence)
                  ? payload.sequence
                  : hotState.lastPing.seq + 1,
              ts: now,
              etaSeconds: hotState.etaSeconds,
              remainingMeters: hotState.remainingMeters,
              routeIndex: hotState.routeIndex,
              routeVersion: hotState.routeVersion,
              staleAfterSec: 45,
            };
            realtime.publishTrackingUpdate(masterOrder.id, compact);
          }
        }
        continue;
      }

      // 3. Road Route & Snapping
      let route = await this.getOrCalculateRoadRoute(masterOrder.id, {
        lat: payload.lat,
        lng: payload.lng,
      });

      let snapResult = snapToPolyline(
        { lat: payload.lat, lng: payload.lng },
        route?.points ?? [],
        60
      );

      // 4. Off-Route Detection
      const offRouteCheck = detectOffRoute(
        snapResult.distanceToRoadMeters,
        hotState?.consecutiveOffRouteCount ?? 0,
        150
      );

      const canReroute =
        offRouteCheck.isOffRoute &&
        now - (hotState?.lastRerouteAt ?? 0) >= REROUTE_COOLDOWN_MS &&
        (hotState?.rerouteCount ?? 0) < env.LIVE_TRACKING_REROUTE_LIMIT;

      if (canReroute) {
        log.info("Rider off route detected, recalculating road route", {
          context: "tracking-service",
          masterOrderId: masterOrder.id,
          distanceToRoad: snapResult.distanceToRoadMeters,
        });

        route = await this.getOrCalculateRoadRoute(
          masterOrder.id,
          { lat: payload.lat, lng: payload.lng },
          true
        );

        snapResult = snapToPolyline(
          { lat: payload.lat, lng: payload.lng },
          route?.points ?? [],
          60
        );
      }

      // 5. Speed & Dynamic ETA Calculation
      const smoothedSpeed = smoothSpeedEma(
        payload.speed,
        hotState?.lastPing.speedKmh,
        validation.isStationary
      );

      const { remainingMeters, etaSeconds } = computeRemainingDistanceAndEta(
        route?.points ?? [],
        { lat: snapResult.snappedLat, lng: snapResult.snappedLng },
        snapResult.segmentIndex,
        smoothedSpeed
      );

      const heading =
        payload.heading != null && !isNaN(payload.heading)
          ? payload.heading
          : snapResult.heading ?? hotState?.lastPing.heading ?? null;

      const newSeq =
        payload.sequence != null && !isNaN(payload.sequence)
          ? payload.sequence
          : (hotState?.lastPing.seq ?? 0) + 1;

      // 6. Update Hot State in Redis (TTL: 120s)
      const newLiveState: LiveTrackingState = {
        masterOrderId: masterOrder.id,
        orderId: masterOrder.id,
        riderId: partner.id,
        status: masterOrder.status,
        lastPing: {
          lat: payload.lat,
          lng: payload.lng,
          snappedLat: snapResult.snappedLat,
          snappedLng: snapResult.snappedLng,
          heading,
          speedKmh: smoothedSpeed,
          accuracy: payload.accuracy ?? null,
          seq: newSeq,
          ts: now,
        },
        routeIndex: snapResult.segmentIndex,
        routeVersion: route?.version ?? 1,
        remainingMeters,
        etaSeconds,
        lastDbPersistAt: hotState?.lastDbPersistAt ?? now,
        consecutiveOffRouteCount: offRouteCheck.newCount,
        rerouteCount: canReroute
          ? (hotState?.rerouteCount ?? 0) + 1
          : (hotState?.rerouteCount ?? 0),
        lastRerouteAt: canReroute ? now : (hotState?.lastRerouteAt ?? 0),
        updatedAt: now,
      };

      await this.setCacheJson(liveKey, newLiveState, LIVE_TTL_SECONDS);

      // 7. Throttled Database Snapshot (at most once every 45s)
      const shouldPersistDb =
        !hotState || now - hotState.lastDbPersistAt >= DB_PERSIST_INTERVAL_MS;

      if (shouldPersistDb) {
        newLiveState.lastDbPersistAt = now;
        await this.setCacheJson(liveKey, newLiveState, LIVE_TTL_SECONDS);

        // Async non-blocking DB persistence
        this.persistDbSnapshot(partner.id, masterOrder.id, payload, snapResult, smoothedSpeed, etaSeconds)
          .catch((err) => {
            log.error("Failed to persist tracking snapshot to DB", {
              context: "tracking-service",
              error: (err as Error).message,
            });
          });
      }

      // 8. Broadcast over WebSocket ONLY if >= 1 subscriber
      const subscriberCount = realtime.getOrderTrackingSubscriberCount(masterOrder.id);
      if (subscriberCount > 0) {
        const compact: CompactLocationUpdate = {
          lat: payload.lat,
          lng: payload.lng,
          snappedLat: snapResult.snappedLat,
          snappedLng: snapResult.snappedLng,
          heading,
          speedKmh: smoothedSpeed,
          accuracy: payload.accuracy ?? null,
          seq: newSeq,
          ts: now,
          etaSeconds,
          remainingMeters,
          routeIndex: snapResult.segmentIndex,
          routeVersion: route?.version ?? 1,
          staleAfterSec: 45,
        };
        realtime.publishTrackingUpdate(masterOrder.id, compact);
      }
    }

    return { success: true, dropped: false };
  }

  private async persistDbSnapshot(
    partnerId: string,
    masterOrderId: string,
    _ping: GPSPingPayload,
    snap: { snappedLat: number; snappedLng: number },
    _speedKmh: number,
    etaSeconds: number
  ): Promise<void> {
    await prisma.deliveryProfile.update({
      where: { id: partnerId },
      data: {
        current_lat: snap.snappedLat,
        current_lng: snap.snappedLng,
      },
    });

    const subOrders = await prisma.order.findMany({
      where: { master_order_id: masterOrderId },
      select: { id: true },
    });

    const etaMinutes = Math.max(1, Math.round(etaSeconds / 60));

    for (const sub of subOrders) {
      await prisma.deliveryTracking.upsert({
        where: { order_id: sub.id },
        update: {
          driver_lat: snap.snappedLat,
          driver_lng: snap.snappedLng,
        },
        create: {
          order_id: sub.id,
          status: "OUT_FOR_DELIVERY",
          driver_lat: snap.snappedLat,
          driver_lng: snap.snappedLng,
        },
      });

      await prisma.order.update({
        where: { id: sub.id },
        data: { eta_minutes: etaMinutes },
      }).catch(() => {});
    }
  }

  // ── Tracking Snapshot Getter ──────────────────────────────────────────────────

  async getTrackingSnapshot(
    orderOrMasterId: string,
    requesterUserId?: string,
    requesterRole?: string
  ): Promise<LiveTrackingSnapshot | null> {
    // 1. Resolve canonical master order
    let masterOrder = await prisma.masterOrder.findUnique({
      where: { id: orderOrMasterId },
      include: {
        delivery_partner: true,
        orders: {
          include: { vendor: true },
        },
      },
    });

    if (!masterOrder) {
      const child = await prisma.order.findUnique({
        where: { id: orderOrMasterId },
        include: {
          delivery_partner: true,
          vendor: true,
          master_order: {
            include: {
              delivery_partner: true,
              orders: { include: { vendor: true } },
            },
          },
        },
      });
      if (child?.master_order) {
        masterOrder = child.master_order;
      } else if (child) {
        masterOrder = {
          id: child.id,
          order_number: child.order_number,
          user_id: child.user_id,
          delivery_partner_id: child.delivery_partner_id,
          address_id: child.address_id as string,
          status: child.status as any,
          delivery_partner: child.delivery_partner,
          orders: [child],
        } as any;
      }
    }

    if (!masterOrder) return null;

    // 2. Authorization check
    if (requesterRole && requesterUserId) {
      const role = requesterRole.toLowerCase();
      if (role === "customer" && masterOrder.user_id !== requesterUserId) {
        return null;
      }
      if (role === "delivery") {
        const partner = await prisma.deliveryProfile.findFirst({
          where: { user_id: requesterUserId },
          select: { id: true },
        });
        if (!partner || masterOrder.delivery_partner_id !== partner.id) {
          return null;
        }
      }
      if (role === "vendor") {
        const vendor = await prisma.vendorProfile.findFirst({
          where: { user_id: requesterUserId },
          select: { id: true },
        });
        if (!masterOrder.orders.some((o) => o.vendor_id === vendor?.id)) {
          return null;
        }
      }
    }

    // 3. Fetch Hot State & Cached Route
    const liveKey = `${LIVE_PREFIX}${masterOrder.id}`;
    const routeKey = `${ROUTE_PREFIX}${masterOrder.id}`;

    const [hotState, cachedRoute] = await Promise.all([
      this.getCacheJson<LiveTrackingState>(liveKey),
      this.getCacheJson<DecodedRoadRoute>(routeKey),
    ]);

    // Lazy resolve road route if not yet cached in Redis/memory
    let activeRoute = cachedRoute;
    if (!activeRoute) {
      try {
        const startLat = hotState?.lastPing.lat ?? (masterOrder.delivery_partner as any)?.current_lat ?? masterOrder.orders[0]?.vendor?.latitude;
        const startLng = hotState?.lastPing.lng ?? (masterOrder.delivery_partner as any)?.current_lng ?? masterOrder.orders[0]?.vendor?.longitude;
        if (startLat && startLng) {
          activeRoute = await this.getOrCalculateRoadRoute(masterOrder.id, {
            lat: startLat,
            lng: startLng,
          });
        }
      } catch {
        // Non-blocking route fallback
      }
    }

    // 4. Fetch Driver details
    let driverInfo: LiveTrackingSnapshot["driver"] = null;
    let partnerProfile: any = null;
    if (masterOrder.delivery_partner_id) {
      partnerProfile = await prisma.deliveryProfile.findUnique({
        where: { id: masterOrder.delivery_partner_id },
        include: {
          user: {
            select: { name: true, phone: true },
          },
        },
      });

      if (partnerProfile) {
        driverInfo = {
          id: partnerProfile.id,
          name: partnerProfile.user?.name ?? "Delivery Partner",
          phone: partnerProfile.user?.phone ?? null,
          rating: partnerProfile.rating ?? null,
          review_count: partnerProfile.review_count ?? null,
          vehicle_type: partnerProfile.vehicle_type ?? null,
          vehicle_number: partnerProfile.vehicle_number ?? null,
        };
      }
    }

    // 5. Delivery Address
    let deliveryCoords = { lat: 0, lng: 0, address: "Delivery Address" };
    if (masterOrder.address_id) {
      const addr = await prisma.address.findUnique({
        where: { id: masterOrder.address_id },
      });
      if (addr) {
        deliveryCoords = {
          lat: addr.latitude ?? 0,
          lng: addr.longitude ?? 0,
          address: addr.full_address || [addr.landmark, addr.city, addr.pincode].filter(Boolean).join(", "),
        };
      }
    }

    // 6. Pickup Locations
    const vendors = masterOrder.orders.map((o) => o.vendor).filter(Boolean);
    const pickupLocations = vendors.map((v) => ({
      id: v!.id,
      name: v!.business_name,
      address: (v as any)!.full_address || v!.address,
      lat: v!.latitude,
      lng: v!.longitude,
      phone: v!.phone,
    }));

    const now = Date.now();
    const isStale = hotState ? now - hotState.updatedAt > 45_000 : true;
    const isLive = Boolean(hotState && !isStale && masterOrder.delivery_partner_id);

    const currentLat = hotState?.lastPing.lat ?? partnerProfile?.current_lat ?? vendors[0]?.latitude ?? null;
    const currentLng = hotState?.lastPing.lng ?? partnerProfile?.current_lng ?? vendors[0]?.longitude ?? null;
    const snappedLat = hotState?.lastPing.snappedLat ?? currentLat;
    const snappedLng = hotState?.lastPing.snappedLng ?? currentLng;

    return {
      order_id: orderOrMasterId,
      master_order_id: masterOrder.id,
      masterOrderId: masterOrder.id,
      status: hotState?.status ?? masterOrder.status,
      is_live: isLive,
      isLive,
      isStale,
      current_lat: currentLat,
      current_lng: currentLng,
      snapped_lat: snappedLat,
      snapped_lng: snappedLng,
      heading: hotState?.lastPing.heading ?? null,
      speed_kmh: hotState?.lastPing.speedKmh ?? null,
      accuracy: hotState?.lastPing.accuracy ?? null,
      eta_seconds: hotState?.etaSeconds ?? null,
      eta_minutes: hotState?.etaSeconds ? Math.max(1, Math.round(hotState.etaSeconds / 60)) : null,
      remaining_meters: hotState?.remainingMeters ?? null,
      distance_km: hotState?.remainingMeters ? Math.round((hotState.remainingMeters / 1000) * 10) / 10 : null,
      route_index: hotState?.routeIndex ?? 0,
      route: activeRoute
        ? {
            points: activeRoute.points,
            distance_meters: activeRoute.distanceMeters,
            duration_seconds: activeRoute.durationSeconds,
            version: activeRoute.version,
          }
        : null,
      pickup_locations: pickupLocations,
      delivery_location: deliveryCoords,
      driver: driverInfo,
      last_updated_at: hotState ? new Date(hotState.updatedAt).toISOString() : null,
      lastUpdatedAt: hotState ? new Date(hotState.updatedAt).toISOString() : null,
    };
  }

  // ── Lifecycle Hooks ───────────────────────────────────────────────────────────

  async warmRouteOnOrderAccepted(masterOrderId: string): Promise<void> {
    try {
      const masterOrder = await prisma.masterOrder.findUnique({
        where: { id: masterOrderId },
        include: { orders: { include: { vendor: true } } },
      });
      if (!masterOrder || !masterOrder.delivery_partner_id) return;

      const partner = await prisma.deliveryProfile.findUnique({
        where: { id: masterOrder.delivery_partner_id },
        select: { current_lat: true, current_lng: true },
      });

      const startPos = {
        lat: partner?.current_lat ?? masterOrder.orders[0]?.vendor?.latitude ?? 12.9716,
        lng: partner?.current_lng ?? masterOrder.orders[0]?.vendor?.longitude ?? 77.5946,
      };

      await this.getOrCalculateRoadRoute(masterOrderId, startPos, true);
      log.info("Road route pre-warmed for accepted delivery order", {
        context: "tracking-service",
        masterOrderId,
      });
    } catch (err) {
      log.warn("Failed to warm road route on order accepted", {
        context: "tracking-service",
        masterOrderId,
        error: (err as Error).message,
      });
    }
  }

  async refreshRouteOnPickupComplete(masterOrderId: string): Promise<void> {
    try {
      const routeKey = `${ROUTE_PREFIX}${masterOrderId}`;
      await this.delCache(routeKey);

      const masterOrder = await prisma.masterOrder.findUnique({
        where: { id: masterOrderId },
        select: { delivery_partner_id: true },
      });

      if (!masterOrder?.delivery_partner_id) return;

      const partner = await prisma.deliveryProfile.findUnique({
        where: { id: masterOrder.delivery_partner_id },
        select: { current_lat: true, current_lng: true },
      });

      if (partner?.current_lat && partner?.current_lng) {
        await this.getOrCalculateRoadRoute(
          masterOrderId,
          { lat: partner.current_lat, lng: partner.current_lng },
          true
        );
        log.info("Road route refreshed for OUT_FOR_DELIVERY (stores dropped)", {
          context: "tracking-service",
          masterOrderId,
        });
      }
    } catch (err) {
      log.warn("Failed to refresh road route on pickup complete", {
        context: "tracking-service",
        masterOrderId,
        error: (err as Error).message,
      });
    }
  }

  async onOrderDeliveredOrCancelled(masterOrderId: string, reason: string): Promise<void> {
    const liveKey = `${LIVE_PREFIX}${masterOrderId}`;
    const routeKey = `${ROUTE_PREFIX}${masterOrderId}`;

    await Promise.all([this.delCache(liveKey), this.delCache(routeKey)]);
    realtime.publishTrackingEnded(masterOrderId, reason);

    log.info("Live delivery tracking session ended and purged", {
      context: "tracking-service",
      masterOrderId,
      reason,
    });
  }
}

export const trackingService = new TrackingService();
