import { readFileSync, writeFileSync } from "fs";

let code = readFileSync("/Users/pushp/Desktop/vegamart/backend/src/services/payment.service.ts", "utf-8");

// Add import for findMasterOrderById and updateMasterOrderStatus
code = code.replace(
  'import { findById as findOrderById } from "../repositories/order.repository";',
  'import { findById as findOrderById, findMasterOrderById, updateMasterOrderStatus } from "../repositories/order.repository";'
);

writeFileSync("/Users/pushp/Desktop/vegamart/backend/src/services/payment.service.ts", code);
