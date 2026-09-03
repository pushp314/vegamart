const fs = require('fs');
const path = 'backend/src/repositories/payment.repository.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  'order_id: string;\n    amount: number;',
  'order_id?: string;\n    master_order_id?: string;\n    amount: number;'
);

fs.writeFileSync(path, code);
