const fs = require('fs');
const path = 'backend/src/repositories/order.repository.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  'master_order_id: input.master_order_id ?? null,\n      user_id: input.user_id,',
  'user_id: input.user_id,'
);

fs.writeFileSync(path, code);
