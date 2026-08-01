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
    return addressRepo.create({
      user_id: userId,
      label: input.label,
      full_address: input.full_address,
      landmark: input.landmark ?? null,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      country: input.country,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      phone: input.phone ?? null,
      is_default: isDefault,
    });
  },

  async update(userId: string, addressId: string, input: UpdateAddressBody): Promise<addressRepo.AddressRow> {
    const address = await this.ensureOwned(userId, addressId);
    if (input.is_default) {
      await addressRepo.updateManyClearDefault(userId);
    }
    return addressRepo.update(address.id, input as never);
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
