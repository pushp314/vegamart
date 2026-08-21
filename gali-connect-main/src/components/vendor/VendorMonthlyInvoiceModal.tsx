import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Building2,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Landmark,
  Receipt,
  IndianRupee,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface VendorMonthlyInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMonth?: string;
}

export function VendorMonthlyInvoiceModal({
  isOpen,
  onClose,
  initialMonth,
}: VendorMonthlyInvoiceModalProps) {
  const currentMonthStr = initialMonth || new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  const { data: invoiceRes, isLoading } = useQuery({
    queryKey: ["vendorMonthlyInvoice", selectedMonth],
    queryFn: () => api.get<any>(`/vendors/me/invoices/monthly?month=${selectedMonth}`),
    enabled: isOpen,
  });

  const invoice = invoiceRes?.data;

  const handlePrint = () => {
    window.print();
  };

  // Generate last 6 months for dropdown selector
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    return { val, label };
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl rounded-3xl border-border bg-card p-6 max-h-[92vh] overflow-y-auto print:max-h-none print:p-0 print:border-none print:shadow-none">
        <DialogHeader className="print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                <Receipt className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="font-display text-lg font-bold text-foreground">
                  Monthly Commission &amp; Settlement Tax Invoice
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Official GST-compliant platform settlement statement &amp; tax invoice.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-semibold rounded-xl bg-muted/50 border border-border px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {monthOptions.map((m) => (
                  <option key={m.val} value={m.val}>
                    {m.label}
                  </option>
                ))}
              </select>

              <Button
                type="button"
                onClick={handlePrint}
                variant="outline"
                size="sm"
                className="rounded-xl h-8 px-3 text-xs font-bold gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
              >
                <Printer className="h-3.5 w-3.5" />
                Print / Save PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-xs font-medium">Generating official tax statement...</p>
          </div>
        ) : !invoice ? (
          <div className="text-center py-12 text-muted-foreground text-xs">
            Unable to load invoice statement for {selectedMonth}.
          </div>
        ) : (
          <div className="mt-4 p-6 rounded-2xl border border-border/80 bg-background/50 space-y-6 text-foreground print:border-none print:p-0">
            {/* Invoice Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-black text-xl tracking-tight text-emerald-600">
                    VegaMart
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                    TAX INVOICE
                  </span>
                </div>
                <p className="text-xs font-semibold text-foreground mt-1">{invoice.platform.name}</p>
                <p className="text-[11px] text-muted-foreground">{invoice.platform.address}</p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  GSTIN: {invoice.platform.gstin} • PAN: {invoice.platform.pan}
                </p>
              </div>

              <div className="sm:text-right space-y-1">
                <div className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300">
                  {invoice.invoice_number}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Invoice Date: {new Date(invoice.invoice_date).toLocaleDateString("en-IN")}
                </div>
                <div className="text-[11px] font-semibold text-foreground">
                  Billing Period:{" "}
                  {new Date(invoice.billing_period.start_date).toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })}
                </div>
                <div className="text-[10px] text-muted-foreground">SAC Code: {invoice.platform.sac_code} (E-Commerce Services)</div>
              </div>
            </div>

            {/* Billed To: Vendor Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-muted/20 p-4 border border-border/60 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Billed To (Store Partner)</span>
                <p className="font-bold text-sm text-foreground mt-0.5">{invoice.vendor.business_name}</p>
                <p className="text-muted-foreground">Proprietor: {invoice.vendor.owner_name}</p>
                <p className="text-muted-foreground">Location: {invoice.vendor.city}, {invoice.vendor.state}</p>
                {invoice.vendor.phone && <p className="text-muted-foreground">Phone: {invoice.vendor.phone}</p>}
              </div>

              <div className="sm:text-right">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Settlement Account</span>
                <p className="font-semibold text-foreground mt-0.5">
                  {invoice.vendor.bank_name || "Direct Bank / UPI"}
                </p>
                {invoice.vendor.bank_account_number && (
                  <p className="text-muted-foreground font-mono">A/C: {invoice.vendor.bank_account_number}</p>
                )}
                {invoice.vendor.bank_ifsc && (
                  <p className="text-muted-foreground font-mono">IFSC: {invoice.vendor.bank_ifsc}</p>
                )}
                {invoice.vendor.upi_id && (
                  <p className="text-muted-foreground font-mono">UPI: {invoice.vendor.upi_id}</p>
                )}
              </div>
            </div>

            {/* Financial Summary Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left font-bold text-muted-foreground text-[11px] uppercase">
                    <th className="pb-2">Description</th>
                    <th className="pb-2 text-center">Orders</th>
                    <th className="pb-2 text-right">Taxable Value</th>
                    <th className="pb-2 text-right">Rate</th>
                    <th className="pb-2 text-right">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  <tr>
                    <td className="py-2.5 font-medium">
                      Gross E-Commerce Order Sales (GMV)
                      <span className="block text-[10px] text-muted-foreground">Total order volume processed for your store</span>
                    </td>
                    <td className="py-2.5 text-center font-bold">{invoice.metrics.delivered_orders_count}</td>
                    <td className="py-2.5 text-right font-mono">₹{invoice.metrics.gross_gmv.toFixed(2)}</td>
                    <td className="py-2.5 text-right text-muted-foreground">—</td>
                    <td className="py-2.5 text-right font-mono font-bold">₹{invoice.metrics.gross_gmv.toFixed(2)}</td>
                  </tr>

                  <tr>
                    <td className="py-2.5 font-medium text-rose-600">
                      Less: Platform Facilitation Commission
                      <span className="block text-[10px] text-muted-foreground">Marketplace service fees</span>
                    </td>
                    <td className="py-2.5 text-center text-muted-foreground">—</td>
                    <td className="py-2.5 text-right font-mono">₹{invoice.metrics.platform_commission.toFixed(2)}</td>
                    <td className="py-2.5 text-right text-muted-foreground">Avg ~5%</td>
                    <td className="py-2.5 text-right font-mono font-bold text-rose-600">
                      -₹{invoice.metrics.platform_commission.toFixed(2)}
                    </td>
                  </tr>

                  {invoice.metrics.refund_reversals > 0 && (
                    <tr>
                      <td className="py-2.5 font-medium text-amber-600">
                        Less: Customer Dispute &amp; Refund Reversals
                        <span className="block text-[10px] text-muted-foreground">Reversed on returned/refunded items</span>
                      </td>
                      <td className="py-2.5 text-center text-muted-foreground">—</td>
                      <td className="py-2.5 text-right font-mono">₹{invoice.metrics.refund_reversals.toFixed(2)}</td>
                      <td className="py-2.5 text-right text-muted-foreground">—</td>
                      <td className="py-2.5 text-right font-mono font-bold text-amber-600">
                        -₹{invoice.metrics.refund_reversals.toFixed(2)}
                      </td>
                    </tr>
                  )}

                  <tr className="bg-emerald-500/5 font-bold">
                    <td className="py-3 font-bold text-emerald-700 dark:text-emerald-300">
                      Net Payable Vendor Earnings
                      <span className="block text-[10px] text-muted-foreground font-normal">
                        Ready for bank withdrawal / auto-settlement
                      </span>
                    </td>
                    <td className="py-3 text-center text-emerald-700 dark:text-emerald-300">
                      {invoice.metrics.delivered_orders_count}
                    </td>
                    <td className="py-3 text-right text-muted-foreground font-mono">—</td>
                    <td className="py-3 text-right text-muted-foreground">—</td>
                    <td className="py-3 text-right font-black text-sm text-emerald-600 font-mono">
                      ₹{invoice.metrics.net_payable_earnings.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tax & Statutory Compliance Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="rounded-xl border border-border/70 p-3 bg-muted/10 text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-foreground text-[11px]">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Tax Breakdown (GST on Commission)
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Platform Fee (Taxable):</span>
                  <span className="font-mono">₹{invoice.metrics.platform_commission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>GST @ 18% (SAC 998311):</span>
                  <span className="font-mono">₹{invoice.metrics.gst_on_commission.toFixed(2)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground italic pt-1">
                  *Eligible for Input Tax Credit (ITC) if vendor has an active GSTIN.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 p-3 bg-muted/10 text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-foreground text-[11px]">
                  <Landmark className="h-3.5 w-3.5 text-emerald-600" />
                  TDS u/s 194-O (E-Commerce Operator)
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Gross Sales:</span>
                  <span className="font-mono">₹{invoice.metrics.gross_gmv.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>TDS Deductible (0.1%):</span>
                  <span className="font-mono">₹{invoice.metrics.tds_194_o.toFixed(2)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground italic pt-1">
                  *Deposited with Government under Section 194-O of IT Act.
                </p>
              </div>
            </div>

            {/* Bank Disbursements & UTR Reference Record */}
            <div className="rounded-xl border border-border/70 p-3 bg-muted/10 text-xs space-y-2">
              <div className="font-bold text-foreground text-[11px] flex items-center justify-between">
                <span>Disbursements &amp; Bank UTR References</span>
                <span className="text-emerald-600 font-mono font-bold">
                  Total Paid: ₹{invoice.metrics.total_disbursed_payouts.toFixed(2)}
                </span>
              </div>

              {invoice.disbursements.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">No payout disbursements recorded for this month.</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {invoice.disbursements.map((d: any) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-card border border-border/50 text-[11px]"
                    >
                      <div>
                        <span className="font-bold">₹{d.amount.toFixed(2)}</span>
                        <span className="text-muted-foreground ml-2">via {d.payout_mode}</span>
                        {d.processed_at && (
                          <span className="text-muted-foreground text-[10px] ml-2">
                            ({new Date(d.processed_at).toLocaleDateString("en-IN")})
                          </span>
                        )}
                      </div>
                      <div className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                        UTR: {d.utr_reference}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Disclaimer */}
            <div className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border/60">
              This is a computer-generated tax invoice and settlement statement for VegaMart Marketplace Partners.
              For billing inquiries, contact billing@vegamart.in or +91 98765 43210.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
