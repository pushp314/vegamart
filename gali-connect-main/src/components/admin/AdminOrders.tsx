import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Eye, Loader2, ShoppingBag, MapPin, User, Store, Phone, Bike, CreditCard, Banknote, ShieldCheck, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { getDeliveryOptionInfo, getPaymentMethodInfo, getOrderStatusInfo } from "@/lib/order-helpers";

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  items_subtotal?: number;
  delivery_fee?: number;
  tax?: number;
  discount?: number;
  payment_method: string;
  payment_status: string;
  delivery_note?: string | null;
  delivery_option?: string | null;
  created_at: string;
  customer: { id: string; name: string; email: string; phone?: string | null } | null;
  vendors?: any[];
  sub_orders?: any[];
  vendor: {
    id: string;
    business_name: string;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  delivery_partner?: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
  payment?: {
    id?: string;
    amount?: number;
    method?: string;
    status?: string;
    refund_amount?: number | null;
    refund_status?: string | null;
  } | null;
  item_count: number;
  items?: {
    product_name: string;
    quantity: number;
    unit_price?: number;
    total_price?: number;
    image_url?: string;
    status?: string;
    product?: {
      images?: { url: string }[];
    };
  }[];
  address?: any;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-indigo-100 text-indigo-800",
  PACKED: "bg-purple-100 text-purple-800",
  READY_FOR_PICKUP: "bg-cyan-100 text-cyan-800",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  FAILED: "bg-red-100 text-red-800",
};

