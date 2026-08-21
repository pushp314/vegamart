import type { Request, Response, NextFunction } from "express";
import { Prisma, TicketStatus } from "@prisma/client";

import { prisma } from "../database/prisma";
import { dashboardService } from "../services/dashboard.service";
import { adminUserService } from "../services/admin-user.service";
import { adminVendorService } from "../services/admin-vendor.service";
import { adminDeliveryService } from "../services/admin-delivery.service";
import { auditLogService } from "../services/audit-log.service";
import { adminOrderService } from "../services/admin-order.service";
import { productService } from "../services/product.service";
import { membershipPlanService } from "../services/membership-plan.service";
import { maintenanceService } from "../services/maintenance.service";
import { payoutService } from "../services/payout.service";
import { getStorageMetrics } from "../storage/r2.client";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { HttpStatus } from "../utils/httpStatus";
import { buildPaginationMeta } from "../utils/pagination";

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get platform dashboard metrics
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Dashboard metrics.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/Forbidden"
 */
export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const data = await dashboardService.getMetrics(req.user!.id, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List all users with filters
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
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
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [customer, vendor, delivery, admin, super_admin] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive, suspended, banned] }
 *     responses:
 *       200:
 *         description: Paginated user list.
 */
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminUserService.list(req.query as never);
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /admin/users/{user_id}:
 *   get:
 *     summary: Get user details for admin
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User details.
 */
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminUserService.getById(req.params.user_id as string);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/users/{user_id}/suspend:
 *   post:
 *     summary: Suspend a user
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: User suspended.
 */
export const suspendUser = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminUserService.suspend(
    req.user!.id,
    req.params.user_id as string,
    (req.body as { reason?: string | null }).reason ?? null,
    req
  );
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/users/{user_id}/activate:
 *   post:
 *     summary: Activate a suspended user
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User activated.
 */
