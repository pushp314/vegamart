const fs = require('fs');

// Fix payment.repository.ts
let pRepo = fs.readFileSync('backend/src/repositories/payment.repository.ts', 'utf8');
pRepo = pRepo.replace(
  /export async function findByMasterOrderId[\s\S]*?EOF/m,
  ''
);
pRepo = pRepo.replace(
  'export async function findByMasterOrderId(masterOrderId: string, db: DbClient = prisma): Promise<PaymentRow | null> {',
  'export async function findByMasterOrderId(masterOrderId: string, db: DbClient = prisma): Promise<any | null> {'
);
if (!pRepo.includes('Promise<any | null>')) {
    pRepo += `\nexport async function findByMasterOrderId(masterOrderId: string, db: DbClient = prisma): Promise<any | null> {
  return await db.payment.findFirst({
    where: { master_order_id: masterOrderId, status: "PAID" },
    select: baseSelect,
  });
}\n`;
}
// wait I just appended it again. Let's do it cleaner.
pRepo = pRepo.replace(/export async function findByMasterOrderId[\s\S]*?\}[\s]*$/, '');
pRepo += `\nexport async function findByMasterOrderId(masterOrderId: string, db: DbClient = prisma): Promise<any | null> {
  return await db.payment.findFirst({
    where: { master_order_id: masterOrderId, status: "PAID" },
    select: baseSelect,
  });
}\n`;
fs.writeFileSync('backend/src/repositories/payment.repository.ts', pRepo);


// Fix order.service.ts
let oSvc = fs.readFileSync('backend/src/services/order.service.ts', 'utf8');

if (!oSvc.includes('import * as paymentRepo')) {
  oSvc = oSvc.replace('import * as orderRepo from "../repositories/order.repository";', 'import * as orderRepo from "../repositories/order.repository";\nimport * as paymentRepo from "../repositories/payment.repository";\nimport { paymentService } from "./payment.service";');
}
oSvc = oSvc.replace('image_url: true', '');
oSvc = oSvc.replace('image_url: true', ''); // incase

// split Promise.all
oSvc = oSvc.replace(
  'const [rows, total] = await Promise.all([',
  `const rows = await prisma.masterOrder.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: perPage,
        include: {
           orders: {
              include: {
                 vendor: { select: { id: true, business_name: true } },
                 items: true
              }
           }
        }
      });
      const total = await prisma.masterOrder.count({ where });
      // `
);
// wait the previous code has the findmany args inside Promise.all.
// I will just replace listMyOrders completely again to be clean.

fs.writeFileSync('backend/src/services/order.service.ts', oSvc);

