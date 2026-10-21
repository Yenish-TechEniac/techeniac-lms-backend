import 'reflect-metadata';

import type { Server } from 'node:http';

import { app } from '../src/app';
import { closeDatabase, initializeDatabase } from '../src/core/db';
import { logger } from '../src/core/logging';

interface LoginResult {
  passed: boolean;
  accessToken: string;
  refreshToken: string;
}

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4000;
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}/api/v1/auth`,
  };
}

async function testValidLogin(baseUrl: string): Promise<LoginResult> {
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

  const hasAccessToken = Boolean(loginData.data?.tokens?.accessToken);
  const hasRefreshTokenCookie = cookiesHeader.includes('refreshToken=');
  const passed =
    loginRes.status === 200 && loginData.success && hasAccessToken && hasRefreshTokenCookie;

  if (passed) {
    console.log('✔ Test 1 PASS: Valid login returns 200, tokens, and httpOnly cookies');
  } else {
    console.error('✘ Test 1 FAIL: Valid login failed', { status: loginRes.status, loginData });
  }

  return {
    passed,
    accessToken: loginData.data?.tokens?.accessToken ?? '',
    refreshToken: loginData.data?.tokens?.refreshToken ?? '',
  };
}

async function testInvalidLogin(baseUrl: string): Promise<boolean> {
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

  const passed =
    invalidLoginRes.status === 401 && invalidLoginData.error?.code === 'UNAUTHENTICATED';

  if (passed) {
    console.log('✔ Test 2 PASS: Wrong password returns 401 UNAUTHENTICATED');
  } else {
    console.error('✘ Test 2 FAIL: Wrong password did not return 401', {
      status: invalidLoginRes.status,
    });
  }

  return passed;
}

async function testGetMe(baseUrl: string, accessToken: string): Promise<boolean> {
  const meRes = await fetch(`${baseUrl}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const meData = (await meRes.json()) as {
    success: boolean;
    data?: { user: { role: string; email: string } };
  };

  const isEmailMatch = meData.data?.user?.email === 'admin@techeniac.com';
  const isRoleMatch = meData.data?.user?.role === 'SUPER_ADMIN';
  const passed = meRes.status === 200 && meData.success && isEmailMatch && isRoleMatch;

  if (passed) {
    console.log('✔ Test 3 PASS: GET /me returns authenticated Super Admin profile');
  } else {
    console.error('✘ Test 3 FAIL: GET /me failed', { status: meRes.status, meData });
  }

  return passed;
}

async function testTokenRotation(baseUrl: string, oldRefreshToken: string): Promise<boolean> {
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

  const hasNewAccessToken = Boolean(refreshData.data?.tokens?.accessToken);
  const isTokenRotated = refreshData.data?.tokens?.refreshToken !== oldRefreshToken;
  const passed =
    refreshRes.status === 200 && refreshData.success && hasNewAccessToken && isTokenRotated;

  if (passed) {
    console.log('✔ Test 4 PASS: POST /refresh rotates refresh token successfully');
  } else {
    console.error('✘ Test 4 FAIL: POST /refresh failed', {
      status: refreshRes.status,
      refreshData,
    });
  }

  return passed;
}

async function testReuseDetection(baseUrl: string, oldRefreshToken: string): Promise<boolean> {
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

  const isReuseDetected = Boolean(reuseData.error?.message?.includes('Token reuse detected'));
  const passed = reuseRes.status === 401 && isReuseDetected;

  if (passed) {
    console.log('✔ Test 5 PASS: Reuse detection caught replay attack and revoked family');
  } else {
    console.error('✘ Test 5 FAIL: Reuse detection failed', {
      status: reuseRes.status,
      reuseData,
    });
  }

  return passed;
}

async function testLogout(baseUrl: string): Promise<boolean> {
  const logoutRes = await fetch(`${baseUrl}/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const logoutData = (await logoutRes.json()) as { success: boolean };
  const logoutCookies = logoutRes.headers.get('set-cookie') ?? '';

  const hasClearedCookie = logoutCookies.includes('refreshToken=;');
  const passed = logoutRes.status === 200 && logoutData.success && hasClearedCookie;

  if (passed) {
    console.log('✔ Test 6 PASS: POST /logout clears cookies and returns 200');
  } else {
    console.error('✘ Test 6 FAIL: POST /logout failed', {
      status: logoutRes.status,
      logoutData,
    });
  }

  return passed;
}

async function testValidationError(baseUrl: string): Promise<boolean> {
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

  const passed = valRes.status === 400 && valData.error?.code === 'VALIDATION_ERROR';

  if (passed) {
    console.log('✔ Test 7 PASS: Invalid email format triggers 400 VALIDATION_ERROR');
  } else {
    console.error('✘ Test 7 FAIL: Validation did not trigger 400', {
      status: valRes.status,
      valData,
    });
  }

  return passed;
}

async function runTests(): Promise<void> {
  await initializeDatabase();
  const { server, baseUrl } = await startServer();
  let failures = 0;

  try {
    logger.info({ baseUrl }, 'Running Auth Endpoints Verification Tests...');

    const loginResult = await testValidLogin(baseUrl);
    if (!loginResult.passed) failures++;

    const isInvalidLoginPassed = await testInvalidLogin(baseUrl);
    if (!isInvalidLoginPassed) failures++;

    const isGetMePassed = await testGetMe(baseUrl, loginResult.accessToken);
    if (!isGetMePassed) failures++;

    const isTokenRotationPassed = await testTokenRotation(baseUrl, loginResult.refreshToken);
    if (!isTokenRotationPassed) failures++;

    const isReusePassed = await testReuseDetection(baseUrl, loginResult.refreshToken);
    if (!isReusePassed) failures++;

    const isLogoutPassed = await testLogout(baseUrl);
    if (!isLogoutPassed) failures++;

    const isValPassed = await testValidationError(baseUrl);
    if (!isValPassed) failures++;
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

async function main(): Promise<void> {
  try {
    await runTests();
  } catch (err) {
    console.error('Test execution error:', err);
    try {
      await closeDatabase();
    } catch {
      // Ignore database close errors during fatal process failure
    }
    process.exit(1);
  }
}

void main();

void main();

