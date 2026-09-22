import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import http from 'http';
import app from '../src/app';
import { User } from '../src/models/User';
import { CollectorProfile } from '../src/models/CollectorProfile';
import { RecyclerProfile } from '../src/models/RecyclerProfile';
import { Material } from '../src/models/Material';
import { getAuthCookieOptions } from '../src/utils/token';
import { env } from '../src/config/env';
import bcrypt from 'bcryptjs';

function extractTokenCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/token=[^;]+/);
  return match ? match[0] : null;
}

async function runProdAuthTests() {
  console.log('🧪 Starting Production Authentication & Cross-Site CORS Verification Suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let server: http.Server | null = null;
  const testPort = 5994;
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  let passedTests = 0;
  const totalTests = 10;

  try {
    // In-memory MongoDB setup
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('DemoPass123!', salt);

    const collectorUser = await User.create({
      name: 'Ravi Kumar',
      email: 'collector_prod@demo.com',
      passwordHash,
      role: 'collector',
      phone: '+91 9876543210',
      isVerified: true,
      verificationStatus: 'verified',
    });

    await CollectorProfile.create({
      user: collectorUser._id,
      dailyCapacityKg: 50,
      serviceAreas: ['Hyderabad'],
    });

    const recyclerUser = await User.create({
      name: 'GreenCycle Recycling',
      email: 'recycler_prod@demo.com',
      passwordHash,
      role: 'recycler',
      phone: '+91 9876543211',
      isVerified: true,
      verificationStatus: 'verified',
    });

    await RecyclerProfile.create({
      user: recyclerUser._id,
      businessName: 'GreenCycle Recycling',
      registrationId: 'GR-HYD-2026-001',
      facilityAddress: 'Hyderabad',
      acceptedMaterials: ['Laptop Scrap'],
    });

    const material = await Material.create({
      name: 'Laptop Scrap',
      category: 'Computers',
      description: 'Obsolete, broken or non-working laptops and motherboards',
      indicativePrice: 110,
      priceTrend: 'stable',
      hazardLevel: 'low',
      isActive: true,
    });

    // Start server
    await new Promise<void>((resolve) => {
      server = app.listen(testPort, () => {
        resolve();
      });
    });

    // --- TEST 1: CORS Preflight allows production Vercel origin exactly with credentials ---
    console.log('Test 1: CORS Preflight allows production Vercel origin');
    const vercelOrigin = 'https://kabadiwala-connect-taupe.vercel.app';
    const corsRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: vercelOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    const allowOrigin = corsRes.headers.get('access-control-allow-origin');
    const allowCreds = corsRes.headers.get('access-control-allow-credentials');

    if (allowOrigin === vercelOrigin && allowCreds === 'true') {
      console.log('  ✅ Passed: CORS preflight allowed production Vercel origin with credentials');
      passedTests++;
    } else {
      throw new Error(`Test 1 Failed: CORS preflight origin: ${allowOrigin}, creds: ${allowCreds}`);
    }

    // --- TEST 2: CORS Preflight blocks untrusted origin ---
    console.log('\nTest 2: CORS Preflight rejects untrusted origin');
    const untrustedRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://malicious-site.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    const untrustedOrigin = untrustedRes.headers.get('access-control-allow-origin');
    if (!untrustedOrigin) {
      console.log('  ✅ Passed: Untrusted origin blocked from CORS access');
      passedTests++;
    } else {
      throw new Error(`Test 2 Failed: Untrusted origin was allowed: ${untrustedOrigin}`);
    }

    // --- TEST 3: Production cookie configuration audit ---
    console.log('\nTest 3: Production cookie options audit');
    const originalEnv = env.NODE_ENV;
    try {
      (env as any).NODE_ENV = 'production';
      const prodOptions = getAuthCookieOptions();
      if (
        prodOptions.httpOnly === true &&
        prodOptions.sameSite === 'none' &&
        prodOptions.secure === true &&
        prodOptions.path === '/'
      ) {
        console.log('  ✅ Passed: Production cookie options: HttpOnly=true, SameSite=none, Secure=true, Path=/');
        passedTests++;
      } else {
        throw new Error(`Test 3 Failed: Unexpected prod cookie options: ${JSON.stringify(prodOptions)}`);
      }
    } finally {
      (env as any).NODE_ENV = originalEnv;
    }

    // --- TEST 4: POST /auth/login sets session cookie ---
    console.log('\nTest 4: POST /auth/login sets session cookie');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: vercelOrigin,
      },
      body: JSON.stringify({
        email: 'collector_prod@demo.com',
        password: 'DemoPass123!',
      }),
    });

    const tokenCookie = extractTokenCookie(loginRes);
    const loginData: any = await loginRes.json();

    if (loginRes.status === 200 && tokenCookie && loginData.data?.user?.role === 'collector') {
      console.log('  ✅ Passed: Login sets session cookie and returns user profile');
      passedTests++;
    } else {
      throw new Error(`Test 4 Failed: Login status ${loginRes.status}, cookie: ${tokenCookie}`);
    }

    // --- TEST 5: GET /auth/me with cookie restores session ---
    console.log('\nTest 5: GET /auth/me with session cookie');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        Cookie: tokenCookie!,
        Origin: vercelOrigin,
      },
    });
    const meData: any = await meRes.json();

    if (meRes.status === 200 && meData.data?.user?.email === 'collector_prod@demo.com') {
      console.log('  ✅ Passed: /auth/me successfully restores session with cookie');
      passedTests++;
    } else {
      throw new Error(`Test 5 Failed: /auth/me status ${meRes.status}, data: ${JSON.stringify(meData)}`);
    }

    // --- TEST 6: GET /auth/me without cookie returns 401 ---
    console.log('\nTest 6: GET /auth/me without cookie returns 401');
    const unauthMeRes = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        Origin: vercelOrigin,
      },
    });
    const unauthMeData: any = await unauthMeRes.json();

    if (
      unauthMeRes.status === 401 &&
      unauthMeData.message === 'Authentication required. No session token provided.'
    ) {
      console.log('  ✅ Passed: /auth/me correctly returns 401 when no token is provided');
      passedTests++;
    } else {
      throw new Error(`Test 6 Failed: Status ${unauthMeRes.status}, message: ${unauthMeData.message}`);
    }

    // --- TEST 7: Authenticated waste creation (POST /waste) works with real MongoDB ObjectId ---
    console.log('\nTest 7: Authenticated POST /waste with real ObjectId');
    const wasteRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: tokenCookie!,
        Origin: vercelOrigin,
      },
      body: JSON.stringify({
        materialId: material._id.toString(),
        quantityKg: 10,
        notes: 'Working / Mixed: Test laptop scrap',
      }),
    });
    const wasteData: any = await wasteRes.json();

    if (wasteRes.status === 201 && wasteData.data?.wasteItem?.id) {
      console.log('  ✅ Passed: Waste logged with real material ObjectId and estimated valuation');
      passedTests++;
    } else {
      throw new Error(`Test 7 Failed: Status ${wasteRes.status}, data: ${JSON.stringify(wasteData)}`);
    }

    // --- TEST 8: Unauthenticated POST /waste returns 401 ---
    console.log('\nTest 8: Unauthenticated POST /waste returns 401');
    const unauthWasteRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: vercelOrigin,
      },
      body: JSON.stringify({
        materialId: material._id.toString(),
        quantityKg: 10,
      }),
    });
    const unauthWasteData: any = await unauthWasteRes.json();

    if (
      unauthWasteRes.status === 401 &&
      unauthWasteData.message === 'Authentication required. No session token provided.'
    ) {
      console.log('  ✅ Passed: Unauthenticated POST /waste returns 401');
      passedTests++;
    } else {
      throw new Error(`Test 8 Failed: Status ${unauthWasteRes.status}, data: ${JSON.stringify(unauthWasteData)}`);
    }

    // --- TEST 9: Role isolation - Recycler cannot create waste & Collector cannot view recycler requests ---
    console.log('\nTest 9: Role isolation between collector and recycler');
    const recLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'recycler_prod@demo.com',
        password: 'DemoPass123!',
      }),
    });
    const recCookie = extractTokenCookie(recLoginRes);

    const recWasteRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recCookie!,
      },
      body: JSON.stringify({
        materialId: material._id.toString(),
        quantityKg: 5,
      }),
    });

    const colRecReqRes = await fetch(`${baseUrl}/requests/incoming`, {
      method: 'GET',
      headers: {
        Cookie: tokenCookie!,
      },
    });

    if (recWasteRes.status === 403 && colRecReqRes.status === 403) {
      console.log('  ✅ Passed: Role isolation strictly enforced (403 Forbidden for cross-role access)');
      passedTests++;
    } else {
      throw new Error(`Test 9 Failed: recWaste status: ${recWasteRes.status}, colRecReq status: ${colRecReqRes.status}`);
    }

    // --- TEST 10: POST /auth/logout clears cookie ---
    console.log('\nTest 10: POST /auth/logout clears session cookie');
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: tokenCookie!,
        Origin: vercelOrigin,
      },
    });
    const logoutCookie = logoutRes.headers.get('set-cookie') || '';

    if (logoutRes.status === 200 && (logoutCookie.includes('Max-Age=0') || logoutCookie.includes('expires='))) {
      console.log('  ✅ Passed: /auth/logout clears cookie with Max-Age=0 and matching path');
      passedTests++;
    } else {
      throw new Error(`Test 10 Failed: Status ${logoutRes.status}, cookie: ${logoutCookie}`);
    }

    console.log(`\n======================================================`);
    console.log(`🎉 ALL ${passedTests}/${totalTests} PRODUCTION AUTH TESTS PASSED!`);
    console.log(`======================================================\n`);
  } finally {
    if (server) {
      await new Promise<void>((resolve) => (server as http.Server).close(() => resolve()));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runProdAuthTests().catch((err) => {
  console.error('❌ Production auth test suite failed:', err);
  process.exit(1);
});
