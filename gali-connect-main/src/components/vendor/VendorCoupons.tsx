import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export function VendorCoupons() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDiscountType, setNewDiscountType] = useState("percentage");
  const [newDiscountValue, setNewDiscountValue] = useState("");
  const [newMinOrder, setNewMinOrder] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("");

  const { data: couponsRes, isLoading } = useQuery({
    queryKey: ["vendorCoupons"],
    queryFn: () => api.get<any>("/coupons"),
  });

  const coupons: Coupon[] = Array.isArray(couponsRes?.data)
    ? couponsRes.data
    : Array.isArray((couponsRes?.data as any)?.data)
      ? (couponsRes?.data as any).data
      : [];

  const createCouponMutation = useMutation({
    mutationFn: (data: any) => api.post("/coupons", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorCoupons"] });
      toast.success("Coupon created");
      setIsCreateOpen(false);
      resetForm();
    },
    onError: () => toast.error("Failed to create coupon"),
  });

  const deleteCouponMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/coupons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorCoupons"] });
      toast.success("Coupon deleted");
    },
  });

  const resetForm = () => {
    setNewCode("");
    setNewDescription("");
    setNewDiscountType("percentage");
    setNewDiscountValue("");
    setNewMinOrder("");
    setNewMaxUses("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Coupons</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Coupon
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Coupon</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  placeholder="e.g., SUMMER20"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="e.g., 20% off on summer items"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <select
                    value={newDiscountType}
                    onChange={(e) => setNewDiscountType(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Discount Value</Label>
                  <Input
                    type="number"
                    placeholder={newDiscountType === "percentage" ? "20" : "100"}
                    value={newDiscountValue}
                    onChange={(e) => setNewDiscountValue(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Order (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newMinOrder}
                    onChange={(e) => setNewMinOrder(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Uses</Label>
                  <Input
                    type="number"
                    placeholder="Unlimited"
                    value={newMaxUses}
                    onChange={(e) => setNewMaxUses(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={() =>
                  createCouponMutation.mutate({
                    code: newCode,
                    description: newDescription,
                    discount_type: newDiscountType,
                    discount_value: Number(newDiscountValue),
                    min_order: Number(newMinOrder) || 0,
                    max_uses: newMaxUses ? Number(newMaxUses) : null,
                  })
                }
                disabled={!newCode || !newDiscountValue}
                className="w-full"
              >
                Create Coupon
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No coupons created yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Min Order</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-mono font-bold">{coupon.code}</TableCell>
                    <TableCell>
                      {coupon.discount_type === "percentage"
                        ? `${coupon.discount_value}% off`
                        : `₹${coupon.discount_value} off`}
                    </TableCell>
                    <TableCell>₹{coupon.min_order}</TableCell>
                    <TableCell>
                      {coupon.used_count}
                      {coupon.max_uses ? ` / ${coupon.max_uses}` : ""}
                    </TableCell>
                    <TableCell>
                      {coupon.valid_until
                        ? format(new Date(coupon.valid_until), "MMM d, yyyy")
                        : "No expiry"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={coupon.is_active ? "default" : "secondary"}>
                        {coupon.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCouponMutation.mutate(coupon.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
