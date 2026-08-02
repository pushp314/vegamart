import type { Request, Response } from "express";

import prisma from "../database/prisma";
import { integrationService } from "../services/integration.service";
import { authService } from "../services/auth.service";
import { adminUserService } from "../services/admin-user.service";
import { adminVendorService } from "../services/admin-vendor.service";
import { adminDeliveryService } from "../services/admin-delivery.service";
import { sendCreated, sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { buildPaginationMeta } from "../utils/pagination";
import type {
  CreateOrderAliasBody,
  DeliveredOtpBody,
  DeliveryKycBody,
  DeliveryLocationBody,
  DeliveryOrderStatusBody,
  DeliveryRegisterBody,
  RingBellBody,
  VendorKycBody,
  VendorRegisterBody,
} from "../validators/integration.validators";

// ---------------------------------------------------------------------------
// Admin CMS aliases (frontend-compatible)
// ---------------------------------------------------------------------------
export const createCmsOfferAlias = asyncHandler(async (req: Request, res: Response) => {
  const { title, sub, tag } = req.body as { title: string; sub?: string | null; tag?: string | null };
  const row = await prisma.cmsOffer.create({
    data: {
      title,
      description: sub ?? null,
      discount: tag ?? null,
    },
  });
  return sendCreated(res, row, "Offer created.");
});

export const createCmsBannerAlias = asyncHandler(async (req: Request, res: Response) => {
  const { title, type, link_url, image_url } = req.body as {
    title?: string | null;
    type?: string | null;
    link_url?: string | null;
    image_url: string;
  };
  const row = await prisma.cmsBanner.create({
    data: {
      title: title ?? null,
      position: type ?? null,
      link: link_url ?? null,
      image_url,
    },
  });
  return sendCreated(res, row, "Banner created.");
});

export const createCmsFaqAlias = asyncHandler(async (req: Request, res: Response) => {
  const { question, answer, sort_order } = req.body as {
    question: string;
    answer: string;
    sort_order?: number;
  };
  const row = await prisma.cmsFaq.create({
    data: {
      question,
      answer,
      sort_order: sort_order ?? 0,
    },
  });
  return sendCreated(res, row, "FAQ created.");
});

export const featureProductAlias = asyncHandler(async (req: Request, res: Response) => {
  const { is_featured } = req.body as { is_featured: boolean };
  const row = await prisma.product.update({
    where: { id: req.params.product_id as string },
    data: { is_featured },
    select: { id: true, name: true, is_featured: true },
  });
  return sendSuccess(res, row, { message: is_featured ? "Product featured." : "Product un-featured." });
});

// ---------------------------------------------------------------------------
// Auth OTP aliases (frontend-compatible)
// ---------------------------------------------------------------------------
export const sendLoginOtpAlias = asyncHandler(async (req: Request, res: Response) => {
  const { email, purpose } = req.body as { email: string; purpose?: string };
  await authService.resendOtp(email, (purpose ?? "LOGIN") as never, req);
  return sendSuccess(res, { ok: true }, { message: "OTP sent." });
});

export const verifyLoginOtpAlias = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body as { email: string; otp: string };
  const session = await authService.loginWithOtp(email, otp, req);
  return sendSuccess(res, session);
});

// ---------------------------------------------------------------------------
// Browse
// ---------------------------------------------------------------------------
export const listBanners = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, await integrationService.listBanners());
});

export const listOffers = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, await integrationService.listOffers());
});

export const listFaqs = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, await integrationService.listFaqs());
});

export const listTrendingProducts = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, await integrationService.listTrendingProducts());
});

// ---------------------------------------------------------------------------
// Recently viewed / recommended
// ---------------------------------------------------------------------------
export const addRecentlyViewed = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.addRecentlyViewed(
    req.user!.id,
    (req.body as { product_id: string }).product_id
  );
  return sendSuccess(res, data);
});

export const listRecentlyViewed = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, await integrationService.listRecentlyViewed(req.user!.id));
});

export const listRecommended = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, await integrationService.listRecommended(req.user!.id));
});

// ---------------------------------------------------------------------------
// Checkout + orders
// ---------------------------------------------------------------------------
export const createOrderAlias = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.createOrder(req.user!.id, req.body as CreateOrderAliasBody, req);
  return sendCreated(res, data, "Order created successfully.");
});

export const listVendorOrdersAlias = asyncHandler(async (req: Request, res: Response) => {
  const result = await integrationService.listVendorOrders(req.user!.id, {
    page: req.query.page ? Number(req.query.page) : undefined,
    per_page: req.query.per_page ? Number(req.query.per_page) : undefined,
    status: (req.query.status as string | undefined) ?? undefined,
  });
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

export const reorderOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.reorder(req.user!.id, req.params.id as string, req);
  return sendSuccess(res, data, { message: "Items added to your cart." });
});

export const returnOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.requestReturn(req.user!.id, req.params.id as string, req);
  return sendSuccess(res, data, { message: "Return/refund requested successfully." });
});

// ---------------------------------------------------------------------------
// Vendor self-service
// ---------------------------------------------------------------------------
export const registerVendor = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.registerVendor(req.user!.id, req.body as VendorRegisterBody, req);
  return sendCreated(res, data, "Vendor application submitted.");
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.updateMyProfile(req.user!.id, req.body as Record<string, unknown>, req);
  return sendSuccess(res, data, { message: "Profile updated successfully." });
});

