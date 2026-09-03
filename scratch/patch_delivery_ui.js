const fs = require('fs');
const file = 'gali-connect-main/src/routes/delivery.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldPickupSection = `                        <div className="flex items-start gap-4 relative">
                          <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-border" />
                          <div className="z-10 bg-card p-1">
                            <Store className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <div className="text-[10px] text-emerald-600 font-bold uppercase mb-1">
                              Pickup
                            </div>
                            <div className="font-bold">{o.vendor?.business_name}</div>
                            <div className="text-xs text-muted-foreground">{o.vendor?.address}</div>
                          </div>
                        </div>`;

const newPickupSection = `                        <div className="relative space-y-4">
                          <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-border" />
                          {o.sub_orders && o.sub_orders.length > 0 ? (
                            o.sub_orders.map((sub: any, idx: number) => {
                              const sStatus = String(sub.status || "").toUpperCase();
                              let sIcon = <Hourglass className="h-3 w-3" />;
                              let sColor = "text-amber-600";
                              let sText = "Pending";
                              if (sStatus === "PREPARING") {
                                sIcon = <Hourglass className="h-3 w-3 animate-pulse" />;
                                sColor = "text-indigo-600";
                                sText = "Preparing";
                              } else if (sStatus === "READY_FOR_PICKUP" || sStatus === "PICKED_UP" || sStatus === "OUT_FOR_DELIVERY" || sStatus === "DELIVERED") {
                                sIcon = <CheckCircle2 className="h-3 w-3" />;
                                sColor = "text-emerald-600";
                                sText = sStatus === "PREPARING" ? "Preparing" : "Ready";
                                if (sStatus === "PICKED_UP") sText = "Picked Up";
                              }

                              return (
                                <div key={idx} className="flex items-start gap-4 relative z-10">
                                  <div className="bg-card p-1 mt-1">
                                    <Store className="h-4 w-4 text-emerald-600" />
                                  </div>
                                  <div className="flex-1 bg-muted/30 border border-border rounded-xl p-3">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <div className="text-[10px] text-emerald-600 font-bold uppercase mb-1 flex items-center gap-1">
                                          Pickup {idx + 1} of {o.sub_orders.length}
                                        </div>
                                        <div className="font-bold text-sm">{sub.vendor?.business_name}</div>
                                      </div>
                                      <div className={\`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-card \${sColor} border-current opacity-80\`}>
                                        {sIcon} {sText}
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1 mb-3">{sub.vendor?.address}</div>
                                    <div className="flex gap-2">
                                      {sub.vendor?.phone && (
                                        <a
                                          href={\`tel:\${sub.vendor.phone}\`}
                                          className="flex-1 text-center py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-xs transition-colors flex items-center justify-center gap-1"
                                        >
                                          <Phone className="h-3.5 w-3.5" /> Call Vendor
                                        </a>
                                      )}
                                      <button
                                        onClick={(e) => {
                                           e.stopPropagation();
                                           toast.success(\`Vendor confirmed for \${sub.vendor?.business_name}\`);
                                        }}
                                        className="flex-1 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-soft"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="flex items-start gap-4 z-10 relative">
                              <div className="bg-card p-1 mt-1">
                                <Store className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div>
                                <div className="text-[10px] text-emerald-600 font-bold uppercase mb-1">
                                  Pickup
                                </div>
                                <div className="font-bold">{o.vendor?.business_name}</div>
                                <div className="text-xs text-muted-foreground">{o.vendor?.address}</div>
                              </div>
                            </div>
                          )}
                        </div>`;

code = code.replace(oldPickupSection, newPickupSection);

fs.writeFileSync(file, code);
