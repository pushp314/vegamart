import type { Request, Response } from "express";

import { vendorService } from "../services/vendor.service";
import { discoveryService } from "../services/discovery.service";
import { analyticsService } from "../services/analytics.service";
import { sendCreated, sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { buildPaginationMeta } from "../utils/pagination";
import { getByKey } from "../repositories/settings.repository";
import { GUEST_USER_ID } from "../constants";
import type {
  CreateVendorBody,
  UpdateVendorBody,
  VendorLocationBody,
  UpsertDailyLocationBody,
} from "../validators/vendor.validators";
import type { CreateReviewBody } from "../validators/product.validators";
import type { VendorKycBody, RingBellBody } from "../validators/integration.validators";

/**
 * @swagger
 * /vendors:
 *   get:
 *     summary: List approved vendors with filters
 *     tags: [Vendors]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Free-text search on name, slug, description, city.
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: is_open
 *         schema: { type: string, enum: ["true", "false"] }
 *     responses:
 *       200:
 *         description: Paginated vendor list.
 */
export const listVendors = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { page?: string; per_page?: string; q?: string; city?: string; category?: string; is_open?: string };
  const result = await vendorService.list({
    page: query.page ? Number(query.page) : undefined,
    per_page: query.per_page ? Number(query.per_page) : undefined,
    q: query.q,
    city: query.city,
    category: query.category,
    is_open: query.is_open,
  });
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /vendors/nearby:
 *   get:
 *     summary: Find vendors within a delivery radius
 *     description: Returns vendors sorted by distance. Only vendors whose delivery radius covers the point are included.
 *     tags: [Vendors]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: radius
 *         schema: { type: number, default: 5 }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: is_open
 *         schema: { type: string, enum: ["true", "false"] }
 *     responses:
 *       200:
 *         description: Vendors sorted by distance.
 */
export const nearbyVendors = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { lat?: string; lng?: string; radius?: string; category?: string; is_open?: string; page?: string; per_page?: string };
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  const radius = query.radius ? Number(query.radius) : 5;
  const page = query.page ? Number(query.page) : 1;
  const perPage = query.per_page ? Number(query.per_page) : 20;
  const result = await vendorService.nearby(lat, lng, radius, {
    category: query.category,
    isOpen: query.is_open !== undefined ? query.is_open === "true" : undefined,
    page,
    perPage,
  });
  if (req.user?.id && req.user.id !== GUEST_USER_ID) {
    await discoveryService.recordSearch(req.user.id, {
      query: query.category ?? "nearby",
      category: query.category,
      latitude: lat,
      longitude: lng,
      radius_km: radius,
      filters: { is_open: query.is_open, scope: "vendors" },
    });
  }
  return sendSuccess(res, result.vendors, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /vendors/me:
 *   get:
 *     summary: Get the authenticated vendor's own profile
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendors]
 *     responses:
 *       200:
 *         description: Vendor profile.
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */
export const getMyVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.getMyVendor(req.user!.id);
  const planRow = await getByKey(`vendor_subscription:${vendor.id}`);
  const plan = planRow?.value as { plan?: string } | null;
  return sendSuccess(res, { ...vendor, status: vendor.status.toLowerCase(), subscription_plan: plan?.plan ?? null });
});

/**
 * @swagger
 * /vendors:
 *   post:
 *     summary: Register a vendor profile
 *     description: Requires an authenticated vendor account. Profile starts in PENDING status.
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_name, address, city, state, pincode]
 *             properties:
 *               business_name: { type: string }
 *               description: { type: string, nullable: true }
 *               category: { type: string, nullable: true }
 *               address: { type: string }
 *               city: { type: string }
 *               state: { type: string }
 *               pincode: { type: string }
 *               latitude: { type: number, nullable: true }
 *               longitude: { type: number, nullable: true }
 *               delivery_radius_km: { type: number }
 *               business_hours: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Vendor profile created.
 */
export const createVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.create(req.user!.id, req.body as CreateVendorBody, req);
  return sendCreated(res, { ...vendor, status: vendor.status.toLowerCase() });
});

/**
 * @swagger
 * /vendors/me:
 *   put:
 *     summary: Update the authenticated vendor's own profile
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Vendor profile updated.
 */
export const updateMyVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.update(req.user!.id, req.body as UpdateVendorBody, req);
  return sendSuccess(res, { ...vendor, status: vendor.status.toLowerCase() });
});

