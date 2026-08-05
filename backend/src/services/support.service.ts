import prisma from "../database/prisma";
import type { ContactBody } from "../validators/contact.validators";

export const supportService = {
  /**
   * Create a support ticket from the public contact form.
   * The ticket is linked to the authenticated user (including guest sessions).
   */
  async createContactTicket(userId: string, input: ContactBody) {
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
  },
};
