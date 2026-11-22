import prisma from "../database/prisma";
import { Prisma } from "@prisma/client";

export interface AddCreditsOptions {
  amount: number;
  reason?: string;
  actorId?: string;
}

export interface ListUsageLogsOptions {
  page?: number;
  per_page?: number;
  search?: string;
}

export const trackingCreditService = {
  /**
   * Retrieves or initializes the singleton credit wallet.
   * Default starting balance is 1200 credits with 0 dues.
   */
  async getWallet() {
    let wallet = await prisma.trackingCreditWallet.findFirst();
    if (!wallet) {
      wallet = await prisma.trackingCreditWallet.create({
        data: {
          balance: 1200,
          total_recharged: 1200,
          total_used: 0,
          dues_amount: new Prisma.Decimal(0),
          cost_per_track: new Prisma.Decimal(1.0),
        },
      });

      // Record initial seed log
      await prisma.trackingUsageLog.create({
        data: {
          wallet_id: wallet.id,
          type: "RECHARGE",
          credits: 1200,
          balance_after: 1200,
          dues_after: new Prisma.Decimal(0),
          description: "Initial platform allocation (+1,200 Credits)",
        },
      });
    }

    return wallet;
  },

  /**
   * Add / recharge credits to the wallet (e.g. from CLI `npm run credits:add 1200`).
   * Automatically clears or reduces dues if the balance was negative.
   */
  async addCredits(amount: number, reason = "Manual Credit Recharge") {
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error("Credit amount must be a positive number.");
    }

    const wallet = await this.getWallet();
    const newBalance = wallet.balance + amount;
    const costPerTrack = Number(wallet.cost_per_track ?? 1.0);
    const newDues = newBalance < 0 ? Math.abs(newBalance) * costPerTrack : 0;

    const [updatedWallet, log] = await prisma.$transaction([
      prisma.trackingCreditWallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          total_recharged: wallet.total_recharged + amount,
          dues_amount: new Prisma.Decimal(newDues),
        },
      }),
      prisma.trackingUsageLog.create({
        data: {
          wallet_id: wallet.id,
          type: "RECHARGE",
          credits: amount,
          balance_after: newBalance,
          dues_after: new Prisma.Decimal(newDues),
          description: `${reason} (+${amount.toLocaleString()} Credits)`,
        },
      }),
    ]);

    return {
      wallet: updatedWallet,
      log,
      amountAdded: amount,
      previousBalance: wallet.balance,
      newBalance,
      duesAmount: newDues,
    };
  },

  /**
   * Deduct 1 credit for a live-tracked delivery order.
   * Completely non-blocking: if balance <= 0, tracking still functions
   * and dues_amount increases by ₹1.00.
   */
  async deductCreditForOrder(orderId: string) {
    if (!orderId) return null;

    try {
      // 1. Fetch order metadata to populate full usage history
      let masterOrder = await prisma.masterOrder.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          address: true,
          delivery_partner: { include: { user: true } },
          orders: { include: { vendor: true } },
        },
      });

      if (!masterOrder) {
        const child = await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            master_order: {
              include: {
                customer: true,
                address: true,
                delivery_partner: { include: { user: true } },
                orders: { include: { vendor: true } },
              },
            },
          },
        });
        if (child?.master_order) {
          masterOrder = child.master_order;
        }
      }

      const targetOrderId = masterOrder?.id || orderId;

      // 2. Idempotency check: don't double charge an order that has already been deducted
      const existingLog = await prisma.trackingUsageLog.findFirst({
        where: {
          type: "USAGE",
          OR: [{ order_id: targetOrderId }, { order_id: orderId }],
        },
      });
      if (existingLog) {
        return { alreadyDeducted: true, log: existingLog };
      }

      const wallet = await this.getWallet();
      const newBalance = wallet.balance - 1;
      const costPerTrack = Number(wallet.cost_per_track ?? 1.0);
      const newDues = newBalance < 0 ? Math.abs(newBalance) * costPerTrack : 0;

      const customerName = masterOrder?.customer?.name || "Customer";
      const customerPhone = masterOrder?.customer?.phone || masterOrder?.address?.phone || null;
      const customerAddress =
        masterOrder?.address?.full_address ||
        [masterOrder?.address?.landmark, masterOrder?.address?.city, masterOrder?.address?.pincode]
          .filter(Boolean)
          .join(", ") ||
        "Delivery Destination";

      const riderName =
        masterOrder?.delivery_partner?.user?.name ||
        masterOrder?.delivery_partner?.vehicle_number ||
        "Delivery Partner";

      const vendorNames =
        masterOrder?.orders
          ?.map((o) => o.vendor?.business_name)
          .filter(Boolean)
          .join(", ") || "VegaMart Store";

      const orderNumber = masterOrder?.order_number || orderId.slice(0, 8);

      const [updatedWallet, log] = await prisma.$transaction([
        prisma.trackingCreditWallet.update({
          where: { id: wallet.id },
          data: {
            balance: newBalance,
            total_used: wallet.total_used + 1,
            dues_amount: new Prisma.Decimal(newDues),
          },
        }),
        prisma.trackingUsageLog.create({
          data: {
            wallet_id: wallet.id,
            type: "USAGE",
            credits: -1,
            balance_after: newBalance,
            dues_after: new Prisma.Decimal(newDues),
            order_id: masterOrder?.id || orderId,
            order_number: orderNumber,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_address: customerAddress,
            rider_name: riderName,
            vendor_names: vendorNames,
            description: `Live Delivery Tracking for Order #${orderNumber}`,
          },
        }),
      ]);

      return {
        success: true,
        wallet: updatedWallet,
        log,
      };
    } catch (err) {
      console.error("[TrackingCreditService] Deduct error:", err);
      return null;
    }
  },

  /**
   * List paginated credit usage logs with search filtering.
   */
  async listUsageLogs(options: ListUsageLogsOptions = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(options.per_page) || 20));
    const skip = (page - 1) * perPage;
    const search = options.search?.trim();

    const wallet = await this.getWallet();

    const where: Prisma.TrackingUsageLogWhereInput = search
      ? {
          OR: [
            { order_number: { contains: search, mode: "insensitive" } },
            { customer_name: { contains: search, mode: "insensitive" } },
            { customer_phone: { contains: search, mode: "insensitive" } },
            { customer_address: { contains: search, mode: "insensitive" } },
            { rider_name: { contains: search, mode: "insensitive" } },
            { vendor_names: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [total, logs] = await Promise.all([
      prisma.trackingUsageLog.count({ where }),
      prisma.trackingUsageLog.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: perPage,
      }),
    ]);

    return {
      wallet: {
        id: wallet.id,
        balance: wallet.balance,
        available_credits: Math.max(0, wallet.balance),
        dues_amount: Number(wallet.dues_amount),
        total_used: wallet.total_used,
        total_recharged: wallet.total_recharged,
        cost_per_track: Number(wallet.cost_per_track),
        is_overdrawn: wallet.balance < 0,
      },
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
      logs: logs.map((l) => ({
        id: l.id,
        type: l.type,
        credits: l.credits,
        balance_after: l.balance_after,
        dues_after: Number(l.dues_after),
        order_id: l.order_id,
        order_number: l.order_number,
        customer_name: l.customer_name,
        customer_phone: l.customer_phone,
        customer_address: l.customer_address,
        rider_name: l.rider_name,
        vendor_names: l.vendor_names,
        description: l.description,
        created_at: l.created_at,
      })),
    };
  },
};
