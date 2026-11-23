import * as addressRepo from "../repositories/address.repository";
import { ForbiddenError, NotFoundError } from "../utils/ApiError";
import type { CreateAddressBody, UpdateAddressBody } from "../validators/address.validators";

export const addressService = {
  async list(userId: string): Promise<addressRepo.AddressRow[]> {
    return addressRepo.listByUser(userId);
  },

  async create(userId: string, input: CreateAddressBody): Promise<addressRepo.AddressRow> {
    const count = await this.list(userId);
    const isDefault = input.is_default ?? count.length === 0;
    if (isDefault) {
      await addressRepo.updateManyClearDefault(userId);
    }

    const label = (input.label || "Home").trim().slice(0, 60);
    const fullAddress = (input.full_address || "Address").trim().slice(0, 400);
    const landmark = input.landmark ? String(input.landmark).trim().slice(0, 200) : null;
    const city = (input.city || "City").trim().slice(0, 100);
    const state = (input.state || "State").trim().slice(0, 100);
    const pincode = (input.pincode || "000000").trim().slice(0, 10);
    const country = (input.country || "India").trim().slice(0, 60);
    const phone = input.phone ? String(input.phone).trim().slice(0, 20) : null;
    const mapUrl = input.map_url
      ? String(input.map_url).trim().slice(0, 500)
      : input.latitude && input.longitude
      ? `https://www.google.com/maps?q=${input.latitude},${input.longitude}`.slice(0, 500)
      : null;
    const exactLocation = input.exact_location ? String(input.exact_location).trim().slice(0, 500) : null;

    return addressRepo.create({
      user_id: userId,
      label,
      full_address: fullAddress,
      landmark,
      city,
      state,
      pincode,
      country,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      map_url: mapUrl,
      exact_location: exactLocation,
      phone,
      is_default: isDefault,
    });
  },

  async update(userId: string, addressId: string, input: UpdateAddressBody): Promise<addressRepo.AddressRow> {
    const address = await this.ensureOwned(userId, addressId);
    if (input.is_default) {
      await addressRepo.updateManyClearDefault(userId);
    }

    const sanitized: Record<string, unknown> = {};
    if (input.label !== undefined) sanitized.label = String(input.label || "Home").trim().slice(0, 60);
    if (input.full_address !== undefined) sanitized.full_address = String(input.full_address || "Address").trim().slice(0, 400);
    if (input.landmark !== undefined) sanitized.landmark = input.landmark ? String(input.landmark).trim().slice(0, 200) : null;
    if (input.city !== undefined) sanitized.city = String(input.city || "City").trim().slice(0, 100);
    if (input.state !== undefined) sanitized.state = String(input.state || "State").trim().slice(0, 100);
    if (input.pincode !== undefined) sanitized.pincode = String(input.pincode || "000000").trim().slice(0, 10);
    if (input.country !== undefined) sanitized.country = String(input.country || "India").trim().slice(0, 60);
    if (input.phone !== undefined) sanitized.phone = input.phone ? String(input.phone).trim().slice(0, 20) : null;
    if (input.map_url !== undefined) sanitized.map_url = input.map_url ? String(input.map_url).trim().slice(0, 500) : null;
    if (input.exact_location !== undefined) sanitized.exact_location = input.exact_location ? String(input.exact_location).trim().slice(0, 500) : null;
    if (input.latitude !== undefined) sanitized.latitude = input.latitude;
    if (input.longitude !== undefined) sanitized.longitude = input.longitude;
    if (input.is_default !== undefined) sanitized.is_default = input.is_default;

    return addressRepo.update(address.id, sanitized as never);
  },

  async remove(userId: string, addressId: string): Promise<void> {
    await this.ensureOwned(userId, addressId);
    await addressRepo.softDelete(addressId);
  },

  async setDefault(userId: string, addressId: string): Promise<addressRepo.AddressRow> {
    const address = await this.ensureOwned(userId, addressId);
    await addressRepo.updateManyClearDefault(userId);
    return addressRepo.update(address.id, { is_default: true });
  },

  async ensureOwned(userId: string, addressId: string): Promise<addressRepo.AddressRow> {
    const address = await addressRepo.findById(addressId);
    if (!address || address.deleted_at) {
      throw new NotFoundError("Address not found.");
    }
    if (address.user_id !== userId) {
      throw new ForbiddenError("You do not own this address.");
    }
    return address;
  },
};
