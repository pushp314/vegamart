import { useState } from "react";
import {
  Plus,
  Tag,
  Search,
  CheckCircle2,
  Ban,
  Sparkles,
  Play,
  AlertCircle,
  XCircle,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { Coupon } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPaginationBar, type PaginationMeta } from "./AdminPaginationBar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CouponCheckItem {
  name: string;
  passed: boolean;
  message: string;
  severity: "error" | "warning" | "success";
}

interface CouponTestResponse {
  found: boolean;
  code: string;
  is_working: boolean;
  summary_message: string;
  coupon?: {
    id: string;
    code: string;
    type: "PERCENTAGE" | "FIXED" | "FREE_DELIVERY";
    value: number;
    max_discount?: number | null;
    min_order_value?: number | null;
    usage_limit: number;
    per_user_limit: number;
    used_count: number;
    valid_from: string;
    valid_until: string;
    is_active: boolean;
    created_by_vendor_id?: string | null;
  } | null;
  test_order_value?: number;
  calculated_discount: number;
  final_amount: number;
  is_free_delivery?: boolean;
  checks: CouponCheckItem[];
}

export function AdminCoupons() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Diagnostic Test Modal state
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testCode, setTestCode] = useState("");
  const [testOrderValue, setTestOrderValue] = useState("500");
  const [testResult, setTestResult] = useState<CouponTestResponse | null>(null);

  const { data: couponsRes, isLoading } = useQuery({
    queryKey: ["adminCoupons", query, page],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", "20");
      if (query.trim()) params.set("q", query.trim());
      return api.get<any>(`/coupons?${params.toString()}`);
    },
  });

  const coupons = Array.isArray(couponsRes?.data) ? couponsRes.data : [];
  const pagination = couponsRes?.pagination as PaginationMeta | undefined;

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/coupons", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCoupons"] });
      toast.success("Coupon created successfully");
      setIsCreateModalOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to create coupon"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/coupons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCoupons"] });
      toast.success("Coupon deleted successfully");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete coupon"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/coupons/${id}`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCoupons"] });
      toast.success("Coupon status updated");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update coupon"),
  });

  const testMutation = useMutation({
    mutationFn: async ({ code, order_value }: { code: string; order_value: number }) => {
      const res = await api.post<CouponTestResponse>("/coupons/test", {
        code: code.trim().toUpperCase(),
        order_value: Number(order_value) || 500,
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data) {
        setTestResult(data);
        if (data.is_working) {
          toast.success(`Coupon ${data.code} is valid and working!`);
        } else {
          toast.error(`Coupon issue detected for ${data.code}`);
        }
      }
    },
    onError: (err: any) => toast.error(err?.message || "Failed to test coupon"),
  });

  const handleOpenTestModal = (code = "", orderValue = 500) => {
    const formattedCode = code.trim().toUpperCase();
    setTestCode(formattedCode);
    setTestOrderValue(String(orderValue));
    setIsTestModalOpen(true);
    if (formattedCode) {
      testMutation.mutate({ code: formattedCode, order_value: orderValue });
    } else {
      setTestResult(null);
    }
  };

  const handleRunTest = (codeToTest = testCode, orderVal = Number(testOrderValue) || 500) => {
    if (!codeToTest.trim()) {
      toast.error("Please enter a coupon code to test");
      return;
    }
    testMutation.mutate({
      code: codeToTest.trim().toUpperCase(),
      order_value: orderVal,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Coupons
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage promotional codes, discount thresholds, and real-time validation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => handleOpenTestModal()}
            className="border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 gap-2 font-medium"
          >
            <Sparkles className="h-4 w-4 text-emerald-600" />
            Test / Check Coupon
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Coupon
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card border border-border p-3 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search coupons..."
            className="pl-10 rounded-xl bg-muted/50 border-transparent focus:bg-background"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {coupons.map((coupon: Coupon) => (
          <div
            key={coupon.id}
            className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between hover:border-primary/30 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" />
                  <span className="font-black text-lg text-foreground tracking-tight">
                    {coupon.code}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    coupon.is_active
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
                  }`}
                >
                  {coupon.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground font-semibold mb-1">
                {coupon.type === "PERCENTAGE"
                  ? `${coupon.value}% OFF`
                  : coupon.type === "FREE_DELIVERY"
                    ? "Free Delivery"
                    : `₹${coupon.value} OFF`}
              </p>
              <p className="text-xs text-muted-foreground/70">
                Max Discount:{" "}
                {coupon.max_discount != null && Number(coupon.max_discount) > 0
                  ? `₹${coupon.max_discount}`
                  : "No limit"}
              </p>
              {coupon.min_order_value != null && Number(coupon.min_order_value) > 0 && (
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Min Order: ₹{coupon.min_order_value}
                </p>
              )}
              {coupon.valid_until && (
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Expires: {new Date(coupon.valid_until).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className={
                    coupon.is_active
                      ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                      : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  }
                  onClick={() =>
                    toggleActiveMutation.mutate({
                      id: coupon.id,
                      is_active: !coupon.is_active,
                    })
                  }
                  disabled={toggleActiveMutation.isPending}
                >
                  {coupon.is_active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-primary hover:bg-primary/5 gap-1 border-primary/20"
                  onClick={() =>
                    handleOpenTestModal(
                      coupon.code,
                      coupon.min_order_value ? Number(coupon.min_order_value) : 500
                    )
                  }
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Check
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this coupon?")) {
                    deleteMutation.mutate(coupon.id);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {coupons.length === 0 && !isLoading && (
        <div className="text-center py-20 bg-card rounded-3xl border border-border">
          <Tag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold">No coupons found</h3>
          <p className="text-muted-foreground text-sm">Create a new coupon to get started.</p>
        </div>
      )}

      <AdminPaginationBar pagination={pagination} onPageChange={setPage} />

      {/* Check / Test Coupon Diagnostic Modal */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Coupon Health & Discount Tester</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verify if any coupon code works, why it might fail, and calculate exact checkout discounts.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-2xl border border-border">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Coupon Code
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={testCode}
                    onChange={(e) => setTestCode(e.target.value.toUpperCase().trim())}
                    placeholder="e.g. SUMMER20"
                    className="pl-9 font-mono font-bold uppercase tracking-wider bg-background"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRunTest();
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Simulated Cart Value (₹)
                </label>
                <Input
                  type="number"
                  min="1"
                  step="10"
                  value={testOrderValue}
                  onChange={(e) => setTestOrderValue(e.target.value)}
                  placeholder="500"
                  className="font-medium bg-background"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRunTest();
                  }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground mr-1">Quick presets:</span>
                {[199, 499, 999, 1499, 2999].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setTestOrderValue(String(amt));
                      if (testCode.trim()) {
                        handleRunTest(testCode, amt);
                      }
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      Number(testOrderValue) === amt
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 hover:bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              <Button
                onClick={() => handleRunTest()}
                disabled={!testCode.trim() || testMutation.isPending}
                className="gap-2 px-5"
              >
                {testMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    Run Diagnostic
                  </>
                )}
              </Button>
            </div>

            {testResult && (
              <div className="space-y-4 pt-2 border-t border-border animate-in fade-in duration-300">
                {/* Status banner */}
                <div
                  className={`p-4 rounded-2xl border flex items-start gap-3 ${
                    testResult.is_working
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100"
                  }`}
                >
                  {testResult.is_working ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm">
                      {testResult.is_working
                        ? `Coupon "${testResult.code}" is 100% Active & Working!`
                        : `Coupon "${testResult.code}" Cannot Be Used`}
                    </h4>
                    <p className="text-xs opacity-90 leading-relaxed">
                      {testResult.summary_message}
                    </p>
                  </div>
                </div>

                {/* Price Calculation Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-2xl bg-card border border-border text-center">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Simulated Cart
                    </div>
                    <div className="text-lg font-black text-foreground mt-1">
                      ₹{testResult.test_order_value ?? testOrderValue}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-card border border-border text-center">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Calculated Discount
                    </div>
                    <div
                      className={`text-lg font-black mt-1 ${
                        testResult.calculated_discount > 0 || testResult.is_free_delivery
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {testResult.is_free_delivery
                        ? "Free Delivery"
                        : `₹${testResult.calculated_discount.toFixed(2)}`}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-card border border-border text-center">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Customer Pays
                    </div>
                    <div className="text-lg font-black text-foreground mt-1">
                      ₹{testResult.final_amount.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Diagnostic Checks Breakdown */}
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Verification Checklist ({testResult.checks.filter((c) => c.passed).length}/
                      {testResult.checks.length} Passed)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Server checkout verification
                    </span>
                  </div>

                  <div className="space-y-2">
                    {testResult.checks.map((check, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 p-2 rounded-xl text-xs hover:bg-muted/40 transition-colors"
                      >
                        {check.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        ) : check.severity === "warning" ? (
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <span className="font-semibold text-foreground mr-1.5">
                            {check.name}:
                          </span>
                          <span
                            className={
                              check.passed
                                ? "text-muted-foreground"
                                : "text-rose-600 dark:text-rose-400 font-medium"
                            }
                          >
                            {check.message}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Action if Inactive */}
                {testResult.found && testResult.coupon && !testResult.coupon.is_active && (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                    <div className="text-xs text-amber-800 dark:text-amber-200">
                      This coupon exists in the database but is currently turned off.
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-amber-500/40 text-amber-700 hover:bg-amber-100 dark:text-amber-300"
                      onClick={() => {
                        toggleActiveMutation.mutate(
                          { id: testResult.coupon!.id, is_active: true },
                          {
                            onSuccess: () => {
                              handleRunTest(testCode, Number(testOrderValue) || 500);
                            },
                          }
                        );
                      }}
                      disabled={toggleActiveMutation.isPending}
                    >
                      Activate Coupon Now
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Coupon Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Coupon</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target as HTMLFormElement);
              const minOrder = fd.get("min_order_value");
              const maxDisc = fd.get("max_discount");
              const discType = fd.get("discount_type") as string;
              const discVal = fd.get("discount_value");

              createMutation.mutate({
                code: (fd.get("code") as string).trim().toUpperCase(),
                type: discType,
                value:
                  discType === "FREE_DELIVERY" ? (discVal ? Number(discVal) : 0) : Number(discVal),
                min_order_value: minOrder ? Number(minOrder) : null,
                max_discount: maxDisc ? Number(maxDisc) : null,
                valid_from: new Date().toISOString(),
                valid_until: fd.get("expires_at")
                  ? new Date(fd.get("expires_at") as string).toISOString()
                  : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
                usage_limit: fd.get("usage_limit") ? Number(fd.get("usage_limit")) : 0,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Coupon Code
              </label>
              <Input name="code" placeholder="e.g. SUMMER20" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Type</label>
                <select
                  name="discount_type"
                  required
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Flat Amount</option>
                  <option value="FREE_DELIVERY">Free Delivery</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Value</label>
                <Input name="discount_value" type="number" step="0.01" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Min Order (₹)
                </label>
                <Input name="min_order_value" type="number" step="0.01" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Max Discount (₹)
                </label>
                <Input name="max_discount" type="number" step="0.01" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Expires At
                </label>
                <Input name="expires_at" type="datetime-local" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Usage Limit
                </label>
                <Input name="usage_limit" type="number" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
