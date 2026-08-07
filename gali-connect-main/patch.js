const fs = require('fs');
const file = 'src/routes/vendor.orders.tsx';
let code = fs.readFileSync(file, 'utf8');

// Fix text container min-w-0 and truncate
code = code.replace(
  `                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        Order #{o.order_number || o.id.slice(0, 8)}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Customer: <span className="font-semibold text-foreground">{o.customer_name || "Customer"}</span> • {new Date(o.created_at || Date.now()).toLocaleString()}
                      </p>
                    </div>`,
  `                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-foreground truncate">
                        Order #{o.order_number || o.id.slice(0, 8)}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        Customer: <span className="font-semibold text-foreground">{o.customer_name || "Customer"}</span> • {new Date(o.created_at || Date.now()).toLocaleString()}
                      </p>
                    </div>`
);

// Fix status badge colors
code = code.replace(
  `                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        <Clock className="h-3 w-3" /> {o.status}
                      </span>`,
  `                      <span className={\`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border \${
                          o.status?.toUpperCase() === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                          o.status?.toUpperCase() === 'CANCELLED' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                          'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        }\`}>
                        {o.status?.toUpperCase() === 'DELIVERED' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />} {o.status}
                      </span>`
);

fs.writeFileSync(file, code);
