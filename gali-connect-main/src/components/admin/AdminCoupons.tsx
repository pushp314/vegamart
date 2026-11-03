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
  Truck,
  Percent,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  Pencil,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatErrorMessage } from "@/lib/api";
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

function formatDateTimeLocal(dateString?: string | null): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  // Create Coupon Modal Form State
  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState<"PERCENTAGE" | "FIXED" | "FREE_DELIVERY">("PERCENTAGE");
  const [formValue, setFormValue] = useState("10");
  const [formMinOrder, setFormMinOrder] = useState("");
  const [formMaxDiscount, setFormMaxDiscount] = useState("");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formUsageLimit, setFormUsageLimit] = useState("");
  const [showGuide, setShowGuide] = useState(false);

  // Edit Coupon Modal Form State
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editCode, setEditCode] = useState("");
  const [editType, setEditType] = useState<"PERCENTAGE" | "FIXED" | "FREE_DELIVERY">("PERCENTAGE");
  const [editValue, setEditValue] = useState("");
  const [editMinOrder, setEditMinOrder] = useState("");
  const [editMaxDiscount, setEditMaxDiscount] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editUsageLimit, setEditUsageLimit] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const resetCreateForm = () => {
    setFormCode("");
    setFormType("PERCENTAGE");
    setFormValue("10");
    setFormMinOrder("");
    setFormMaxDiscount("");
    setFormExpiresAt("");
    setFormUsageLimit("");
    setShowGuide(false);
  };

  const applyPreset = (type: "PERCENTAGE" | "FIXED" | "FREE_DELIVERY") => {
    if (type === "FREE_DELIVERY") {
      setFormType("FREE_DELIVERY");
      setFormCode("FREEDEL299");
      setFormValue("0");
      setFormMinOrder("299");
      setFormMaxDiscount("");
    } else if (type === "FIXED") {
      setFormType("FIXED");
      setFormCode("SAVE50");
      setFormValue("50");
      setFormMinOrder("300");
      setFormMaxDiscount("");
    } else {
      setFormType("PERCENTAGE");
      setFormCode("FESTIVE15");
      setFormValue("15");
      setFormMinOrder("499");
      setFormMaxDiscount("150");
    }
  };

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
    mutationFn: async (data: any) => {
      const res = await api.post("/coupons", data);
      if (!res.success) {
        throw new Error(formatErrorMessage(res.error, "Failed to create coupon"));
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["adminCoupons"] });
      const createdCode = variables.code;
      toast.success(`Coupon ${createdCode} created successfully!`, {
        action: {
          label: "Test Coupon",
          onClick: () => handleOpenTestModal(createdCode, variables.min_order_value || 500),
        },
      });
      setIsCreateModalOpen(false);
      resetCreateForm();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create coupon");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.patch(`/coupons/${id}`, data);
      if (!res.success) {
        throw new Error(formatErrorMessage(res.error, "Failed to update coupon"));
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["adminCoupons"] });
      const updatedCode = variables.data.code || editingCoupon?.code || "Coupon";
      toast.success(`Coupon ${updatedCode} updated successfully!`, {
        action: {
          label: "Test Coupon",
          onClick: () => handleOpenTestModal(updatedCode, variables.data.min_order_value || 500),
        },
      });
      setIsEditModalOpen(false);
      setEditingCoupon(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update coupon");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/coupons/${id}`);
      if (!res.success) {
        throw new Error(formatErrorMessage(res.error, "Failed to delete coupon"));
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCoupons"] });
      toast.success("Coupon deleted successfully");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete coupon"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await api.patch(`/coupons/${id}`, { is_active });
      if (!res.success) {
        throw new Error(formatErrorMessage(res.error, "Failed to update coupon status"));
      }
      return res.data;
    },
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
      if (!res.success) {
        throw new Error(formatErrorMessage(res.error, "Failed to test coupon"));
      }
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

  const handleOpenEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setEditCode(coupon.code || "");
    setEditType((coupon.type as any) || "PERCENTAGE");
    setEditValue(coupon.type === "FREE_DELIVERY" ? "0" : String(coupon.value ?? ""));
    setEditMinOrder(coupon.min_order_value != null && Number(coupon.min_order_value) > 0 ? String(coupon.min_order_value) : "");
    setEditMaxDiscount(coupon.max_discount != null && Number(coupon.max_discount) > 0 ? String(coupon.max_discount) : "");
    setEditExpiresAt(formatDateTimeLocal(coupon.valid_until));
    setEditUsageLimit(coupon.usage_limit && coupon.usage_limit > 0 ? String(coupon.usage_limit) : "");
    setEditIsActive(coupon.is_active ?? true);
    setIsEditModalOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formCode.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 2) {
      toast.error("Please enter a valid coupon code (min 2 characters, letters or numbers).");
      return;
    }

    let val = 0;
    if (formType === "FREE_DELIVERY") {
      val = 0;
    } else {
      val = Number(formValue);
      if (isNaN(val) || val <= 0) {
        toast.error(
          formType === "PERCENTAGE"
            ? "Please enter a valid discount percentage (e.g. 10 for 10%)."
            : "Please enter a valid discount rupee amount (e.g. 50 for ₹50)."
        );
        return;
      }
      if (formType === "PERCENTAGE" && val > 100) {
        toast.error("Percentage discount cannot exceed 100%.");
        return;
      }
    }

    if (formExpiresAt) {
      const expDate = new Date(formExpiresAt);
      if (isNaN(expDate.getTime()) || expDate.getTime() <= Date.now()) {
        toast.error("Expiry date & time must be in the future.");
        return;
      }
    }

    const payload: any = {
      code: cleanCode,
      type: formType,
      value: val,
      min_order_value: formMinOrder ? Number(formMinOrder) : null,
      max_discount: formType === "PERCENTAGE" && formMaxDiscount ? Number(formMaxDiscount) : null,
      usage_limit: formUsageLimit ? Number(formUsageLimit) : 0,
      valid_from: new Date(Date.now() - 60000).toISOString(),
    };

    if (formExpiresAt) {
      payload.valid_until = new Date(formExpiresAt).toISOString();
    } else {
      // Default to 30 days from now
      payload.valid_until = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    }

    createMutation.mutate(payload);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon) return;
    const cleanCode = editCode.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 2) {
      toast.error("Please enter a valid coupon code (min 2 characters).");
      return;
    }

    let val = 0;
    if (editType === "FREE_DELIVERY") {
      val = 0;
    } else {
      val = Number(editValue);
      if (isNaN(val) || val <= 0) {
        toast.error(
          editType === "PERCENTAGE"
            ? "Please enter a valid discount percentage (e.g. 10 for 10%)."
            : "Please enter a valid discount rupee amount (e.g. 50 for ₹50)."
        );
        return;
      }
      if (editType === "PERCENTAGE" && val > 100) {
        toast.error("Percentage discount cannot exceed 100%.");
        return;
      }
    }

    if (editExpiresAt) {
      const expDate = new Date(editExpiresAt);
      if (isNaN(expDate.getTime())) {
        toast.error("Please select a valid expiry date.");
        return;
      }
      if (editingCoupon?.valid_from && new Date(editingCoupon.valid_from).getTime() >= expDate.getTime()) {
        toast.error(`Expiry date must be after start date (${new Date(editingCoupon.valid_from).toLocaleDateString()}).`);
        return;
      }
    }

    const payload: any = {
      code: cleanCode,
      type: editType,
      value: val,
      min_order_value: editMinOrder ? Number(editMinOrder) : null,
      max_discount: editType === "PERCENTAGE" && editMaxDiscount ? Number(editMaxDiscount) : null,
      usage_limit: editUsageLimit ? Number(editUsageLimit) : 0,
      is_active: editIsActive,
    };

    if (editExpiresAt) {
      payload.valid_until = new Date(editExpiresAt).toISOString();
    }

    updateMutation.mutate({ id: editingCoupon.id, data: payload });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Coupons
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage promotional codes, free shipping rules, edit existing coupons, and run diagnostics.
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
          <Button
            onClick={() => {
              resetCreateForm();
              setIsCreateModalOpen(true);
            }}
            className="gap-2 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create Coupon
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card border border-border p-3 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search coupons by code..."
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
            className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-all hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    {coupon.type === "FREE_DELIVERY" ? (
                      <Truck className="h-4 w-4 text-emerald-600" />
                    ) : coupon.type === "PERCENTAGE" ? (
                      <Percent className="h-4 w-4 text-primary" />
                    ) : (
                      <Tag className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <span className="font-black text-lg font-mono text-foreground tracking-tight">
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

              <div className="mb-3">
                <p className="text-base font-bold text-foreground flex items-center gap-1.5">
                  {coupon.type === "PERCENTAGE" ? (
                    `${coupon.value}% OFF Products`
                  ) : coupon.type === "FREE_DELIVERY" ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Truck className="h-4 w-4" /> 100% Free Delivery
                    </span>
                  ) : (
                    `Flat ₹${coupon.value} OFF`
                  )}
                </p>
                {coupon.type === "PERCENTAGE" && (
                  <p className="text-xs text-muted-foreground/80 mt-0.5">
                    Max Discount:{" "}
                    {coupon.max_discount != null && Number(coupon.max_discount) > 0
                      ? `₹${coupon.max_discount}`
                      : "No limit (uncapped)"}
                  </p>
                )}
                {coupon.type === "FREE_DELIVERY" && (
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                    Waives all delivery charges at checkout
                  </p>
                )}
              </div>

              <div className="space-y-1 text-xs text-muted-foreground/80 bg-muted/30 p-2.5 rounded-xl border border-border/50">
                <div className="flex justify-between">
                  <span>Min Order:</span>
                  <span className="font-semibold text-foreground">
                    {coupon.min_order_value != null && Number(coupon.min_order_value) > 0
                      ? `₹${coupon.min_order_value}`
                      : "Any cart (₹0)"}
                  </span>
                </div>
                {coupon.valid_until && (
                  <div className="flex justify-between">
                    <span>Expires:</span>
                    <span className="font-semibold text-foreground">
                      {new Date(coupon.valid_until).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Claims:</span>
                  <span className="font-semibold text-foreground">
                    {coupon.used_count || 0}{" "}
                    {coupon.usage_limit > 0 ? `of ${coupon.usage_limit}` : "(Unlimited)"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-foreground hover:bg-muted gap-1 border-border text-xs h-8 px-2.5 font-medium"
                  onClick={() => handleOpenEditModal(coupon)}
                >
                  <Pencil className="h-3.5 w-3.5 text-primary" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-primary hover:bg-primary/5 gap-1 border-primary/20 text-xs h-8 px-2.5"
                  onClick={() =>
                    handleOpenTestModal(
                      coupon.code,
                      coupon.min_order_value ? Number(coupon.min_order_value) : 500
                    )
                  }
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Test
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={
                    coupon.is_active
                      ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs h-8 px-2"
                      : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs h-8 px-2"
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
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-xs h-8 px-2.5"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete coupon ${coupon.code}?`)) {
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
          <p className="text-muted-foreground text-sm mt-1">
            Create a new coupon or click "Test / Check Coupon" to diagnose any code.
          </p>
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
                <DialogTitle className="text-xl font-bold">Coupon Health & Diagnostic Tester</DialogTitle>
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
                    placeholder="e.g. SUMMER20 or FREEDEL"
                    className="pl-9 font-mono font-bold uppercase tracking-wider bg-background"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRunTest();
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Simulated Order Subtotal (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="10"
                  value={testOrderValue}
                  onChange={(e) => setTestOrderValue(e.target.value)}
                  placeholder="500"
                  className="bg-background"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRunTest();
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTestCode("");
                  setTestResult(null);
                }}
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => handleRunTest()}
                disabled={testMutation.isPending || !testCode.trim()}
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {testMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running Diagnosis...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    Run Diagnostic Check
                  </>
                )}
              </Button>
            </div>

            {testResult && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div
                  className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                    testResult.is_working
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100"
                  }`}
                >
                  {testResult.is_working ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-6 w-6 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base">
                        {testResult.is_working
                          ? "✓ Coupon is 100% Valid & Working"
                          : "✕ Coupon Issue Detected"}
                      </span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-background/80 font-bold border border-border">
                        {testResult.code}
                      </span>
                    </div>
                    <p className="text-xs mt-1 text-foreground/80 leading-relaxed">
                      {testResult.summary_message}
                    </p>
                  </div>
                </div>

                {testResult.is_working && (
                  <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-muted/40 border border-border text-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        Order Subtotal
                      </span>
                      <p className="text-lg font-bold text-foreground mt-0.5">
                        ₹{Number(testResult.test_order_value || testOrderValue || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        {testResult.is_free_delivery ? "Benefit" : "Discount Applied"}
                      </span>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {testResult.is_free_delivery
                          ? "Free Delivery (₹0 Fee)"
                          : `-₹${Number(testResult.calculated_discount || 0).toFixed(2)}`}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        Customer Subtotal
                      </span>
                      <p className="text-lg font-bold text-foreground mt-0.5">
                        ₹{Number(testResult.final_amount || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Eligibility Checklist ({testResult.checks.length} criteria)
                  </h4>
                  <div className="space-y-2">
                    {testResult.checks.map((chk, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-2.5 rounded-xl border text-xs ${
                          chk.passed
                            ? "bg-card border-border text-foreground"
                            : chk.severity === "error"
                              ? "bg-rose-500/5 border-rose-500/20 text-rose-800 dark:text-rose-200"
                              : "bg-amber-500/5 border-amber-500/20 text-amber-800 dark:text-amber-200"
                        }`}
                      >
                        {chk.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        ) : chk.severity === "error" ? (
                          <XCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <span className="font-bold mr-1.5">{chk.name}:</span>
                          <span className="text-muted-foreground">{chk.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

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

      {/* Upgraded, Foolproof Create Coupon Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">Create New Coupon</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure discounts or free delivery for your store.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowGuide(!showGuide)}
                className="text-xs text-primary gap-1.5 h-8 px-2.5 hover:bg-primary/5"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                {showGuide ? "Hide Guide" : "View Guide"}
              </Button>
            </div>
          </DialogHeader>

          {/* Quick Presets for Instant Setup */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              ⚡ Quick Templates (Click to Auto-fill)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => applyPreset("FREE_DELIVERY")}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  formType === "FREE_DELIVERY"
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 shadow-sm"
                    : "border-border hover:border-emerald-300 bg-card text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-700 dark:text-emerald-400">
                  <Truck className="h-3.5 w-3.5" /> Free Delivery
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Min Order: ₹299</p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset("PERCENTAGE")}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  formType === "PERCENTAGE"
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border hover:border-primary/40 bg-card text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-primary">
                  <Percent className="h-3.5 w-3.5" /> 15% Percentage
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Cap: ₹150 • Min ₹499</p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset("FIXED")}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  formType === "FIXED"
                    ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 shadow-sm"
                    : "border-border hover:border-amber-300 bg-card text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-400">
                  <Tag className="h-3.5 w-3.5" /> Flat ₹50 Off
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Min Order: ₹300</p>
              </button>
            </div>
          </div>

          {/* Interactive Guide Cheatsheet */}
          {showGuide && (
            <div className="p-3.5 rounded-2xl bg-muted/50 border border-border text-xs space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Info className="h-4 w-4 text-primary" />
                <span>How to Create Coupons Correctly & Field Meanings:</span>
              </div>
              <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
                <li>
                  <strong className="text-foreground">Coupon Code (Required):</strong> The secret word customers type (e.g., <code className="font-mono bg-muted px-1 rounded text-primary">SUMMER20</code>). Must be unique.
                </li>
                <li>
                  <strong className="text-foreground">Free Delivery:</strong> Completely removes the delivery fee at checkout! You do <span className="underline font-semibold">not</span> need to specify any discount value; it is automatically handled.
                </li>
                <li>
                  <strong className="text-foreground">Percentage Discount:</strong> E.g., 20% off items. You can set an optional <em>Max Discount Cap</em> (e.g. ₹100) so big orders don't get unlimited discounts.
                </li>
                <li>
                  <strong className="text-foreground">Flat Amount:</strong> Subtracts a fixed rupee amount (e.g. ₹50) from qualifying cart items.
                </li>
                <li>
                  <strong className="text-foreground">Min Order Value (Optional):</strong> If set to ₹299, the coupon only works when customer cart items reach at least ₹299. Leave blank for any amount.
                </li>
                <li>
                  <strong className="text-foreground">Usage Limit (Optional):</strong> Total times this coupon can be used across all shoppers combined. 0 means unlimited.
                </li>
              </ul>
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-1">
            {/* Field 1: Coupon Code */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  Coupon Code
                  <span className="text-[10px] uppercase font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                    Required
                  </span>
                </label>
                <span className="text-[11px] text-muted-foreground">Auto-uppercased</span>
              </div>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  name="code"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                  placeholder="e.g. FREEDEL or FESTIVE20"
                  className="pl-9 font-mono font-bold tracking-wider text-base uppercase bg-background"
                  maxLength={40}
                  required
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Customers enter this code at checkout. Use letters and numbers without spaces.
              </p>
            </div>

            {/* Field 2 & 3: Type and Value */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    Coupon Type
                    <span className="text-[10px] uppercase font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                      Required
                    </span>
                  </label>
                </div>
                <select
                  value={formType}
                  onChange={(e) => {
                    const newType = e.target.value as "PERCENTAGE" | "FIXED" | "FREE_DELIVERY";
                    setFormType(newType);
                    if (newType === "FREE_DELIVERY") {
                      setFormValue("0");
                      setFormMaxDiscount("");
                    } else if (newType === "PERCENTAGE" && formValue === "0") {
                      setFormValue("10");
                    } else if (newType === "FIXED" && formValue === "0") {
                      setFormValue("50");
                    }
                  }}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="PERCENTAGE">🎁 Percentage Discount (%)</option>
                  <option value="FIXED">🏷️ Flat Rupee Amount (₹)</option>
                  <option value="FREE_DELIVERY">🚚 Free Delivery (100% Waived)</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  {formType === "FREE_DELIVERY"
                    ? "Waives delivery fee completely."
                    : formType === "PERCENTAGE"
                      ? "Calculates percentage discount on items."
                      : "Deducts flat rupee discount from cart."}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    {formType === "FREE_DELIVERY"
                      ? "Delivery Fee Waiver"
                      : formType === "PERCENTAGE"
                        ? "Discount Percentage (%)"
                        : "Discount Amount (₹)"}
                    {formType === "FREE_DELIVERY" ? (
                      <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        Automatic
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                        Required
                      </span>
                    )}
                  </label>
                </div>

                {formType === "FREE_DELIVERY" ? (
                  <div className="h-10 px-3 rounded-md border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span>Free Delivery (Value auto-set to ₹0)</span>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      type="number"
                      step={formType === "PERCENTAGE" ? "1" : "0.01"}
                      min={formType === "PERCENTAGE" ? "1" : "0.01"}
                      max={formType === "PERCENTAGE" ? "100" : undefined}
                      value={formValue}
                      onChange={(e) => setFormValue(e.target.value)}
                      placeholder={formType === "PERCENTAGE" ? "e.g. 15 for 15%" : "e.g. 50 for ₹50"}
                      className="bg-background font-bold text-base"
                      required
                    />
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {formType === "FREE_DELIVERY"
                    ? "Customer pays ₹0 delivery charges."
                    : formType === "PERCENTAGE"
                      ? "Enter value from 1 to 100 (e.g. 20 = 20% off)."
                      : "Enter exact rupee amount (e.g. 50 = ₹50 off)."}
                </p>
              </div>
            </div>

            {/* Field 4 & 5: Min Order Value & Max Discount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    Min Order Value (₹)
                    <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Optional
                    </span>
                  </label>
                </div>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={formMinOrder}
                  onChange={(e) => setFormMinOrder(e.target.value)}
                  placeholder="e.g. 299 (blank = any amount)"
                  className="bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  Minimum cart subtotal needed to redeem this coupon.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    Max Discount Cap (₹)
                    <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {formType === "PERCENTAGE" ? "Optional" : "N/A"}
                    </span>
                  </label>
                </div>
                {formType === "PERCENTAGE" ? (
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formMaxDiscount}
                    onChange={(e) => setFormMaxDiscount(e.target.value)}
                    placeholder="e.g. 150 (blank = uncapped)"
                    className="bg-background"
                  />
                ) : (
                  <div className="h-10 px-3 rounded-md border border-border bg-muted/40 flex items-center text-xs text-muted-foreground">
                    Not applicable for {formType === "FREE_DELIVERY" ? "Free Delivery" : "Flat Amount"}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {formType === "PERCENTAGE"
                    ? "Limits the maximum discount a customer can receive."
                    : "Only percentage coupons have a maximum discount cap."}
                </p>
              </div>
            </div>

            {/* Field 6 & 7: Expires At & Usage Limit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    Expires At
                    <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Optional
                    </span>
                  </label>
                </div>
                <Input
                  type="datetime-local"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                  className="bg-background text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Defaults to 30 days from today if left empty.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    Global Usage Limit
                    <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Optional
                    </span>
                  </label>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={formUsageLimit}
                  onChange={(e) => setFormUsageLimit(e.target.value)}
                  placeholder="0 = Unlimited uses"
                  className="bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  Total times this coupon can be redeemed across all users.
                </p>
              </div>
            </div>

            {/* Live Preview Card */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-primary/5 via-muted/40 to-primary/5 border border-primary/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Live Customer Preview
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Active On Create
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm bg-background px-2.5 py-1 rounded-lg border border-border shadow-xs">
                  {formCode.trim().toUpperCase() || "YOURCODE"}
                </span>
                <span className="font-bold text-xs text-foreground">
                  {formType === "FREE_DELIVERY"
                    ? "🚚 Free Delivery"
                    : formType === "PERCENTAGE"
                      ? `${formValue || "0"}% OFF${formMaxDiscount ? ` (Up to ₹${formMaxDiscount})` : ""}`
                      : `Flat ₹${formValue || "0"} OFF`}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Applies to{" "}
                {formMinOrder && Number(formMinOrder) > 0
                  ? `orders of ₹${formMinOrder} or more`
                  : "all qualifying orders"}
                .
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetCreateForm();
                }}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="gap-2 font-bold px-6"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating Coupon...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Coupon Now
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Coupon Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">
                    Edit Coupon: {editingCoupon?.code}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Modify discount settings, thresholds, expiry, or status.
                  </p>
                </div>
              </div>
              {editingCoupon && (
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      editIsActive
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
                    }`}
                  >
                    {editIsActive ? "Active" : "Inactive"}
                  </span>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Quick Stats Banner */}
          {editingCoupon && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-muted/40 border border-border text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Times Redeemed</span>
                <p className="font-bold text-foreground mt-0.5">
                  {editingCoupon.used_count || 0}{" "}
                  {editingCoupon.usage_limit > 0 ? `of ${editingCoupon.usage_limit} limit` : "(Unlimited claims)"}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Start Date</span>
                <p className="font-semibold text-foreground mt-0.5">
                  {new Date(editingCoupon.valid_from).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-1">
            {/* Field 1: Coupon Code */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  Coupon Code
                  <span className="text-[10px] uppercase font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                    Required
                  </span>
                </label>
                <span className="text-[11px] text-muted-foreground">Auto-uppercased</span>
              </div>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  name="edit_code"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                  placeholder="e.g. FREEDEL or FESTIVE20"
                  className="pl-9 font-mono font-bold tracking-wider text-base uppercase bg-background"
                  maxLength={40}
                  required
                />
              </div>
            </div>

            {/* Field 2 & 3: Type and Value */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  Coupon Type
                  <span className="text-[10px] uppercase font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                    Required
                  </span>
                </label>
                <select
                  value={editType}
                  onChange={(e) => {
                    const newType = e.target.value as "PERCENTAGE" | "FIXED" | "FREE_DELIVERY";
                    setEditType(newType);
                    if (newType === "FREE_DELIVERY") {
                      setEditValue("0");
                      setEditMaxDiscount("");
                    } else if (newType === "PERCENTAGE" && editValue === "0") {
                      setEditValue("10");
                    } else if (newType === "FIXED" && editValue === "0") {
                      setEditValue("50");
                    }
                  }}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="PERCENTAGE">🎁 Percentage Discount (%)</option>
                  <option value="FIXED">🏷️ Flat Rupee Amount (₹)</option>
                  <option value="FREE_DELIVERY">🚚 Free Delivery (100% Waived)</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  {editType === "FREE_DELIVERY"
                    ? "Waives delivery fee completely."
                    : editType === "PERCENTAGE"
                      ? "Calculates percentage discount on items."
                      : "Deducts flat rupee discount from cart."}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    {editType === "FREE_DELIVERY"
                      ? "Delivery Fee Waiver"
                      : editType === "PERCENTAGE"
                        ? "Discount Percentage (%)"
                        : "Discount Amount (₹)"}
                    {editType === "FREE_DELIVERY" ? (
                      <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        Automatic
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                        Required
                      </span>
                    )}
                  </label>
                </div>

                {editType === "FREE_DELIVERY" ? (
                  <div className="h-10 px-3 rounded-md border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span>Free Delivery (Value auto-set to ₹0)</span>
                  </div>
                ) : (
                  <Input
                    type="number"
                    step={editType === "PERCENTAGE" ? "1" : "0.01"}
                    min={editType === "PERCENTAGE" ? "1" : "0.01"}
                    max={editType === "PERCENTAGE" ? "100" : undefined}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder={editType === "PERCENTAGE" ? "e.g. 15 for 15%" : "e.g. 50 for ₹50"}
                    className="bg-background font-bold text-base"
                    required
                  />
                )}
                <p className="text-[11px] text-muted-foreground">
                  {editType === "FREE_DELIVERY"
                    ? "Customer pays ₹0 delivery charges."
                    : editType === "PERCENTAGE"
                      ? "Value between 1 and 100."
                      : "Exact rupee amount subtracted from items."}
                </p>
              </div>
            </div>

            {/* Field 4 & 5: Min Order Value & Max Discount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  Min Order Value (₹)
                  <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Optional
                  </span>
                </label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={editMinOrder}
                  onChange={(e) => setEditMinOrder(e.target.value)}
                  placeholder="e.g. 299 (blank = any amount)"
                  className="bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  Minimum cart subtotal needed to redeem this coupon.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  Max Discount Cap (₹)
                  <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {editType === "PERCENTAGE" ? "Optional" : "N/A"}
                  </span>
                </label>
                {editType === "PERCENTAGE" ? (
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={editMaxDiscount}
                    onChange={(e) => setEditMaxDiscount(e.target.value)}
                    placeholder="e.g. 150 (blank = uncapped)"
                    className="bg-background"
                  />
                ) : (
                  <div className="h-10 px-3 rounded-md border border-border bg-muted/40 flex items-center text-xs text-muted-foreground">
                    Not applicable for {editType === "FREE_DELIVERY" ? "Free Delivery" : "Flat Amount"}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {editType === "PERCENTAGE"
                    ? "Limits maximum savings for customer."
                    : "Only percentage coupons have a maximum cap."}
                </p>
              </div>
            </div>

            {/* Field 6 & 7: Expires At & Usage Limit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  Expires At
                  <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Optional
                  </span>
                </label>
                <Input
                  type="datetime-local"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                  className="bg-background text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Date and time after which the coupon cannot be used.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  Global Usage Limit
                  <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Optional
                  </span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={editUsageLimit}
                  onChange={(e) => setEditUsageLimit(e.target.value)}
                  placeholder="0 = Unlimited uses"
                  className="bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  Total redemptions allowed across all users (0 = unlimited).
                </p>
              </div>
            </div>

            {/* Status Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
              <div>
                <span className="text-xs font-bold text-foreground">Active Status</span>
                <p className="text-[11px] text-muted-foreground">
                  When active, customers can apply this code during checkout.
                </p>
              </div>
              <Button
                type="button"
                variant={editIsActive ? "default" : "outline"}
                size="sm"
                className={`text-xs ${
                  editIsActive
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "text-rose-600 border-rose-300 hover:bg-rose-50"
                }`}
                onClick={() => setEditIsActive(!editIsActive)}
              >
                {editIsActive ? "✓ Active (Enabled)" : "✕ Inactive (Disabled)"}
              </Button>
            </div>

            {/* Live Customer Preview */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-primary/5 via-muted/40 to-primary/5 border border-primary/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Live Customer Preview
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    editIsActive
                      ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800"
                      : "text-rose-600 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800"
                  }`}
                >
                  {editIsActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm bg-background px-2.5 py-1 rounded-lg border border-border shadow-xs">
                  {editCode.trim().toUpperCase() || "YOURCODE"}
                </span>
                <span className="font-bold text-xs text-foreground">
                  {editType === "FREE_DELIVERY"
                    ? "🚚 Free Delivery"
                    : editType === "PERCENTAGE"
                      ? `${editValue || "0"}% OFF${editMaxDiscount ? ` (Up to ₹${editMaxDiscount})` : ""}`
                      : `Flat ₹${editValue || "0"} OFF`}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Applies to{" "}
                {editMinOrder && Number(editMinOrder) > 0
                  ? `orders of ₹${editMinOrder} or more`
                  : "all qualifying orders"}
                .
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingCoupon(null);
                }}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="gap-2 font-bold px-6"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" />
                    Save Coupon Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