export const activateUser = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminUserService.activate(req.user!.id, req.params.user_id as string, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/users/{user_id}:
 *   delete:
 *     summary: Soft-delete a user
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User deleted.
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminUserService.remove(req.user!.id, req.params.user_id as string, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/users/{user_id}/restore:
 *   post:
 *     summary: Restore a soft-deleted user
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User restored.
 */
export const restoreUser = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminUserService.restore(req.user!.id, req.params.user_id as string, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/users/{user_id}/reset-password:
 *   post:
 *     summary: Reset a user's password
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Password reset.
 */
export const resetUserPassword = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminUserService.resetPassword(
    req.user!.id,
    req.params.user_id as string,
    (req.body as { password: string }).password,
    req
  );
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/users/{user_id}/force-logout:
 *   post:
 *     summary: Force logout a user across all sessions
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User logged out.
 */
export const forceLogoutUser = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminUserService.forceLogout(req.user!.id, req.params.user_id as string, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/users/{user_id}/role:
 *   patch:
 *     summary: Change a user's role
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [customer, vendor, delivery, admin, super_admin] }
 *     responses:
 *       200:
 *         description: Role updated.
 */
export const changeUserRole = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminUserService.changeRole(
    req.user!.id,
    req.params.user_id as string,
    (req.body as { role: string }).role,
    req
  );
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/credentials:
 *   patch:
 *     summary: Update the signed-in admin's login email (id) and/or password
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password]
 *             properties:
 *               current_password: { type: string }
 *               email: { type: string, format: email }
 *               new_password: { type: string }
 *     responses:
 *       200:
 *         description: Admin credentials updated.
 *       400:
 *         description: Current password is incorrect.
 */
export const updateAdminCredentials = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { current_password: string; email?: string; new_password?: string };
  const data = await adminUserService.updateOwnCredentials(req.user!.id, body, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/vendors:
 *   get:
 *     summary: List all vendors for admin
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Paginated vendor list.
 */
export const listVendorsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminVendorService.list(req.query as never);
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /admin/vendors/{vendor_id}:
 *   get:
 *     summary: Get vendor details with stats
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: vendor_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vendor details and stats.
 */
export const getVendorAdmin = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminVendorService.getById(req.params.vendor_id as string);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/vendors/{vendor_id}/review:
 *   post:
 *     summary: Approve or reject a vendor
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: vendor_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision]
 *             properties:
 *               decision: { type: string, enum: [approve, reject] }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Vendor decision applied.
 */
export const reviewVendorAdmin = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { decision: "approve" | "reject"; reason?: string | null };
  const data = await adminVendorService.review(
    req.user!.id,
    req.params.vendor_id as string,
    body.decision,
    body.reason ?? null,
    req
  );
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/vendors/{vendor_id}/suspend:
 *   post:
 *     summary: Suspend a vendor
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: vendor_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vendor suspended.
 */
export const suspendVendorAdmin = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminVendorService.suspend(
    req.user!.id,
    req.params.vendor_id as string,
    (req.body as { reason?: string | null }).reason ?? null,
    req
  );
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/vendors/{vendor_id}/restore:
 *   post:
 *     summary: Restore a suspended/deleted vendor
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: vendor_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vendor restored.
 */
export const restoreVendorAdmin = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminVendorService.restore(req.user!.id, req.params.vendor_id as string, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/vendors/{vendor_id}:
 *   delete:
 *     summary: Soft-delete a vendor and its account
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: vendor_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vendor deleted.
 */
export const deleteVendorAdmin = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminVendorService.remove(req.user!.id, req.params.vendor_id as string, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/vendors/{vendor_id}/earnings:
 *   get:
 *     summary: Get vendor earnings summary
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: vendor_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vendor earnings stats.
 */
export const getVendorEarnings = asyncHandler(async (req: Request, res: Response) => {
  const month = req.query.month as string | undefined;
  const data = await adminVendorService.earnings(req.params.vendor_id as string, month);
  return sendSuccess(res, data);
});

export const updateVendorCommission = asyncHandler(async (req: Request, res: Response) => {
  const { commission_rate } = req.body as { commission_rate: number };
  const data = await adminVendorService.updateCommission(
    req.params.vendor_id as string,
    commission_rate,
    req.user!.id,
    req
  );
  return sendSuccess(res, data);
});

export const updateVendorMembership = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminVendorService.updateMembership(
    req.params.vendor_id as string,
    req.body as { membership_plan_id?: string | null; commission_rate?: number | null; membership_tier?: string | null; membership_expires_at?: string | null },
    req.user!.id,
    req
  );
  return sendSuccess(res, data);
});

export const listMembershipPlans = asyncHandler(async (req: Request, res: Response) => {
  const includeInactive = (req.query as { include_inactive?: string }).include_inactive === "true";
  const data = await membershipPlanService.listPlans(includeInactive);
  return sendSuccess(res, data);
});

export const getMembershipPlan = asyncHandler(async (req: Request, res: Response) => {
  const data = await membershipPlanService.getPlan(req.params.plan_id as string);
  return sendSuccess(res, data);
});

export const createMembershipPlan = asyncHandler(async (req: Request, res: Response) => {
  const data = await membershipPlanService.createPlan(req.body as Parameters<typeof membershipPlanService.createPlan>[0]);
  return sendSuccess(res, data);
});

export const updateMembershipPlan = asyncHandler(async (req: Request, res: Response) => {
  const data = await membershipPlanService.updatePlan(
    req.params.plan_id as string,
    req.body as Parameters<typeof membershipPlanService.updatePlan>[1]
  );
  return sendSuccess(res, data);
});

export const deleteMembershipPlan = asyncHandler(async (req: Request, res: Response) => {
  const data = await membershipPlanService.deletePlan(req.params.plan_id as string);
  return sendSuccess(res, data);
});

export const updateVendorPromotion = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { is_sponsored: boolean; sponsored_until?: string | null; sponsored_priority?: number };
  const sponsoredUntil = body.sponsored_until ? new Date(body.sponsored_until) : null;
  const data = await adminVendorService.updatePromotion(
    req.params.vendor_id as string,
    body.is_sponsored,
    sponsoredUntil,
    body.sponsored_priority,
    req.user!.id,
    req
  );
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/delivery-partners:
 *   get:
 *     summary: List all delivery partners
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Paginated delivery partner list.
 */
export const listDeliveryPartners = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminDeliveryService.list(req.query as never);
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /admin/delivery-partners:
 *   post:
 *     summary: Create a delivery partner (delivery boy) directly
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, vehicle_type]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               phone: { type: string }
 *               vehicle_type: { type: string }
 *               vehicle_number: { type: string }
 *               license_number: { type: string }
 *     responses:
 *       201:
 *         description: Delivery partner created and approved.
 */
export const createDeliveryPartner = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminDeliveryService.create(req.user!.id, req.body, req);
  return sendSuccess(res, data, { status: HttpStatus.CREATED });
});

