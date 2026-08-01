import { NotificationType, Prisma } from "@prisma/client";

import { createNotification } from "../repositories/notification.repository";
import log from "../config/logger";

export const notificationService = {
  async send(input: {
    user_id: string;
    type: NotificationType;
    title: string;
    body?: string;
    data?: Prisma.InputJsonValue;
  }): Promise<void> {
    try {
      await createNotification({
        user_id: input.user_id,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data,
      });
    } catch (error) {
      log.error(`[notifications] Failed to persist notification for user ${input.user_id}`, {
        context: "notifications",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async orderStatus(userId: string, orderNumber: string, title: string, body?: string, data?: Prisma.InputJsonValue): Promise<void> {
    await this.send({
      user_id: userId,
      type: NotificationType.ORDER,
      title,
      body,
      data: { order_number: orderNumber, ...(data as Record<string, unknown> | undefined) },
    });
  },

  async payment(userId: string, title: string, body?: string, data?: Prisma.InputJsonValue): Promise<void> {
    await this.send({ user_id: userId, type: NotificationType.PAYMENT, title, body, data });
  },

  async vendor(userId: string, title: string, body?: string, data?: Prisma.InputJsonValue): Promise<void> {
    await this.send({ user_id: userId, type: NotificationType.VENDOR, title, body, data });
  },
};
