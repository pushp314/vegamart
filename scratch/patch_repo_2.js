const fs = require('fs');
const path = 'backend/src/repositories/order.repository.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  'order_number: string;',
  'order_number: string;\n  master_order_id?: string;'
);

code = code.replace(
  'order_number: input.order_number,',
  'order_number: input.order_number,\n      master_order_id: input.master_order_id ?? null,'
);

fs.writeFileSync(path, code);