export function AdminOrders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const vendorIdFromUrl = new URLSearchParams(window.location.search).get("vendor_id");
  const [vendorId] = useState(vendorIdFromUrl || "");

  const { data: ordersRes, isLoading } = useQuery({
    queryKey: ["adminOrders", search, statusFilter, page, vendorId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (vendorId) params.set("vendor_id", vendorId);
      params.set("page", String(page));
      params.set("per_page", "20");
      return api.get<any>(`/admin/orders?${params.toString()}`);
    },
  });

  const orders: Order[] = Array.isArray(ordersRes?.data)
    ? ordersRes.data
    : Array.isArray((ordersRes?.data as any)?.data)
      ? (ordersRes?.data as any).data
      : [];

  const pagination = ordersRes?.pagination;

  const { data: detailRes, isLoading: detailLoading } = useQuery({
    queryKey: ["adminOrderDetail", selectedOrder?.id],
    queryFn: () => api.get<any>(`/admin/orders/${selectedOrder!.id}`),
    enabled: !!selectedOrder?.id,
  });

  const detail: Order | null = detailRes?.data || selectedOrder;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Order Management</h2>
          {vendorId && (
            <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200">
              Filtered by Vendor
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PENDING">Order Booked (Pending)</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="PREPARING">Preparing</SelectItem>
              <SelectItem value="PACKED">Packed</SelectItem>
              <SelectItem value="READY_FOR_PICKUP">Ready for Pickup</SelectItem>
              <SelectItem value="OUT_FOR_DELIVERY">Out for Delivery</SelectItem>
              <SelectItem value="DELIVERED">Delivered</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Delivery Mode</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => {
                    const dInfo = getDeliveryOptionInfo(order.delivery_note || order.delivery_option || (order as any).delivery_slot);
                    const pInfo = getPaymentMethodInfo(
                      order.payment_method,
                      order.payment_status,
                      order.total,
                      dInfo.id === "self_pickup",
                      order.payment?.amount != null ? Number(order.payment.amount) : null
                    );
                    const DIcon = dInfo.icon;
                    const PIcon = pInfo.icon;

                    return (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <TableCell className="font-mono text-sm font-bold">{order.order_number}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{order.customer?.name ?? "N/A"}</span>
                            {order.customer?.phone ? (
                              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-medium">
                                <Phone className="h-3 w-3 text-emerald-600 shrink-0" />
                                {order.customer.phone}
                              </span>
                            ) : order.customer?.email ? (
                              <span className="text-xs text-muted-foreground truncate max-w-[140px]">{order.customer.email}</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{order.vendor?.business_name ?? "N/A"}</span>
                            {order.vendor?.phone ? (
                              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-medium">
                                <Phone className="h-3 w-3 text-emerald-600 shrink-0" />
                                {order.vendor.phone}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${dInfo.colorClass}`}>
                            <DIcon className="h-3.5 w-3.5" />
                            {dInfo.shortLabel}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold">{order.item_count} Items</span>
                            {order.items && order.items.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {order.items.slice(0, 2).map((i: any, itemIdx: number) => {
                                  const itemImg = i.image_url || i.product?.images?.[0]?.url;
                                  return (
                                    <div
                                      key={itemIdx}
                                      className="flex items-center gap-1.5 bg-muted/60 border border-border/70 rounded-lg px-2 py-0.5 text-xs text-muted-foreground"
                                    >
                                      <div className="h-4 w-4 rounded bg-muted overflow-hidden shrink-0 grid place-items-center">
                                        {itemImg ? (
                                          <img src={itemImg} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                          <ShoppingBag className="h-3 w-3 text-muted-foreground/60" />
                                        )}
                                      </div>
                                      <span className="truncate max-w-[110px] font-medium text-foreground">
                                        {i.quantity}x {i.product_name}
                                      </span>
                                    </div>
                                  );
                                })}
                                {order.items.length > 2 && (
                                  <span className="text-[10px] text-muted-foreground font-bold">
                                    +{order.items.length - 2} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">₹{order.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className={`${getOrderStatusInfo(order.status).badgeBg} font-bold text-xs whitespace-nowrap`}>
                            {getOrderStatusInfo(order.status).label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold border w-fit ${pInfo.colorClass}`}>
                              <PIcon className="h-3.5 w-3.5" />
                              {pInfo.shortLabel}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold w-fit ${pInfo.statusColorClass}`}>
                              {pInfo.statusText}
                            </span>
                            {pInfo.isPartialAdvance && (
                              <span className="text-[10px] text-muted-foreground font-bold">
                                Bal: ₹{pInfo.balanceAmount.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(order.created_at), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.total_pages} ({pagination.total} total)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pagination.total_pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={(o) => !o && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-6">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                Order #{detail?.order_number || detail?.id.slice(0, 8)}
                {detail && (
                  <Badge className={`${getOrderStatusInfo(detail.status).badgeBg} font-bold text-xs`}>
                    {getOrderStatusInfo(detail.status).label}
                  </Badge>
                )}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              {detail?.created_at ? `Placed on ${format(new Date(detail.created_at), "PPP p")} | ` : ""}ID: {detail?.id}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            detail && (() => {
              const modalDInfo = getDeliveryOptionInfo(detail.delivery_note || detail.delivery_option || (detail as any).delivery_slot);
              const modalPInfo = getPaymentMethodInfo(
                detail.payment_method,
                detail.payment_status,
                detail.total,
                modalDInfo.id === "self_pickup",
                detail.payment?.amount != null ? Number(detail.payment.amount) : null
              );
              const modalSInfo = getOrderStatusInfo(detail.status);
              const ModalDIcon = modalDInfo.icon;
              const ModalPIcon = modalPInfo.icon;
              const ModalSIcon = modalSInfo.icon;

              const modalSteps = [
                { key: "pending", label: "Order Booked", done: true },
                { key: "confirmed", label: "Confirmed", done: ["confirmed", "preparing", "packed", "ready_for_pickup", "out_for_delivery", "delivered"].includes(modalSInfo.status) },
                { key: "preparing", label: "Preparing", done: ["preparing", "packed", "ready_for_pickup", "out_for_delivery", "delivered"].includes(modalSInfo.status) },
                { key: "out_for_delivery", label: "Out for Delivery", done: ["out_for_delivery", "delivered"].includes(modalSInfo.status) },
                { key: "delivered", label: "Delivered", done: modalSInfo.status === "delivered" },
              ];

              return (
                <div className="space-y-6 pt-2">
                  {/* Status Lifecycle Track */}
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ModalSIcon className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-bold text-foreground">
                          Current Stage: <strong className="text-emerald-700 dark:text-emerald-400">{modalSInfo.label}</strong>
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {modalSInfo.desc}
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-2 pt-1">
                      {modalSteps.map((st, sIdx) => (
                        <div
                          key={st.key}
                          className={`rounded-xl border p-2 text-center text-[10px] font-bold transition-all ${
                            st.done
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                              : "bg-muted/40 border-border text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${st.done ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                            <span className="truncate">{st.label}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delivery & Payment Badges Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Delivery Option Chosen Card */}
                    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Chosen Delivery Option
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${modalDInfo.colorClass}`}>
                          <ModalDIcon className="h-3.5 w-3.5" />
                          {modalDInfo.shortLabel}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{modalDInfo.label}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{modalDInfo.desc}</p>
                      </div>
                      {detail.delivery_partner && (
                        <div className="pt-2 border-t text-xs text-muted-foreground flex items-center gap-1.5">
                          <Bike className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Assigned Partner: <strong className="text-foreground">{detail.delivery_partner.name}</strong> {detail.delivery_partner.phone ? `(${detail.delivery_partner.phone})` : ""}</span>
                        </div>
                      )}
                    </div>

                    {/* Payment Mode Card */}
                    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Payment Method
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${modalPInfo.colorClass}`}>
                          <ModalPIcon className="h-3.5 w-3.5" />
                          {modalPInfo.shortLabel}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground flex items-center justify-between">
                          <span>{modalPInfo.label}</span>
                          <Badge className={`text-[10px] ${modalPInfo.statusColorClass}`}>
                            {modalPInfo.statusText}
                          </Badge>
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{modalPInfo.instruction}</p>
                      </div>
                    </div>
                  </div>

                  {/* Customer & Vendor Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                        <User className="h-4 w-4" /> Customer & Delivery Address
                      </div>
                      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                        <div>
                          <p className="font-bold text-foreground text-sm">{detail.customer?.name || "N/A"}</p>
                          {detail.customer?.phone ? (
                            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1.5 w-fit font-medium mt-1">
                              <Phone className="h-3 w-3" />
                              {detail.customer.phone}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No mobile number</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">{detail.customer?.email}</p>
                        </div>

                        {detail.address ? (
                          <div className="mt-2 text-xs border-t border-border/70 pt-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-foreground flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                {detail.address.label || "Delivery Location"}
                              </span>
                              {detail.address.latitude && detail.address.longitude && (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${detail.address.latitude},${detail.address.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
                                >
                                  <ExternalLink className="h-3 w-3" /> Map
                                </a>
                              )}
                            </div>
                            <p className="text-foreground font-medium leading-relaxed">
                              {detail.address.full_address}
                            </p>
                            {detail.address.landmark && (
                              <p className="text-muted-foreground">
                                <strong className="text-foreground">Landmark:</strong> {detail.address.landmark}
                              </p>
                            )}
                            <p className="text-muted-foreground">
                              {[detail.address.city, detail.address.state, detail.address.pincode ? `- ${detail.address.pincode}` : "", detail.address.country || "India"]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                            {detail.address.phone && detail.address.phone !== detail.customer?.phone && (
                              <p className="text-muted-foreground">
                                <strong className="text-foreground">Address Phone:</strong> {detail.address.phone}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic border-t pt-2">No address recorded</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                        <Store className="h-4 w-4" /> Store-wise Breakdown
                      </div>
                      <div className="rounded-xl border border-border bg-muted/20 space-y-3 p-4">
                        {detail.sub_orders && detail.sub_orders.length > 0 ? (
                          detail.sub_orders.map((sub: any, idx: number) => (
                            <div key={idx} className="bg-card rounded-lg border border-border p-3 space-y-2">
                              <div className="flex justify-between items-center">
                                <p className="font-bold text-foreground text-sm flex items-center gap-2">
                                  <Store className="h-3.5 w-3.5 text-emerald-600" />
                                  {sub.vendor?.business_name || "N/A"}
                                </p>
                                <Badge className={`${getOrderStatusInfo(sub.status).badgeBg} font-bold text-[10px]`}>
                                  {getOrderStatusInfo(sub.status).label}
                                </Badge>
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground border-t pt-2 mt-2">
                                <span>Sub-order Total: <strong className="text-foreground">₹{sub.total.toFixed(2)}</strong></span>
                                <span className="text-rose-600">Comm: <strong>₹{sub.commission.toFixed(2)}</strong></span>
                                <span className="text-emerald-600">Payout: <strong>₹{sub.vendorEarnings.toFixed(2)}</strong></span>
                              </div>
                              <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                                {sub.vendor?.phone && (
                                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {sub.vendor.phone}</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          // Fallback for older orders without sub_orders populated
                          <div className="text-sm text-muted-foreground">
                             <p className="font-bold text-foreground text-sm">{detail.vendor?.business_name || "N/A"}</p>
                             <p>{detail.vendor?.address}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                      <ShoppingBag className="h-4 w-4" /> Items ({detail.item_count})
                    </div>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <div className="divide-y divide-border/50 bg-card">
                        {(detail.items || []).map((item: any, idx: number) => {
                          const itemImg = item.image_url || item.product?.images?.[0]?.url;
                          const isRejected = item.status === "rejected";
                          return (
                            <div
                              key={idx}
                              className={`flex justify-between items-center p-4 hover:bg-muted/30 transition-colors ${
                                isRejected ? "bg-rose-50/20 opacity-60" : ""
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className="h-11 w-11 rounded-xl bg-muted border border-border overflow-hidden flex-shrink-0 grid place-items-center">
                                  {itemImg ? (
                                    <img
                                      src={itemImg}
                                      alt={item.product_name}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLElement).style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <ShoppingBag className="h-5 w-5 text-muted-foreground/50" />
                                  )}
                                </div>
                                <div>
                                  <p
                                    className={`font-semibold ${
                                      isRejected ? "line-through text-muted-foreground" : ""
                                    }`}
                                  >
                                    {item.quantity}x {item.product_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    ₹{item.unit_price} each
                                  </p>
                                  {isRejected && (
                                    <span className="mt-1 inline-block rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                                      Rejected by Vendor
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p
                                  className={`font-bold ${
                                    isRejected ? "line-through text-muted-foreground" : ""
                                  }`}
                                >
                                  ₹{item.total_price}
                                </p>
                                {isRejected && (
                                  <span className="text-[10px] text-rose-600 font-bold">
                                    Excluded from Total
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="bg-muted/30 p-4 border-t border-border space-y-1.5 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Accepted Items Subtotal</span>
                          <span className="tabular-nums">₹{Number(detail.items_subtotal || 0).toFixed(2)}</span>
                        </div>
                        {Number(detail.delivery_fee) > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Delivery Fee</span>
                            <span className="tabular-nums">+ ₹{Number(detail.delivery_fee).toFixed(2)}</span>
                          </div>
                        )}
                        {Number(detail.tax) > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Taxes</span>
                            <span className="tabular-nums">+ ₹{Number(detail.tax).toFixed(2)}</span>
                          </div>
                        )}
                        {Number(detail.discount) > 0 && (
                          <div className="flex justify-between text-emerald-600 font-medium">
                            <span>Discount</span>
                            <span className="tabular-nums">- ₹{Number(detail.discount).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center font-bold text-base pt-2 border-t border-border/50">
                          <span>Total Order Amount</span>
                          <span className="text-foreground font-black text-lg">₹{Number(detail.total || 0).toFixed(2)}</span>
                        </div>
                        {modalPInfo.isPartialAdvance && (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between text-xs font-bold text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                              <span>Advance Paid Online ({detail.payment?.method || "UPI/Card"})</span>
                              <span className="tabular-nums font-black">- ₹{modalPInfo.advancePaid.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                              <span>Balance to Collect at Store</span>
                              <span className="tabular-nums font-black text-sm text-amber-700">₹{modalPInfo.balanceAmount.toFixed(2)}</span>
                            </div>
                            <div className="text-[11px] text-center font-bold text-emerald-800 bg-emerald-100/60 py-1 rounded-md border border-emerald-200">
                              {modalPInfo.summaryText}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
