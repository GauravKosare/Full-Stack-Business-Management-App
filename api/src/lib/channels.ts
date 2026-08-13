import { Channel, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

// Company/department channel membership isn't a manually-maintained join table — it's
// derived from BusinessMember (everyone joined belongs to the company channel; whoever
// has a given department belongs to that department's channel) and kept in sync here.
// Direct (DM) channels are the one type with real, explicit membership, set once when
// the DM is created.

type ChannelWhere =
  | { businessId: string; type: "company" }
  | { businessId: string; type: "department"; department: string };

async function getOrCreateChannel(where: ChannelWhere): Promise<Channel> {
  const existing = await prisma.channel.findFirst({ where });
  if (existing) return existing;

  try {
    return await prisma.channel.create({ data: where });
  } catch (err) {
    // Two concurrent first-touches (e.g. two people joining at once) can both miss the
    // findFirst above; the loser hits the partial unique index here — recover by
    // fetching the row the winner just created instead of failing.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return await prisma.channel.findFirstOrThrow({ where });
    }
    throw err;
  }
}

export async function syncChannelMembership(businessId: string, userId: string, department: string | null) {
  const company = await getOrCreateChannel({ businessId, type: "company" });
  await prisma.channelMember.upsert({
    where: { channelId_userId: { channelId: company.id, userId } },
    update: {},
    create: { channelId: company.id, userId },
  });

  // A person has at most one department at a time — drop membership from any other
  // department channel in this business before (re-)joining the current one.
  const otherDeptChannels = await prisma.channel.findMany({
    where: {
      businessId,
      type: "department",
      ...(department ? { NOT: { department } } : {}),
    },
    select: { id: true },
  });
  if (otherDeptChannels.length > 0) {
    await prisma.channelMember.deleteMany({
      where: { userId, channelId: { in: otherDeptChannels.map((c) => c.id) } },
    });
  }

  if (department) {
    const deptChannel = await getOrCreateChannel({ businessId, type: "department", department });
    await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId: deptChannel.id, userId } },
      update: {},
      create: { channelId: deptChannel.id, userId },
    });
  }
}

// Called after signup/Google sign-in claims pending invites — re-derives channel
// membership for every business the user has actually joined, not just the one they
// most recently joined, since a single call can mark several placeholders as joined.
export async function syncAllChannelMembershipsForUser(userId: string) {
  const memberships = await prisma.businessMember.findMany({
    where: { userId, joinedAt: { not: null } },
    select: { businessId: true, department: true },
  });
  for (const m of memberships) {
    await syncChannelMembership(m.businessId, userId, m.department);
  }
}

export async function findOrCreateDirectChannel(businessId: string, userAId: string, userBId: string): Promise<Channel> {
  const existing = await prisma.channel.findFirst({
    where: {
      businessId,
      type: "direct",
      members: { some: { userId: userAId } },
      AND: { members: { some: { userId: userBId } } },
    },
  });
  if (existing) return existing;

  return prisma.channel.create({
    data: {
      businessId,
      type: "direct",
      members: { create: [{ userId: userAId }, { userId: userBId }] },
    },
  });
}
