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
  const channel = (data.channel ? data.channel.toUpperCase() : "IN_APP") as Prisma.NotificationCreateInput["channel"];
  const type = (data.type ? data.type.toUpperCase() : "ORDER") as Prisma.NotificationCreateInput["type"];

  await prisma.notification.create({
    data: {
      user_id: data.user_id,
      type,
      channel,
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
  type?: string,
  role?: string
) {
  const where: Prisma.NotificationWhereInput = { user_id: userId };
  if (type && type !== "system" && type !== "promo") {
    where.type = type.toUpperCase() as Prisma.NotificationWhereInput["type"];
  }

  const [notifRows, notifTotal] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take,
    }),
    prisma.notification.count({ where }),
  ]);

  let rows: any[] = [...notifRows];
  let total = notifTotal;

  // If no type specified or type is system/promo, also fetch active announcements
  if (!type || type === "system" || type === "promo") {
    const audienceFilter = role ? { in: ["all", role] } : { equals: "all" };
    const announcements = await prisma.announcement.findMany({
      where: {
        is_active: true,
        published_at: { not: null },
        audience: audienceFilter as any,
      },
      orderBy: { published_at: "desc" },
      take: 20 // Just grab latest 20 active announcements
    });

    const mappedAnnouncements = announcements.map(a => ({
      id: a.id,
      user_id: userId,
      type: "promotional",
      channel: "in_app",
      title: a.title,
      body: a.body,
      data: null,
      is_read: false,
      source: "announcement",
      created_at: a.published_at || a.created_at,
      read_at: null
    }));

    rows = [...mappedAnnouncements, ...rows].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    total += announcements.length;
    
    // Apply pagination properly to the merged array
    rows = rows.slice(0, take);
  }

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
