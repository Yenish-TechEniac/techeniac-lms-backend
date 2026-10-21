import 'reflect-metadata';

import type { Server } from 'node:http';

import { app } from '../src/app';
import { logAudit } from '../src/core/audit';
import { hashPassword, signAccessToken } from '../src/core/auth';
import { closeDatabase, initializeDatabase } from '../src/core/db';
import { logger } from '../src/core/logging';
import { AuditLog, AuditType } from '../src/modules/audit';
import { userRepository, UserRole } from '../src/modules/users';

interface AuditApiResponse {
  success: boolean;
  data: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function runAuditTests(): Promise<void> {
  await initializeDatabase();

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}/api/v1/audit-logs`;

  let failures = 0;

  try {
    logger.info({ baseUrl }, 'Running M14 Audit Log Verification Tests (AUD-01 to AUD-05)...');

    // Helper to find or create test user
    async function getOrCreateUser(email: string, name: string, role: UserRole) {
      let u = await userRepository.findByEmail(email);
      if (!u) {
        const passwordHash = await hashPassword('Password123!');
        u = await userRepository.create({
          name,
          email,
          passwordHash,
          role,
          mustChangePassword: false,
        });
      }
      return u;
    }

    const admin = await getOrCreateUser('admin@techeniac.com', 'Super Admin', UserRole.SUPER_ADMIN);
    const mentor = await getOrCreateUser('mentor@techeniac.com', 'Test Mentor', UserRole.MENTOR);
    const mentee = await getOrCreateUser('mentee@techeniac.com', 'Test Mentee', UserRole.MENTEE);

    // Generate test auth tokens with real user IDs
    const adminToken = signAccessToken({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      tokenVersion: admin.tokenVersion,
    });

    const mentorToken = signAccessToken({
      sub: mentor.id,
      email: mentor.email,
      role: mentor.role,
      tokenVersion: mentor.tokenVersion,
    });

    const menteeToken = signAccessToken({
      sub: mentee.id,
      email: mentee.email,
      role: mentee.role,
      tokenVersion: mentee.tokenVersion,
    });

    // Seed test audit entries covering AUD-01 to AUD-04
    await logAudit({
      actorId: admin.id,
      type: AuditType.USER,
      entity: 'User',
      entityId: mentee.id,
      action: 'ROLE_CHANGE',
      oldValue: { role: 'MENTEE' },
      newValue: { role: 'MENTOR', reason: 'Promotion to Mentor' },
    });

    await logAudit({
      actorId: admin.id,
      type: AuditType.COURSE,
      entity: 'Course',
      entityId: '00000000-0000-0000-0000-000000000010',
      action: 'LIVE_EDIT',
      oldValue: { title: 'Old Git Basics' },
      newValue: { title: 'Git & GitHub Deep Dive' },
    });

    await logAudit({
      actorId: admin.id,
      type: AuditType.BATCH,
      entity: 'Batch',
      entityId: '00000000-0000-0000-0000-000000000020',
      action: 'STATUS_CHANGE',
      oldValue: { status: 'DRAFT' },
      newValue: { status: 'LIVE' },
    });

    await logAudit({
      actorId: admin.id,
      type: AuditType.AUTH,
      entity: 'User',
      entityId: admin.id,
      action: 'LOGIN',
      newValue: { email: admin.email },
    });

    // Failed login of unknown user (null actor_id)
    await logAudit({
      actorId: null,
      type: AuditType.AUTH,
      entity: 'User',
      action: 'FAILED_LOGIN',
      oldValue: { email: 'unknown@external.com' },
    });

    // --- TEST 1: AUD-05 Non-admin Mentee -> 403 Forbidden ---
    const menteeRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${menteeToken}` },
    });
    if (menteeRes.status === 403) {
      console.log('✔ AUD-05 PASS: Mentee access to audit log is blocked with 403 Forbidden');
    } else {
      console.error('✘ AUD-05 FAIL: Expected 403 for Mentee, got:', menteeRes.status);
      failures++;
    }

    // --- TEST 2: AUD-05 Non-admin Mentor -> 403 Forbidden ---
    const mentorRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${mentorToken}` },
    });
    if (mentorRes.status === 403) {
      console.log('✔ AUD-05 PASS: Mentor access to audit log is blocked with 403 Forbidden');
    } else {
      console.error('✘ AUD-05 FAIL: Expected 403 for Mentor, got:', mentorRes.status);
      failures++;
    }

    // --- TEST 3: Unauthenticated -> 401 Unauthorized ---
    const unauthRes = await fetch(baseUrl);
    if (unauthRes.status === 401) {
      console.log('✔ PASS: Unauthenticated access blocked with 401 Unauthorized');
    } else {
      console.error('✘ FAIL: Expected 401 for unauthenticated request, got:', unauthRes.status);
      failures++;
    }

    // --- TEST 4: AUD-01 Admin filters by type USER and action ROLE_CHANGE ---
    const userAuditRes = await fetch(`${baseUrl}?type=USER&action=ROLE_CHANGE`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const userAuditData = (await userAuditRes.json()) as AuditApiResponse;
    const hasRoleChange = userAuditData.data?.some(
      (item) =>
        item.type === AuditType.USER &&
        item.action === 'ROLE_CHANGE' &&
        item.newValue?.reason === 'Promotion to Mentor',
    );
    if (userAuditRes.status === 200 && hasRoleChange) {
      console.log(
        '✔ AUD-01 PASS: Admin filters by type USER and action ROLE_CHANGE, shows old->new & reason',
      );
    } else {
      console.error('✘ AUD-01 FAIL: Expected filtered USER audit logs with role change', {
        status: userAuditRes.status,
        data: userAuditData,
      });
      failures++;
    }

    // --- TEST 5: AUD-02 Admin filters by type COURSE ---
    const courseAuditRes = await fetch(`${baseUrl}?type=COURSE`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const courseAuditData = (await courseAuditRes.json()) as AuditApiResponse;
    const hasCourseEdit = courseAuditData.data?.some(
      (item) => item.type === AuditType.COURSE && item.oldValue?.title && item.newValue?.title,
    );
    if (courseAuditRes.status === 200 && hasCourseEdit) {
      console.log(
        '✔ AUD-02 PASS: Admin filters by type COURSE, shows live course edit with old & new values',
      );
    } else {
      console.error('✘ AUD-02 FAIL: Expected filtered COURSE audit logs', {
        status: courseAuditRes.status,
      });
      failures++;
    }

    // --- TEST 6: AUD-03 Admin filters by type BATCH ---
    const batchAuditRes = await fetch(`${baseUrl}?type=BATCH`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const batchAuditData = (await batchAuditRes.json()) as AuditApiResponse;
    const hasBatchStatus = batchAuditData.data?.some(
      (item) =>
        item.type === AuditType.BATCH &&
        item.oldValue?.status === 'DRAFT' &&
        item.newValue?.status === 'LIVE',
    );
    if (batchAuditRes.status === 200 && hasBatchStatus) {
      console.log('✔ AUD-03 PASS: Admin filters by type BATCH, shows status changes');
    } else {
      console.error('✘ AUD-03 FAIL: Expected filtered BATCH audit logs', {
        status: batchAuditRes.status,
      });
      failures++;
    }

    // --- TEST 7: AUD-04 Admin filters by type AUTH (includes null actor) ---
    const authAuditRes = await fetch(`${baseUrl}?type=AUTH`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const authAuditData = (await authAuditRes.json()) as AuditApiResponse;
    const hasLogin = authAuditData.data?.some((item) => item.action === 'LOGIN');
    const hasAnonymousFailedLogin = authAuditData.data?.some(
      (item) => item.action === 'FAILED_LOGIN' && item.actorId === null,
    );
    if (authAuditRes.status === 200 && hasLogin && hasAnonymousFailedLogin) {
      console.log(
        '✔ AUD-04 PASS: Admin filters by type AUTH, shows logins and failed logins with null actor',
      );
    } else {
      console.error('✘ AUD-04 FAIL: Expected AUTH logs with login and null-actor failed login', {
        status: authAuditRes.status,
        hasLogin,
        hasAnonymousFailedLogin,
      });
      failures++;
    }

    // --- TEST 8: Pagination ---
    const pageRes = await fetch(`${baseUrl}?page=1&limit=2`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pageData = (await pageRes.json()) as AuditApiResponse;
    if (
      pageRes.status === 200 &&
      pageData.data?.length <= 2 &&
      pageData.pagination?.page === 1 &&
      pageData.pagination?.limit === 2 &&
      pageData.pagination?.total >= 5
    ) {
      console.log('✔ PASS: Audit log pagination works correctly');
    } else {
      console.error('✘ FAIL: Expected valid pagination', { pageData });
      failures++;
    }
  } finally {
    server.close();
    await closeDatabase();
  }

  if (failures > 0) {
    logger.error({ failures }, 'Audit endpoints verification tests completed with failures.');
    process.exit(1);
  } else {
    logger.info('All M14 Audit Log verification tests passed successfully (0 failures).');
  }
}

runAuditTests().catch(async (err) => {
  logger.error({ err }, 'Unhandled test runner exception.');
  await closeDatabase().catch(() => {});
  process.exit(1);
});
