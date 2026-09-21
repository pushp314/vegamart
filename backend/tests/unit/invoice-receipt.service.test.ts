import { orderService } from "../../src/services/order.service";
import { adminOrderService } from "../../src/services/admin-order.service";

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../src/services/notification.service", () => ({
  notificationService: {
    send: jest.fn(),
    orderStatus: jest.fn().mockResolvedValue(undefined),
    payment: jest.fn(),
    vendor: jest.fn(),
  },
}));

jest.mock("../../src/services/vendor.service", () => ({
  vendorService: { getMyVendor: jest.fn() },
}));

jest.mock("../../src/services/payment.service", () => ({
  paymentService: { refund: jest.fn() },
}));

jest.mock("../../src/repositories/order.repository", () => ({
  listOrders: jest.fn(),
  findById: jest.fn(),
  updateOrderStatus: jest.fn(),
  updateOrder: jest.fn(),
}));

jest.mock("../../src/repositories/inventory.repository", () => ({
  releaseQuantityForOrder: jest.fn(),
  releaseReserved: jest.fn(),
  consumeQuantityForOrder: jest.fn(),
}));

jest.mock("../../src/services/earning.service", () => ({
  reverseOrderEarnings: jest.fn(),
}));

jest.mock("../../src/database/prisma", () => {
  const prismaMock: any = {
    $transaction: jest.fn(),
    masterOrder: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    orderItem: { updateMany: jest.fn() },
    orderEvent: { create: jest.fn() },
    payment: { findFirst: jest.fn() },
    order: { findUnique: jest.fn(), findMany: jest.fn() },
  };
  prismaMock.$transaction.mockImplementation((cb: any) =>
    typeof cb === "function" ? cb(prismaMock) : Promise.resolve([])
  );
  return {
    __esModule: true,
    default: prismaMock,
    prisma: prismaMock,
  };
});

import defaultPrisma from "../../src/database/prisma";
const prismaMock = defaultPrisma as any;

function dec(val: number) {
  return {
    toNumber: () => val,
    toFixed: (n: number) => val.toFixed(n),
    valueOf: () => val,
    [Symbol.toPrimitive]: () => val,
  };
}

