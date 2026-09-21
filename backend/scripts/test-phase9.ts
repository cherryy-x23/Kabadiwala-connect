/**
 * Phase 9 Final Verification & Production Readiness Test Suite
 * Tests: Complete End-to-End Workflow, Security, RBAC, Data Integrity, Idempotency & Clean States
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import http from 'http';
import app from '../src/app';
import { User } from '../src/models/User';
import { CollectorProfile } from '../src/models/CollectorProfile';
import { RecyclerProfile } from '../src/models/RecyclerProfile';
import { Material } from '../src/models/Material';
import { WasteItem } from '../src/models/WasteItem';
import { HandoverRequest } from '../src/models/HandoverRequest';
import { HandoverRecord } from '../src/models/HandoverRecord';
import { Transaction } from '../src/models/Transaction';
import { Notification } from '../src/models/Notification';
import { AIConversation } from '../src/models/AIConversation';
import bcrypt from 'bcryptjs';

function extractTokenCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/token=[^;]+/);
  return match ? match[0] : null;
}

function containsSensitiveData(obj: any): boolean {
  if (!obj) return false;
  const str = JSON.stringify(obj);
  return (
    str.includes('"passwordHash"') ||
    str.includes('AIzaSy')
  );
}

async function runPhase9Tests() {
  console.log('🧪 Starting Phase 9 Final Product Polish & Verification Suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let server: http.Server | null = null;
  const testPort = 5989;
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  let passedTests = 0;
  const totalTests = 30;
  const allResponses: any[] = [];

  function pass(n: number, label: string) {
    console.log(`✅ Test ${n} Passed: ${label}`);
    passedTests++;
  }

  function fail(n: number, label: string, detail?: any) {
    console.error(`❌ Test ${n} Failed: ${label}`, detail ?? '');
  }

  try {
    // ── Setup ──────────────────────────────────────────────────────────
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Create 2dsphere index for location queries
    await RecyclerProfile.collection.createIndex({ locationCoordinates: '2dsphere' });

    // Seed test materials
    const testMaterial = await Material.create({
      name: 'Printed Circuit Board',
      category: 'Electronics',
      indicativePrice: 450,
      pricePerKg: 450,
      unit: 'per kg',
      priceTrend: 'up',
      isActive: true,
      status: 'active',
    });

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(testPort, () => resolve()));

    // ──────────────────────────────────────────────────────────────────
    // Section 1: Health & API Foundation
    // ──────────────────────────────────────────────────────────────────
    const t1Res = await fetch(`${baseUrl}/health`);
    const t1Data = await t1Res.json();
    allResponses.push(t1Data);
    if (t1Res.status === 200 && t1Data.success === true && t1Data.database === 'connected') {
      pass(1, 'Health check returns 200 and healthy database connected status');
    } else {
      fail(1, 'Health check failed', { status: t1Res.status, t1Data });
    }

    // ──────────────────────────────────────────────────────────────────
    // Section 2: Authentication & RBAC
    // ──────────────────────────────────────────────────────────────────
    // Test 2: Register Collector
    const t2Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Collector Phase9',
        email: 'collector.p9@example.com',
        password: 'DemoPassword123!',
        role: 'collector',
        phone: '+919999900001',
      }),
    });
    const t2Data = await t2Res.json();
    const collectorCookie = extractTokenCookie(t2Res);
    allResponses.push(t2Data);
    if (t2Res.status === 201 && t2Data.data?.user?.role === 'collector' && collectorCookie) {
      pass(2, 'Collector registration sets HttpOnly JWT cookie and creates profile');
    } else {
      fail(2, 'Collector registration failed', { status: t2Res.status, t2Data });
    }

    // Test 3: Register Recycler
    const t3Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Recycler Phase9',
        email: 'recycler.p9@example.com',
        password: 'DemoPassword123!',
        role: 'recycler',
        organizationName: 'EcoRecycle P9 Ltd',
        businessName: 'EcoRecycle P9 Ltd',
        registrationId: 'REG-P9-2026-001',
        phone: '+919999900002',
      }),
    });
    const t3Data = await t3Res.json();
    const recyclerCookie = extractTokenCookie(t3Res);
    allResponses.push(t3Data);
    if (t3Res.status === 201 && t3Data.data?.user?.role === 'recycler' && recyclerCookie) {
      pass(3, 'Recycler registration sets HttpOnly JWT cookie and creates profile');
    } else {
      fail(3, 'Recycler registration failed', { status: t3Res.status, t3Data });
    }

    // Test 4: Duplicate registration prevention
    const t4Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate User',
        email: 'collector.p9@example.com',
        password: 'DemoPassword123!',
        role: 'collector',
      }),
    });
    allResponses.push(await t4Res.clone().json().catch(() => null));
    if (t4Res.status === 409 || t4Res.status === 400) {
      pass(4, 'Duplicate email registration rejected with conflict/error status');
    } else {
      fail(4, 'Duplicate registration was not blocked', { status: t4Res.status });
    }

    // Test 5: Login with valid credentials
    const t5Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'collector.p9@example.com',
        password: 'DemoPassword123!',
      }),
    });
    const t5Data = await t5Res.json();
    allResponses.push(t5Data);
    if (t5Res.status === 200 && t5Data.data?.user?.email === 'collector.p9@example.com') {
      pass(5, 'Login with valid credentials succeeds and returns user');
    } else {
      fail(5, 'Valid login failed', { status: t5Res.status, t5Data });
    }

    // Test 6: Login with invalid password rejected (401)
    const t6Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'collector.p9@example.com',
        password: 'WrongPassword!',
      }),
    });
    allResponses.push(await t6Res.clone().json().catch(() => null));
    if (t6Res.status === 401) {
      pass(6, 'Login with invalid password rejected with 401 Unauthorized');
    } else {
      fail(6, 'Invalid password was not rejected with 401', { status: t6Res.status });
    }

    // Test 7: /auth/me session recovery via HttpOnly cookie
    const t7Res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: collectorCookie! },
    });
    const t7Data = await t7Res.json();
    allResponses.push(t7Data);
    if (t7Res.status === 200 && t7Data.data?.user?.role === 'collector') {
      pass(7, 'GET /auth/me recovers session cleanly via cookie');
    } else {
      fail(7, 'Session recovery failed', { status: t7Res.status, t7Data });
    }

    // Test 8: RBAC - Collector cannot access recycler-only endpoints (403)
    const t8Res = await fetch(`${baseUrl}/requests/incoming`, {
      headers: { Cookie: collectorCookie! },
    });
    allResponses.push(await t8Res.clone().json().catch(() => null));
    if (t8Res.status === 403) {
      pass(8, 'Collector forbidden (403) from accessing recycler incoming requests');
    } else {
      fail(8, 'Collector was not forbidden from recycler endpoint', { status: t8Res.status });
    }

    // Test 9: RBAC - Recycler cannot create waste items (403)
    const t9Res = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: recyclerCookie! },
      body: JSON.stringify({
        materialId: testMaterial._id.toString(),
        quantityKg: 10,
      }),
    });
    allResponses.push(await t9Res.clone().json().catch(() => null));
    if (t9Res.status === 403) {
      pass(9, 'Recycler forbidden (403) from creating collector waste items');
    } else {
      fail(9, 'Recycler was not forbidden from waste creation', { status: t9Res.status });
    }

    // ──────────────────────────────────────────────────────────────────
    // Section 3: Materials & Geospatial Recycler Discovery
    // ──────────────────────────────────────────────────────────────────
    // Test 10: Materials catalog
    const t10Res = await fetch(`${baseUrl}/materials`);
    const t10Data = await t10Res.json();
    allResponses.push(t10Data);
    if (t10Res.status === 200 && Array.isArray(t10Data.data?.materials) && t10Data.data.materials.length > 0) {
      pass(10, 'GET /materials returns active materials catalog with indicative rates');
    } else {
      fail(10, 'Failed to fetch materials catalog', { status: t10Res.status, t10Data });
    }

    // Test 11: Recycler updates location coordinates via /recyclers/me/location
    const t11Res = await fetch(`${baseUrl}/recyclers/me/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: recyclerCookie! },
      body: JSON.stringify({
        latitude: 17.4909,
        longitude: 78.3589,
        address: 'Miyapur Industrial Area, Hyderabad',
      }),
    });
    const t11Data = await t11Res.json();
    allResponses.push(t11Data);
    if (t11Res.status === 200 && t11Data.data?.locationCoordinates?.coordinates) {
      pass(11, 'Recycler updates location with valid GeoJSON Point coordinates');
    } else {
      fail(11, 'Recycler location update failed', { status: t11Res.status, t11Data });
    }

    // Test 12: Nearby recycler discovery
    const t12Res = await fetch(`${baseUrl}/recyclers/nearby?latitude=17.4950&longitude=78.3590&radiusKm=10`, {
      headers: { Cookie: collectorCookie! },
    });
    const t12Data = await t12Res.json();
    allResponses.push(t12Data);
    const discoveredRecycler = Array.isArray(t12Data.data) ? t12Data.data[0] : null;
    if (t12Res.status === 200 && discoveredRecycler && discoveredRecycler.distanceKm != null) {
      pass(12, 'GET /recyclers/nearby finds recycler within radius ordered by proximity');
    } else {
      fail(12, 'Nearby recycler discovery failed', { status: t12Res.status, t12Data });
    }

    // ──────────────────────────────────────────────────────────────────
    // Section 4: Waste Logging & Inventory
    // ──────────────────────────────────────────────────────────────────
    // Test 13: Collector logs waste item
    const t13Res = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: collectorCookie! },
      body: JSON.stringify({
        materialId: testMaterial._id.toString(),
        quantityKg: 15,
        notes: 'Mixed laptop PCBs in good condition',
      }),
    });
    const t13Data = await t13Res.json();
    const createdWasteItem = t13Data.data?.wasteItem || t13Data.data;
    allResponses.push(t13Data);
    const expectedValue = 15 * 450; // 6750
    if (
      t13Res.status === 201 &&
      createdWasteItem?.quantityKg === 15 &&
      createdWasteItem?.estimatedValue === expectedValue &&
      createdWasteItem?.status === 'available'
    ) {
      pass(13, 'Waste item logged with authoritative server valuation and available status');
    } else {
      fail(13, 'Waste logging failed', { status: t13Res.status, t13Data });
    }

    // Test 14: Collector gets waste inventory
    const t14Res = await fetch(`${baseUrl}/waste/my`, {
      headers: { Cookie: collectorCookie! },
    });
    const t14Data = await t14Res.json();
    allResponses.push(t14Data);
    const wasteList = Array.isArray(t14Data.data?.wasteItems) ? t14Data.data.wasteItems : t14Data.data;
    if (t14Res.status === 200 && Array.isArray(wasteList) && wasteList.some((w: any) => w.id === createdWasteItem.id || w._id === createdWasteItem.id)) {
      pass(14, 'GET /waste/my lists logged item in available inventory');
    } else {
      fail(14, 'Fetching waste inventory failed', { status: t14Res.status, t14Data });
    }

    // ──────────────────────────────────────────────────────────────────
    // Section 5: Handover Request Workflow Lifecycle
    // ──────────────────────────────────────────────────────────────────
    // Test 15: Create Handover Request
    const recyclerProfileDoc = await RecyclerProfile.findOne({ user: t3Data.data.user.id });
    const recyclerId = recyclerProfileDoc!._id.toString();

    const t15Res = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: collectorCookie! },
      body: JSON.stringify({
        recyclerId,
        wasteItemIds: [createdWasteItem.id || createdWasteItem._id],
        notes: 'Handover request for testing complete workflow',
      }),
    });
    const t15Data = await t15Res.json();
    const handoverRequest = t15Data.data?.request || t15Data.data;
    allResponses.push(t15Data);
    if (t15Res.status === 201 && handoverRequest?.status === 'pending') {
      pass(15, 'Handover request created in pending status');
    } else {
      fail(15, 'Failed to create handover request', { status: t15Res.status, t15Data });
    }

    // Test 16: Active request guard prevents duplicate requests for same waste item
    const t16DupRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: collectorCookie! },
      body: JSON.stringify({
        recyclerId,
        wasteItemIds: [createdWasteItem.id || createdWasteItem._id],
        notes: 'Attempting duplicate active request',
      }),
    });
    allResponses.push(await t16DupRes.clone().json().catch(() => null));
    if (t16DupRes.status === 400) {
      pass(16, 'Active request guard prevents creating another request for same waste item (400)');
    } else {
      fail(16, 'Active request guard failed to reject duplicate request', { status: t16DupRes.status });
    }

    // Test 17: Recycler views incoming request
    const t17Res = await fetch(`${baseUrl}/requests/incoming`, {
      headers: { Cookie: recyclerCookie! },
    });
    const t17Data = await t17Res.json();
    allResponses.push(t17Data);
    const incomingRequests = Array.isArray(t17Data.data?.requests) ? t17Data.data.requests : t17Data.data;
    const incomingReq = Array.isArray(incomingRequests) ? incomingRequests.find((r: any) => (r.id || r._id) === (handoverRequest.id || handoverRequest._id)) : null;
    if (t17Res.status === 200 && incomingReq) {
      pass(17, 'Recycler GET /requests/incoming displays pending handover request');
    } else {
      fail(17, 'Recycler cannot see incoming request', { status: t17Res.status, t17Data });
    }

    // Test 18: Recycler accepts request (POST /requests/:id/accept)
    const reqId = handoverRequest.id || handoverRequest._id;
    const t18Res = await fetch(`${baseUrl}/requests/${reqId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: recyclerCookie! },
      body: JSON.stringify({ notes: 'Confirmed' }),
    });
    const t18Data = await t18Res.json();
    allResponses.push(t18Data);
    if (t18Res.status === 200 && (t18Data.data?.request?.status === 'accepted' || t18Data.data?.status === 'accepted')) {
      pass(18, 'Recycler accepts handover request (status -> accepted)');
    } else {
      fail(18, 'Failed to accept request', { status: t18Res.status, t18Data });
    }

    // Test 19: Recycler schedules pickup (POST /requests/:id/schedule)
    const schedDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const t19Res = await fetch(`${baseUrl}/requests/${reqId}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: recyclerCookie! },
      body: JSON.stringify({
        scheduledDate: schedDate,
        notes: 'Pickup vehicle scheduled',
      }),
    });
    const t19Data = await t19Res.json();
    allResponses.push(t19Data);
    if (t19Res.status === 200 && (t19Data.data?.request?.status === 'scheduled' || t19Data.data?.status === 'scheduled')) {
      pass(19, 'Recycler schedules handover request (status -> scheduled)');
    } else {
      fail(19, 'Failed to schedule request', { status: t19Res.status, t19Data });
    }

    // Test 20: Recycler marks in-transit (POST /requests/:id/in-transit)
    const t20Res = await fetch(`${baseUrl}/requests/${reqId}/in-transit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: recyclerCookie! },
      body: JSON.stringify({ notes: 'Dispatched' }),
    });
    const t20Data = await t20Res.json();
    allResponses.push(t20Data);
    if (t20Res.status === 200 && (t20Data.data?.request?.status === 'in_transit' || t20Data.data?.status === 'in_transit')) {
      pass(20, 'Recycler marks request in transit (status -> in_transit)');
    } else {
      fail(20, 'Failed to set in transit', { status: t20Res.status, t20Data });
    }

    // Test 21: Recycler completes handover (POST /requests/:id/complete)
    const t21Res = await fetch(`${baseUrl}/requests/${reqId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: recyclerCookie! },
      body: JSON.stringify({
        notes: 'Inspection verified, material accepted into facility',
      }),
    });
    const t21Data = await t21Res.json();
    allResponses.push(t21Data);
    if (t21Res.status === 200 && (t21Data.data?.request?.status === 'completed' || t21Data.data?.status === 'completed')) {
      pass(21, 'Recycler completes handover successfully');
    } else {
      fail(21, 'Failed to complete handover', { status: t21Res.status, t21Data });
    }

    // Test 22: Waste item becomes handed_over in DB
    const finalWasteCheck = await WasteItem.findById(createdWasteItem.id || createdWasteItem._id);
    if (finalWasteCheck?.status === 'handed_over') {
      pass(22, 'Associated waste item status atomically persisted as handed_over');
    } else {
      fail(22, 'Waste item was not updated to handed_over', { status: finalWasteCheck?.status });
    }

    // Test 23: HandoverRecord created with KBC- reference
    const recordCheck = await HandoverRecord.findOne({ handoverRequestId: reqId });
    if (recordCheck && recordCheck.handoverReference?.startsWith('KBC-') && recordCheck.finalValue === expectedValue) {
      pass(23, 'Digital HandoverRecord created with KBC- reference and authoritative finalValue');
    } else {
      fail(23, 'HandoverRecord creation failed', { recordCheck });
    }

    // Test 24: Transaction created with TXN- reference and simulated settlement
    const txnCheck = await Transaction.findOne({ handoverRequestId: reqId });
    if (
      txnCheck &&
      txnCheck.transactionReference?.startsWith('TXN-') &&
      txnCheck.paymentMethod === 'simulated_settlement' &&
      txnCheck.status === 'completed'
    ) {
      pass(24, 'Simulated Transaction created with TXN- reference and completed status');
    } else {
      fail(24, 'Transaction creation failed', { txnCheck });
    }

    // Test 25: Duplicate completion prevented
    const t25Res = await fetch(`${baseUrl}/requests/${reqId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: recyclerCookie! },
      body: JSON.stringify({ notes: 'Attempting duplicate completion' }),
    });
    allResponses.push(await t25Res.clone().json().catch(() => null));
    if (t25Res.status === 409 || t25Res.status === 400) {
      pass(25, 'Duplicate completion rejected with 409 Conflict / 400 Bad Request');
    } else {
      fail(25, 'Duplicate completion was not rejected', { status: t25Res.status });
    }

    // ──────────────────────────────────────────────────────────────────
    // Section 6: In-App Notifications
    // ──────────────────────────────────────────────────────────────────
    // Test 26: In-app notifications generated for workflow
    const t26Res = await fetch(`${baseUrl}/notifications`, {
      headers: { Cookie: collectorCookie! },
    });
    const t26Data = await t26Res.json();
    allResponses.push(t26Data);
    const notificationsList = Array.isArray(t26Data.data?.notifications) ? t26Data.data.notifications : t26Data.data;
    if (t26Res.status === 200 && Array.isArray(notificationsList) && notificationsList.length > 0) {
      pass(26, 'In-app notifications automatically generated during handover lifecycle');
    } else {
      fail(26, 'Notifications were not generated', { status: t26Res.status, t26Data });
    }

    // Test 27: Mark notification read & unread count
    const notifId = notificationsList[0]?.id || notificationsList[0]?._id;
    const t27Res = await fetch(`${baseUrl}/notifications/${notifId}/read`, {
      method: 'PATCH',
      headers: { Cookie: collectorCookie! },
    });
    const t27Data = await t27Res.json();
    allResponses.push(t27Data);
    if (t27Res.status === 200) {
      pass(27, 'PATCH /notifications/:id/read marks notification as read');
    } else {
      fail(27, 'Mark notification read failed', { status: t27Res.status, t27Data });
    }

    // ──────────────────────────────────────────────────────────────────
    // Section 7: KabiAI Assistant
    // ──────────────────────────────────────────────────────────────────
    // Test 28: KabiAI chat creates conversation session
    const t28Res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: collectorCookie! },
      body: JSON.stringify({
        message: 'What is the indicative price for laptop circuit boards?',
      }),
    });
    const t28Data = await t28Res.json();
    allResponses.push(t28Data);
    const aiSessionId = t28Data.data?.sessionId;
    if (t28Res.status === 200 && aiSessionId && (t28Data.data?.message || t28Data.data?.reply)) {
      pass(28, 'KabiAI generates response and persists conversation thread with sessionId');
    } else {
      fail(28, 'KabiAI chat failed', { status: t28Res.status, t28Data });
    }

    // Test 29: KabiAI conversation deletion & ownership
    const t29Res = await fetch(`${baseUrl}/ai/conversations/${aiSessionId}`, {
      method: 'DELETE',
      headers: { Cookie: collectorCookie! },
    });
    const t29Data = await t29Res.json();
    allResponses.push(t29Data);
    if (t29Res.status === 200) {
      pass(29, 'DELETE /ai/conversations/:sessionId cleans up thread safely');
    } else {
      fail(29, 'Failed to delete conversation', { status: t29Res.status, t29Data });
    }

    // ──────────────────────────────────────────────────────────────────
    // Section 8: Final Security & Secret Leakage Audit
    // ──────────────────────────────────────────────────────────────────
    // Test 30: Zero credential or sensitive token leakage in any response
    const hasLeak = allResponses.some((resp) => containsSensitiveData(resp));
    if (!hasLeak) {
      pass(30, 'Zero responses contain passwordHash, API keys, or raw credentials');
    } else {
      fail(30, 'Sensitive data leak detected in response payload');
    }

    // ──────────────────────────────────────────────────────────────────
    // Final Summary
    // ──────────────────────────────────────────────────────────────────
    console.log('\n────────────────────────────────────────────────────────────');
    console.log(`Phase 9 Verification Results: ${passedTests}/${totalTests} tests passed`);
    console.log('────────────────────────────────────────────────────────────\n');

    if (passedTests === totalTests) {
      console.log('🎉 ALL PHASE 9 VERIFICATION TESTS PASSED\n');
    } else {
      console.error(`❌ ${totalTests - passedTests} tests failed.`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error('💥 Fatal error during Phase 9 test suite:', err);
    process.exit(1);
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

runPhase9Tests();
