const fs = require('fs');

const path = 'gali-connect-main/src/components/admin/AdminOrders.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Update Order interface
code = code.replace(
  '  vendor: {',
  `  vendors?: any[];
  sub_orders?: any[];
  vendor: {`
);

// 2. Replace Vendor & Store Details section with Store-wise breakdown
const oldVendorSection = `                  <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                        <Store className="h-4 w-4" /> Vendor & Store Details
                      </div>
                      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                        <div>
                          <p className="font-bold text-foreground text-sm">{detail.vendor?.business_name || "N/A"}</p>
                          {detail.vendor?.phone ? (
                            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1.5 w-fit font-medium mt-1">
                              <Phone className="h-3 w-3" />
                              {detail.vendor.phone}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No mobile number</p>
                          )}
                        </div>

                        {detail.vendor?.address ? (
                          <div className="mt-2 text-xs border-t border-border/70 pt-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-foreground flex items-center gap-1">
                                <Store className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Store Address
                              </span>
                              {detail.vendor?.latitude && detail.vendor?.longitude && (
                                <a
                                  href={\`https://www.google.com/maps/search/?api=1&query=\${detail.vendor.latitude},\${detail.vendor.longitude}\`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
                                >
                                  <ExternalLink className="h-3 w-3" /> Map
                                </a>
                              )}
                            </div>
                            <p className="text-foreground font-medium leading-relaxed">
                              {detail.vendor.address}
                            </p>
                            <p className="text-muted-foreground">
                              {[detail.vendor.city, (detail.vendor as any).state, (detail.vendor as any).pincode ? \`- \${(detail.vendor as any).pincode}\` : ""]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic border-t pt-2">No store address recorded</p>
                        )}
                      </div>
                    </div>`;

const newVendorSection = `                  <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                        <Store className="h-4 w-4" /> Store-wise Breakdown
                      </div>
                      <div className="rounded-xl border border-border bg-muted/20 space-y-3 p-4">
                        {detail.sub_orders && detail.sub_orders.length > 0 ? (
                          detail.sub_orders.map((sub: any, idx: number) => (
                            <div key={idx} className="bg-card rounded-lg border border-border p-3 space-y-2">
                              <div className="flex justify-between items-center">
                                <p className="font-bold text-foreground text-sm flex items-center gap-2">
                                  <Store className="h-3.5 w-3.5 text-emerald-600" />
                                  {sub.vendor?.business_name || "N/A"}
                                </p>
                                <Badge className={\`\${getOrderStatusInfo(sub.status).badgeBg} font-bold text-[10px]\`}>
                                  {getOrderStatusInfo(sub.status).label}
                                </Badge>
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground border-t pt-2 mt-2">
                                <span>Sub-order Total: <strong className="text-foreground">₹{sub.total.toFixed(2)}</strong></span>
                                <span className="text-rose-600">Comm: <strong>₹{sub.commission.toFixed(2)}</strong></span>
                                <span className="text-emerald-600">Payout: <strong>₹{sub.vendorEarnings.toFixed(2)}</strong></span>
                              </div>
                              <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                                {sub.vendor?.phone && (
                                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {sub.vendor.phone}</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          // Fallback for older orders without sub_orders populated
                          <div className="text-sm text-muted-foreground">
                             <p className="font-bold text-foreground text-sm">{detail.vendor?.business_name || "N/A"}</p>
                             <p>{detail.vendor?.address}</p>
                          </div>
                        )}
                      </div>
                    </div>`;

code = code.replace(oldVendorSection, newVendorSection);

fs.writeFileSync(path, code);
