import prisma from "../src/database/prisma";
import { trackingService } from "../src/modules/tracking/tracking.service";
import { routingService } from "../src/modules/tracking/route.provider";
import { signAccessToken } from "../src/services/token.service";
import { v4 as uuidv4 } from "uuid";

/**
 * VegaMart Live GPS Tracking Localhost Simulation
 * Run with: cd backend && npx ts-node --transpile-only scripts/simulate-tracking.ts
 */
async function runSimulation() {
  console.log("\n=======================================================");
  console.log(" 🛵 VegaMart Blinkit-Style Live Tracking Simulator");
  console.log("=======================================================\n");

  // 1. Fetch the active master order
  let masterOrder = await prisma.masterOrder.findUnique({
    where: { id: "f5ca005f-c48b-4e9d-9bba-c25d7b846c78" },
    include: {
      address: true,
      orders: { include: { vendor: true } },
      delivery_partner: { include: { user: true } },
    },
  });

  if (!masterOrder) {
    masterOrder = await prisma.masterOrder.findFirst({
      where: { status: { notIn: ["DELIVERED", "CANCELLED", "REFUNDED", "FAILED"] } },
      include: {
        address: true,
        orders: { include: { vendor: true } },
        delivery_partner: { include: { user: true } },
      },
    });
  }

  if (!masterOrder) {
    console.error("❌ No master order found.");
    process.exit(1);
  }

  // 2. Resolve the exact delivery partner assigned to this order
  let partner = masterOrder.delivery_partner;
  if (!partner) {
    partner = await prisma.deliveryProfile.findFirst({
      include: { user: true },
    });
  }

  if (!partner) {
    console.error("❌ No delivery partner profile found.");
    process.exit(1);
  }

  console.log(`✅ Assigned Rider: ${partner.user?.name || "Rider"} (${partner.id})`);
  console.log(`✅ Partner User ID: ${partner.user_id}`);

  // Create or retrieve active session for HTTP ingestion
  let session = await prisma.session.findFirst({
    where: { user_id: partner.user_id, is_active: true },
  });
  if (!session) {
    session = await prisma.session.create({
      data: {
        id: uuidv4(),
        user_id: partner.user_id,
        is_active: true,
        expires_at: new Date(Date.now() + 7 * 86400000),
      },
    });
  }

  const partnerToken = signAccessToken({
    sub: partner.user_id,
    email: partner.user?.email || "delivery@vegamart.in",
    role: "delivery",
    session_id: session.id,
  });

  // 3. Set realistic Bangalore coordinates
  const storeLat = 12.9784;
  const storeLng = 77.6408;
  const destLat = 12.9600;
  const destLng = 77.6400;

  if (masterOrder.address_id) {
    await prisma.address.update({
      where: { id: masterOrder.address_id },
      data: {
        latitude: destLat,
        longitude: destLng,
        full_address: "100ft Road, Indiranagar, Bengaluru, Karnataka 560038",
      },
    });
  }

  const firstSubOrder = masterOrder.orders[0];
  if (firstSubOrder?.vendor_id) {
    await prisma.vendorProfile.update({
      where: { id: firstSubOrder.vendor_id },
      data: {
        latitude: storeLat,
        longitude: storeLng,
        business_name: "Fresh Gali Mart Indiranagar",
      },
    });
  }

  // 4. Force state to OUT_FOR_DELIVERY with matching delivery_partner_id
  await prisma.masterOrder.update({
    where: { id: masterOrder.id },
    data: {
      delivery_partner_id: partner.id,
      status: "OUT_FOR_DELIVERY",
      payment_status: "PAID",
    },
  });

  for (const sub of masterOrder.orders) {
    await prisma.order.update({
      where: { id: sub.id },
      data: {
        delivery_partner_id: partner.id,
        status: "OUT_FOR_DELIVERY",
        delivery_note: "VegaMart Delivery Partner",
        payment_status: "PAID",
      },
    });
  }

  // 5. Pre-warm road route in cache
  await trackingService.warmRouteOnOrderAccepted(masterOrder.id);

  console.log(`✅ Master Order: ${masterOrder.id}`);
  if (firstSubOrder) console.log(`✅ Sub-Order:    ${firstSubOrder.id}`);
  console.log(`📍 Store Origin: [${storeLat}, ${storeLng}]`);
  console.log(`🏠 Customer Destination: [${destLat}, ${destLng}]`);
  console.log("\n-------------------------------------------------------");
  console.log(`🌐 OPEN IN YOUR BROWSER TO SEE LIVE TRACKING:`);
  console.log(`👉 http://localhost:3000/orders/${firstSubOrder?.id || masterOrder.id}/track`);
  console.log("-------------------------------------------------------\n");

  // 6. Calculate road route between store and customer
  const route = await routingService.calculateRoute([
    { lat: storeLat, lng: storeLng },
    { lat: destLat, lng: destLng },
  ]);

  console.log(
    `🛣️  Road route resolved via [${route.provider.toUpperCase()}]: ${route.points.length} waypoints, ~${Math.round(
      route.distanceMeters
    )} meters`
  );
  console.log("🚀 Starting continuous simulated rider movement...\n");

  let step = 0;
  let seq = 1;

  // Step through coordinates along the road polyline
  const stepInterval = setInterval(async () => {
    if (step >= route.points.length) {
      console.log("\n🏁 Rider reached destination! Looping simulation...");
      step = 0;
    }

    const currentPoint = route.points[step];
    if (!currentPoint) return;
    const [lat, lng] = currentPoint;

    // Calculate heading towards next point
    let heading = 0;
    if (step + 1 < route.points.length && route.points[step + 1]) {
      const nextPoint = route.points[step + 1];
      if (nextPoint) {
        const [nextLat, nextLng] = nextPoint;
        const dLng = ((nextLng - lng) * Math.PI) / 180;
        const y = Math.sin(dLng) * Math.cos((nextLat * Math.PI) / 180);
        const x =
          Math.cos((lat * Math.PI) / 180) * Math.sin((nextLat * Math.PI) / 180) -
          Math.sin((lat * Math.PI) / 180) * Math.cos((nextLat * Math.PI) / 180) * Math.cos(dLng);
        heading = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
      }
    }

    const speed = 25 + Math.random() * 5; // ~28 km/h city riding speed

    try {
      // 1. Direct HTTP call to running backend server (broadcasts to connected WebSockets)
      let httpSuccess = false;
      try {
        const httpRes = await fetch("http://localhost:8081/api/v1/delivery/location", {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${partnerToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lat,
            lng,
            accuracy: 10,
            heading: Math.round(heading),
            speed: Math.round(speed),
            sequence: seq++,
            capturedAt: Date.now(),
          }),
        });
        httpSuccess = httpRes.ok;
      } catch {
        // Fallback if server is temporarily restarting
      }

      // 2. Direct service fallback
      const res = await trackingService.ingestLocation(partner!.user_id, {
        lat,
        lng,
        accuracy: 10,
        heading: Math.round(heading),
        speed: Math.round(speed),
        sequence: seq,
        capturedAt: Date.now(),
      });

      process.stdout.write(
        `\r🛵 Ping #${seq - 1}: Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)} | Head: ${Math.round(
          heading
        )}° | Speed: ${Math.round(speed)} km/h | HTTP: ${httpSuccess ? "200 OK" : "DIRECT"}`
      );
    } catch (err: any) {
      console.error("\n❌ Ingest failed:", err.message);
    }

    step++;
  }, 3500);

  process.on("SIGINT", () => {
    clearInterval(stepInterval);
    console.log("\n\n👋 Simulation stopped.");
    process.exit(0);
  });
}

runSimulation().catch((err) => {
  console.error("Simulation error:", err);
  process.exit(1);
});
