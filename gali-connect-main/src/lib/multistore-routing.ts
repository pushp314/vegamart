/**
 * Multi-Store Delivery Sequencing & Routing Engine
 *
 * Implements greedy nearest-neighbor proximity sequencing for multi-vendor orders:
 * 1. Checks pickup status of all stores/vendors in the order.
 * 2. When stores are pending pickup:
 *    - Finds the nearest pending store to the rider -> Stop 1 (Active target).
 *    - From Stop 1, finds the next nearest pending store -> Stop 2.
 *    - And so on, until all pending stores are sequenced.
 * 3. Shows store items to collect, store phone, and address.
 * 4. Only after ALL products and stores are picked up (or OUT_FOR_DELIVERY),
 *    activates customer location as the destination for final doorstep delivery.
 */

export interface StoreItem {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  price?: number;
  image?: string;
}

export interface StorePickupStop {
  subOrderId: string;
  vendorId: string;
  businessName: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  status: string;
  isPickedUp: boolean;
  items: StoreItem[];
  distanceFromPrevMeters?: number;
}

export interface MultiStoreDeliveryPlan {
  isMultiStore: boolean;
  totalStoresCount: number;
  pendingStoresCount: number;
  allStoresPickedUp: boolean;
  phase: "PICKUP" | "DROPOFF";
  // Ordered pending stores (nearest to rider first)
  sequencedPendingStores: StorePickupStop[];
  // Stores already picked up
  pickedUpStores: StorePickupStop[];
  // Active target for current in-app navigation & directions
  activeTarget: {
    type: "STORE" | "CUSTOMER";
    title: string;
    subtitle: string;
    label: string;
    address: string;
    phone: string;
    lat: number;
    lng: number;
    landmark?: string;
    exact_location?: string;
    subOrderId?: string;
    items?: StoreItem[];
    stopNumber?: number;
    totalStops?: number;
  };
  // Next stop preview if any
  nextTarget?: {
    type: "STORE" | "CUSTOMER";
    label: string;
    subtitle: string;
  };
  // Complete ordered waypoints for the full journey polyline
  allWaypoints: Array<{
    lat: number;
    lng: number;
    label: string;
    type: "rider" | "store" | "customer";
    isCurrentTarget?: boolean;
    stopIndex?: number;
  }>;
  // Official Google Maps driving URL for the CURRENT active target
  googleMapsActiveUrl: string;
}

export function computeHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function extractStorePickupStops(order: any): StorePickupStop[] {
  if (!order) return [];

  // 1. Sub-orders for multi-vendor master order
  if (Array.isArray(order.sub_orders) && order.sub_orders.length > 0) {
    return order.sub_orders
      .map((sub: any) => {
        const v = sub.vendor || {};
        const sStatus = String(sub.status || "").toUpperCase();
        const isPickedUp = [
          "PICKED_UP",
          "OUT_FOR_DELIVERY",
          "DELIVERED",
          "COMPLETED",
          "CANCELLED",
        ].includes(sStatus);

        const lat = Number(v.latitude || v.lat || 0);
        const lng = Number(v.longitude || v.lng || 0);

        const items: StoreItem[] = (sub.items || []).map((it: any) => ({
          id: String(it.id || it.product_id || Math.random()),
          name: it.product_name || it.name || "Store Item",
          quantity: Number(it.quantity || 1),
          unit: it.selected_unit || it.unit || "",
          price: Number(it.total_price || it.unit_price || 0),
          image: it.image_url || it.image || it.product_image || it.product?.images?.[0]?.url,
        }));

        return {
          subOrderId: String(sub.id || ""),
          vendorId: String(v.id || sub.vendor_id || sub.id),
          businessName: v.business_name || v.name || "Merchant Store",
          address: v.address || v.full_address || "Store Address",
          phone: v.phone || "",
          lat: lat > 5 && lng > 60 ? lat : 21.9588,
          lng: lat > 5 && lng > 60 ? lng : 82.9588,
          status: sStatus,
          isPickedUp,
          items,
        };
      })
      .filter((s: StorePickupStop) => s.businessName);
  }

  // 2. Single-vendor fallback
  if (order.vendor) {
    const v = order.vendor;
    const oStatus = String(order.status || "").toUpperCase();
    const isPickedUp = [
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
    ].includes(oStatus);

    const lat = Number(v.latitude || v.lat || 0);
    const lng = Number(v.longitude || v.lng || 0);

    const items: StoreItem[] = (order.items || []).map((it: any) => ({
      id: String(it.id || it.product_id || Math.random()),
      name: it.product_name || it.name || "Store Item",
      quantity: Number(it.quantity || 1),
      unit: it.selected_unit || it.unit || "",
      price: Number(it.total_price || it.unit_price || 0),
      image: it.image_url || it.image || it.product_image || it.product?.images?.[0]?.url,
    }));

    return [
      {
        subOrderId: String(order.id || ""),
        vendorId: String(v.id || order.vendor_id || order.id),
        businessName: v.business_name || v.name || "Merchant Store",
        address: v.address || v.full_address || "Store Address",
        phone: v.phone || "",
        lat: lat > 5 && lng > 60 ? lat : 21.9588,
        lng: lat > 5 && lng > 60 ? lng : 82.9588,
        status: oStatus,
        isPickedUp,
        items,
      },
    ];
  }

  return [];
}

