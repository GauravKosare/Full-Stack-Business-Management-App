import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {},
    create: { email: "owner@example.com", name: "Demo Owner" },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: {},
    create: { email: "manager@example.com", name: "Demo Manager" },
  });

  const employee = await prisma.user.upsert({
    where: { email: "employee@example.com" },
    update: {},
    create: { email: "employee@example.com", name: "Demo Employee" },
  });

  const business = await prisma.business.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Demo Business",
      ownerId: owner.id,
      members: {
        create: [
          { userId: owner.id, role: "owner", joinedAt: new Date() },
          { userId: manager.id, role: "manager", joinedAt: new Date() },
          { userId: employee.id, role: "employee", joinedAt: new Date() },
        ],
      },
    },
  });

  await prisma.task.create({
    data: {
      businessId: business.id,
      title: "Welcome task — mark this done",
      priority: "medium",
      createdBy: manager.id,
      assignments: { create: { userId: employee.id } },
    },
  });

  console.log("Seed complete:", { businessId: business.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