/**
 * @swagger
 * /admin/delivery-partners/{delivery_id}:
 *   get:
 *     summary: Get delivery partner details
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: delivery_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Delivery partner details.
 */
export const getDeliveryPartner = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminDeliveryService.getById(req.params.delivery_id as string);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/delivery-partners/{delivery_id}/review:
 *   post:
 *     summary: Approve or reject a delivery partner
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: delivery_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision]
 *             properties:
 *               decision: { type: string, enum: [approve, reject] }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Delivery partner decision applied.
 */
export const reviewDeliveryPartner = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { decision: "approve" | "reject"; reason?: string | null };
  const data = await adminDeliveryService.review(
    req.user!.id,
    req.params.delivery_id as string,
    body.decision,
    body.reason ?? null,
    req
  );
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/delivery-partners/{delivery_id}/suspend:
 *   post:
 *     summary: Suspend a delivery partner
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: delivery_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Delivery partner suspended.
 */
export const suspendDeliveryPartner = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminDeliveryService.suspend(
    req.user!.id,
    req.params.delivery_id as string,
    (req.body as { reason?: string | null }).reason ?? null,
    req
  );
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/delivery-partners/{delivery_id}/restore:
 *   post:
 *     summary: Restore a suspended delivery partner
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: delivery_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Delivery partner restored.
 */
export const restoreDeliveryPartner = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminDeliveryService.restore(req.user!.id, req.params.delivery_id as string, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: List audit logs with filters
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Paginated audit log list.
 */
export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await auditLogService.list(req.query as never);
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /admin/audit-logs/{audit_log_id}:
 *   get:
 *     summary: Get a single audit log entry
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: audit_log_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Audit log entry.
 */
export const getAuditLog = asyncHandler(async (req: Request, res: Response) => {
  const data = await auditLogService.getById(req.params.audit_log_id as string);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// Order management
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /admin/orders:
 *   get:
 *     summary: List all orders with filters
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
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
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: payment_status
 *         schema: { type: string }
 *       - in: query
 *         name: vendor_id
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Paginated order list.
 */
export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminOrderService.list(req.query as never);
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /admin/products:
 *   get:
 *     summary: List all products including inactive for admin
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
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
 *       - in: query
 *         name: is_active
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: is_featured
 *         schema: { type: string, enum: [true, false] }
 *     responses:
 *       200:
 *         description: Paginated product list.
 */
export const listProductsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const result = await productService.listAdmin(req.query as never);
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /admin/orders/{order_id}:
 *   get:
 *     summary: Get order details for admin
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Order details.
 */
export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminOrderService.getById(req.params.order_id as string);
  return sendSuccess(res, data);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  await productService.adminRemove(req.user!.id, req.params.product_id as string, req);
  sendSuccess(res, "Product deleted successfully");
});

/**
 * @swagger
 * /admin/orders/{order_id}/status:
 *   patch:
 *     summary: Update order status (admin override)
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Order status updated.
 */
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, reason } = req.body as { status: string; reason?: string };
  const data = await adminOrderService.updateStatus(
    req.user!.id,
    req.params.order_id as string,
    status,
    reason ?? null,
    req
  );
  return sendSuccess(res, data);
});