/**
 * @swagger
 * /vendors/me/availability:
 *   put:
 *     summary: Toggle the vendor's open/closed status
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [is_open]
 *             properties:
 *               is_open: { type: boolean }
 *     responses:
 *       200:
 *         description: Availability updated.
 */
export const setVendorAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { is_open } = req.body as { is_open: boolean };
  const vendor = await vendorService.setAvailability(req.user!.id, is_open, req);
  return sendSuccess(res, vendor);
});

/**
 * @swagger
 * /vendors/me/location:
 *   put:
 *     summary: Update the vendor's location (lat/lng)
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lat, lng]
 *             properties:
 *               lat: { type: number }
 *               lng: { type: number }
 *     responses:
 *       200:
 *         description: Location updated.
 */
export const updateVendorLocation = asyncHandler(async (req: Request, res: Response) => {
  const { lat, lng } = req.body as { lat: number; lng: number };
  const vendor = await vendorService.setLocation(req.user!.id, lat, lng, req);
  return sendSuccess(res, vendor);
});

/**
 * @swagger
 * /vendors/me/hours:
 *   put:
 *     summary: Update the vendor's business hours
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_hours]
 *             properties:
 *               business_hours: { type: string }
 *               available_from: { type: string, nullable: true }
 *               available_to: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Hours updated.
 */
export const updateVendorHours = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { business_hours: string; available_from?: string | null; available_to?: string | null };
  const vendor = await vendorService.setHours(
    req.user!.id,
    body.business_hours,
    body.available_from ?? null,
    body.available_to ?? null,
    req
  );
  return sendSuccess(res, vendor);
});

/**
 * @swagger
 * /vendors/{vendor_id}:
 *   get:
 *     summary: Get a public vendor profile by id
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: vendor_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vendor details.
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */
export const getVendorById = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.getById(req.params.vendor_id as string);
  await analyticsService.trackStoreView(vendor.id);
  return sendSuccess(res, vendor);
});

/**
 * @swagger
 * /vendors/by-slug/{slug}:
 *   get:
 *     summary: Get a public approved vendor by slug
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Vendor details.
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */
export const getVendorBySlug = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.getBySlug(req.params.slug as string);
  await analyticsService.trackStoreView(vendor.id);
  return sendSuccess(res, vendor);
});

/**
 * @swagger
 * /vendors/location:
 *   patch:
 *     summary: Update the authenticated vendor's full location details
 *     description: Updates any subset of latitude, longitude, address, landmark, city, state, country, pincode and delivery radius.
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               latitude: { type: number, nullable: true }
 *               longitude: { type: number, nullable: true }
 *               address: { type: string }
 *               landmark: { type: string, nullable: true }
 *               city: { type: string }
 *               state: { type: string }
 *               country: { type: string }
 *               pincode: { type: string }
 *               delivery_radius_km: { type: number }
 *     responses:
 *       200:
 *         description: Vendor location updated.
 */
export const patchVendorLocation = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.updateLocation(req.user!.id, req.body as VendorLocationBody, req);
  return sendSuccess(res, vendor);
});

/**
 * @swagger
 * /vendors/location:
 *   get:
 *     summary: Get the authenticated vendor's current location
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendors]
 *     responses:
 *       200:
 *         description: Vendor location details.
 */
export const getMyLocation = asyncHandler(async (req: Request, res: Response) => {
  const location = await vendorService.getMyLocation(req.user!.id);
  return sendSuccess(res, location);
});

/**
 * @swagger
 * /vendors/{vendor_id}/location:
 *   get:
 *     summary: Get a public vendor's location
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: vendor_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vendor location details.
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */
export const getVendorLocation = asyncHandler(async (req: Request, res: Response) => {
  const location = await vendorService.getLocationById(req.params.vendor_id as string);
  return sendSuccess(res, location);
});

/**
 * @swagger
 * /vendors/{vendor_id}/review:
 *   post:
 *     summary: Approve or reject a vendor application
 *     description: Admin / super_admin only.
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: vendor_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision]
 *             properties:
 *               decision: { type: string, enum: ["approve", "reject"] }
 *               reason: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Vendor reviewed.
 */
