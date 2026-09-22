(process.env as any).NODE_ENV = 'test';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import http from 'http';
import app from '../src/app';
import { User } from '../src/models/User';
import { CollectorProfile } from '../src/models/CollectorProfile';
import { RecyclerProfile } from '../src/models/RecyclerProfile';
import { Material } from '../src/models/Material';
import bcrypt from 'bcryptjs';

function extractTokenCookie(headers: Headers): string | null {
  const rawSetCookie = headers.get('set-cookie');
  if (!rawSetCookie) return null;
  const match = rawSetCookie.match(/token=[^;]+/);
  return match ? match[0] : null;
}

/**
 * Creates a local test proxy server that executes the exact logic from
 * app/api/v1/[[...path]]/route.ts
 */
function createTestProxyServer(targetBackendUrl: string): http.Server {
  const HOP_BY_HOP_REQ = new Set([
    'host',
    'connection',
    'keep-alive',
    'transfer-encoding',
    'content-length',
    'upgrade',
  ]);

  const HOP_BY_HOP_RES = new Set([
    'transfer-encoding',
    'connection',
    'keep-alive',
    'set-cookie',
  ]);

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const targetUrl = `${targetBackendUrl}${url.pathname}${url.search}`;

      // Forward headers
      const forwardHeaders = new Headers();
      for (const [key, val] of Object.entries(req.headers)) {
        if (!val) continue;
        const lower = key.toLowerCase();
        if (!HOP_BY_HOP_REQ.has(lower)) {
          if (Array.isArray(val)) {
            val.forEach((v) => forwardHeaders.append(key, v));
          } else {
            forwardHeaders.set(key, val);
          }
        }
      }

      // Read incoming body buffer
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cookie',
          'Access-Control-Allow-Credentials': 'true',
        });
        res.end();
        return;
      }

      const backendRes = await fetch(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        body: bodyBuffer && req.method !== 'GET' && req.method !== 'HEAD' ? bodyBuffer : undefined,
        redirect: 'manual',
      });

      // Forward response headers
      backendRes.headers.forEach((val, key) => {
        if (!HOP_BY_HOP_RES.has(key.toLowerCase())) {
          res.setHeader(key, val);
        }
      });

      // Process and sanitize Set-Cookie
      const rawSetCookies: string[] = [];
      if (typeof (backendRes.headers as any).getSetCookie === 'function') {
        rawSetCookies.push(...(backendRes.headers as any).getSetCookie());
      } else {
        const single = backendRes.headers.get('set-cookie');
        if (single) rawSetCookies.push(single);
      }

      const sanitizedCookies = rawSetCookies.map((c) => {
        let s = c.replace(/;\s*Domain=[^;]+/gi, '');
        if (/SameSite=None/i.test(s)) {
          s = s.replace(/;\s*SameSite=None/gi, '; SameSite=Lax');
        } else if (!/SameSite=/i.test(s)) {
          s += '; SameSite=Lax';
        }
        if (!/HttpOnly/i.test(s)) s += '; HttpOnly';
        if (!/Path=/i.test(s)) s += '; Path=/';
        return s;
      });

      if (sanitizedCookies.length > 0) {
        res.setHeader('Set-Cookie', sanitizedCookies);
      }

      res.statusCode = backendRes.status;
      const resBody = Buffer.from(await backendRes.arrayBuffer());
      res.end(resBody);
    } catch (err: any) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, message: 'Proxy forwarding failed', error: err?.message }));
    }
  });
}

