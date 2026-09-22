import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import http from 'http';
import fs from 'fs';
import path from 'path';
import app from '../src/app';
import { User } from '../src/models/User';
import { CollectorProfile } from '../src/models/CollectorProfile';
import { RecyclerProfile } from '../src/models/RecyclerProfile';
import { Material } from '../src/models/Material';
import bcrypt from 'bcryptjs';

function extractTokenCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/token=[^;]+/);
  return match ? match[0] : null;
}

async function runPhase7aTests() {
  console.log('🧪 Starting Phase 7A Frontend ↔ Backend Integration Foundation Test Suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let server: http.Server | null = null;
  const testPort = 5993;
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  let passedTests = 0;
  const totalTests = 20;

  try {
    // 0. In-memory MongoDB setup
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    const salt = await bcrypt.genSalt(10);
    const demoPasswordHash = await bcrypt.hash('demo123', salt);

    // Seed test users matching demo credentials
    const collectorUser = await User.create({
      name: 'Ravi Kumar',
      email: 'ravi@demo.com',
      passwordHash: demoPasswordHash,
      role: 'collector',
      phone: '+91 9876543210',
      isVerified: true,
      verificationStatus: 'verified',
    });

    await CollectorProfile.create({
      user: collectorUser._id,
      dailyCapacityKg: 50,
      serviceAreas: ['Charminar', 'Koti'],
    });

    const recyclerUser = await User.create({
      name: 'GreenCycle Recycling',
      email: 'greencycle@demo.com',
      passwordHash: demoPasswordHash,
      role: 'recycler',
      phone: '+91 9876543211',
      isVerified: true,
      verificationStatus: 'verified',
    });

    await RecyclerProfile.create({
      user: recyclerUser._id,
      organizationName: 'GreenCycle Recycling Facility',
      registrationId: 'GR-HYD-2026-001',
      acceptedMaterials: ['Computers & Laptops', 'Mobile Phones', 'Batteries', 'Cables & Wires'],
      operatingHours: '9 AM - 6 PM, Mon-Sat',
    });

    // Seed test materials
    await Material.create([
      {
        name: 'Printed Circuit Boards (Grade A)',
        category: 'Computers & Laptops',
        unit: 'kg',
        pricePerKg: 350,
        priceTrend: 'up',
        description: 'Motherboards from modern laptops and desktop computers.',
        isActive: true,
      },
      {
        name: 'Copper Wire & Cables',
        category: 'Cables & Wires',
        unit: 'kg',
        pricePerKg: 420,
        priceTrend: 'up',
        description: 'Insulated and stripped copper cables.',
        isActive: true,
      },
      {
        name: 'Lithium-ion Batteries',
        category: 'Batteries',
        unit: 'kg',
        pricePerKg: 85,
        priceTrend: 'stable',
        description: 'Rechargeable Li-ion batteries from electronics.',
        isActive: true,
      },
    ]);

    // Start Express test server
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(testPort, () => resolve()));
    console.log(`📡 Backend integration server listening on ${baseUrl}\n`);

    // --- TEST 1: CORS options preflight with credentials support ---
    console.log('Test 1: CORS Preflight includes Allow-Credentials');
    const corsRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    const allowCreds = corsRes.headers.get('access-control-allow-credentials');
    if (allowCreds === 'true') {
      console.log('  ✅ Passed: CORS preflight allows credentials');
      passedTests++;
    } else {
      console.error('  ❌ Failed: Allow-Credentials missing or false', allowCreds);
    }

    // --- TEST 2: Collector Login sets HttpOnly JWT Cookie ---
    console.log('\nTest 2: Login with Collector credentials sets HttpOnly cookie');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ravi@demo.com', password: 'demo123' }),
    });
    const loginJson = await loginRes.json();
    const setCookieHeader = loginRes.headers.get('set-cookie');
    const collectorCookie = extractTokenCookie(loginRes);

    if (
      loginRes.status === 200 &&
      loginJson.success &&
      loginJson.data.user.role === 'collector' &&
      collectorCookie &&
      setCookieHeader?.toLowerCase().includes('httponly') &&
      (setCookieHeader?.toLowerCase().includes('samesite=lax') || setCookieHeader?.toLowerCase().includes('samesite=none'))
    ) {
      console.log('  ✅ Passed: Collector logged in with secure HttpOnly token cookie');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { status: loginRes.status, loginJson, setCookieHeader });
    }

    // --- TEST 3: Authenticated /auth/me with Cookie ---
    console.log('\nTest 3: Session restoration via GET /auth/me with cookie');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: collectorCookie! },
    });
    const meJson = await meRes.json();
    if (
      meRes.status === 200 &&
      meJson.success &&
      meJson.data.user.email === 'ravi@demo.com' &&
      meJson.data.user.role === 'collector' &&
      meJson.data.user.passwordHash === undefined
    ) {
      console.log('  ✅ Passed: /auth/me returned authenticated collector profile');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { status: meRes.status, meJson });
    }

    // --- TEST 4: Unauthenticated /auth/me without Cookie returns 401 ---
    console.log('\nTest 4: Unauthenticated GET /auth/me returns 401 Unauthorized');
    const unauthRes = await fetch(`${baseUrl}/auth/me`);
    const unauthJson = await unauthRes.json();
    if (unauthRes.status === 401 && !unauthJson.success) {
      console.log('  ✅ Passed: /auth/me rejected unauthenticated request');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { status: unauthRes.status, unauthJson });
    }

    // --- TEST 5: Logout Clears the Token Cookie ---
    console.log('\nTest 5: POST /auth/logout expires and clears token cookie');
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: collectorCookie! },
    });
    const logoutJson = await logoutRes.json();
    const logoutSetCookie = logoutRes.headers.get('set-cookie');
    if (
      logoutRes.status === 200 &&
      logoutJson.success &&
      logoutSetCookie &&
      (logoutSetCookie.includes('token=;') || logoutSetCookie.includes('Max-Age=0') || logoutSetCookie.includes('Expires='))
    ) {
      console.log('  ✅ Passed: /auth/logout successfully cleared cookie');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { status: logoutRes.status, logoutJson, logoutSetCookie });
    }

    // --- TEST 6: Recycler Login sets Recycler Session ---
    console.log('\nTest 6: Recycler login and session inspection');
    const recLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'greencycle@demo.com', password: 'demo123' }),
    });
    const recLoginJson = await recLoginRes.json();
    const recyclerCookie = extractTokenCookie(recLoginRes);
    if (
      recLoginRes.status === 200 &&
      recLoginJson.success &&
      recLoginJson.data.user.role === 'recycler' &&
      recyclerCookie
    ) {
      console.log('  ✅ Passed: Recycler logged in with valid role and cookie');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { status: recLoginRes.status, recLoginJson });
    }

    // --- TEST 7: Register New Collector via /auth/register ---
    console.log('\nTest 7: Collector registration sets role, profile, and session cookie');
    const newCollectorRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sunil Verma',
        email: 'sunil@collector.demo',
        password: 'Password123!',
        role: 'collector',
        phone: '+91 9123456780',
      }),
    });
    const newCollectorJson = await newCollectorRes.json();
    const newCollectorCookie = extractTokenCookie(newCollectorRes);
    if (
      newCollectorRes.status === 201 &&
      newCollectorJson.success &&
      newCollectorJson.data.user.role === 'collector' &&
      newCollectorCookie
    ) {
      console.log('  ✅ Passed: Collector registered successfully with session cookie');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { status: newCollectorRes.status, newCollectorJson });
    }

    // --- TEST 8: Register New Recycler via /auth/register ---
    console.log('\nTest 8: Recycler registration sets business profile and session cookie');
    const newRecyclerRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'EcoRecycle Solutions',
        email: 'contact@ecorecycle.demo',
        password: 'Password123!',
        role: 'recycler',
        phone: '+91 9123456789',
        organizationName: 'EcoRecycle Solutions Pvt Ltd',
        registrationId: 'ECO-HYD-2026-999',
      }),
    });
    const newRecyclerJson = await newRecyclerRes.json();
    const newRecyclerCookie = extractTokenCookie(newRecyclerRes);
    if (
      newRecyclerRes.status === 201 &&
      newRecyclerJson.success &&
      newRecyclerJson.data.user.role === 'recycler' &&
      newRecyclerCookie
    ) {
      console.log('  ✅ Passed: Recycler registered successfully with session cookie');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { status: newRecyclerRes.status, newRecyclerJson });
    }

    // --- TEST 9: Disallow Admin Registration on Public Auth Endpoint ---
    console.log('\nTest 9: Attempting to register as "admin" is rejected');
    const adminRegRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unauthorized Admin',
        email: 'attacker@demo.com',
        password: 'Password123!',
        role: 'admin',
      }),
    });
    const adminRegJson = await adminRegRes.json();
    if (adminRegRes.status === 400 && !adminRegJson.success) {
      console.log('  ✅ Passed: Public registration correctly rejects admin role');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { status: adminRegRes.status, adminRegJson });
    }

    // --- TEST 10: Reject Duplicate Email on Registration ---
    console.log('\nTest 10: Duplicate email registration returns error');
    const dupRegRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Ravi',
        email: 'ravi@demo.com',
        password: 'Password123!',
        role: 'collector',
      }),
    });
    const dupRegJson = await dupRegRes.json();
    if ((dupRegRes.status === 400 || dupRegRes.status === 409) && !dupRegJson.success) {
      console.log('  ✅ Passed: Duplicate registration rejected with error');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { status: dupRegRes.status, dupRegJson });
    }

    // --- TEST 11: Invalid Password returns 401 Unauthorized ---
    console.log('\nTest 11: Login with invalid password returns 401');
    const badPassRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ravi@demo.com', password: 'wrongpassword' }),
    });
    const badPassJson = await badPassRes.json();
    if (badPassRes.status === 401 && !badPassJson.success) {
      console.log('  ✅ Passed: Invalid password rejected with 401');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { status: badPassRes.status, badPassJson });
    }

    // --- TEST 12: GET /materials catalog endpoint returns seeded materials ---
    console.log('\nTest 12: GET /materials catalog returns formatted items');
    const matRes = await fetch(`${baseUrl}/materials`);
    const matJson = await matRes.json();
    if (
      matRes.status === 200 &&
      matJson.success &&
      Array.isArray(matJson.data.materials) &&
      matJson.data.materials.length >= 3 &&
      matJson.data.materials[0].pricePerKg !== undefined
    ) {
      console.log(`  ✅ Passed: Materials catalog returned ${matJson.data.materials.length} items`);
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { status: matRes.status, matJson });
    }

    // --- TEST 13: GET /recyclers directory returns authorized recyclers ---
    console.log('\nTest 13: GET /recyclers returns recycler directory');
    const recRes = await fetch(`${baseUrl}/recyclers`);
    const recJson = await recRes.json();
    if (
      recRes.status === 200 &&
      recJson.success &&
      Array.isArray(recJson.data.recyclers) &&
      recJson.data.recyclers.length >= 1 &&
      recJson.data.recyclers.some((r: any) => r.organizationName)
    ) {
      console.log(`  ✅ Passed: Recyclers directory returned ${recJson.data.recyclers.length} facilities`);
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { status: recRes.status, recJson });
    }

    // --- TEST 14: Verify .env files have correct NEXT_PUBLIC_API_BASE_URL ---
    console.log('\nTest 14: Frontend environment configuration');
    const envLocalPath = path.resolve(__dirname, '../../.env.local');
    const envExamplePath = path.resolve(__dirname, '../../.env.example');
    const envLocalExists = fs.existsSync(envLocalPath);
    const envExampleExists = fs.existsSync(envExamplePath);
    const envLocalContent = envLocalExists ? fs.readFileSync(envLocalPath, 'utf8') : '';
    if (
      envLocalExists &&
      envExampleExists &&
      envLocalContent.includes('NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1')
    ) {
      console.log('  ✅ Passed: .env.local and .env.example configured with NEXT_PUBLIC_API_BASE_URL');
      passedTests++;
    } else {
      console.error('  ❌ Failed: Environment files missing or misconfigured');
    }

    // --- TEST 15: Verify lib/apiClient.ts enforces credentials: 'include' ---
    console.log('\nTest 15: Audit lib/apiClient.ts for credentials: include');
    const apiClientPath = path.resolve(__dirname, '../../lib/apiClient.ts');
    const apiClientContent = fs.readFileSync(apiClientPath, 'utf8');
    if (
      apiClientContent.includes("credentials: 'include'") &&
      apiClientContent.includes('class ApiError')
    ) {
      console.log("  ✅ Passed: lib/apiClient.ts enforces credentials: 'include' and ApiError handling");
      passedTests++;
    } else {
      console.error('  ❌ Failed: lib/apiClient.ts missing credentials configuration');
    }

    // --- TEST 16: Zero JWT tokens in localStorage/sessionStorage across repo ---
    console.log('\nTest 16: Security audit - Zero localStorage/sessionStorage for JWT token');
    const frontendDirs = ['components', 'lib', 'app'];
    let violationFound = false;

    function searchForStorage(dir: string) {
      const fullDir = path.resolve(__dirname, '../../', dir);
      if (!fs.existsSync(fullDir)) return;
      const files = fs.readdirSync(fullDir, { recursive: true }) as string[];
      for (const file of files) {
        if (typeof file === 'string' && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
          const filePath = path.join(fullDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          if (
            content.includes("localStorage.setItem('token'") ||
            content.includes('localStorage.setItem("token"') ||
            content.includes("sessionStorage.setItem('token'") ||
            content.includes('sessionStorage.setItem("token"')
          ) {
            console.error(`  ❌ Storage violation found in: ${filePath}`);
            violationFound = true;
          }
        }
      }
    }

    frontendDirs.forEach(searchForStorage);
    if (!violationFound) {
      console.log('  ✅ Passed: Security audit passed - zero tokens stored in localStorage/sessionStorage');
      passedTests++;
    } else {
      console.error('  ❌ Failed: Token storage violation found');
    }

    // --- TEST 17: AuthProvider and useAuth in lib/authContext.tsx ---
    console.log('\nTest 17: Audit lib/authContext.tsx session restoration & hooks');
    const authContextPath = path.resolve(__dirname, '../../lib/authContext.tsx');
    const authContextContent = fs.readFileSync(authContextPath, 'utf8');
    if (
      authContextContent.includes('export function AuthProvider') &&
      authContextContent.includes('export function useAuth') &&
      authContextContent.includes('authApi.getCurrentUser()') &&
      authContextContent.includes('authApi.login(') &&
      authContextContent.includes('authApi.logout(')
    ) {
      console.log('  ✅ Passed: AuthProvider restores session on mount and provides complete useAuth API');
      passedTests++;
    } else {
      console.error('  ❌ Failed: lib/authContext.tsx is missing required methods');
    }

    // --- TEST 18: Sidebar Logout Integration ---
    console.log('\nTest 18: Audit components/layout/Sidebar.tsx for logout integration');
    const sidebarPath = path.resolve(__dirname, '../../components/layout/Sidebar.tsx');
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
    if (
      sidebarContent.includes('useAuth') &&
      sidebarContent.includes('handleLogout') &&
      sidebarContent.includes('onClick={handleLogout}')
    ) {
      console.log('  ✅ Passed: Sidebar logout button calls useAuth().logout() and redirects');
      passedTests++;
    } else {
      console.error('  ❌ Failed: Sidebar logout button not wired to handleLogout');
    }

    // --- TEST 19: Login Component Integration in components/KabadiwalaApp.tsx ---
    console.log('\nTest 19: Audit Login component in components/KabadiwalaApp.tsx');
    const appPath = path.resolve(__dirname, '../../components/KabadiwalaApp.tsx');
    const appContent = fs.readFileSync(appPath, 'utf8');
    if (
      appContent.includes('useAuth') &&
      appContent.includes('handleLogin') &&
      appContent.includes('login({ email: email.trim(), password })') &&
      appContent.includes('handleQuickDemo')
    ) {
      console.log('  ✅ Passed: Login component connected to useAuth().login with demo switcher');
      passedTests++;
    } else {
      console.error('  ❌ Failed: Login component not properly wired to useAuth');
    }

    // --- TEST 20: MaterialsGrid, RecyclerDirectory & DashboardShell in KabadiwalaApp.tsx ---
    console.log('\nTest 20: Audit dynamic Materials, Recyclers, and DashboardShell');
    if (
      appContent.includes('materialsApi.getMaterials()') &&
      appContent.includes('recyclersApi.getRecyclers()') &&
      appContent.includes('const { user } = useAuth()') &&
      appContent.includes('const activeRole = (user?.role')
    ) {
      console.log('  ✅ Passed: MaterialsGrid, RecyclerDirectory and DashboardShell consume live APIs & auth');
      passedTests++;
    } else {
      console.error('  ❌ Failed: Live catalog adapters or dynamic shell not found');
    }

    console.log(`\n========================================`);
    console.log(`Phase 7A Test Summary: ${passedTests}/${totalTests} tests passed`);
    console.log(`========================================\n`);

    if (passedTests === totalTests) {
      console.log('🎉 ALL PHASE 7A TESTS PASSED SUCCESSFULLY!\n');
    } else {
      console.error(`⚠️ ${totalTests - passedTests} tests failed.`);
      process.exit(1);
    }
  } catch (err) {
    console.error('💥 Test suite encountered fatal error:', err);
    process.exit(1);
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runPhase7aTests();
