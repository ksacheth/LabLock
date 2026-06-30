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
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const name = process.env.ADMIN_NAME ?? "Admin";
  const plainPassword = process.env.ADMIN_PASSWORD ?? "change-me";

  const password = await Bun.password.hash(plainPassword, {
    algorithm: "bcrypt",
    cost: 12,
  });

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password,
      role: UserRole.ADMIN,
      facultyApproved: true,
      departmentId: null,
      batchId: null,
      rollNumber: null,
    },
    create: {
      email,
      name,
      password,
      role: UserRole.ADMIN,
      facultyApproved: true,
    },
  });

  console.log(`Seeded admin: ${email}`);
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
