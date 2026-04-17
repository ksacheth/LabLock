import { PrismaClient, UserRole } from "./generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await Bun.password.hash("change-me", {
    algorithm: "bcrypt",
    cost: 12,
  });

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      name: "Admin",
      password,
      role: UserRole.ADMIN,
      departmentId: null,
      batchId: null,
      rollNumber: null,
    },
    create: {
      email: "admin@example.com",
      name: "Admin",
      password,
      role: UserRole.ADMIN,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
