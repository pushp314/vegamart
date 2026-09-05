const fs = require("fs");
let content = fs.readFileSync("/Users/pushp/Desktop/vegamart/backend/src/services/payment.service.ts", "utf-8");

content = content.replace(
  'import { findById as findOrderById, findMasterOrderById, updateMasterOrderStatus } from "../repositories/order.repository";',
  'import * as transactionRepo from "../repositories/transaction.repository";\\nimport { findById as findOrderById, findMasterOrderById, updateMasterOrderStatus } from "../repositories/order.repository";'
);

fs.writeFileSync("/Users/pushp/Desktop/vegamart/backend/src/services/payment.service.ts", content);

let repo = fs.readFileSync("/Users/pushp/Desktop/vegamart/backend/src/repositories/order.repository.ts", "utf-8");
repo = repo.replace(
  'export async function updateMasterOrderStatus(id: string, status: string, db: DbClient = prisma) {',
  'import { MasterOrderStatus } from "@prisma/client";\\n\\nexport async function updateMasterOrderStatus(id: string, status: MasterOrderStatus, db: DbClient = prisma) {'
);
fs.writeFileSync("/Users/pushp/Desktop/vegamart/backend/src/repositories/order.repository.ts", repo);
