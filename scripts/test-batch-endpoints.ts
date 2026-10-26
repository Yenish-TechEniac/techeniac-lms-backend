import 'reflect-metadata';

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import { app } from '../src/app';
import { hashPassword, signAccessToken } from '../src/core/auth';
import { AppDataSource, closeDatabase, initializeDatabase } from '../src/core/db';
import { logger } from '../src/core/logging';
import { BatchStatus } from '../src/modules/batches';
import { userRepository, UserRole } from '../src/modules/users';

async function runBatchTests(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Integration test script cannot be run in production environments');
  }

  await initializeDatabase();

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}/api/v1/batches`;

  let failures = 0;
  const createdUserIds: string[] = [];
  const createdBatchIds: string[] = [];

  try {
    logger.info({ baseUrl }, 'Running M5 Batch Management Verification Tests...');

    async function createDisposableUser(name: string, role: UserRole) {
      const randomId = randomUUID();
      const email = `test-${role.toLowerCase()}-${randomId.slice(0, 8)}@test.local`;
      const password = `TestP@ss-${randomUUID()}`;
      const passwordHash = await hashPassword(password);
      const u = await userRepository.create({
        name,
        email,
        passwordHash,
        role,
        mustChangePassword: false,
      });
      createdUserIds.push(u.id);
      return u;
    }

    const uniqueSuffix = Date.now().toString().slice(-6);
    const batchCode1 = `BAT-${uniqueSuffix}-A`;
    const batchCode2 = `BAT-${uniqueSuffix}-B`;

    const admin = await createDisposableUser('Disposable Super Admin', UserRole.SUPER_ADMIN);
    const mentor = await createDisposableUser('Disposable Mentor Batch', UserRole.MENTOR);
    const mentee = await createDisposableUser('Disposable Mentee Batch', UserRole.MENTEE);

    const adminToken = signAccessToken({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      tokenVersion: admin.tokenVersion,
    });

    const menteeToken = signAccessToken({
      sub: mentee.id,
      email: mentee.email,
      role: mentee.role,
      tokenVersion: mentee.tokenVersion,
    });

    // 1. Create Batch (Admin only)
    const createRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: `Engineering Batch ${uniqueSuffix}`,
        code: batchCode1,
        startDate: '2026-11-01',
        endDate: '2027-04-30',
        description: 'Full stack engineering batch',
      }),
    });
    const createData = (await createRes.json()) as {
      success: boolean;
      data: { batch: { id: string; status: string } };
    };

    if (
      createRes.status === 201 &&
      createData.success &&
      createData.data.batch.status === BatchStatus.DRAFT
    ) {
      console.log('✔ Test 1 PASS: Batch created in DRAFT status by Super Admin');
    } else {
      console.error('✘ Test 1 FAIL: Batch creation failed', {
        status: createRes.status,
        createData,
      });
      failures++;
    }

    const batch1Id = createData.data?.batch?.id;
    if (batch1Id) {
      createdBatchIds.push(batch1Id);
    }

    // 2. Mentee cannot create batch (RBAC check)
    const menteeCreateRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${menteeToken}`,
      },
      body: JSON.stringify({
        name: 'Unauthorized Batch',
        code: `UNAUTH-${uniqueSuffix}`,
        startDate: '2026-11-01',
        endDate: '2027-04-30',
      }),
    });

    if (menteeCreateRes.status === 403) {
      console.log('✔ Test 2 PASS: Non-admin creation blocked with 403 Forbidden');
    } else {
      console.error('✘ Test 2 FAIL: RBAC failed to block non-admin', {
        status: menteeCreateRes.status,
      });
      failures++;
    }

    // 3. Duplicate code rejected
    const dupCodeRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: `Duplicate Batch ${uniqueSuffix}`,
        code: batchCode1,
        startDate: '2026-11-01',
        endDate: '2027-04-30',
      }),
    });

    if (dupCodeRes.status === 409) {
      console.log('✔ Test 3 PASS: Duplicate batch code rejected with 409 Conflict');
    } else {
      console.error('✘ Test 3 FAIL: Duplicate code was not rejected with 409', {
        status: dupCodeRes.status,
      });
      failures++;
    }

    // 4. Invalid dates (start > end) rejected by validation
    const invalidDatesRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: `Invalid Dates ${uniqueSuffix}`,
        code: `INV-${uniqueSuffix}`,
        startDate: '2027-05-01',
        endDate: '2026-05-01',
      }),
    });

    if (invalidDatesRes.status === 400) {
      console.log('✔ Test 4 PASS: Start date > end date rejected with 400 Validation error');
    } else {
      console.error('✘ Test 4 FAIL: Invalid dates not rejected', {
        status: invalidDatesRes.status,
      });
      failures++;
    }

    // 5. Status transition to LIVE without mentor must fail
    const liveWithoutMentorRes = await fetch(`${baseUrl}/${batch1Id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        toStatus: BatchStatus.LIVE,
      }),
    });

    if (liveWithoutMentorRes.status === 400) {
      console.log('✔ Test 5 PASS: Transition to LIVE without active mentor blocked with 400');
    } else {
      console.error('✘ Test 5 FAIL: Transition to LIVE allowed without mentor', {
        status: liveWithoutMentorRes.status,
      });
      failures++;
    }

    // 6. Add mentor to batch
    const addMentorRes = await fetch(`${baseUrl}/${batch1Id}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        userIds: [mentor.id],
        memberRole: 'MENTOR',
      }),
    });

    if (addMentorRes.status === 200) {
      console.log('✔ Test 6 PASS: Mentor added to batch successfully');
    } else {
      console.error('✘ Test 6 FAIL: Failed to add mentor', { status: addMentorRes.status });
      failures++;
    }

    // 7. Transition to LIVE now succeeds with mentor
    const liveWithMentorRes = await fetch(`${baseUrl}/${batch1Id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        toStatus: BatchStatus.LIVE,
        reason: 'All setup ready and mentor assigned',
      }),
    });
    const liveData = (await liveWithMentorRes.json()) as {
      success: boolean;
      data: { batch: { status: string } };
    };

    if (liveWithMentorRes.status === 200 && liveData.data.batch.status === BatchStatus.LIVE) {
      console.log('✔ Test 7 PASS: Batch successfully transitioned to LIVE status');
    } else {
      console.error('✘ Test 7 FAIL: Transition to LIVE failed', {
        status: liveWithMentorRes.status,
        liveData,
      });
      failures++;
    }

    // 8. Add mentee to batch
    const addMenteeRes = await fetch(`${baseUrl}/${batch1Id}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        userIds: [mentee.id],
        memberRole: 'MENTEE',
      }),
    });

    if (addMenteeRes.status === 200) {
      console.log('✔ Test 8 PASS: Mentee added to batch successfully');
    } else {
      console.error('✘ Test 8 FAIL: Failed to add mentee', { status: addMenteeRes.status });
      failures++;
    }

    // 9. Create second batch and attempt adding same mentee (FR-5.2 one-batch rule)
    const createBatch2Res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: `Target Transfer Batch ${uniqueSuffix}`,
        code: batchCode2,
        startDate: '2026-11-01',
        endDate: '2027-04-30',
      }),
    });
    const batch2Data = (await createBatch2Res.json()) as { data: { batch: { id: string } } };
    const batch2Id = batch2Data.data?.batch?.id;
    if (batch2Id) {
      createdBatchIds.push(batch2Id);
    }

    const dupMenteeRes = await fetch(`${baseUrl}/${batch2Id}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        userIds: [mentee.id],
        memberRole: 'MENTEE',
      }),
    });
    const dupMenteeData = (await dupMenteeRes.json()) as { error?: { message?: string } };

    if (
      dupMenteeRes.status === 409 &&
      dupMenteeData.error?.message?.includes('already an active member of batch')
    ) {
      console.log(
        '✔ Test 9 PASS: One-batch rule enforced; duplicate mentee rejected with 409 and batch name',
      );
    } else {
      console.error('✘ Test 9 FAIL: One-batch rule not enforced', {
        status: dupMenteeRes.status,
        dupMenteeData,
      });
      failures++;
    }

    // 10. Transfer mentee from batch1 to batch2
    const transferRes = await fetch(`${baseUrl}/${batch1Id}/transfer-mentee`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        menteeId: mentee.id,
        targetBatchId: batch2Id,
        reason: 'Transferred to target batch',
      }),
    });

    if (transferRes.status === 200) {
      console.log('✔ Test 10 PASS: Mentee successfully transferred to new batch');
    } else {
      console.error('✘ Test 10 FAIL: Mentee transfer failed', { status: transferRes.status });
      failures++;
    }

    // 11. Verify query listing with counts
    const listRes = await fetch(`${baseUrl}?search=${uniqueSuffix}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listData = (await listRes.json()) as {
      success: boolean;
      data: {
        items: Array<{ id: string; mentorsCount: number; menteesCount: number }>;
        pagination: { total: number };
      };
    };

    if (listRes.status === 200 && listData.success && listData.data.pagination.total >= 2) {
      console.log('✔ Test 11 PASS: Batch list query returns pagination and member counts');
    } else {
      console.error('✘ Test 11 FAIL: Batch listing failed', { status: listRes.status, listData });
      failures++;
    }
  } catch (error) {
    logger.error({ err: error }, 'Test runner encountered unhandled error');
    failures++;
  } finally {
    try {
      if (createdBatchIds.length > 0) {
        await AppDataSource.query(`DELETE FROM mentor_mentees WHERE batch_id = ANY($1::uuid[])`, [
          createdBatchIds,
        ]);
        await AppDataSource.query(
          `DELETE FROM batch_status_history WHERE batch_id = ANY($1::uuid[])`,
          [createdBatchIds],
        );
        await AppDataSource.query(`DELETE FROM batch_members WHERE batch_id = ANY($1::uuid[])`, [
          createdBatchIds,
        ]);
        await AppDataSource.query(`DELETE FROM batches WHERE id = ANY($1::uuid[])`, [
          createdBatchIds,
        ]);
      }
      if (createdUserIds.length > 0) {
        await AppDataSource.query(`DELETE FROM refresh_tokens WHERE user_id = ANY($1::uuid[])`, [
          createdUserIds,
        ]);
        await AppDataSource.query(`DELETE FROM user_role_history WHERE user_id = ANY($1::uuid[])`, [
          createdUserIds,
        ]);
        await AppDataSource.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
      }
    } catch (cleanupError) {
      logger.error({ err: cleanupError }, 'Failed to clean up test entities');
    }

    server.close();
    await closeDatabase();
    if (failures > 0) {
      console.error(`\nTest suite finished with ${failures} failure(s).`);
      process.exit(1);
    } else {
      console.log('\nAll 11 M5 Batch Management tests passed successfully!');
      process.exit(0);
    }
  }
}

void runBatchTests();
