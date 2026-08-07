import prisma from "../database/prisma";
import type { ContactBody } from "../validators/contact.validators";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

export const supportService = {
  /**
   * Create a support ticket from the public contact form.
   * The ticket is linked to the authenticated user (including guest sessions).
   */
  async createContactTicket(userId: string, input: ContactBody) {
    try {
      const name = input.name?.trim();
      const subject =
        (input.subject?.trim() ||
          (name ? `Contact request from ${name}` : "Contact request from user")).slice(0, 200);

      const ticket = await prisma.supportTicket.create({
        data: {
          user_id: userId,
          subject,
          description: input.message.trim(),
          category: "support",
        },
        select: {
          id: true,
          subject: true,
          status: true,
          created_at: true,
        },
      });

      return ticket;
    } catch (error) {
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create support ticket",
        { code: "TICKET_CREATION_FAILED" }
      );
    }
  },

  /**
   * Create a vendor suspension appeal ticket
   */
  async createSuspensionAppealTicket(userId: string, vendorId: string, reason: string) {
    try {
      const ticket = await prisma.supportTicket.create({
        data: {
          user_id: userId,
          subject: "Vendor Account Suspension Appeal",
          description: `Vendor ID: ${vendorId}\n\nAppeal Reason:\n${reason.trim()}`,
          category: "account",
          priority: "HIGH",
        },
        select: {
          id: true,
          subject: true,
          status: true,
          priority: true,
          created_at: true,
        },
      });

      return ticket;
    } catch (error) {
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create appeal ticket",
        { code: "APPEAL_TICKET_FAILED" }
      );
    }
  },
};
