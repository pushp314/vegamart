import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

export async function createNotification(data: {
  user_id: string;
  type: string;
  channel?: string;
  title: string;
  body?: string | null;
  data?: Prisma.InputJsonValue | null;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      user_id: data.user_id,
      type: data.type as Prisma.NotificationCreateInput["type"],
      channel: (data.channel ?? "in_app") as Prisma.NotificationCreateInput["channel"],
      title: data.title,
      body: data.body ?? null,
      data: (data.data as Prisma.InputJsonValue) ?? undefined,
    },
  });
}

export async function listByUser(
  userId: string,
  skip: number,
  take: number,
  type?: string
) {
  const where: Prisma.NotificationWhereInput = { user_id: userId };
  if (type) {
    where.type = type as Prisma.NotificationWhereInput["type"];
  }
  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take,
    }),
    prisma.notification.count({ where }),
  ]);
  return { rows, total };
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { user_id: userId, is_read: false },
    data: { is_read: true, read_at: new Date() },
  });
}

export async function markRead(userId: string, notificationId: string): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, user_id: userId },
    data: { is_read: true, read_at: new Date() },
  });
  return result.count > 0;
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { user_id: userId, is_read: false } });
}

export async function deleteNotification(userId: string, notificationId: string): Promise<boolean> {
  const result = await prisma.notification.deleteMany({
    where: { id: notificationId, user_id: userId },
  });
  return result.count > 0;
}