export const reviewVendor = asyncHandler(async (req: Request, res: Response) => {
  const { decision, reason } = req.body as { decision: "approve" | "reject"; reason?: string | null };
  const vendor = await vendorService.review(req.user!.id, req.params.vendor_id as string, decision, reason ?? null, req);
  return sendSuccess(res, vendor);
});

/**
 * @swagger
 * /vendors/{vendor_id}/suspend:
 *   post:
 *     summary: Suspend a vendor
 *     description: Admin / super_admin only.
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: vendor_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vendor suspended.
 */
export const suspendVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.suspend(req.user!.id, req.params.vendor_id as string, req);
  return sendSuccess(res, vendor);
});

// ---------------------------------------------------------------------------
// Vendor Dashboard
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /vendors/me/dashboard:
 *   get:
 *     summary: Get the authenticated vendor's dashboard data
 *     description: Returns today's stats, revenue, recent orders, and top products.
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendors]
 *     responses:
 *       200:
 *         description: Vendor dashboard data.
 */
export const getMyDashboard = asyncHandler(async (req: Request, res: Response) => {
  const data = await vendorService.getMyDashboard(req.user!.id);
  return sendSuccess(res, data);
});

export const getVendorAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const data = await vendorService.getVendorAnalytics(req.user!.id);
  return sendSuccess(res, data);
});

export const getMyReviews = asyncHandler(async (req: Request, res: Response) => {
  const data = await vendorService.getMyReviews(req.user!.id);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// Daily Location (Location Broadcast)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /vendors/me/daily-location:
 *   get:
 *     summary: Get the authenticated vendor's today's broadcast location
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendors]
 *     responses:
 *       200:
 *         description: Today's daily location (or null if not set).
 */
export const getMyDailyLocation = asyncHandler(async (req: Request, res: Response) => {
  const data = await vendorService.getMyDailyLocation(req.user!.id);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /vendors/me/daily-location:
 *   put:
 *     summary: Create or update the vendor's today's broadcast location
 *     description: Only roaming vendors can broadcast a daily location. One active broadcast per vendor per day.
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [area, address, latitude, longitude]
 *             properties:
 *               area: { type: string, description: "Area or neighborhood" }
 *               landmark: { type: string, nullable: true }
 *               address: { type: string, description: "Full address text" }
 *               latitude: { type: number, minimum: -90, maximum: 90 }
 *               longitude: { type: number, minimum: -180, maximum: 180 }
 *               start_time: { type: string, description: "HH:MM (24h)", nullable: true }
 *               end_time: { type: string, description: "HH:MM (24h)", nullable: true }
 *               notes: { type: string, nullable: true }
 *               is_active: { type: boolean, default: true }
 *     responses:
 *       200:
 *         description: Daily location upserted.
 */
export const upsertDailyLocation = asyncHandler(async (req: Request, res: Response) => {
  const data = await vendorService.upsertDailyLocation(req.user!.id, req.body as UpsertDailyLocationBody, req);
  return sendSuccess(res, data, { message: "Daily location updated." });
});

/**
 * @swagger
 * /vendors/me/daily-location:
 *   delete:
 *     summary: Remove the vendor's today's broadcast location
 *     security:
 *       - bearerAuth: []
 *     tags: [Vendors]
 *     responses:
 *       204:
 *         description: Daily location removed.
 */
export const removeDailyLocation = asyncHandler(async (req: Request, res: Response) => {
  await vendorService.removeDailyLocation(req.user!.id);
  res.status(204).send();
});

/**
 * @swagger
 * /vendors/{vendor_id}/daily-location:
 *   get:
 *     summary: Get a vendor's today's broadcast location (public)
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: vendor_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vendor's daily location (or null).
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */
export const getVendorDailyLocation = asyncHandler(async (req: Request, res: Response) => {
  const data = await vendorService.getVendorDailyLocation(req.params.vendor_id as string);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /vendors/nearby/daily:
 *   get:
 *     summary: Find roaming vendors with active daily locations nearby
 *     tags: [Vendors]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: radius
 *         schema: { type: number, default: 5 }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: is_open
 *         schema: { type: string, enum: ["true", "false"] }
 *     responses:
 *       200:
 *         description: Nearby vendors with daily locations.
 */
export const nearbyDailyLocations = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { lat?: string; lng?: string; radius?: string; category?: string; is_open?: string; page?: string; per_page?: string };
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  const radius = query.radius ? Number(query.radius) : 5;
  const result = await vendorService.getNearbyWithDailyLocation(lat, lng, radius, {
    category: query.category,
    is_open: query.is_open !== undefined ? query.is_open === "true" : undefined,
    page: query.page ? Number(query.page) : undefined,
    per_page: query.per_page ? Number(query.per_page) : undefined,
  });
  if (req.user?.id && req.user.id !== GUEST_USER_ID) {
    await discoveryService.recordSearch(req.user.id, {
      query: query.category ?? "nearby-daily",
      category: query.category,
      latitude: lat,
      longitude: lng,
      radius_km: radius,
      filters: { is_open: query.is_open, scope: "roaming" },
    });
  }
  return sendSuccess(res, result.items, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.per_page }, result.total),
  });
});

