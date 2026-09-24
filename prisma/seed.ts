import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Idempotent seed: safe to run repeatedly against any environment.
// Creates the first admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. This
// replaces the old runtime /api/bootstrap/promote-admin route entirely — there
// is no HTTP path that can create or promote an admin without an existing one.
//
// Demo catalog/providers are added in a later step (SEED_DEMO=true).

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before seeding");
  }
  if (password.length < 10) throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      await prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN", sessionVersion: { increment: 1 } } });
      console.log(`Promoted existing user ${email} to ADMIN`);
    } else {
      console.log(`Admin ${email} already exists — unchanged`);
    }
  } else {
    const admin = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        firstName: "Platform",
        lastName: "Admin",
        role: "ADMIN",
      },
    });
    await prisma.auditEvent.create({
      data: {
        actorType: "SYSTEM", action: "user.seed_admin", entityType: "User",
        entityId: admin.id, outcome: "success",
      },
    });
    console.log(`Created admin ${email}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
