import type { Prisma, PrismaClient } from "@prisma/client";

import prisma from "../database/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const baseSelect = {
  id: true,
  order_number: true,
  user_id: true,
  vendor_id: true,
  delivery_partner_id: true,
  address_id: true,
  coupon_id: true,
  status: true,
  items_subtotal: true,
  delivery_fee: true,
  discount: true,
  tax: true,
  total: true,
  payment_method: true,
  payment_status: true,
  invoice_number: true,
  otp_code: true,
  otp_expires_at: true,
  otp_attempts: true,
  delivery_note: true,
  delivered_at: true,
  cancelled_at: true,
  cancel_reason: true,
  refunded_at: true,
  refund_reason: true,
  accepted_at: true,
  prepared_at: true,
  packed_at: true,
  picked_up_at: true,
  started_at: true,
  eta_minutes: true,
  created_at: true,
  updated_at: true,
} as const;

export type OrderRow = {
  id: string;
  order_number: string;
  user_id: string;
  vendor_id: string;
  delivery_partner_id: string | null;
  address_id: string;
  coupon_id: string | null;
  status: string;
  items_subtotal: import("@prisma/client").Prisma.Decimal;
  delivery_fee: import("@prisma/client").Prisma.Decimal;
  discount: import("@prisma/client").Prisma.Decimal;
  tax: import("@prisma/client").Prisma.Decimal;
  total: import("@prisma/client").Prisma.Decimal;
  payment_method: string;
  payment_status: string;
  invoice_number: string | null;
  otp_code: string | null;
  otp_expires_at: Date | null;
  otp_attempts: number;
  delivery_note: string | null;
  delivered_at: Date | null;
  cancelled_at: Date | null;
  cancel_reason: string | null;
  refunded_at: Date | null;
  refund_reason: string | null;
  accepted_at: Date | null;
  prepared_at: Date | null;
  packed_at: Date | null;
  picked_up_at: Date | null;
  started_at: Date | null;
  eta_minutes: number | null;
  created_at: Date;
  updated_at: Date;
};

export interface OrderDetail extends OrderRow {
  items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    unit: string;
    selected_unit: string | null;
    quantity: number;
    unit_price: import("@prisma/client").Prisma.Decimal;
    total_price: import("@prisma/client").Prisma.Decimal;
    image_url: string | null;
    status: string;
  }>;
  events: Array<{
    id: string;
    status: string;
    note: string | null;
    actor_type: string | null;
    actor_id: string | null;
    created_at: Date;
  }>;
  payment: {
    id: string;
    razorpay_order_id: string | null;
    razorpay_payment_id: string | null;
    method: string;
    amount: import("@prisma/client").Prisma.Decimal;
    status: string;
    refund_id: string | null;
    refund_amount: import("@prisma/client").Prisma.Decimal | null;
    refund_status: string | null;
    created_at: Date;
  } | null;
  coupon: {
    id: string;
    code: string;
    type: string;
  } | null;
  vendor: {
    id: string;
    business_name: string;
  } | null;
  address: {
    id: string;
    label: string;
    full_address: string;
    landmark: string | null;
    country: string | null;
  } | null;
}

const detailSelect = {
  ...baseSelect,
  items: {
    select: {
      id: true,
      product_id: true,
      product_name: true,
      unit: true,
      selected_unit: true,
      quantity: true,
      unit_price: true,
      total_price: true,
      image_url: true,
      status: true,
    },
    orderBy: { created_at: "asc" as const },
  },
  events: {
    select: { id: true, status: true, note: true, actor_type: true, actor_id: true, created_at: true },
    orderBy: { created_at: "asc" as const },
  },
  payment: {
    select: {
      id: true,
      razorpay_order_id: true,
      razorpay_payment_id: true,
      method: true,
      amount: true,
      status: true,
      refund_id: true,
      refund_amount: true,
      refund_status: true,
      created_at: true,
    },
  },
  coupon: { select: { id: true, code: true, type: true } },
  vendor: { select: { id: true, business_name: true } },
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  address: {
    select: {
      id: true,
      label: true,
      full_address: true,
      landmark: true,
      country: true,
    },
  },
} as const;

