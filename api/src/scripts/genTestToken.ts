import "dotenv/config";
import { prisma } from "../lib/prisma";
import { signAuthToken } from "../lib/jwt";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: tsx src/scripts/genTestToken.ts <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  console.log(signAuthToken({ userId: user.id }));
}

main().finally(() => prisma.$disconnect());
