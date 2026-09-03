const fs = require('fs');
const path = 'backend/prisma/schema.prisma';
let code = fs.readFileSync(path, 'utf8');

const masterOrderStatus = `
enum MasterOrderStatus {
  PENDING          @map("pending")
  ACCEPTED         @map("accepted")
  PICKUP_IN_PROGRESS @map("pickup_in_progress")
  OUT_FOR_DELIVERY @map("out_for_delivery")
  DELIVERED        @map("delivered")
  CANCELLED        @map("cancelled")
  REFUNDED         @map("refunded")
  FAILED           @map("failed")
}
`;

if (!code.includes('MasterOrderStatus')) {
  code = code.replace('enum OrderStatus {', masterOrderStatus + '\nenum OrderStatus {');
}

const masterOrderModel = `
model MasterOrder {
  id                    String        @id @default(uuid()) @db.Uuid
  order_number          String        @unique @db.VarChar(40)
  user_id               String        @db.Uuid
  delivery_partner_id   String?       @db.Uuid
  address_id            String        @db.Uuid
  status                MasterOrderStatus @default(PENDING)
  total_amount          Decimal       @db.Decimal(10, 2)
  delivery_fee          Decimal       @default(0) @db.Decimal(10, 2)
  tax                   Decimal       @default(0) @db.Decimal(10, 2)
  payment_method        PaymentMethod @default(RAZORPAY)
  payment_status        PaymentStatus @default(PENDING)
  created_at            DateTime      @default(now())
  updated_at            DateTime      @updatedAt

  customer          User              @relation(fields: [user_id], references: [id], onDelete: Restrict)
  delivery_partner  DeliveryProfile?  @relation(fields: [delivery_partner_id], references: [id], onDelete: SetNull)
  address           Address           @relation(fields: [address_id], references: [id], onDelete: Restrict)
  orders            Order[]
  payment           Payment?

  @@index([user_id])
  @@index([delivery_partner_id])
  @@map("master_orders")
}
`;

if (!code.includes('model MasterOrder {')) {
  code = code.replace('model Order {', masterOrderModel + '\nmodel Order {');
}

// Update Order model to link to MasterOrder
if (!code.includes('master_order_id')) {
  code = code.replace(
    /id                    String        @id @default\(uuid\(\)\) @db\.Uuid/,
    'id                    String        @id @default(uuid()) @db.Uuid\n  master_order_id       String?       @db.Uuid'
  );
  code = code.replace(
    /items             OrderItem\[\]/,
    'items             OrderItem[]\n  master_order      MasterOrder?  @relation(fields: [master_order_id], references: [id], onDelete: Cascade)'
  );
}

// Update Payment model
code = code.replace(
  /order_id            String        @unique @db\.Uuid/,
  'order_id            String?       @db.Uuid\n  master_order_id     String?       @unique @db.Uuid'
);

code = code.replace(
  /order\s+Order\s+@relation\(fields: \[order_id\], references: \[id\], onDelete: Cascade\)/,
  'order               Order?        @relation(fields: [order_id], references: [id], onDelete: Cascade)\n  master_order        MasterOrder?  @relation(fields: [master_order_id], references: [id], onDelete: Cascade)'
);

// We need to add relations in User and DeliveryProfile for MasterOrder
code = code.replace(
  /orders                Order\[\]               @relation\("CustomerOrders"\)/,
  'orders                Order[]               @relation("CustomerOrders")\n  master_orders         MasterOrder[]'
);

code = code.replace(
  /orders              Order\[\]         @relation\("AssignedOrders"\)/,
  'orders              Order[]         @relation("AssignedOrders")\n  master_orders       MasterOrder[]'
);

fs.writeFileSync(path, code);