export interface CreateOrderInput {
  order_number: string;
  user_id: string;
  vendor_id: string;
  address_id: string;
  coupon_id: string | null;
  coupon_discount: number;
  items_subtotal: number;
  delivery_fee: number;
  tax: number;
  total: number;
  payment_method: string;
  delivery_note?: string | null;
  items: Array<{
    product_id: string;
    product_name: string;
    unit: string;
    selected_unit?: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
    image_url?: string | null;
  }>;
}

export async function createOrder(input: CreateOrderInput, db: DbClient = prisma): Promise<OrderRow> {
  const row = await db.order.create({
    data: {
      order_number: input.order_number,
      user_id: input.user_id,
      vendor_id: input.vendor_id,
      address_id: input.address_id,
      coupon_id: input.coupon_id,
      discount: input.coupon_discount,
      items_subtotal: input.items_subtotal,
      delivery_fee: input.delivery_fee,
      tax: input.tax,
      total: input.total,
      payment_method: input.payment_method as Prisma.OrderCreateInput["payment_method"],
      delivery_note: input.delivery_note ?? null,
      items: {
        create: input.items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          unit: item.unit,
          selected_unit: item.selected_unit ?? null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          image_url: item.image_url ?? null,
        })),
      },
    },
    select: baseSelect,
  });
  return row as unknown as OrderRow;
}

export async function findById(id: string): Promise<OrderDetail | null> {
  const row = await prisma.order.findUnique({
    where: { id, deleted_at: null },
    select: detailSelect,
  });
  return row as unknown as OrderDetail | null;
}

export async function findByOrderNumber(orderNumber: string): Promise<OrderRow | null> {
  const row = await prisma.order.findFirst({
    where: { order_number: orderNumber, deleted_at: null },
    select: baseSelect,
  });
  return row ? (row as unknown as OrderRow) : null;
}

export interface OrderListFilter {
  userId?: string;
  vendorId?: string;
  status?: string;
}

export async function listOrders(
  filter: OrderListFilter,
  skip: number,
  take: number
): Promise<{ rows: OrderDetail[]; total: number }> {
  const where: Prisma.OrderWhereInput = { deleted_at: null };
  if (filter.userId) where.user_id = filter.userId;
  if (filter.vendorId) where.vendor_id = filter.vendorId;
  if (filter.status) where.status = filter.status as Prisma.OrderWhereInput["status"];

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: detailSelect,
      orderBy: { created_at: "desc" },
      skip,
      take,
    }),
    prisma.order.count({ where }),
  ]);
  return { rows: rows as unknown as OrderDetail[], total };
}

export async function updateOrderStatus(
  id: string,
  data: {
    status: string;
    note?: string | null;
    actorType?: string | null;
    actorId?: string | null;
    timestamps?: Record<string, Date | string | null>;
    otp_code?: string | null;
  },
  db: DbClient = prisma
): Promise<OrderRow> {
  const eventData: Prisma.OrderEventUncheckedCreateWithoutOrderInput = {
    status: data.status as Prisma.OrderEventCreateInput["status"],
    note: data.note ?? null,
    actor_type: data.actorType ?? null,
    actor_id: data.actorId ?? null,
  };
  const orderData: Prisma.OrderUpdateInput = {
    status: data.status as Prisma.OrderUpdateInput["status"],
    ...(data.timestamps ?? {}),
    ...(data.otp_code !== undefined ? { otp_code: data.otp_code } : {}),
  };
  const apply = async (tx: DbClient) => {
    await tx.orderEvent.create({
      data: { ...eventData, order: { connect: { id } } },
    });
    return tx.order.update({
      where: { id },
      data: orderData,
      select: baseSelect,
    });
  };
  const row =
    db === prisma ? await prisma.$transaction((tx) => apply(tx)) : await apply(db);
  return row as unknown as OrderRow;
}

export async function updateOrder(id: string, data: Prisma.OrderUpdateInput, db: DbClient = prisma): Promise<OrderRow> {
  const row = await db.order.update({
    where: { id },
    data,
    select: baseSelect,
  });
  return row as unknown as OrderRow;
}

export async function listOrderEvents(orderId: string): Promise<OrderDetail["events"]> {
  const rows = await prisma.orderEvent.findMany({
    where: { order_id: orderId },
    orderBy: { created_at: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    note: r.note,
    actor_type: r.actor_type,
    actor_id: r.actor_id,
    created_at: r.created_at,
  }));
}
