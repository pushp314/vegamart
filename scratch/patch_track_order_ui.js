const fs = require('fs');

const file = 'gali-connect-main/src/routes/orders.$orderId.track.tsx';
let code = fs.readFileSync(file, 'utf8');

const insertStr = `
                {order.additional_charges && order.additional_charges.length > 0 && order.additional_charges.map((charge: any, idx: number) => (
                  <div key={idx} className="flex justify-between">
                    <span>{charge.name}</span>
                    <span className="tabular-nums font-semibold">₹{Number(charge.amount).toFixed(2)}</span>
                  </div>
                ))}
`;

// Replace Taxes & Platform Fee with Taxes (GST)
code = code.replace(
    /(<span>Taxes & Platform Fee<\/span>\s*<span className="tabular-nums font-semibold">₹\{\(tax \|\| 0\)\.toFixed\(2\)\}<\/span>\s*<\/div>)/,
    '<span>Taxes (GST)</span>\n                  <span className="tabular-nums font-semibold">₹{(tax || 0).toFixed(2)}</span>\n                </div>' + insertStr
);

fs.writeFileSync(file, code);