/**
 * Greedy nearest-neighbor sequencing for pending store stops
 */
export function sequenceStoresByProximity(
  origin: { lat: number; lng: number },
  stores: StorePickupStop[]
): StorePickupStop[] {
  if (stores.length <= 1) return [...stores];

  const unvisited = [...stores];
  const sequenced: StorePickupStop[] = [];
  let currentPos = origin;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const store = unvisited[i];
      if (!store) continue;
      const dist = computeHaversineDistance(
        currentPos.lat,
        currentPos.lng,
        store.lat,
        store.lng
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const [nearestStore] = unvisited.splice(nearestIdx, 1);
    if (nearestStore) {
      sequenced.push({
        ...nearestStore,
        distanceFromPrevMeters: Math.round(minDistance),
      });
      currentPos = { lat: nearestStore.lat, lng: nearestStore.lng };
    }
  }

  return sequenced;
}

export function buildMultiStoreDeliveryPlan(
  order: any,
  riderCoords: { lat: number; lng: number } | null
): MultiStoreDeliveryPlan {
  const allStores = extractStorePickupStops(order);
  const isMultiStore = allStores.length > 1;

  const orderStatus = String(order?.status || "").toUpperCase();
  const isForcedDropoff =
    orderStatus === "OUT_FOR_DELIVERY" ||
    orderStatus === "DELIVERED" ||
    orderStatus === "COMPLETED";

  const pendingStores = allStores.filter((s) => !s.isPickedUp);
  const pickedUpStores = allStores.filter((s) => s.isPickedUp);

  const allStoresPickedUp =
    isForcedDropoff || (allStores.length > 0 && pendingStores.length === 0);

  // Fallback rider position near Sakti center
  const origin =
    riderCoords && riderCoords.lat > 5 && riderCoords.lng > 60
      ? riderCoords
      : allStores[0] && allStores[0].lat > 5
        ? { lat: allStores[0].lat - 0.003, lng: allStores[0].lng - 0.003 }
        : { lat: 21.9588, lng: 82.9588 };

  // Customer location
  const cLat = Number(
    order?.address?.latitude ||
      order?.delivery_address?.latitude ||
      order?.delivery_location?.lat ||
      order?.dropoff_lat ||
      0
  );
  const cLng = Number(
    order?.address?.longitude ||
      order?.delivery_address?.longitude ||
      order?.delivery_location?.lng ||
      order?.dropoff_lng ||
      0
  );

  const safeCustomerLat = cLat > 5 ? cLat : origin.lat + 0.008;
  const safeCustomerLng = cLng > 60 ? cLng : origin.lng + 0.008;

  const customerName =
    order?.user?.name ||
    order?.customer?.name ||
    order?.address?.name ||
    order?.customer_name ||
    "Customer";
  const customerAddress =
    order?.address?.full_address ||
    order?.address?.line1 ||
    order?.delivery_address?.address ||
    order?.delivery_location?.address ||
    "Customer Doorstep";
  const customerPhone =
    order?.user?.phone ||
    order?.customer?.phone ||
    order?.address?.phone ||
    order?.delivery_location?.phone ||
    "";
  const customerLandmark =
    order?.address?.landmark ||
    order?.delivery_address?.landmark ||
    order?.delivery_location?.landmark ||
    "";
  const customerExactNotes =
    order?.address?.exact_location ||
    order?.delivery_address?.exact_location ||
    order?.delivery_location?.exact_location ||
    "";

  // Sequence pending stores: Rider -> Nearest Store 1 -> Next Nearest Store 2...
  const sequencedPendingStores = sequenceStoresByProximity(origin, pendingStores);

  if (allStoresPickedUp || sequencedPendingStores.length === 0) {
    // ═══════════════════════════════════════════════════
    // PHASE 2: DROPOFF (All store products picked up)
    // ═══════════════════════════════════════════════════
    const activeTarget = {
      type: "CUSTOMER" as const,
      title: "Deliver to Customer",
      subtitle: `All products picked up from ${allStores.length} store(s). Complete doorstep delivery.`,
      label: customerName,
      address: customerAddress,
      phone: customerPhone,
      lat: safeCustomerLat,
      lng: safeCustomerLng,
      landmark: customerLandmark,
      exact_location: customerExactNotes,
    };

    const googleMapsActiveUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${safeCustomerLat},${safeCustomerLng}&travelmode=driving`;

    const allWaypoints = [
      { lat: origin.lat, lng: origin.lng, label: "Rider Position", type: "rider" as const },
      {
        lat: safeCustomerLat,
        lng: safeCustomerLng,
        label: customerName,
        type: "customer" as const,
        isCurrentTarget: true,
      },
    ];

    return {
      isMultiStore,
      totalStoresCount: allStores.length,
      pendingStoresCount: 0,
      allStoresPickedUp: true,
      phase: "DROPOFF",
      sequencedPendingStores: [],
      pickedUpStores,
      activeTarget,
      allWaypoints,
      googleMapsActiveUrl,
    };
  }

  // ═══════════════════════════════════════════════════
  // PHASE 1: STORE PICKUPS (Navigate to nearest store first)
  // ═══════════════════════════════════════════════════
  const currentStore = sequencedPendingStores[0];
  const nextStore = sequencedPendingStores[1];

  const totalStores = allStores.length;
  const currentStopIndex = pickedUpStores.length + 1;

  const activeTarget = {
    type: "STORE" as const,
    title: `Stop ${currentStopIndex} of ${totalStores}: Store Pickup`,
    subtitle: `Pick up ${currentStore.items.length} item(s) from ${currentStore.businessName}`,
    label: currentStore.businessName,
    address: currentStore.address,
    phone: currentStore.phone,
    lat: currentStore.lat,
    lng: currentStore.lng,
    subOrderId: currentStore.subOrderId,
    items: currentStore.items,
    stopNumber: currentStopIndex,
    totalStops: totalStores,
  };

  const nextTarget = nextStore
    ? {
        type: "STORE" as const,
        label: nextStore.businessName,
        subtitle: `Stop ${currentStopIndex + 1}: ${nextStore.items.length} items to collect`,
      }
    : {
        type: "CUSTOMER" as const,
        label: `Customer: ${customerName}`,
        subtitle: "Final Stop: Doorstep Delivery (after all items picked up)",
      };

  // Google Maps URL targeting current active store with next stops as waypoints
  const waypointsForGoogle: string[] = [];
  if (nextStore) {
    waypointsForGoogle.push(`${nextStore.lat},${nextStore.lng}`);
  }
  let googleMapsActiveUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${currentStore.lat},${currentStore.lng}&travelmode=driving`;
  if (waypointsForGoogle.length > 0) {
    googleMapsActiveUrl += `&waypoints=${encodeURIComponent(waypointsForGoogle.join("|"))}`;
  }

  // Complete ordered waypoints: [Rider] -> [Pending Store 1] -> [Pending Store 2...] -> [Customer]
  const allWaypoints: Array<{
    lat: number;
    lng: number;
    label: string;
    type: "rider" | "store" | "customer";
    isCurrentTarget?: boolean;
    stopIndex?: number;
  }> = [{ lat: origin.lat, lng: origin.lng, label: "Rider Position", type: "rider" }];

  sequencedPendingStores.forEach((store, idx) => {
    allWaypoints.push({
      lat: store.lat,
      lng: store.lng,
      label: `${pickedUpStores.length + idx + 1}. ${store.businessName}`,
      type: "store",
      isCurrentTarget: idx === 0,
      stopIndex: pickedUpStores.length + idx + 1,
    });
  });

  allWaypoints.push({
    lat: safeCustomerLat,
    lng: safeCustomerLng,
    label: `Final: ${customerName}`,
    type: "customer",
    isCurrentTarget: false,
  });

  return {
    isMultiStore,
    totalStoresCount: totalStores,
    pendingStoresCount: sequencedPendingStores.length,
    allStoresPickedUp: false,
    phase: "PICKUP",
    sequencedPendingStores,
    pickedUpStores,
    activeTarget,
    nextTarget,
    allWaypoints,
    googleMapsActiveUrl,
  };
}
