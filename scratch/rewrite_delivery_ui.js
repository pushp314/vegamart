const fs = require('fs');
const path = 'gali-connect-main/src/routes/delivery.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStart = `<div className="flex gap-2">
                          {o.status === "CONFIRMED" || o.status === "READY_FOR_PICKUP" ? (`;

const targetEnd = `                          <button
                            onClick={() => {
                              setSelectedOrderId(o.id);
                              setOtpValue("");
                              setOtpModalOpen(true);
                            }}
                            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="h-4 w-4" /> Delivered
                          </button>
                        </div>
                      </div>
                    </div>`;

const replaceWith = `
                        {/* Sub-orders Sequence UI */}
                        {o.sub_orders && o.sub_orders.length > 0 && o.status !== "OUT_FOR_DELIVERY" && o.status !== "DELIVERED" && (
                          <div className="flex flex-col gap-2 mt-4">
                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                              Pickup Sequence ({o.sub_orders.length} Stores)
                            </div>
                            {o.sub_orders.map((sub: any, idx: number) => {
                              const isReady = sub.status === "READY_FOR_PICKUP" || sub.status === "PREPARING";
                              const isPickedUp = sub.status === "PICKED_UP" || sub.status === "OUT_FOR_DELIVERY" || sub.status === "DELIVERED";
                              
                              return (
                                <div key={sub.id} className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-card shadow-sm">
                                  <div className="flex justify-between items-center">
                                    <div className="font-bold text-sm">
                                      {idx + 1}. {sub.vendor?.business_name || "Vendor"}
                                    </div>
                                    <div className={\`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase \${isPickedUp ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}\`}>
                                      {isPickedUp ? "Picked Up" : sub.status.replace(/_/g, " ")}
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">{sub.items?.length || 0} items</div>
                                  
                                  {!isPickedUp && (
                                    <div className="flex gap-2 mt-2">
                                      <a
                                        href={\`tel:\${sub.vendor?.phone}\`}
                                        className="flex-1 py-2 text-xs rounded-lg font-bold transition-colors bg-slate-200 text-slate-700 hover:bg-slate-300 flex items-center justify-center gap-1"
                                      >
                                        <Phone className="h-3 w-3" /> Call
                                      </a>
                                      <button
                                        onClick={() => notifyVendorMutation.mutate({ orderId: o.id, subId: sub.id })}
                                        className="flex-1 py-2 text-xs rounded-lg font-bold transition-colors bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center justify-center gap-1"
                                      >
                                        <Bell className="h-3 w-3" /> Notify
                                      </button>
                                      <button
                                        disabled={!isReady}
                                        onClick={() => confirmPickupMutation.mutate({ orderId: o.id, subId: sub.id })}
                                        className="flex-1 py-2 text-xs rounded-lg font-bold transition-colors bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                      >
                                        <CheckCircle2 className="h-3 w-3" /> Picked Up
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex gap-2 mt-4">
                          {o.status === "CONFIRMED" || o.status === "READY_FOR_PICKUP" || o.status === "PREPARING" || o.status === "PICKED_UP" ? (
                            <button
                              onClick={() => {
                                const allPickedUp = o.sub_orders ? o.sub_orders.every((sub: any) => sub.status === "PICKED_UP" || sub.status === "OUT_FOR_DELIVERY" || sub.status === "DELIVERED") : true;
                                if (!allPickedUp) {
                                  toast.error("You must confirm pickup from all stores first.");
                                  return;
                                }
                                updateStatusMutation.mutate({
                                  orderId: o.id,
                                  status: "out_for_delivery",
                                });
                              }}
                              className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors bg-purple-600 text-white hover:bg-purple-500"
                            >
                              Start Customer Delivery
                            </button>
                          ) : o.status === "OUT_FOR_DELIVERY" ? (
                             <button
                               onClick={() => {
                                 setSelectedOrderId(o.id);
                                 setOtpValue("");
                                 setOtpModalOpen(true);
                               }}
                               className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                             >
                               <CheckCircle2 className="h-4 w-4" /> Mark Delivered
                             </button>
                          ) : (
                             <button
                               disabled
                               className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors bg-muted text-muted-foreground"
                             >
                               Out for Delivery
                             </button>
                          )}
                        </div>
                      </div>
                    </div>`;

const startIdx = content.indexOf(targetStart);
if (startIdx === -1) {
  console.log("targetStart not found");
  process.exit(1);
}
const endIdx = content.indexOf(targetEnd, startIdx);
if (endIdx === -1) {
  console.log("targetEnd not found");
  process.exit(1);
}

const newContent = content.substring(0, startIdx) + replaceWith + content.substring(endIdx + targetEnd.length);
fs.writeFileSync(path, newContent);
console.log("Success");
