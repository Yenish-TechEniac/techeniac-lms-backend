import 'reflect-metadata';

import { hashPassword } from '../src/core/auth';
import { closeDatabase, initializeDatabase } from '../src/core/db';
import { logger } from '../src/core/logging';
import { userRepository, UserRole } from '../src/modules/users';

async function seedAdmin(): Promise<void> {
  const name = process.env.SEED_ADMIN_NAME ?? 'Super Admin';
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@techeniac.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123456!';

  logger.info({ email }, 'Starting Super Admin seed script...');

  await initializeDatabase();

  const passwordHash = await hashPassword(password);

  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    await userRepository.updatePassword(existingUser.id, passwordHash);
    logger.info({ email }, 'Super Admin user already exists. Password synchronized.');
    await closeDatabase();
    return;
  }

  const admin = await userRepository.create({
    name,
    email,
    passwordHash,
    role: UserRole.SUPER_ADMIN,
    mustChangePassword: false,
  });

  logger.info(
    { id: admin.id, email: admin.email, role: admin.role },
    'Super Admin seeded successfully.',
  );
  await closeDatabase();
}

seedAdmin().catch(async (err) => {
  logger.error({ err }, 'Failed to seed Super Admin.');
  await closeDatabase().catch(() => {});
  process.exit(1);
});
