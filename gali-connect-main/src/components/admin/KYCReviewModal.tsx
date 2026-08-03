import { useState, useEffect } from "react";
import { XCircle, Ban, Loader2, FileText, CheckCircle2 } from "lucide-react";

export function KYCReviewModal({ vendor, onClose, onApprove, onReject, isApproving, isRejecting }: any) {
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!vendor) return null;

  const kyc = vendor.kyc;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-md p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border w-full max-w-2xl rounded-3xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute right-6 top-6 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <XCircle className="h-6 w-6" />
        </button>

        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                <FileText className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-black font-display text-foreground">Review KYC Application</h2>
            </div>
            <p className="text-sm text-muted-foreground">Verify legal documents for <span className="text-foreground font-bold">{vendor.business_name}</span></p>
          </div>

          {!kyc ? (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center bg-muted/40">
              <Ban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-bold text-foreground">No KYC Documents Submitted</p>
              <p className="text-sm text-muted-foreground mt-2">This vendor has not submitted their identity verification yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border p-5 bg-muted/40">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Document Type</div>
                  <div className="font-black text-lg mt-1 text-foreground">{kyc.document_type}</div>
                </div>
                <div className="rounded-2xl border border-border p-5 bg-muted/40">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Document ID</div>
                  <div className="font-black text-lg mt-1 uppercase text-foreground tracking-wide">{kyc.document_number}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border p-5 bg-muted/40">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">FSSAI License</div>
                  <div className="font-bold text-sm mt-1 text-foreground">{kyc.fssai_license || "N/A"}</div>
                </div>
                <div className="rounded-2xl border border-border p-5 bg-muted/40">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">GSTIN</div>
                  <div className="font-bold text-sm mt-1 text-foreground">{kyc.gst_number || "N/A"}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-border p-5 bg-muted/40 flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Current KYC Status</div>
                  <div className={`font-black text-lg uppercase mt-1 ${
                    kyc.status === "approved" ? "text-emerald-600" :
                    kyc.status === "rejected" ? "text-rose-600" : "text-amber-600"
                  }`}>
                    {kyc.status}
                  </div>
                </div>
                {kyc.status === 'pending' && <div className="h-3 w-3 rounded-full bg-amber-500 animate-ping" />}
              </div>
            </div>
          )}

          {(vendor.status || "").toLowerCase() === "pending" && (
            <div className="pt-6 border-t border-border space-y-4">
              {showRejectInput ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter specific reason for rejection..."
                    className="w-full rounded-2xl border border-rose-200 bg-rose-50/40 p-5 text-sm outline-none focus:ring-2 focus:ring-rose-500/50 min-h-[120px] text-foreground placeholder:text-muted-foreground"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="flex-1 rounded-2xl border border-border bg-card py-4 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => onReject(vendor.id, rejectReason)}
                      disabled={isRejecting || !rejectReason.trim()}
                      className="flex-1 rounded-2xl bg-rose-600 py-4 text-sm font-black text-white hover:bg-rose-500 disabled:opacity-50 transition-colors shadow-[0_0_20px_rgba(225,29,72,0.3)]"
                    >
                      {isRejecting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Confirm Rejection"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowRejectInput(true)}
                    className="flex-1 rounded-2xl border border-border bg-card py-4 text-sm font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                  >
                    Reject KYC
                  </button>
                  <button
                    onClick={() => onApprove(vendor.id)}
                    disabled={isApproving || !kyc}
                    className="flex-[2] rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-50 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(16,185,129,0.3)] flex justify-center items-center gap-2"
                  >
                    {isApproving ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : <><CheckCircle2 className="h-5 w-5" /> Approve Vendor</>}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}