describe("Invoice & Receipt Verification Test Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("orderService.getInvoice", () => {
    it("returns complete tax invoice payload for a MasterOrder with all charges and items", async () => {
      const mockMaster = {
        id: "mo_123",
        order_number: "ORD-2026-9999",
        status: "CONFIRMED",
        total_amount: dec(540),
        delivery_fee: dec(40),
        tax: dec(25),
        platform_fee: dec(15),
        additional_charges: [{ name: "Packaging Fee", amount: 10 }],
        payment_method: "ONLINE",
        payment_status: "PAID",
        created_at: new Date("2026-09-21T10:00:00Z"),
        customer: {
          id: "cust_1",
          name: "Rohan Sharma",
          phone: "9876543210",
          email: "rohan@example.com",
        },
        address: {
          full_address: "Flat 402, Green Valley Apartments, MG Road",
          landmark: "Near Metro Gate 2",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
        delivery_partner: {
          id: "dp_1",
          vehicle_type: "EV Scooter",
          vehicle_number: "KA-01-AB-1234",
          user: { name: "Amit Rider", phone: "9123456780" },
        },
        payment: {
          id: "pay_1",
          method: "RAZORPAY",
          amount: dec(540),
          status: "PAID",
          razorpay_order_id: "order_rzp_123",
          razorpay_payment_id: "pay_rzp_456",
          refund_amount: null,
          refund_status: null,
        },
        orders: [
          {
            id: "sub_1",
            order_number: "ORD-2026-9999-A",
            invoice_number: "INV-2026-0001",
            total: dec(300),
            items_subtotal: dec(280),
            delivery_fee: dec(20),
            tax: dec(15),
            discount: dec(30),
            status: "CONFIRMED",
            coupon: { code: "FRESH30" },
            vendor: {
              id: "v_1",
              business_name: "Fresh Farm Organic",
              phone: "9898989898",
              address: "Shop 12, Main Market",
              gstin: "29AAAAA0000A1Z5",
            },
            items: [
              {
                id: "it_1",
                product_name: "Fresh Apples Shimla",
                unit: "1 kg",
                quantity: 2,
                unit_price: dec(100),
                total_price: dec(200),
                status: "active",
                product: { id: "p1", name: "Fresh Apples Shimla", unit: "1 kg" },
              },
              {
                id: "it_2",
                product_name: "Organic Bananas",
                unit: "1 dozen",
                quantity: 1,
                unit_price: dec(80),
                total_price: dec(80),
                status: "active",
                product: { id: "p2", name: "Organic Bananas", unit: "1 dozen" },
              },
            ],
          },
          {
            id: "sub_2",
            order_number: "ORD-2026-9999-B",
            invoice_number: "INV-2026-0002",
            total: dec(240),
            items_subtotal: dec(220),
            delivery_fee: dec(20),
            tax: dec(10),
            discount: dec(20),
            status: "CONFIRMED",
            vendor: {
              id: "v_2",
              business_name: "Green Grocers",
              phone: "9797979797",
              address: "Shop 4, Sector 5",
            },
            items: [
              {
                id: "it_3",
                product_name: "Farm Tomatoes",
                unit: "1 kg",
                quantity: 2,
                unit_price: dec(60),
                total_price: dec(120),
                status: "active",
                product: { id: "p3", name: "Farm Tomatoes", unit: "1 kg" },
              },
              {
                id: "it_4",
                product_name: "Out-of-stock Spinach",
                unit: "500 g",
                quantity: 1,
                unit_price: dec(50),
                total_price: dec(50),
                status: "rejected", // Rejected item
                product: { id: "p4", name: "Spinach", unit: "500 g" },
              },
            ],
          },
        ],
      };

      prismaMock.masterOrder.findUnique.mockResolvedValueOnce(mockMaster);

      const invoice = await orderService.getInvoice("mo_123");

      expect(invoice.id).toBe("mo_123");
      expect(invoice.order_number).toBe("ORD-2026-9999");
      expect(invoice.invoice_number).toBe("INV-2026-0001");
      expect(invoice.total).toBe(540);
      expect(invoice.delivery_fee).toBe(40);
      expect(invoice.tax).toBe(25);
      expect(invoice.platform_fee).toBe(15);
      expect(invoice.additional_charges).toEqual([{ name: "Packaging Fee", amount: 10 }]);

      // Total discount across sub-orders: 30 + 20 = 50
      expect(invoice.discount).toBe(50);
      expect(invoice.coupon_code).toBe("FRESH30");

      // Accepted items subtotal: Apples (200) + Bananas (80) + Tomatoes (120) = 400 (Spinach is rejected, excluded)
      expect(invoice.items_subtotal).toBe(400);

      expect(invoice.customer.name).toBe("Rohan Sharma");
      expect(invoice.delivery_partner.user.name).toBe("Amit Rider");
      expect(invoice.items.length).toBe(4);
      expect(invoice.sub_orders.length).toBe(2);
    });

    it("resolves by sub_order ID when passed a sub_order ID", async () => {
      prismaMock.masterOrder.findUnique.mockResolvedValueOnce(null); // not master
      prismaMock.order.findUnique.mockResolvedValueOnce({ master_order_id: "mo_from_sub" });
      prismaMock.masterOrder.findUnique.mockResolvedValueOnce({
        id: "mo_from_sub",
        order_number: "ORD-999",
        total_amount: dec(300),
        delivery_fee: dec(30),
        tax: dec(15),
        platform_fee: dec(5),
        additional_charges: [],
        orders: [
          {
            id: "sub_1",
            order_number: "ORD-999-A",
            invoice_number: "INV-999",
            discount: dec(10),
            items: [],
          },
        ],
      });

      const invoice = await orderService.getInvoice("sub_1");
      expect(invoice.id).toBe("mo_from_sub");
      expect(invoice.invoice_number).toBe("INV-999");
      expect(invoice.discount).toBe(10);
    });
  });

  describe("orderService.getOrderForUser", () => {
    it("returns order with invoice_number, discount, platform_fee, and payment details", async () => {
      const mockMaster = {
        id: "mo_456",
        user_id: "user_1",
        order_number: "ORD-2026-456",
        status: "CONFIRMED",
        total_amount: dec(250),
        delivery_fee: dec(30),
        tax: dec(12),
        platform_fee: dec(8),
        additional_charges: [],
        payment_method: "PARTIAL_ONLINE",
        payment_status: "PARTIAL",
        payment: {
          id: "pay_part",
          method: "UPI",
          amount: dec(100),
          status: "PAID",
          razorpay_payment_id: "pay_rzp_part",
          refund_amount: null,
          refund_status: null,
        },
        customer: { id: "user_1", name: "Neha Patel", phone: "9812345678", email: "neha@patel.com" },
        address: { full_address: "12 Lakeview, Pune" },
        delivery_partner: null,
        orders: [
          {
            id: "sub_part",
            order_number: "ORD-2026-456-A",
            invoice_number: "INV-2026-456",
            total: dec(250),
            items_subtotal: dec(210),
            delivery_fee: dec(30),
            tax: dec(12),
            discount: dec(10),
            coupon: { code: "SAVE10" },
            vendor: { id: "v1", business_name: "Organic Veggies" },
            items: [
              {
                id: "it_1",
                product_name: "Cabbage",
                quantity: 1,
                unit_price: dec(40),
                total_price: dec(40),
                status: "active",
              },
            ],
          },
        ],
      };

      prismaMock.masterOrder.findUnique.mockResolvedValueOnce(mockMaster);

      const order = await orderService.getOrderForUser("user_1", "mo_456");

      expect(order.invoice_number).toBe("INV-2026-456");
      expect(order.discount).toBe(10);
      expect(order.coupon_code).toBe("SAVE10");
      expect(order.platform_fee).toBe(8);
      expect(order.total).toBe(250);
      expect(order.payment.method).toBe("UPI");
      expect(order.payment.amount).toBe(100);
      expect(order.payment.razorpay_payment_id).toBe("pay_rzp_part");
    });
  });

  describe("adminOrderService - getById and listOrders", () => {
    it("aggregates discount dynamically across sub-orders instead of returning 0", async () => {
      const mockMaster = {
        id: "mo_admin",
        order_number: "ORD-ADM-1",
        status: "CONFIRMED",
        total_amount: dec(600),
        delivery_fee: dec(50),
        tax: dec(30),
        platform_fee: dec(10),
        additional_charges: [{ name: "Handling", amount: 10 }],
        payment_method: "ONLINE",
        payment_status: "PAID",
        payment: {
          id: "p_adm",
          method: "CARD",
          amount: dec(600),
          status: "PAID",
          razorpay_order_id: "order_adm",
          razorpay_payment_id: "pay_adm",
          refund_amount: null,
          refund_status: null,
        },
        address: { full_address: "Admin Test Address" },
        delivery_partner: null,
        orders: [
          {
            id: "sub_adm_1",
            order_number: "ORD-ADM-1-A",
            invoice_number: "INV-ADM-001",
            status: "CONFIRMED",
            total: dec(300),
            items_subtotal: dec(270),
            delivery_fee: dec(25),
            tax: dec(15),
            discount: dec(20), // Sub-order 1 discount: 20
            vendor: { id: "v1", business_name: "Store 1" },
            commission: dec(30),
            items: [
              {
                product_name: "Item 1",
                unit: "1 kg",
                quantity: 1,
                unit_price: dec(100),
                total_price: dec(100),
                status: "active",
              },
            ],
          },
          {
            id: "sub_adm_2",
            order_number: "ORD-ADM-1-B",
            invoice_number: "INV-ADM-002",
            status: "CONFIRMED",
            total: dec(300),
            items_subtotal: dec(280),
            delivery_fee: dec(25),
            tax: dec(15),
            discount: dec(15), // Sub-order 2 discount: 15
            vendor: { id: "v2", business_name: "Store 2" },
            commission: dec(30),
            items: [
              {
                product_name: "Item 2",
                unit: "500 g",
                quantity: 2,
                unit_price: dec(50),
                total_price: dec(100),
                status: "active",
              },
            ],
          },
        ],
      };

      prismaMock.masterOrder.findUnique.mockResolvedValueOnce(mockMaster);

      const detail = await adminOrderService.getById("mo_admin");

      // Verify discount is 20 + 15 = 35 (NOT 0!)
      expect(detail.discount).toBe(35);
      expect(detail.invoice_number).toBe("INV-ADM-001");
      expect(detail.platform_fee).toBe(10);
      expect(detail.additional_charges).toEqual([{ name: "Handling", amount: 10 }]);
      expect(detail.payment?.razorpay_payment_id).toBe("pay_adm");

      // Store-wise sub_orders breakdown
      expect(detail.sub_orders?.length).toBe(2);
      expect(detail.sub_orders?.[0]?.discount).toBe(20);
      expect(detail.sub_orders?.[1]?.discount).toBe(15);
      expect(detail.sub_orders?.[0]?.invoice_number).toBe("INV-ADM-001");
      expect(detail.sub_orders?.[1]?.invoice_number).toBe("INV-ADM-002");
    });
  });
});
