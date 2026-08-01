import { api } from "./api";

export interface StreetBroadcast {
  id: string;
  vendorId?: string;
  vendorName: string;
  vendorType: "roaming" | "shop";
  phone: string;
  street: string;
  arrivalTime: string;
  produce: string;
  note?: string;
  createdAt: string;
}

const BROADCAST_STORAGE_KEY = "vegamart_street_broadcasts";

// Initial seed broadcasts so customers immediately see live schedule announcements
const INITIAL_BROADCASTS: StreetBroadcast[] = [
  {
    id: "bcast-1",
    vendorId: "vendor-1",
    vendorName: "Raju Sabziwala 🛒",
    vendorType: "roaming",
    phone: "+919876543210",
    street: "4th Main Rd, Jayanagar 4th Block",
    arrivalTime: "Today at 5:30 PM",
    produce: "Fresh Organic Tomatoes, Palak, Shimla Mirch, Cauliflower",
    note: "Fresh farm morning harvest arrived! Special ₹5 OFF on Palak bunches today.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "bcast-2",
    vendorId: "vendor-2",
    vendorName: "Ramesh Fresh Fruit Cart 🍎",
    vendorType: "roaming",
    phone: "+919876543211",
    street: "12th Cross, JP Nagar 2nd Phase",
    arrivalTime: "Today at 6:15 PM",
    produce: "Sweet Alphonso Mangoes, Nagpuri Oranges, Bananas",
    note: "Sweet juicy mangoes straight from Ratnagiri farms!",
    createdAt: new Date().toISOString(),
  },
  {
    id: "bcast-3",
    vendorId: "vendor-3",
    vendorName: "Gupta Chai & Samosa Stall ☕",
    vendorType: "shop",
    phone: "+919876543212",
    street: "Main Market Gate 2, Bengaluru",
    arrivalTime: "Everyday 4:00 PM - 9:00 PM",
    produce: "Kulhad Masala Chai, Piping Hot Crispy Samosas",
    note: "Evening fresh batch of hot samosas ready by 4:30 PM!",
    createdAt: new Date().toISOString(),
  },
];

export function getStreetBroadcasts(): StreetBroadcast[] {
  if (typeof window === "undefined") return INITIAL_BROADCASTS;
  try {
    const raw = localStorage.getItem(BROADCAST_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(BROADCAST_STORAGE_KEY, JSON.stringify(INITIAL_BROADCASTS));
      return INITIAL_BROADCASTS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_BROADCASTS;
  }
}

export async function fetchRemoteBroadcasts(): Promise<StreetBroadcast[]> {
  try {
    const res = await api.get<any[]>("/broadcasts");
    const remoteData = res?.data || [];
    if (Array.isArray(remoteData) && remoteData.length > 0) {
      const mapped: StreetBroadcast[] = remoteData.map((b: any) => ({
        id: b.id,
        vendorId: b.vendor_id,
        vendorName: b.vendor_name || "Street Vendor",
        vendorType: b.vendor_type || "roaming",
        phone: b.phone || "+919876543210",
        street: b.street,
        arrivalTime: b.arrival_time,
        produce: b.produce,
        note: b.note,
        createdAt: b.created_at || new Date().toISOString(),
      }));
      localStorage.setItem(BROADCAST_STORAGE_KEY, JSON.stringify([...mapped, ...INITIAL_BROADCASTS]));
      window.dispatchEvent(new Event("vegamart-broadcast-updated"));
      return mapped;
    }
  } catch (e) {
    console.warn("Backend broadcasts fetch error, using local storage:", e);
  }
  return getStreetBroadcasts();
}

export async function addStreetBroadcast(
  data: Omit<StreetBroadcast, "id" | "createdAt">
): Promise<StreetBroadcast> {
  const current = getStreetBroadcasts();
  const newBroadcast: StreetBroadcast = {
    ...data,
    id: `bcast-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  
  const updated = [newBroadcast, ...current];
  try {
    localStorage.setItem(BROADCAST_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("vegamart-broadcast-updated"));
  } catch (e) {
    console.error("Failed to save broadcast to local storage:", e);
  }

  // Also push to backend database
  try {
    await api.post("/broadcasts", {
      vendor_id: data.vendorId || "00000000-0000-0000-0000-000000000001",
      vendor_name: data.vendorName,
      vendor_type: data.vendorType,
      phone: data.phone,
      street: data.street,
      arrival_time: data.arrivalTime,
      produce: data.produce,
      note: data.note,
    });
  } catch (err) {
    console.warn("Backend broadcast post offline fallback:", err);
  }

  return newBroadcast;
}

export async function deleteStreetBroadcast(id: string): Promise<void> {
  const current = getStreetBroadcasts();
  const updated = current.filter((b) => b.id !== id);
  try {
    localStorage.setItem(BROADCAST_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("vegamart-broadcast-updated"));
  } catch (e) {
    console.error("Failed to delete broadcast:", e);
  }

  try {
    await api.delete(`/broadcasts/${id}`);
  } catch (err) {
    console.warn("Backend broadcast delete offline fallback:", err);
  }
}
