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
import { Search, Eye, Loader2, ShoppingBag, MapPin, User, Store } from "lucide-react";
import { format } from "date-fns";

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
  created_at: string;
  customer: { id: string; name: string; email: string } | null;
  vendor: { id: string; business_name: string } | null;
  item_count: number;
  items?: {
    product_name: string;
    quantity: number;
    unit_price?: number;
    total_price?: number;
    image_url?: string;
    status?: string;
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
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="PREPARING">Preparing</SelectItem>
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
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                      <TableCell>{order.customer?.name ?? "N/A"}</TableCell>
                      <TableCell>{order.vendor?.business_name ?? "N/A"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold">{order.item_count} Items</span>
                          {order.items && order.items.length > 0 && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {order.items
                                .map((i) => `${i.quantity}x ${i.product_name}`)
                                .join(", ")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">₹{order.total.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[order.status] ?? "bg-gray-100"}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.payment_status === "PAID" ? "default" : "secondary"}>
                          {order.payment_method} - {order.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(order.created_at), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {orders.length} of {pagination.total} orders
          </p>
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
            <DialogTitle className="flex justify-between items-center pr-6">
              <span>Order Details</span>
              <Badge className={statusColors[detail?.status || ""] || "bg-gray-100"}>
                {detail?.status}
              </Badge>
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              ID: {detail?.id} | No: {detail?.order_number}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            detail && (
              <div className="space-y-6 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                      <User className="h-4 w-4" /> Customer
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 p-4">
                      <p className="font-semibold">{detail.customer?.name || "N/A"}</p>
                      <p className="text-sm text-muted-foreground">{detail.customer?.email}</p>
                      {detail.address && (
                        <div className="mt-2 text-sm flex gap-2 text-muted-foreground items-start">
                          <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>
                            {detail.address.full_address}
                            {detail.address.landmark ? `, ${detail.address.landmark}` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                      <Store className="h-4 w-4" /> Vendor
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 p-4">
                      <p className="font-semibold">{detail.vendor?.business_name || "N/A"}</p>
                      <p className="text-sm text-muted-foreground">{detail.vendor?.id}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                    <ShoppingBag className="h-4 w-4" /> Items ({detail.item_count})
                  </div>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="divide-y divide-border/50 bg-card">
                      {(detail.items || []).map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className={`flex justify-between items-center p-4 hover:bg-muted/30 transition-colors ${item.status === "rejected" ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-muted border border-border overflow-hidden flex-shrink-0 grid place-items-center">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt="Item"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <ShoppingBag className="h-5 w-5 text-muted-foreground/50" />
                              )}
                            </div>
                            <div>
                              <p
                                className={`font-semibold ${item.status === "rejected" ? "line-through text-muted-foreground" : ""}`}
                              >
                                {item.quantity}x {item.product_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                ₹{item.unit_price} each
                              </p>
                              {item.status === "rejected" && (
                                <span className="mt-1 inline-block rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                                  Rejected
                                </span>
                              )}
                            </div>
                          </div>
                          <p
                            className={`font-bold ${item.status === "rejected" ? "line-through text-muted-foreground" : ""}`}
                          >
                            ₹{item.total_price}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-muted/30 p-4 border-t border-border space-y-1.5 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Items Subtotal</span>
                        <span className="tabular-nums">₹{Number(detail.items_subtotal || 0)}</span>
                      </div>
                      {Number(detail.delivery_fee) > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Delivery Fee</span>
                          <span className="tabular-nums">+ ₹{Number(detail.delivery_fee)}</span>
                        </div>
                      )}
                      {Number(detail.tax) > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Taxes</span>
                          <span className="tabular-nums">+ ₹{Number(detail.tax)}</span>
                        </div>
                      )}
                      {Number(detail.discount) > 0 && (
                        <div className="flex justify-between text-emerald-600 font-medium">
                          <span>Discount</span>
                          <span className="tabular-nums">- ₹{Number(detail.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center font-bold text-lg pt-2 border-t border-border/50">
                        <span>Total</span>
                        <span className="text-emerald-600">₹{detail.total}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
