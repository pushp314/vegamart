const fs = require('fs');

const file = 'gali-connect-main/src/routes/checkout.tsx';
let code = fs.readFileSync(file, 'utf8');

const insertStr = `
                {summaryData?.additional_charges && summaryData.additional_charges.length > 0 && summaryData.additional_charges.map((charge: any) => (
                  <div key={charge.id} className="flex justify-between">
                    <span className="text-muted-foreground">{charge.name}</span>
                    <span className="font-semibold tabular-nums">₹{Number(charge.amount).toFixed(2)}</span>
                  </div>
                ))}
`;

// Find where to insert it. Just below Taxes & Charges (GST).
code = code.replace(
    /(<span className="text-muted-foreground">Taxes & Charges \(GST\)<\/span>\s*<span className="font-semibold tabular-nums">₹\{displayTax\.toFixed\(2\)\}<\/span>\s*<\/div>)/,
    '$1' + insertStr
);

fs.writeFileSync(file, code);
