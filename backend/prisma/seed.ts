import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'Administrator';

  if (!email || !password) {
    throw new Error('ADMIN_USER_EMAIL and ADMIN_PASSWORD must be set in .env');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: 'ADMIN', status: 'APPROVED' },
    create: { email, name, passwordHash, role: 'ADMIN', status: 'APPROVED' },
  });

  console.log(`Seeded admin account: ${admin.email} (role=${admin.role}, status=${admin.status})`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
