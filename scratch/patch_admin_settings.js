const fs = require('fs');

const file = 'gali-connect-main/src/components/admin/AdminSettings.tsx';
let code = fs.readFileSync(file, 'utf8');

// Insert the new Card inside the grid
const insertStr = `
        {/* Checkout Charges */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Checkout & Platform Charges</CardTitle>
            <CardDescription>Configure extra fees like Rain Charge, Platform Fee, Surge Pricing, etc.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              let charges = [];
              try {
                charges = JSON.parse(settings["platform.checkout_charges"] || "[]");
              } catch (e) { }

              const updateCharges = (newCharges) => {
                setSettings({ ...settings, "platform.checkout_charges": JSON.stringify(newCharges) });
              };

              return (
                <div className="space-y-4">
                  {charges.map((charge, i) => (
                    <div key={i} className="flex flex-col md:flex-row gap-4 items-start md:items-end border p-4 rounded-lg bg-muted/20">
                      <div className="space-y-2 flex-1">
                        <Label>Fee Name</Label>
                        <Input value={charge.name} onChange={e => {
                          const c = [...charges]; c[i].name = e.target.value; updateCharges(c);
                        }} placeholder="e.g. Rain Charge" />
                      </div>
                      <div className="space-y-2 w-full md:w-32">
                        <Label>Type</Label>
                        <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm" value={charge.type} onChange={e => {
                          const c = [...charges]; c[i].type = e.target.value; updateCharges(c);
                        }}>
                          <option value="fixed">Fixed (₹)</option>
                          <option value="percentage">Percentage (%)</option>
                        </select>
                      </div>
                      <div className="space-y-2 w-full md:w-32">
                        <Label>Amount</Label>
                        <Input type="number" value={charge.amount} onChange={e => {
                          const c = [...charges]; c[i].amount = e.target.value; updateCharges(c);
                        }} />
                      </div>
                      <div className="space-y-2 w-full md:w-24">
                         <Label className="block mb-2 text-center">Active</Label>
                         <div className="flex justify-center">
                           <Switch checked={charge.is_active} onCheckedChange={checked => {
                              const c = [...charges]; c[i].is_active = checked; updateCharges(c);
                           }} />
                         </div>
                      </div>
                      <Button variant="destructive" size="icon" className="shrink-0" onClick={() => {
                        const c = [...charges]; c.splice(i, 1); updateCharges(c);
                      }}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full" onClick={() => {
                    const c = [...charges, { id: Date.now().toString(), name: "", type: "fixed", amount: 0, is_active: true }];
                    updateCharges(c);
                  }}>
                    + Add New Charge
                  </Button>
                </div>
              );
            })()}
          </CardContent>
        </Card>
`;

// Also need XCircle from lucide-react if not imported
if (!code.includes('XCircle')) {
    code = code.replace('} from "lucide-react";', ', XCircle } from "lucide-react";');
}

// Find a good spot to insert. Before the "Support" card is good.
code = code.replace(/<Card>\s*<CardHeader>\s*<CardTitle>Support<\/CardTitle>/, insertStr + '\n        <Card>\n          <CardHeader>\n            <CardTitle>Support</CardTitle>');

fs.writeFileSync(file, code);
