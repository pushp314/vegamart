const fs = require('fs');
const path = 'backend/src/services/payment.service.ts';
let code = fs.readFileSync(path, 'utf8');

// I will just replace `const order = await findOrderById(payment.order_id);` with proper handling, wait but findOrderById requires string not string | undefined!
code = code.replace(
  'const order = await findOrderById(payment.order_id);',
  'const order = payment.order_id ? await findOrderById(payment.order_id) : null;'
);

fs.writeFileSync(path, code);
