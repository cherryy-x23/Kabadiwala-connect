import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import http from 'http';
import app from '../src/app';
import { User } from '../src/models/User';
import { CollectorProfile } from '../src/models/CollectorProfile';
import { RecyclerProfile } from '../src/models/RecyclerProfile';
import bcrypt from 'bcryptjs';

function extractTokenCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/token=[^;]+/);
  return match ? match[0] : null;
}

async function runPhase2Tests() {
  console.log('🧪 Starting Phase 2 Authentication & RBAC Test Suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let server: http.Server | null = null;
  const testPort = 5998;
  const baseUrl = `http://localhost:${testPort}/api/v1/auth`;

  let passedTests = 0;
  const totalTests = 17;

  try {
    // 0. Setup in-memory MongoDB and Express server
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Seed Demo Accounts
    const salt = await bcrypt.genSalt(10);
    const demoPasswordHash = await bcrypt.hash('DemoPassword123!', salt);

    await User.create({
      name: 'Ravi Kumar (Demo Collector)',
      email: 'collector@demo.com',
      passwordHash: demoPasswordHash,
      role: 'collector',
      isVerified: true,
      verificationStatus: 'verified',
    });

    await User.create({
      name: 'GreenCycle Recycling (Demo Recycler)',
      email: 'recycler@demo.com',
      passwordHash: demoPasswordHash,
      role: 'recycler',
      isVerified: true,
      verificationStatus: 'verified',
    });

    await User.create({
      name: 'Platform Admin (Demo)',
      email: 'admin@demo.com',
      passwordHash: demoPasswordHash,
      role: 'admin',
      isVerified: true,
      verificationStatus: 'verified',
    });

    server = app.listen(testPort);

    // -------------------------------------------------------------
    // Test 1: Register collector
    // -------------------------------------------------------------
    const regCollectorRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Collector',
        email: 'newcollector@example.com',
        password: 'Password123!',
        role: 'collector',
      }),
    });
    const regCollectorJson = await regCollectorRes.json();
    const regCollectorCookie = extractTokenCookie(regCollectorRes);

    if (
      regCollectorRes.status === 201 &&
      regCollectorJson.success === true &&
      regCollectorJson.data?.user?.role === 'collector' &&
      regCollectorCookie
    ) {
      console.log('✅ 1. Register collector succeeded');
      passedTests++;
    } else {
      throw new Error(`Test 1 Failed: ${JSON.stringify(regCollectorJson)}`);
    }

    // -------------------------------------------------------------
    // Test 2: Register recycler
    // -------------------------------------------------------------
    const regRecyclerRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Recycler Facility',
        email: 'newrecycler@example.com',
        password: 'Password123!',
        role: 'recycler',
      }),
    });
    const regRecyclerJson = await regRecyclerRes.json();
    const regRecyclerCookie = extractTokenCookie(regRecyclerRes);

    if (
      regRecyclerRes.status === 201 &&
      regRecyclerJson.success === true &&
      regRecyclerJson.data?.user?.role === 'recycler' &&
      regRecyclerCookie
    ) {
      console.log('✅ 2. Register recycler succeeded');
      passedTests++;
    } else {
      throw new Error(`Test 2 Failed: ${JSON.stringify(regRecyclerJson)}`);
    }

    // -------------------------------------------------------------
    // Test 3: Reject public admin registration
    // -------------------------------------------------------------
    const regAdminRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Malicious Admin Attempt',
        email: 'fakeadmin@example.com',
        password: 'Password123!',
        role: 'admin',
      }),
    });
    const regAdminJson = await regAdminRes.json();

    if (regAdminRes.status === 400 && regAdminJson.success === false) {
      console.log('✅ 3. Reject public admin registration succeeded');
      passedTests++;
    } else {
      throw new Error(`Test 3 Failed: Should reject role=admin with 400. Got: ${regAdminRes.status}`);
    }

    // -------------------------------------------------------------
    // Test 4: Reject duplicate email
    // -------------------------------------------------------------
    const dupRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate User',
        email: 'collector@demo.com',
        password: 'Password123!',
        role: 'collector',
      }),
    });
    const dupJson = await dupRes.json();

    if (dupRes.status === 409 && dupJson.success === false) {
      console.log('✅ 4. Reject duplicate email with 409 Conflict succeeded');
      passedTests++;
    } else {
      throw new Error(`Test 4 Failed: Expected 409, got ${dupRes.status}`);
    }

    // -------------------------------------------------------------
    // Test 5: Reject invalid registration data (short password & bad email)
    // -------------------------------------------------------------
    const invalidRegRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        email: 'not-an-email',
        password: 'short',
        role: 'collector',
      }),
    });
    const invalidRegJson = await invalidRegRes.json();

    if (invalidRegRes.status === 400 && invalidRegJson.success === false) {
      console.log('✅ 5. Reject invalid registration data succeeded');
      passedTests++;
    } else {
      throw new Error(`Test 5 Failed: Expected 400, got ${invalidRegRes.status}`);
    }

    // -------------------------------------------------------------
    // Test 6: Login with correct credentials
    // -------------------------------------------------------------
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'collector@demo.com',
        password: 'DemoPassword123!',
      }),
    });
    const loginJson = await loginRes.json();
    const collectorCookie = extractTokenCookie(loginRes);

    if (
      loginRes.status === 200 &&
      loginJson.success === true &&
      loginJson.data?.user?.email === 'collector@demo.com' &&
      collectorCookie
    ) {
      console.log('✅ 6. Login with correct credentials succeeded');
      passedTests++;
    } else {
      throw new Error(`Test 6 Failed: ${JSON.stringify(loginJson)}`);
    }

    // -------------------------------------------------------------
    // Test 7: Reject incorrect password
    // -------------------------------------------------------------
    const wrongPassRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'collector@demo.com',
        password: 'WrongPassword123!',
      }),
    });
    const wrongPassJson = await wrongPassRes.json();

    if (wrongPassRes.status === 401 && wrongPassJson.success === false) {
      console.log('✅ 7. Reject incorrect password succeeded');
      passedTests++;
    } else {
      throw new Error(`Test 7 Failed: Expected 401, got ${wrongPassRes.status}`);
    }

    // -------------------------------------------------------------
    // Test 8: Reject incorrect email/password with generic message
    // -------------------------------------------------------------
    const nonExistentRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'SomePassword123!',
      }),
    });
    const nonExistentJson = await nonExistentRes.json();

    if (
      nonExistentRes.status === 401 &&
      nonExistentJson.message === 'Invalid email or password' &&
      wrongPassJson.message === 'Invalid email or password'
    ) {
      console.log('✅ 8. Generic error message used without revealing user existence succeeded');
      passedTests++;
    } else {
      throw new Error('Test 8 Failed: Error message revealed email existence!');
    }

    // -------------------------------------------------------------
    // Test 9: JWT cookie is created with HttpOnly flag
    // -------------------------------------------------------------
    const rawSetCookie = loginRes.headers.get('set-cookie');
    if (
      rawSetCookie &&
      rawSetCookie.includes('token=') &&
      rawSetCookie.toLowerCase().includes('httponly') &&
      rawSetCookie.toLowerCase().includes('samesite=lax')
    ) {
      console.log('✅ 9. JWT cookie is created with HttpOnly and SameSite=lax succeeded');
      passedTests++;
    } else {
      throw new Error(`Test 9 Failed: Cookie attributes missing. Got: ${rawSetCookie}`);
    }

    // -------------------------------------------------------------
    // Test 10: /auth/me works with valid authentication
    // -------------------------------------------------------------
    const meRes = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      headers: {
        Cookie: collectorCookie!,
      },
    });
    const meJson = await meRes.json();

    if (
      meRes.status === 200 &&
      meJson.success === true &&
      meJson.data?.user?.email === 'collector@demo.com' &&
      meJson.data?.user?.role === 'collector'
    ) {
      console.log('✅ 10. /auth/me works with valid authentication succeeded');
      passedTests++;
    } else {
      throw new Error(`Test 10 Failed: ${JSON.stringify(meJson)}`);
    }

    // -------------------------------------------------------------
    // Test 11: /auth/me rejects unauthenticated request
    // -------------------------------------------------------------
    const unauthMeRes = await fetch(`${baseUrl}/me`, {
      method: 'GET',
    });
    const unauthMeJson = await unauthMeRes.json();

    if (unauthMeRes.status === 401 && unauthMeJson.success === false) {
      console.log('✅ 11. /auth/me rejects unauthenticated request with 401 succeeded');
      passedTests++;
    } else {
      throw new Error(`Test 11 Failed: Expected 401, got ${unauthMeRes.status}`);
    }

    // -------------------------------------------------------------
    // Test 12: Collector can access collector test endpoint
    // -------------------------------------------------------------
    const collectorTestRes = await fetch(`${baseUrl}/test/collector`, {
      method: 'GET',
      headers: {
        Cookie: collectorCookie!,
      },
    });
    const collectorTestJson = await collectorTestRes.json();

    if (
      collectorTestRes.status === 200 &&
      collectorTestJson.success === true &&
      collectorTestJson.message === 'Collector access granted'
    ) {
      console.log('✅ 12. Collector access to /test/collector succeeded');
      passedTests++;
    } else {
      throw new Error(`Test 12 Failed: ${JSON.stringify(collectorTestJson)}`);
    }

    // -------------------------------------------------------------
    // Test 13: Collector cannot access admin test endpoint (403)
    // -------------------------------------------------------------
    const collectorToAdminRes = await fetch(`${baseUrl}/test/admin`, {
      method: 'GET',
      headers: {
        Cookie: collectorCookie!,
      },
    });
    const collectorToAdminJson = await collectorToAdminRes.json();

    if (collectorToAdminRes.status === 403 && collectorToAdminJson.success === false) {
      console.log('✅ 13. Collector forbidden from /test/admin with 403 succeeded');
      passedTests++;
    } else {
      throw new Error(`Test 13 Failed: Expected 403, got ${collectorToAdminRes.status}`);
    }

    // -------------------------------------------------------------
    // Test 14: Admin can access admin test endpoint
    // -------------------------------------------------------------
    const adminLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@demo.com',
        password: 'DemoPassword123!',
      }),
    });
    const adminCookie = extractTokenCookie(adminLoginRes);

    const adminTestRes = await fetch(`${baseUrl}/test/admin`, {
      method: 'GET',
      headers: {
        Cookie: adminCookie!,
      },
    });
    const adminTestJson = await adminTestRes.json();

    if (
      adminTestRes.status === 200 &&
      adminTestJson.success === true &&
      adminTestJson.message === 'Admin access granted'
    ) {
      console.log('✅ 14. Admin access to /test/admin succeeded');
      passedTests++;
    } else {
      throw new Error(`Test 14 Failed: ${JSON.stringify(adminTestJson)}`);
    }

    // -------------------------------------------------------------
    // Test 15: Logout clears authentication cookie
    // -------------------------------------------------------------
    const logoutRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: {
        Cookie: collectorCookie!,
      },
    });
    const logoutCookie = logoutRes.headers.get('set-cookie');
    const logoutJson = await logoutRes.json();

    if (
      logoutRes.status === 200 &&
      logoutJson.success === true &&
      logoutCookie &&
      (logoutCookie.includes('token=;') ||
        logoutCookie.includes('Max-Age=0') ||
        logoutCookie.includes('Expires=Thu, 01 Jan 1970'))
    ) {
      console.log('✅ 15. Logout clears authentication cookie succeeded');
      passedTests++;
    } else {
      throw new Error(`Test 15 Failed: Logout cookie not cleared. Got: ${logoutCookie}`);
    }

    // -------------------------------------------------------------
    // Test 16: Authenticated endpoint rejects request after logout
    // -------------------------------------------------------------
    // When browser/client clears cookie as instructed by Set-Cookie Max-Age=0
    const afterLogoutRes = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      headers: {
        Cookie: 'token=',
      },
    });

    if (afterLogoutRes.status === 401) {
      console.log('✅ 16. Authenticated endpoint rejects request after logout succeeded');
      passedTests++;
    } else {
      throw new Error(`Test 16 Failed: Expected 401 after logout, got ${afterLogoutRes.status}`);
    }

    // -------------------------------------------------------------
    // Test 17: passwordHash is never returned in responses
    // -------------------------------------------------------------
    const responsesToCheck = [regCollectorJson, regRecyclerJson, loginJson, meJson];
    for (const resData of responsesToCheck) {
      const stringified = JSON.stringify(resData);
      if (stringified.includes('passwordHash')) {
        throw new Error('Test 17 Failed: passwordHash exposed in response JSON!');
      }
    }
    console.log('✅ 17. Security verification: passwordHash never exposed in any response succeeded');
    passedTests++;

    console.log(`\n======================================================`);
    console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 2 AUTHENTICATION & RBAC TESTS PASSED!`);
    console.log(`======================================================\n`);
  } catch (error: any) {
    console.error('\n❌ Phase 2 test suite failed:', error);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
    console.log('🧹 Cleanup complete.');
  }
}

runPhase2Tests();