export const cancelVendorApplication = asyncHandler(async (req: Request, res: Response) => {
  const data = await vendorService.cancelVendorApplication(req.user!.id, req);
  return sendSuccess(res, data, { message: "Vendor application cancelled successfully." });
});

/**
 * @swagger
 * /api/v1/vendors/me/kyc:
 *   get:
 *     summary: Get my vendor KYC details
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KYC details retrieved successfully
 */
export const getVendorKyc = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, await vendorService.getVendorKyc(req.user!.id));
});

/**
 * @swagger
 * /api/v1/vendors/me/kyc:
 *   post:
 *     summary: Submit vendor KYC documents
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               document_type:
 *                 type: string
 *               document_number:
 *                 type: string
 *               document_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: KYC documents submitted
 */
export const submitVendorKyc = asyncHandler(async (req: Request, res: Response) => {
  const data = await vendorService.submitVendorKyc(req.user!.id, req.body as VendorKycBody, req);
  return sendCreated(res, data, "KYC documents submitted.");
});

/**
 * @swagger
 * /api/v1/vendors/me/earnings:
 *   get:
 *     summary: Get my vendor earnings summary
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Earnings summary retrieved successfully
 */
export const getVendorEarnings = asyncHandler(async (req: Request, res: Response) => {
  const month = req.query.month as string | undefined;
  return sendSuccess(res, await vendorService.getVendorEarnings(req.user!.id, month));
});

export const getMyMembership = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, await vendorService.getMyMembership(req.user!.id));
});

export const purchaseMembership = asyncHandler(async (req: Request, res: Response) => {
  const { plan_id } = req.body as { plan_id: string };
  const result = await vendorService.purchaseMembership(req.user!.id, plan_id, req);
  const message = "checkout" in result
    ? "Membership checkout initiated. Complete payment to activate your plan."
    : "Membership plan activated successfully.";
  return sendSuccess(res, result, { message });
});

export const verifyMembershipPayment = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorService.verifyMembershipPayment(
    req.user!.id,
    req.body as { razorpay_subscription_id: string; razorpay_payment_id: string; razorpay_signature: string },
    req
  );
  return sendSuccess(res, result, { message: "Payment verified. Membership plan activated." });
});

export const cancelMembership = asyncHandler(async (req: Request, res: Response) => {
  const membership = await vendorService.cancelMembership(req.user!.id, req);
  return sendSuccess(res, membership, { message: "Membership plan canceled successfully." });
});

/**
 * @swagger
 * /api/v1/vendors/{vendor_id}/ring-bell:
 *   post:
 *     summary: Ring a bell for a vendor
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: vendor_id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: Vendor ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customer_lat:
 *                 type: number
 *               customer_lng:
 *                 type: number
 *     responses:
 *       200:
 *         description: Bell rung successfully
 */
export const ringBell = asyncHandler(async (req: Request, res: Response) => {
  const data = await vendorService.ringBell(req.params.vendor_id as string, req.body as RingBellBody, req);
  return sendSuccess(res, data, { message: "Bell rung! The vendor has been notified." });
});

export const createVendorReview = asyncHandler(async (req: Request, res: Response) => {
  const { vendor_id } = req.params as { vendor_id: string };
  const body = req.body as CreateReviewBody;
  const review = await vendorService.createReview(req.user!.id, vendor_id, body, req);
  return sendCreated(res, review, "Vendor review submitted successfully.");
});

export const bulkUploadProducts = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new Error("No file uploaded");
  const result = await vendorService.bulkUploadProducts(req.user!.id, req.file.buffer);
  return sendSuccess(res, result, "Products uploaded successfully");
});
