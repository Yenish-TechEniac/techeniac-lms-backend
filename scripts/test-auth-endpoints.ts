import 'reflect-metadata';

import type { Server } from 'node:http';

import { app } from '../src/app';
import { closeDatabase, initializeDatabase } from '../src/core/db';
import { logger } from '../src/core/logging';

async function runTests(): Promise<void> {
  await initializeDatabase();

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}/api/v1/auth`;

  let failures = 0;

  try {
    logger.info({ baseUrl }, 'Running Auth Endpoints Verification Tests...');

    // 1. Valid Login
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@techeniac.com',
        password: 'Admin123456!',
      }),
    });
    const loginData = (await loginRes.json()) as {
      success: boolean;
      data?: { tokens: { accessToken: string; refreshToken: string } };
    };
    const cookiesHeader = loginRes.headers.get('set-cookie') ?? '';

    if (
      loginRes.status === 200 &&
      loginData.success &&
      loginData.data?.tokens?.accessToken &&
      cookiesHeader.includes('refreshToken=')
    ) {
      console.log('✔ Test 1 PASS: Valid login returns 200, tokens, and httpOnly cookies');
    } else {
      console.error('✘ Test 1 FAIL: Valid login failed', { status: loginRes.status, loginData });
      failures++;
    }

    const accessToken = loginData.data?.tokens?.accessToken ?? '';
    const oldRefreshToken = loginData.data?.tokens?.refreshToken ?? '';

    // 2. Invalid Login (wrong password)
    const invalidLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@techeniac.com',
        password: 'WrongPassword123!',
      }),
    });
    const invalidLoginData = (await invalidLoginRes.json()) as {
      error?: { code: string };
    };

    if (invalidLoginRes.status === 401 && invalidLoginData.error?.code === 'UNAUTHENTICATED') {
      console.log('✔ Test 2 PASS: Wrong password returns 401 UNAUTHENTICATED');
    } else {
      console.error('✘ Test 2 FAIL: Wrong password did not return 401', {
        status: invalidLoginRes.status,
      });
      failures++;
    }

    // 3. GET /me (authenticated)
    const meRes = await fetch(`${baseUrl}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const meData = (await meRes.json()) as {
      success: boolean;
      data?: { user: { role: string; email: string } };
    };

    if (
      meRes.status === 200 &&
      meData.success &&
      meData.data?.user?.email === 'admin@techeniac.com' &&
      meData.data?.user?.role === 'SUPER_ADMIN'
    ) {
      console.log('✔ Test 3 PASS: GET /me returns authenticated Super Admin profile');
    } else {
      console.error('✘ Test 3 FAIL: GET /me failed', { status: meRes.status, meData });
      failures++;
    }

    // 4. POST /refresh (token rotation)
    const refreshRes = await fetch(`${baseUrl}/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refreshToken=${oldRefreshToken}`,
      },
      body: JSON.stringify({}),
    });
    const refreshData = (await refreshRes.json()) as {
      success: boolean;
      data?: { tokens: { accessToken: string; refreshToken: string } };
    };

    if (
      refreshRes.status === 200 &&
      refreshData.success &&
      refreshData.data?.tokens?.accessToken &&
      refreshData.data?.tokens?.refreshToken !== oldRefreshToken
    ) {
      console.log('✔ Test 4 PASS: POST /refresh rotates refresh token successfully');
    } else {
      console.error('✘ Test 4 FAIL: POST /refresh failed', {
        status: refreshRes.status,
        refreshData,
      });
      failures++;
    }

    // 5. Reuse detection on rotated refresh token
    const reuseRes = await fetch(`${baseUrl}/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refreshToken=${oldRefreshToken}`,
      },
      body: JSON.stringify({}),
    });
    const reuseData = (await reuseRes.json()) as {
      error?: { code: string; message: string };
    };

    if (reuseRes.status === 401 && reuseData.error?.message?.includes('Token reuse detected')) {
      console.log('✔ Test 5 PASS: Reuse detection caught replay attack and revoked family');
    } else {
      console.error('✘ Test 5 FAIL: Reuse detection failed', {
        status: reuseRes.status,
        reuseData,
      });
      failures++;
    }

    // 6. POST /logout
    const logoutRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const logoutData = (await logoutRes.json()) as { success: boolean };
    const logoutCookies = logoutRes.headers.get('set-cookie') ?? '';

    if (
      logoutRes.status === 200 &&
      logoutData.success &&
      logoutCookies.includes('refreshToken=;')
    ) {
      console.log('✔ Test 6 PASS: POST /logout clears cookies and returns 200');
    } else {
      console.error('✘ Test 6 FAIL: POST /logout failed', {
        status: logoutRes.status,
        logoutData,
      });
      failures++;
    }

    // 7. Validation error test (invalid email format)
    const valRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email-format',
        password: 'Password123!',
      }),
    });
    const valData = (await valRes.json()) as {
      error?: { code: string };
    };

    if (valRes.status === 400 && valData.error?.code === 'VALIDATION_ERROR') {
      console.log('✔ Test 7 PASS: Invalid email format triggers 400 VALIDATION_ERROR');
    } else {
      console.error('✘ Test 7 FAIL: Validation did not trigger 400', {
        status: valRes.status,
        valData,
      });
      failures++;
    }
  } finally {
    server.close();
    await closeDatabase();
  }

  if (failures > 0) {
    console.error(`\n${failures} tests failed.`);
    process.exit(1);
  } else {
    console.log('\nAll 7 Auth integration tests passed successfully!');
    process.exit(0);
  }
}

runTests().catch(async (err) => {
  console.error('Test execution error:', err);
  await closeDatabase().catch(() => {});
  process.exit(1);
});
