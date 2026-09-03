const fs = require('fs');
const path = 'backend/src/repositories/order.repository.ts';
let code = fs.readFileSync(path, 'utf8');

const createMasterOrderSnippet = `
export interface CreateMasterOrderInput {
  order_number: string;
  user_id: string;
  address_id: string;
  total_amount: number;
  delivery_fee: number;
  tax: number;
  payment_method: string;
}

export async function createMasterOrder(input: CreateMasterOrderInput, db: DbClient = prisma) {
  return await db.masterOrder.create({
    data: {
      order_number: input.order_number,
      user_id: input.user_id,
      address_id: input.address_id,
      total_amount: input.total_amount,
      delivery_fee: input.delivery_fee,
      tax: input.tax,
      payment_method: input.payment_method as Prisma.MasterOrderCreateInput["payment_method"],
    }
  });
}
`;

if (!code.includes('createMasterOrder')) {
  code = code.replace(
    'export async function createOrder',
    createMasterOrderSnippet + '\nexport async function createOrder'
  );
  fs.writeFileSync(path, code);
}