export const toggleAvailabilityAlias = asyncHandler(async (req: Request, res: Response) => {
  const isOpen = (req.body as { is_open: boolean }).is_open;
  const data = await integrationService.toggleAvailability(req.user!.id, isOpen, req);
  return sendSuccess(res, data, { message: "Availability updated." });
});

export const submitVendorKyc = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.submitVendorKyc(req.user!.id, req.body as VendorKycBody, req);
  return sendCreated(res, data, "KYC documents submitted.");
});

export const getVendorKyc = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, await integrationService.getVendorKyc(req.user!.id));
});

export const getVendorEarnings = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, await integrationService.getVendorEarnings(req.user!.id));
});

export const ringBell = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.ringBell(req.params.vendor_id as string, req.body as RingBellBody, req);
  return sendSuccess(res, data, { message: "Bell rung! The vendor has been notified." });
});

// ---------------------------------------------------------------------------
// Delivery partner
// ---------------------------------------------------------------------------
export const registerDelivery = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.registerDelivery(req.user!.id, req.body as DeliveryRegisterBody, req);
  return sendCreated(res, data, "Delivery partner application submitted.");
});

export const getDeliveryMe = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, await integrationService.getDeliveryMe(req.user!.id));
});

export const listDeliveryRequests = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, await integrationService.listDeliveryRequests());
});

export const listMyDeliveries = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, await integrationService.listMyDeliveries(req.user!.id));
});

export const acceptDelivery = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.acceptDelivery(req.user!.id, req.params.id as string, req);
  return sendSuccess(res, data, { message: "Delivery accepted." });
});

export const updateDeliveryStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.updateDeliveryStatus(
    req.user!.id,
    req.params.id as string,
    req.body as DeliveryOrderStatusBody
  );
  return sendSuccess(res, data, { message: "Delivery status updated." });
});

export const updateDeliveryLocation = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.updateDeliveryLocation(req.user!.id, req.body as DeliveryLocationBody);
  return sendSuccess(res, data, { message: "Location updated." });
});

export const markDelivered = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.markDelivered(req.user!.id, req.params.id as string, req.body as DeliveredOtpBody);
  return sendSuccess(res, data, { message: "Order marked as delivered." });
});

export const submitDeliveryKyc = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.submitDeliveryKyc(req.user!.id, req.body as DeliveryKycBody, req);
  return sendCreated(res, data, "Documents submitted.");
});

export const getDeliveryTracking = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, await integrationService.getDeliveryTracking(req.params.id as string));
});

// ---------------------------------------------------------------------------
// Addresses under /users/me
// ---------------------------------------------------------------------------
export const listMyAddresses = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, await integrationService.listMyAddresses(req.user!.id));
});

export const createMyAddress = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.createMyAddress(req.user!.id, req.body as Record<string, unknown>);
  return sendCreated(res, data, "Address created.");
});

export const updateMyAddress = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.updateMyAddress(req.user!.id, req.params.id as string, req.body as Record<string, unknown>);
  return sendSuccess(res, data, { message: "Address updated." });
});

export const removeMyAddress = asyncHandler(async (req: Request, res: Response) => {
  await integrationService.removeMyAddress(req.user!.id, req.params.id as string);
  return sendSuccess(res, { ok: true }, { message: "Address removed." });
});

export const setDefaultMyAddress = asyncHandler(async (req: Request, res: Response) => {
  const data = await integrationService.setDefaultAddress(req.user!.id, req.params.id as string);
  return sendSuccess(res, data, { message: "Default address updated." });
});

// ---------------------------------------------------------------------------
// Admin aliases (frontend-compatible)
// ---------------------------------------------------------------------------
export const listDeliveryPartnersAlias = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminDeliveryService.list(req.query as never);
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

export const approveVendorAlias = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminVendorService.review(req.user!.id, req.params.vendor_id as string, "approve", null, req);
  return sendSuccess(res, data, { message: "Vendor approved." });
});

export const rejectVendorAlias = asyncHandler(async (req: Request, res: Response) => {
  const reason = (req.body as { reason?: string | null }).reason ?? null;
  const data = await adminVendorService.review(req.user!.id, req.params.vendor_id as string, "reject", reason, req);
  return sendSuccess(res, data, { message: "Vendor rejected." });
});

export const suspendVendorAlias = asyncHandler(async (req: Request, res: Response) => {
  const reason = (req.body as { reason?: string | null }).reason ?? null;
  const data = await adminVendorService.suspend(req.user!.id, req.params.vendor_id as string, reason, req);
  return sendSuccess(res, data, { message: "Vendor suspended." });
});

export const toggleUserStatusAlias = asyncHandler(async (req: Request, res: Response) => {
  const isActive = (req.body as { is_active: boolean }).is_active;
  const data = isActive
    ? await adminUserService.activate(req.user!.id, req.params.user_id as string, req)
    : await adminUserService.suspend(req.user!.id, req.params.user_id as string, null, req);
  return sendSuccess(res, data, { message: isActive ? "User activated." : "User suspended." });
});

export const approveDeliveryAlias = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminDeliveryService.review(req.user!.id, req.params.delivery_id as string, "approve", null, req);
  return sendSuccess(res, data, { message: "Delivery partner approved." });
});

export const rejectDeliveryAlias = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminDeliveryService.review(req.user!.id, req.params.delivery_id as string, "reject", null, req);
  return sendSuccess(res, data, { message: "Delivery partner rejected." });
});
