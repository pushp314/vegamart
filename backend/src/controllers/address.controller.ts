import type { Request, Response } from "express";

import { addressService } from "../services/address.service";
import { sendCreated, sendNoContent, sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import type { CreateAddressBody, UpdateAddressBody } from "../validators/address.validators";

/**
 * @swagger
 * /addresses:
 *   get:
 *     summary: List the current user's addresses
 *     security:
 *       - bearerAuth: []
 *     tags: [Addresses]
 *     responses:
 *       200:
 *         description: Address list.
 */
export const listAddresses = asyncHandler(async (req: Request, res: Response) => {
  const addresses = await addressService.list(req.user!.id);
  return sendSuccess(res, addresses);
});

/**
 * @swagger
 * /addresses:
 *   post:
 *     summary: Create a new address
 *     security:
 *       - bearerAuth: []
 *     tags: [Addresses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [label, full_address, city, state, pincode]
 *             properties:
 *               label: { type: string }
 *               full_address: { type: string }
 *               landmark: { type: string, nullable: true }
 *               city: { type: string }
 *               state: { type: string }
 *               pincode: { type: string }
 *               country: { type: string, default: India }
 *               latitude: { type: number, nullable: true }
 *               longitude: { type: number, nullable: true }
 *               phone: { type: string, nullable: true }
 *               is_default: { type: boolean, default: false }
 *     responses:
 *       201:
 *         description: Address created.
 */
export const createAddress = asyncHandler(async (req: Request, res: Response) => {
  const address = await addressService.create(req.user!.id, req.body as CreateAddressBody);
  return sendCreated(res, address);
});

/**
 * @swagger
 * /addresses/{address_id}:
 *   patch:
 *     summary: Update an address
 *     security:
 *       - bearerAuth: []
 *     tags: [Addresses]
 *     parameters:
 *       - in: path
 *         name: address_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Address updated.
 */
export const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  const address = await addressService.update(req.user!.id, req.params.address_id as string, req.body as UpdateAddressBody);
  return sendSuccess(res, address);
});

/**
 * @swagger
 * /addresses/{address_id}:
 *   delete:
 *     summary: Soft-delete an address
 *     security:
 *       - bearerAuth: []
 *     tags: [Addresses]
 *     parameters:
 *       - in: path
 *         name: address_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Address deleted.
 */
export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  await addressService.remove(req.user!.id, req.params.address_id as string);
  return sendNoContent(res);
});

/**
 * @swagger
 * /addresses/{address_id}/default:
 *   put:
 *     summary: Set an address as the default
 *     security:
 *       - bearerAuth: []
 *     tags: [Addresses]
 *     parameters:
 *       - in: path
 *         name: address_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Default address set.
 */
export const setDefaultAddress = asyncHandler(async (req: Request, res: Response) => {
  const address = await addressService.setDefault(req.user!.id, req.params.address_id as string);
  return sendSuccess(res, address);
});
