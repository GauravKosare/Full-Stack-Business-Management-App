import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function createNotification(
  userId: string,
  businessId: string,
  type: NotificationType,
  payload: Prisma.InputJsonValue
) {
  await prisma.notification.create({ data: { userId, businessId, type, payload } });
}
