const fs = require('fs');
const path = 'backend/src/repositories/payment.repository.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  'order_id: string;',
  'order_id?: string;\n    master_order_id?: string;'
);

code = code.replace(
  'order_id: data.order_id,',
  'order_id: data.order_id ?? null,\n      master_order_id: data.master_order_id ?? null,'
);

fs.writeFileSync(path, code);
