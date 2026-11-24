import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Loader2,
  Bike,
  Compass,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Store,
  MapPin,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { format } from "date-fns";
import { AdminPaginationBar, type PaginationMeta } from "./AdminPaginationBar";

interface TrackingWallet {
  id: string;
  balance: number;
  available_credits: number;
  dues_amount: number;
  total_used: number;
  total_recharged: number;
  cost_per_track: number;
  is_overdrawn: boolean;
}

interface TrackingLog {
  id: string;
  type: string;
  credits: number;
  balance_after: number;
  dues_after: number;
  order_id: string | null;
  order_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  rider_name: string | null;
  vendor_names: string | null;
  description: string | null;
  created_at: string;
}

export function AdminTrackingCredits() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const {
    data: resData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["adminTrackingCredits", search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("per_page", "20");
      const res = await api.get<{
        success: boolean;
        data: {
          wallet: TrackingWallet;
          pagination: PaginationMeta;
          logs: TrackingLog[];
        };
      }>(`/admin/tracking-credits/logs?${params.toString()}`);
      return (res.data as any)?.data || (res.data as any);
    },
  });

  const wallet: TrackingWallet = resData?.wallet || {
    id: "",
    balance: 1200,
    available_credits: 1200,
    dues_amount: 0,
    total_used: 0,
    total_recharged: 1200,
    cost_per_track: 1.0,
    is_overdrawn: false,
  };

  const rawLogs: TrackingLog[] = resData?.logs || [];
  const logs: TrackingLog[] = rawLogs.filter(
    (log) => !(log.type !== "USAGE" && log.credits < 0) && log.credits !== -1200
  );
  const pagination: PaginationMeta = resData?.pagination || {
    page: 1,
    per_page: 20,
    total: logs.length,
    total_pages: 1,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2 text-foreground">
            <Compass className="h-6 w-6 text-emerald-600" />
            <span>Live Tracking & Fleet Credits</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time delivery tracking consumption ledger, route snapping history, and credit balance.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-9 gap-1.5 self-start sm:self-auto rounded-xl text-xs font-bold"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Available Credits */}
        <Card className="rounded-3xl border shadow-soft bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Available Credits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-black text-foreground flex items-baseline gap-1.5">
              <span>{wallet.available_credits.toLocaleString()}</span>
              <span className="text-xs font-semibold text-muted-foreground">Credits</span>
            </div>
            <div className="pt-1">
              {wallet.available_credits > 100 ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 border-emerald-300 text-[10px] font-bold">
                  ✓ Healthy Balance
                </Badge>
              ) : wallet.available_credits > 0 ? (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 border-amber-300 text-[10px] font-bold">
                  ⚠ Low Balance
                </Badge>
              ) : (
                <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25 border-rose-300 text-[10px] font-bold">
                  0 Available (Overdraft Mode)
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Dues to Pay */}
        <Card
          className={`rounded-3xl border shadow-soft transition-all ${
            wallet.dues_amount > 0
              ? "bg-amber-500/5 dark:bg-amber-950/20 border-amber-300/80"
              : "bg-card"
          }`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Dues to Pay</span>
              {wallet.dues_amount > 0 && (
                <AlertTriangle className="h-4 w-4 text-amber-600 animate-pulse" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div
              className={`text-3xl font-black flex items-baseline gap-1 ${
                wallet.dues_amount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
              }`}
            >
              <span>{Math.round(wallet.dues_amount)} Credits</span>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1 leading-tight">
              {wallet.dues_amount > 0 ? (
                <span className="text-amber-700 dark:text-amber-300 font-semibold">
                  Overdraft active — tracking continues smoothly without interruption.
                </span>
              ) : (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Zero Outstanding Dues
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Total Deliveries Tracked */}
        <Card className="rounded-3xl border shadow-soft bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Deliveries Tracked
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-black text-foreground">
              {wallet.total_used.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Lifetime total live-tracked customer orders
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Tracking Rate */}
        <Card className="rounded-3xl border shadow-soft bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Tracking Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-black text-foreground flex items-baseline gap-1">
              <span>1 Credit</span>
              <span className="text-xs font-semibold text-muted-foreground">/ store stop</span>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              1 credit per merchant stop (e.g. 2 stores = 2 credits)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage History Section */}
      <Card className="rounded-3xl border shadow-soft overflow-hidden">
        <div className="p-4 sm:p-5 border-b bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-display font-black text-base text-foreground">
              Credit Usage & Delivery Audit Ledger
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Granular record of each delivery order tracked, rider assigned, merchant pickups, and drop-off destinations.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Order #, Customer, Rider…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 rounded-xl text-xs bg-muted/40"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[140px] text-xs font-bold">Date & Time</TableHead>
                <TableHead className="w-[120px] text-xs font-bold">Type</TableHead>
                <TableHead className="w-[130px] text-xs font-bold">Order #</TableHead>
                <TableHead className="min-w-[200px] text-xs font-bold">Customer & Drop-off</TableHead>
                <TableHead className="min-w-[170px] text-xs font-bold">Merchant / Pickups</TableHead>
                <TableHead className="min-w-[140px] text-xs font-bold">Delivery Rider</TableHead>
                <TableHead className="text-right text-xs font-bold">Credits</TableHead>
                <TableHead className="text-right text-xs font-bold">Balance After</TableHead>
                <TableHead className="text-right text-xs font-bold">Dues After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600 mx-auto" />
                    <p className="text-xs text-muted-foreground mt-2 font-medium">
                      Loading tracking credit records…
                    </p>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <Compass className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-semibold">No usage logs found.</p>
                    <p className="text-xs">
                      {search ? "No records match your search filter." : "Live tracking activity will be logged here."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const isUsage = log.type === "USAGE";
                  return (
                    <TableRow key={log.id} className="hover:bg-muted/30">
                      {/* Date */}
                      <TableCell className="text-xs whitespace-nowrap font-medium text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                          <span>{format(new Date(log.created_at), "dd MMM yyyy, hh:mm a")}</span>
                        </div>
                      </TableCell>

                      {/* Type Badge */}
                      <TableCell>
                        {isUsage ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
                          >
                            <ArrowDownRight className="h-3 w-3 mr-1 text-emerald-600" />
                            Live Track
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold border-blue-200 bg-blue-50/70 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300"
                          >
                            <ArrowUpRight className="h-3 w-3 mr-1 text-blue-600" />
                            Recharge
                          </Badge>
                        )}
                      </TableCell>

                      {/* Order Number */}
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {log.order_number ? (
                          <span className="px-2 py-0.5 rounded-lg bg-muted border font-semibold">
                            #{log.order_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Customer & Address */}
                      <TableCell className="text-xs max-w-xs">
                        <div className="font-bold text-foreground truncate">
                          {log.customer_name || "Customer"}
                          {log.customer_phone && (
                            <span className="text-[11px] font-normal text-muted-foreground ml-1">
                              ({log.customer_phone})
                            </span>
                          )}
                        </div>
                        {log.customer_address && (
                          <div className="flex items-start gap-1 text-[11px] text-muted-foreground truncate mt-0.5" title={log.customer_address}>
                            <MapPin className="h-3 w-3 text-rose-500 shrink-0 mt-0.5" />
                            <span className="truncate">{log.customer_address}</span>
                          </div>
                        )}
                      </TableCell>

                      {/* Merchant Pickups */}
                      <TableCell className="text-xs max-w-xs">
                        {log.vendor_names ? (
                          <div className="flex items-center gap-1.5 truncate text-foreground font-medium" title={log.vendor_names}>
                            <Store className="h-3 w-3 text-amber-600 shrink-0" />
                            <span className="truncate">{log.vendor_names}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Rider */}
                      <TableCell className="text-xs">
                        {log.rider_name ? (
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <Bike className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span>{log.rider_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Credits */}
                      <TableCell className="text-right font-black text-xs">
                        {log.credits < 0 ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            {log.credits}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{log.credits}
                          </span>
                        )}
                      </TableCell>

                      {/* Balance After */}
                      <TableCell className="text-right font-mono font-bold text-xs">
                        <span className={log.balance_after < 0 ? "text-amber-600" : "text-foreground"}>
                          {log.balance_after.toLocaleString()}
                        </span>
                      </TableCell>

                      {/* Dues After */}
                      <TableCell className="text-right font-mono text-xs">
                        {log.dues_after > 0 ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {Math.round(log.dues_after)} Credits
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="p-4 border-t bg-muted/20">
            <AdminPaginationBar
              pagination={pagination}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