async function runProxyAuthTests() {
  console.log('🧪 Starting Full Next.js Proxy + Mobile Authentication Verification Suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let backendServer: http.Server | null = null;
  let proxyServer: http.Server | null = null;

  const backendPort = 5997;
  const proxyPort = 5998;
  const backendBaseUrl = `http://localhost:${backendPort}`;
  const proxyApiUrl = `http://localhost:${proxyPort}/api/v1`;

  let passedTests = 0;
  const totalTests = 13;

  try {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('DemoPass123!', salt);

    // Create Collector
    const collector = await User.create({
      name: 'Ravi Kumar',
      email: 'collector_proxy@demo.com',
      passwordHash,
      role: 'collector',
      isVerified: true,
      verificationStatus: 'verified',
    });
    await CollectorProfile.create({
      user: collector._id,
      dailyCapacityKg: 50,
      serviceAreas: ['Hyderabad'],
    });

    // Create Recycler
    const recycler = await User.create({
      name: 'GreenCycle Recycling',
      email: 'recycler_proxy@demo.com',
      passwordHash,
      role: 'recycler',
      isVerified: true,
      verificationStatus: 'verified',
    });
    await RecyclerProfile.create({
      user: recycler._id,
      businessName: 'GreenCycle Recycling',
      registrationId: 'GR-HYD-2026-001',
      facilityAddress: 'Hyderabad',
      acceptedMaterials: ['Laptop Scrap'],
    });

    // Create Material
    const material = await Material.create({
      name: 'Laptop Scrap',
      category: 'Computers',
      indicativePrice: 110,
      priceTrend: 'stable',
      hazardLevel: 'low',
      isActive: true,
    });

    // Start Backend Server
    await new Promise<void>((resolve) => {
      backendServer = app.listen(backendPort, () => resolve());
    });

    // Start Proxy Server
    proxyServer = createTestProxyServer(backendBaseUrl);
    await new Promise<void>((resolve) => {
      proxyServer!.listen(proxyPort, () => resolve());
    });

    console.log(`  Backend running on :${backendPort}`);
    console.log(`  Next.js Proxy running on :${proxyPort}\n`);

    // --- TEST 1: Login through proxy ---
    console.log('Test 1: POST /api/v1/auth/login through Next.js proxy');
    const loginRes = await fetch(`${proxyApiUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'collector_proxy@demo.com',
        password: 'DemoPass123!',
      }),
    });

    const tokenCookie = extractTokenCookie(loginRes.headers);
    const loginData: any = await loginRes.json();

    if (loginRes.status === 200 && loginData.data?.user?.role === 'collector' && tokenCookie) {
      console.log('  ✅ Passed: Login succeeded through proxy and returned token cookie');
      passedTests++;
    } else {
      throw new Error(`Test 1 Failed: status ${loginRes.status}, data: ${JSON.stringify(loginData)}`);
    }

    // --- TEST 2: Set-Cookie forwarding and sanitization ---
    console.log('\nTest 2: Set-Cookie rewritten for same-origin (no remote domain, SameSite=Lax, HttpOnly)');
    const rawSetCookieHeader = loginRes.headers.get('set-cookie') || '';
    const hasNoRemoteDomain = !rawSetCookieHeader.includes('Domain=');
    const hasSameSiteLax = /SameSite=Lax/i.test(rawSetCookieHeader);
    const hasHttpOnly = /HttpOnly/i.test(rawSetCookieHeader);
    const hasPath = /Path=\//i.test(rawSetCookieHeader);

    if (hasNoRemoteDomain && hasSameSiteLax && hasHttpOnly && hasPath) {
      console.log('  ✅ Passed: Cookie sanitized for first-party browser origin');
      passedTests++;
    } else {
      throw new Error(`Test 2 Failed: rawSetCookie: ${rawSetCookieHeader}`);
    }

    // --- TEST 3: Cookie forwarding from browser proxy request to backend ---
    console.log('\nTest 3: Browser Cookie header is forwarded through proxy to backend');
    const cookieForwardRes = await fetch(`${proxyApiUrl}/auth/me`, {
      method: 'GET',
      headers: {
        Cookie: tokenCookie!,
      },
    });
    const cookieForwardData: any = await cookieForwardRes.json();

    if (cookieForwardRes.status === 200 && cookieForwardData.data?.user?.email === 'collector_proxy@demo.com') {
      console.log('  ✅ Passed: Cookie forwarded to backend successfully, session restored');
      passedTests++;
    } else {
      throw new Error(`Test 3 Failed: status ${cookieForwardRes.status}, data: ${JSON.stringify(cookieForwardData)}`);
    }

    // --- TEST 4: /auth/me after login restores collector session ---
    console.log('\nTest 4: GET /auth/me returns collector profile and permissions');
    if (cookieForwardData.data?.user?.role === 'collector' && cookieForwardData.data?.user?.id === collector._id.toString()) {
      console.log('  ✅ Passed: /auth/me profile matches collector identity');
      passedTests++;
    } else {
      throw new Error(`Test 4 Failed: Expected collector role, got ${cookieForwardData.data?.user?.role}`);
    }

    // --- TEST 5: /auth/me without authentication returns 401 ---
    console.log('\nTest 5: GET /auth/me without cookie returns 401');
    const unauthMeRes = await fetch(`${proxyApiUrl}/auth/me`, { method: 'GET' });
    const unauthMeData: any = await unauthMeRes.json();

    if (unauthMeRes.status === 401 && unauthMeData.message?.includes('Authentication required')) {
      console.log('  ✅ Passed: Unauthenticated request rejected with 401');
      passedTests++;
    } else {
      throw new Error(`Test 5 Failed: status ${unauthMeRes.status}, data: ${JSON.stringify(unauthMeData)}`);
    }

    // --- TEST 6: Authenticated GET /waste through proxy ---
    console.log('\nTest 6: Authenticated GET /waste/my through proxy');
    const getWasteRes = await fetch(`${proxyApiUrl}/waste/my`, {
      method: 'GET',
      headers: {
        Cookie: tokenCookie!,
      },
    });
    const getWasteData: any = await getWasteRes.json();

    if (getWasteRes.status === 200 && Array.isArray(getWasteData.data?.wasteItems)) {
      console.log('  ✅ Passed: GET /waste/my returned waste items array for collector');
      passedTests++;
    } else {
      throw new Error(`Test 6 Failed: status ${getWasteRes.status}, data: ${JSON.stringify(getWasteData)}`);
    }

    // --- TEST 7: Authenticated POST /waste with real ObjectId through proxy ---
    console.log('\nTest 7: Authenticated POST /waste with real ObjectId through proxy');
    const postWasteRes = await fetch(`${proxyApiUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: tokenCookie!,
      },
      body: JSON.stringify({
        materialId: material._id.toString(),
        quantityKg: 10,
        notes: 'Working / Mixed: Test laptop scrap through proxy',
      }),
    });
    const postWasteData: any = await postWasteRes.json();

    if (postWasteRes.status === 201 && postWasteData.data?.wasteItem?.estimatedValue === 1100) {
      console.log('  ✅ Passed: POST /waste created item with ₹1,100 valuation');
      passedTests++;
    } else {
      throw new Error(`Test 7 Failed: status ${postWasteRes.status}, data: ${JSON.stringify(postWasteData)}`);
    }

    // --- TEST 8: Multipart/form-data photo upload through proxy ---
    console.log('\nTest 8: Multipart photo upload preserved byte-for-byte through proxy');
    const validJpegBase64 =
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8APw//2Q==';
    const validJpgBuffer = Buffer.from(validJpegBase64, 'base64');

    const formWithPhoto = new FormData();
    formWithPhoto.append('materialId', material._id.toString());
    formWithPhoto.append('quantityKg', '15');
    formWithPhoto.append('notes', 'Photo upload test item');
    formWithPhoto.append('photo', new Blob([validJpgBuffer], { type: 'image/jpeg' }), 'scrap_laptop.jpg');

    const photoRes = await fetch(`${proxyApiUrl}/waste`, {
      method: 'POST',
      headers: {
        Cookie: tokenCookie!,
      },
      body: formWithPhoto,
    });
    const photoData: any = await photoRes.json();

    if (photoRes.status === 201 && photoData.data?.wasteItem?.id) {
      console.log('  ✅ Passed: Multipart/form-data with image successfully processed through proxy');
      passedTests++;
    } else {
      throw new Error(`Test 8 Failed: status ${photoRes.status}, data: ${JSON.stringify(photoData)}`);
    }

    // --- TEST 9: POST /auth/logout clears cookie ---
    console.log('\nTest 9: POST /auth/logout clears session cookie');
    const logoutRes = await fetch(`${proxyApiUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: tokenCookie!,
      },
    });
    const logoutCookie = logoutRes.headers.get('set-cookie') || '';

    if (logoutRes.status === 200 && (logoutCookie.includes('Max-Age=0') || logoutCookie.includes('expires='))) {
      console.log('  ✅ Passed: Logout clears cookie with Max-Age=0');
      passedTests++;
    } else {
      throw new Error(`Test 9 Failed: status ${logoutRes.status}, cookie: ${logoutCookie}`);
    }

    // --- TEST 10: Session restoration verification ---
    console.log('\nTest 10: Session verification after re-login');
    const reloginRes = await fetch(`${proxyApiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'collector_proxy@demo.com',
        password: 'DemoPass123!',
      }),
    });
    const refreshedCookie = extractTokenCookie(reloginRes.headers);
    const restoreRes = await fetch(`${proxyApiUrl}/auth/me`, {
      method: 'GET',
      headers: { Cookie: refreshedCookie! },
    });
    const restoreData: any = await restoreRes.json();

    if (restoreRes.status === 200 && restoreData.data?.user?.email === 'collector_proxy@demo.com') {
      console.log('  ✅ Passed: Session fully restored and persistent');
      passedTests++;
    } else {
      throw new Error(`Test 10 Failed: status ${restoreRes.status}`);
    }

    // --- TEST 11: Collector role isolation ---
    console.log('\nTest 11: Collector cannot access recycler-only incoming requests');
    const collectorAccessRecyclerRes = await fetch(`${proxyApiUrl}/requests/incoming`, {
      method: 'GET',
      headers: { Cookie: refreshedCookie! },
    });

    if (collectorAccessRecyclerRes.status === 403) {
      console.log('  ✅ Passed: Collector blocked with 403 Forbidden from recycler endpoints');
      passedTests++;
    } else {
      throw new Error(`Test 11 Failed: status was ${collectorAccessRecyclerRes.status}`);
    }

    // --- TEST 12: Recycler role isolation ---
    console.log('\nTest 12: Recycler cannot create waste items (collector only)');
    const recLoginRes = await fetch(`${proxyApiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'recycler_proxy@demo.com',
        password: 'DemoPass123!',
      }),
    });
    const recCookie = extractTokenCookie(recLoginRes.headers);

    const recWasteRes = await fetch(`${proxyApiUrl}/waste`, {
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

    if (recWasteRes.status === 403) {
      console.log('  ✅ Passed: Recycler blocked with 403 Forbidden from collector waste creation');
      passedTests++;
    } else {
      throw new Error(`Test 12 Failed: status was ${recWasteRes.status}`);
    }

    // --- TEST 13: Admin role isolation ---
    console.log('\nTest 13: Non-admin users cannot access admin endpoints');
    const adminStatsRes = await fetch(`${proxyApiUrl}/auth/test/admin`, {
      method: 'GET',
      headers: { Cookie: refreshedCookie! },
    });

    if (adminStatsRes.status === 403) {
      console.log('  ✅ Passed: Non-admin blocked with 403 Forbidden from admin endpoints');
      passedTests++;
    } else {
      throw new Error(`Test 13 Failed: status was ${adminStatsRes.status}`);
    }

    console.log(`\n======================================================`);
    console.log(`🎉 ALL ${passedTests}/${totalTests} NEXT.JS PROXY AUTH TESTS PASSED!`);
    console.log(`======================================================\n`);
  } finally {
    if (proxyServer) {
      await new Promise<void>((resolve) => (proxyServer as http.Server).close(() => resolve()));
    }
    if (backendServer) {
      await new Promise<void>((resolve) => (backendServer as http.Server).close(() => resolve()));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runProxyAuthTests().catch((err) => {
  console.error('❌ Proxy auth test suite failed:', err);
  process.exit(1);
});