export const listSupportTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 20;
    const status = req.query.status as string;

    const where: Prisma.SupportTicketWhereInput = {};
    if (status) {
      where.status = status as TicketStatus;
    }

    const [total, tickets] = await Promise.all([
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { created_at: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        page,
        per_page: perPage,
        total_pages: Math.ceil(total / perPage),
        rows: tickets,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateSupportTicketStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticket_id } = req.params;
    const { status, resolved_at } = req.body;

    const ticket = await prisma.supportTicket.update({
      where: { id: ticket_id },
      data: {
        status,
        resolved_at: resolved_at ? new Date(resolved_at) : (status === "RESOLVED" || status === "CLOSED" ? new Date() : null),
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    res.json({ success: true, data: ticket });
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2025") {
      res.status(404).json({ success: false, error: { message: "Ticket not found", code: "NOT_FOUND" } });
      return;
    }
    next(err);
  }
};

/**
 * @swagger
 * /admin/maintenance:
 *   get:
 *     summary: Get the maintenance schedule and which maintenance tasks are currently due
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Maintenance schedule status with due/upcoming tasks.
 */
export const getMaintenanceStatus = asyncHandler(async (_req: Request, res: Response) => {
  const data = await maintenanceService.getStatus();
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/maintenance/{type}/done:
 *   post:
 *     summary: Mark a maintenance task as performed and reschedule its next alert
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Maintenance status after rescheduling.
 */
export const completeMaintenanceTask = asyncHandler(async (req: Request, res: Response) => {
  const data = await maintenanceService.markDone(req.params.type as string, req.user!.id, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/maintenance/contact:
 *   patch:
 *     summary: Set the developer contact details sent with maintenance alerts
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contact_email: { type: string, format: email }
 *               contact_phone: { type: string }
 *     responses:
 *       200:
 *         description: Maintenance status after updating contact details.
 */
export const updateMaintenanceContact = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { contact_email?: string | null; contact_phone?: string | null };
  const data = await maintenanceService.updateContact(body, req.user!.id, req);
  return sendSuccess(res, data);
});

export const getPayoutSummary = asyncHandler(async (_req: Request, res: Response) => {
  const data = await payoutService.getPayoutSummary();
  return sendSuccess(res, data);
});

export const getVendorsWithPendingPayouts = asyncHandler(async (_req: Request, res: Response) => {
  const data = await payoutService.getVendorsWithPendingPayouts();
  return sendSuccess(res, data);
});

export const disburseVendorPayout = asyncHandler(async (req: Request, res: Response) => {
  const data = await payoutService.disburseVendorPayout(req.params.vendor_id as string, {
    mode: req.body?.mode,
    reference: req.body?.reference,
    adminUserId: req.user?.id,
  });
  return sendSuccess(res, data);
});

export const disburseAllPendingPayouts = asyncHandler(async (req: Request, res: Response) => {
  const data = await payoutService.disburseAllPendingPayouts({
    adminUserId: req.user?.id,
    reference: req.body?.reference,
  });
  return sendSuccess(res, data);
});

export const exportPayoutsCsv = asyncHandler(async (_req: Request, res: Response) => {
  const csv = await payoutService.exportPayoutsCsv();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="vegamart-vendor-payouts-${Date.now()}.csv"`);
  return res.status(200).send(csv);
});

export const getDisputesQueue = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminOrderService.getDisputesAndRefunds(req.query as never);
  return sendSuccess(res, data);
});

export const getStorageHealthMetrics = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getStorageMetrics();
  return sendSuccess(res, data);
});

export const listPayoutRequests = asyncHandler(async (req: Request, res: Response) => {
  const data = await payoutService.adminListPayoutRequests(req.query as never);
  return sendSuccess(res, data);
});

export const processPayoutRequest = asyncHandler(async (req: Request, res: Response) => {
  const data = await payoutService.adminProcessPayoutRequest(
    req.params.id as string,
    req.user!.id,
    req.body as never
  );
  return sendSuccess(res, data);
});


