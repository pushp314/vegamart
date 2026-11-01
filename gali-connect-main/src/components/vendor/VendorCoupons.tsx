import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Loader2, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreateCouponModal } from "./CreateCouponModal";

interface Coupon {
  id: string;
  code: string;
  type: string;
  value: number;
  min_order_value: number | null;
  max_discount: number | null;
  usage_limit: number;
  used_count: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
}

export function VendorCoupons() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: couponsRes, isLoading } = useQuery({
    queryKey: ["vendorCoupons"],
    queryFn: () => api.get<any>("/vendors/me/coupons"),
  });

  const coupons: Coupon[] = Array.isArray(couponsRes?.data)
    ? couponsRes.data
    : Array.isArray((couponsRes?.data as any)?.data)
      ? (couponsRes?.data as any).data
      : [];

  const deleteCouponMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vendors/me/coupons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorCoupons"] });
      toast.success("Coupon deleted");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete coupon"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/vendors/me/coupons/${id}`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorCoupons"] });
      toast.success("Coupon status updated");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update coupon"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Coupons</h2>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Coupon
        </Button>
      </div>

      <CreateCouponModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />

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
                    <TableCell className="font-mono font-bold uppercase">{coupon.code}</TableCell>
                    <TableCell>
                      {coupon.type === "PERCENTAGE"
                        ? `${coupon.value}% off`
                        : coupon.type === "FREE_DELIVERY"
                          ? "Free Delivery"
                          : `₹${coupon.value} off`}
                    </TableCell>
                    <TableCell>
                      {coupon.min_order_value ? `₹${coupon.min_order_value}` : "None"}
                    </TableCell>
                    <TableCell>
                      {coupon.used_count || 0}
                      {coupon.usage_limit ? ` / ${coupon.usage_limit}` : " / ∞"}
                    </TableCell>
                    <TableCell>
                      {coupon.valid_until
                        ? format(new Date(coupon.valid_until), "MMM d, yyyy")
                        : "No expiry"}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() =>
                          toggleActiveMutation.mutate({ id: coupon.id, is_active: !coupon.is_active })
                        }
                        disabled={toggleActiveMutation.isPending}
                        className="cursor-pointer"
                      >
                        <Badge variant={coupon.is_active ? "default" : "secondary"}>
                          {coupon.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this coupon?")) {
                            deleteCouponMutation.mutate(coupon.id);
                          }
                        }}
                        disabled={deleteCouponMutation.isPending}
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

