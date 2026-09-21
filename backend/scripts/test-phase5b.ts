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
import {
  createNotification,
  safeCreateNotification,
  createSystemNotification,
} from '../src/services/notificationService';
import bcrypt from 'bcryptjs';

function extractTokenCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/token=[^;]+/);
  return match ? match[0] : null;
}

async function runPhase5bTests() {
  console.log('🧪 Starting Phase 5B Notification Reliability & Completeness Test Suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let server: http.Server | null = null;
  const testPort = 5993;
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  let passedTests = 0;
  const totalTests = 30;
  const allResponsesToCheckForSensitiveData: any[] = [];

  try {
    // 0. Setup in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    const salt = await bcrypt.genSalt(10);
    const demoPasswordHash = await bcrypt.hash('DemoPassword123!', salt);

    // Seed Collector 1 & Collector 2
    const collector1 = await User.create({
      name: 'Ravi Kumar (Collector 1)',
      email: 'collector1@demo.com',
      passwordHash: demoPasswordHash,
      role: 'collector',
      isVerified: true,
    });
    await CollectorProfile.create({ user: collector1._id });

    const collector2 = await User.create({
      name: 'Sita Sharma (Collector 2)',
      email: 'collector2@demo.com',
      passwordHash: demoPasswordHash,
      role: 'collector',
      isVerified: true,
    });
    await CollectorProfile.create({ user: collector2._id });

    // Seed Recycler
    const recyclerUser1 = await User.create({
      name: 'EcoGreen Recyclers',
      email: 'recycler1@demo.com',
      passwordHash: demoPasswordHash,
      role: 'recycler',
      isVerified: true,
    });
    const recyclerProfile1 = await RecyclerProfile.create({
      user: recyclerUser1._id,
      organizationName: 'EcoGreen Recyclers Pvt Ltd',
      businessName: 'EcoGreen Recyclers',
      registrationId: 'REG-HYD-001',
      facilityType: 'authorized_dismantler',
      location: 'Cherlapally, Hyderabad',
      address: 'Plot 42, IDA Cherlapally',
      capacityKgPerDay: 2500,
      verificationStatus: 'verified',
    });

    // Seed Material
    const material = await Material.create({
      name: 'Electronic Scrap Grade A',
      category: 'Circuits',
      pricePerKg: 350,
      unit: 'kg',
      isActive: true,
    });

    // Seed Waste Items
    const waste1 = await WasteItem.create({
      collectorId: collector1._id,
      materialId: material._id,
      quantityKg: 10,
      estimatedPricePerKg: 350,
      estimatedValue: 3500,
      status: 'available',
    });

    // Start Express server
    await new Promise<void>((resolve) => {
      server = app.listen(testPort, () => resolve());
    });

    // Helper login
    async function login(email: string): Promise<string> {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'DemoPassword123!' }),
      });
      const data = await res.json();
      allResponsesToCheckForSensitiveData.push(data);
      const cookie = extractTokenCookie(res);
      if (!cookie) throw new Error(`Failed to login as ${email}`);
      return cookie;
    }

    const c1Cookie = await login('collector1@demo.com');
    const c2Cookie = await login('collector2@demo.com');
    const r1Cookie = await login('recycler1@demo.com');

    // -------------------------------------------------------------
    // Workflow Step A: Create Request
    // -------------------------------------------------------------
    const createReqRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: c1Cookie,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile1._id.toString(),
        wasteItemIds: [waste1._id.toString()],
        notes: 'Handover request for testing metadata & reliability',
      }),
    });
    const createReqData = await createReqRes.json();
    allResponsesToCheckForSensitiveData.push(createReqData);
    const requestId = createReqData.data?.request?.id || createReqData.data?.request?._id;

    // Test 3: Metadata exists for request_created
    const notifCreated = await Notification.findOne({
      userId: recyclerUser1._id,
      type: 'request_created',
      relatedEntityId: requestId,
    });

    if (
      notifCreated &&
      notifCreated.metadata?.requestId === requestId &&
      notifCreated.metadata?.status === 'pending' &&
      notifCreated.metadata?.totalQuantityKg === 10
    ) {
      console.log('✅ Test 3 Passed: Metadata accurately populated for request_created');
      passedTests++;
    } else {
      console.error('❌ Test 3 Failed: Metadata missing or inaccurate for request_created', notifCreated);
    }

    // Test 9: eventKey is server-generated
    if (notifCreated?.eventKey === `request_created:${requestId}:${recyclerUser1._id}`) {
      console.log(`✅ Test 9 Passed: eventKey is server-generated (${notifCreated.eventKey})`);
      passedTests++;
    } else {
      console.error('❌ Test 9 Failed: eventKey mismatch', notifCreated?.eventKey);
    }

    // Test 11: Duplicate request_created event does not create duplicate notification
    const dupCreatedNotif = await safeCreateNotification({
      userId: recyclerUser1._id,
      type: 'request_created',
      title: 'New Handover Request Duplicate Attempt',
      message: 'Duplicate attempt message',
      relatedEntityType: 'HandoverRequest',
      relatedEntityId: requestId,
      eventKey: `request_created:${requestId}:${recyclerUser1._id}`,
      metadata: { requestId, status: 'pending' },
    });

    const countReqCreated = await Notification.countDocuments({
      eventKey: `request_created:${requestId}:${recyclerUser1._id}`,
    });

    if (countReqCreated === 1 && dupCreatedNotif?.id === notifCreated?.id) {
      console.log('✅ Test 11 Passed: Duplicate request_created event safely suppressed by eventKey');
      passedTests++;
    } else {
      console.error('❌ Test 11 Failed: Duplicate request_created created multiple records', countReqCreated);
    }

    // -------------------------------------------------------------
    // Workflow Step B: Recycler Accepts Request
    // -------------------------------------------------------------
    const acceptRes = await fetch(`${baseUrl}/requests/${requestId}/accept`, {
      method: 'POST',
      headers: { Cookie: r1Cookie },
    });
    const acceptData = await acceptRes.json();
    allResponsesToCheckForSensitiveData.push(acceptData);

    // Test 4: Metadata exists for request_accepted
    const notifAccepted = await Notification.findOne({
      userId: collector1._id,
      type: 'request_accepted',
      relatedEntityId: requestId,
    });

    if (
      notifAccepted &&
      notifAccepted.metadata?.requestId === requestId &&
      notifAccepted.metadata?.status === 'accepted'
    ) {
      console.log('✅ Test 4 Passed: Metadata accurately populated for request_accepted');
      passedTests++;
    } else {
      console.error('❌ Test 4 Failed: Metadata missing for request_accepted', notifAccepted);
    }

    // Test 12: Duplicate accept attempt does not create duplicate notification
    // Attempting to accept an already accepted request is rejected by state machine with 400
    const dupAcceptRes = await fetch(`${baseUrl}/requests/${requestId}/accept`, {
      method: 'POST',
      headers: { Cookie: r1Cookie },
    });
    const dupAcceptData = await dupAcceptRes.json();
    allResponsesToCheckForSensitiveData.push(dupAcceptData);

    const countReqAccepted = await Notification.countDocuments({
      userId: collector1._id,
      type: 'request_accepted',
      relatedEntityId: requestId,
    });

    if (dupAcceptRes.status === 400 && countReqAccepted === 1) {
      console.log('✅ Test 12 Passed: Duplicate accept attempt does not create duplicate notification');
      passedTests++;
    } else {
      console.error('❌ Test 12 Failed: Duplicate accept created duplicate notification', countReqAccepted);
    }

    // -------------------------------------------------------------
    // Workflow Step C: Recycler Schedules Request
    // -------------------------------------------------------------
    const schedDate = new Date();
    schedDate.setDate(schedDate.getDate() + 5);
    const schedDateStr = schedDate.toISOString().split('T')[0];

    const schedRes = await fetch(`${baseUrl}/requests/${requestId}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: r1Cookie,
      },
      body: JSON.stringify({ scheduledDate: schedDateStr }),
    });
    const schedData = await schedRes.json();
    allResponsesToCheckForSensitiveData.push(schedData);

    // Test 5: Metadata exists for request_scheduled
    const notifScheduled = await Notification.findOne({
      userId: collector1._id,
      type: 'request_scheduled',
      relatedEntityId: requestId,
    });

    if (
      notifScheduled &&
      notifScheduled.metadata?.requestId === requestId &&
      notifScheduled.metadata?.status === 'scheduled'
    ) {
      console.log('✅ Test 5 Passed: Metadata accurately populated for request_scheduled');
      passedTests++;
    } else {
      console.error('❌ Test 5 Failed: Metadata missing for request_scheduled', notifScheduled);
    }

    // Test 13: Duplicate schedule event does not create duplicate notification
    const dupSchedRes = await fetch(`${baseUrl}/requests/${requestId}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: r1Cookie,
      },
      body: JSON.stringify({ scheduledDate: schedDateStr }),
    });
    const dupSchedData = await dupSchedRes.json();
    allResponsesToCheckForSensitiveData.push(dupSchedData);

    const countReqScheduled = await Notification.countDocuments({
      userId: collector1._id,
      type: 'request_scheduled',
      relatedEntityId: requestId,
    });

    if (dupSchedRes.status === 400 && countReqScheduled === 1) {
      console.log('✅ Test 13 Passed: Duplicate schedule event safely rejected and does not duplicate notification');
      passedTests++;
    } else {
      console.error('❌ Test 13 Failed: Duplicate schedule event created extra notification', countReqScheduled);
    }

    // -------------------------------------------------------------
    // Workflow Step D: Move to In-Transit
    // -------------------------------------------------------------
    const inTransitRes = await fetch(`${baseUrl}/requests/${requestId}/in-transit`, {
      method: 'POST',
      headers: { Cookie: c1Cookie },
    });
    const inTransitData = await inTransitRes.json();
    allResponsesToCheckForSensitiveData.push(inTransitData);

    // Test 6: Metadata exists for request_in_transit
    const notifInTransit = await Notification.findOne({
      userId: recyclerUser1._id,
      type: 'request_in_transit',
      relatedEntityId: requestId,
    });

    if (
      notifInTransit &&
      notifInTransit.metadata?.requestId === requestId &&
      notifInTransit.metadata?.status === 'in_transit'
    ) {
      console.log('✅ Test 6 Passed: Metadata accurately populated for request_in_transit');
      passedTests++;
    } else {
      console.error('❌ Test 6 Failed: Metadata missing for request_in_transit', notifInTransit);
    }

    // Test 14: Duplicate in-transit event does not create duplicate notification
    const dupInTransitRes = await fetch(`${baseUrl}/requests/${requestId}/in-transit`, {
      method: 'POST',
      headers: { Cookie: c1Cookie },
    });
    const dupInTransitData = await dupInTransitRes.json();
    allResponsesToCheckForSensitiveData.push(dupInTransitData);

    const countInTransit = await Notification.countDocuments({
      userId: recyclerUser1._id,
      type: 'request_in_transit',
      relatedEntityId: requestId,
    });

    if (dupInTransitRes.status === 400 && countInTransit === 1) {
      console.log('✅ Test 14 Passed: Duplicate in-transit event rejected without duplicate notification');
      passedTests++;
    } else {
      console.error('❌ Test 14 Failed: Duplicate in-transit produced extra notification', countInTransit);
    }

    // -------------------------------------------------------------
    // Workflow Step E: Complete Request
    // -------------------------------------------------------------
    const compRes = await fetch(`${baseUrl}/requests/${requestId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: r1Cookie,
      },
      body: JSON.stringify({ notes: 'Handover complete' }),
    });
    const compData = await compRes.json();
    allResponsesToCheckForSensitiveData.push(compData);

    const handoverRecordId = compData.data?.handoverRecord?.id || compData.data?.handoverRecord?._id;
    const transactionId = compData.data?.transaction?.id || compData.data?.transaction?._id;

    // Test 7: Completion metadata includes requestId/handoverRecordId
    const notifCompleted = await Notification.findOne({
      userId: collector1._id,
      type: 'request_completed',
    });

    if (
      notifCompleted &&
      notifCompleted.metadata?.requestId === requestId &&
      notifCompleted.metadata?.handoverRecordId === handoverRecordId &&
      notifCompleted.metadata?.status === 'completed'
    ) {
      console.log('✅ Test 7 Passed: Completion metadata accurately includes requestId, handoverRecordId, and status');
      passedTests++;
    } else {
      console.error('❌ Test 7 Failed: Completion metadata mismatch', notifCompleted);
    }

    // Test 8: Transaction metadata includes transactionId/amount/currency
    const notifTxn = await Notification.findOne({
      userId: collector1._id,
      type: 'transaction_created',
    });

    if (
      notifTxn &&
      notifTxn.metadata?.transactionId === transactionId &&
      notifTxn.metadata?.amount === 3500 &&
      notifTxn.metadata?.currency === 'INR'
    ) {
      console.log('✅ Test 8 Passed: Transaction metadata accurately includes transactionId, amount, and currency');
      passedTests++;
    } else {
      console.error('❌ Test 8 Failed: Transaction metadata mismatch', notifTxn);
    }

    // Test 15 & 16: Duplicate completion attempt does not create duplicate notification or transaction notification
    const dupCompRes = await fetch(`${baseUrl}/requests/${requestId}/complete`, {
      method: 'POST',
      headers: { Cookie: r1Cookie },
    });
    const dupCompData = await dupCompRes.json();
    allResponsesToCheckForSensitiveData.push(dupCompData);

    const countCompNotifs = await Notification.countDocuments({
      userId: collector1._id,
      type: 'request_completed',
    });
    const countTxnNotifs = await Notification.countDocuments({
      userId: collector1._id,
      type: 'transaction_created',
    });

    if (dupCompRes.status === 409 && countCompNotifs === 1 && countTxnNotifs === 1) {
      console.log('✅ Tests 15 & 16 Passed: Duplicate completion attempt rejected (409) without duplicate notifications');
      passedTests += 2;
    } else {
      console.error('❌ Tests 15 & 16 Failed: Duplicate completion created duplicate notifications', {
        countCompNotifs,
        countTxnNotifs,
      });
    }

    // Test 27 & 28: Phase 4B completion still creates exactly one HandoverRecord and one Transaction
    const totalRecords = await HandoverRecord.countDocuments({ handoverRequestId: requestId });
    const totalTxns = await Transaction.countDocuments({ handoverRequestId: requestId });

    if (totalRecords === 1 && totalTxns === 1) {
      console.log('✅ Tests 27 & 28 Passed: Phase 4B completion preserved exactly one HandoverRecord and one Transaction');
      passedTests += 2;
    } else {
      console.error('❌ Tests 27 & 28 Failed: Record/Transaction counts mismatch', { totalRecords, totalTxns });
    }

    // Test 29: Waste still becomes handed_over
    const updatedWaste = await WasteItem.findById(waste1._id);
    if (updatedWaste?.status === 'handed_over') {
      console.log('✅ Test 29 Passed: Associated waste item status correctly transitioned to handed_over');
      passedTests++;
    } else {
      console.error('❌ Test 29 Failed: Waste item status is not handed_over', updatedWaste?.status);
    }

    // Test 30: Completed request remains immutable
    const cancelCompletedRes = await fetch(`${baseUrl}/requests/${requestId}/cancel`, {
      method: 'POST',
      headers: { Cookie: c1Cookie },
    });
    const cancelCompletedData = await cancelCompletedRes.json();
    allResponsesToCheckForSensitiveData.push(cancelCompletedData);

    if (cancelCompletedRes.status === 400 && !cancelCompletedData.success) {
      console.log('✅ Test 30 Passed: Completed request remains immutable against cancellation/modification');
      passedTests++;
    } else {
      console.error('❌ Test 30 Failed: Completed request allowed cancellation', cancelCompletedData);
    }

    // -------------------------------------------------------------
    // Test 1: Existing Phase 5A notification retrieval still works
    // -------------------------------------------------------------
    const getNotifsRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Cookie: c1Cookie },
    });
    const getNotifsData = await getNotifsRes.json();
    allResponsesToCheckForSensitiveData.push(getNotifsData);

    if (getNotifsRes.status === 200 && Array.isArray(getNotifsData.data) && getNotifsData.data.length >= 3) {
      console.log(`✅ Test 1 Passed: Notification retrieval works (${getNotifsData.data.length} notifications)`);
      passedTests++;
    } else {
      console.error('❌ Test 1 Failed: Could not retrieve notifications', getNotifsData);
    }

    const testNotifId = getNotifsData.data[0].id || getNotifsData.data[0]._id;

    // -------------------------------------------------------------
    // Test 2: Existing Phase 5A read/unread behavior still works
    // -------------------------------------------------------------
    const readRes = await fetch(`${baseUrl}/notifications/${testNotifId}/read`, {
      method: 'PATCH',
      headers: { Cookie: c1Cookie },
    });
    const readData = await readRes.json();
    allResponsesToCheckForSensitiveData.push(readData);

    const unreadRes = await fetch(`${baseUrl}/notifications/${testNotifId}/unread`, {
      method: 'PATCH',
      headers: { Cookie: c1Cookie },
    });
    const unreadData = await unreadRes.json();
    allResponsesToCheckForSensitiveData.push(unreadData);

    if (
      readRes.status === 200 &&
      readData.data?.notification?.isRead === true &&
      unreadRes.status === 200 &&
      unreadData.data?.notification?.isRead === false
    ) {
      console.log('✅ Test 2 Passed: Read/unread toggling works as expected');
      passedTests++;
    } else {
      console.error('❌ Test 2 Failed: Read/unread toggling failed', { readData, unreadData });
    }

    // -------------------------------------------------------------
    // Test 10: Client cannot inject eventKey (API doesn't allow external notification creation)
    // -------------------------------------------------------------
    // Test 26: Normal user has no public endpoint to create arbitrary notifications
    const fakePostRes = await fetch(`${baseUrl}/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: c1Cookie,
      },
      body: JSON.stringify({
        eventKey: 'spoofed_event_key',
        title: 'Hacked Notification',
        message: 'Forged notification',
      }),
    });
    const fakePostData = await fakePostRes.json();
    allResponsesToCheckForSensitiveData.push(fakePostData);

    if (fakePostRes.status === 404 || fakePostRes.status === 405) {
      console.log('✅ Tests 10 & 26 Passed: No public creation endpoint exists; client cannot inject eventKey or arbitrary notifications');
      passedTests += 2;
    } else {
      console.error('❌ Tests 10 & 26 Failed: Public notification creation was allowed', fakePostData);
    }

    // -------------------------------------------------------------
    // Test 17: Cross-user notification access remains blocked (403)
    // -------------------------------------------------------------
    const crossGetRes = await fetch(`${baseUrl}/notifications/${testNotifId}`, {
      headers: { Cookie: c2Cookie }, // Collector 2 trying to read Collector 1's notification
    });
    const crossGetData = await crossGetRes.json();
    allResponsesToCheckForSensitiveData.push(crossGetData);

    if (crossGetRes.status === 403 && !crossGetData.success) {
      console.log("✅ Test 17 Passed: Cross-user notification access remains blocked (403 Forbidden)");
      passedTests++;
    } else {
      console.error("❌ Test 17 Failed: Allowed cross-user access", crossGetData);
    }

    // -------------------------------------------------------------
    // Test 18: Cross-user read/unread remains blocked (403)
    // -------------------------------------------------------------
    const crossReadRes = await fetch(`${baseUrl}/notifications/${testNotifId}/read`, {
      method: 'PATCH',
      headers: { Cookie: c2Cookie },
    });
    const crossReadData = await crossReadRes.json();
    allResponsesToCheckForSensitiveData.push(crossReadData);

    if (crossReadRes.status === 403 && !crossReadData.success) {
      console.log("✅ Test 18 Passed: Cross-user read modification remains blocked (403 Forbidden)");
      passedTests++;
    } else {
      console.error("❌ Test 18 Failed: Cross-user read modification allowed", crossReadData);
    }

    // -------------------------------------------------------------
    // Test 19: Notification ownership cannot be changed
    // -------------------------------------------------------------
    // Verify in DB that testNotifId still belongs exclusively to collector1
    const notifDbCheck = await Notification.findById(testNotifId);
    if (notifDbCheck?.userId.toString() === collector1._id.toString()) {
      console.log('✅ Test 19 Passed: Notification ownership is immutable and protected');
      passedTests++;
    } else {
      console.error('❌ Test 19 Failed: Notification ownership altered', notifDbCheck);
    }

    // -------------------------------------------------------------
    // Test 20: Pagination remains correct (including page beyond total returns empty array)
    // -------------------------------------------------------------
    const beyondPageRes = await fetch(`${baseUrl}/notifications?page=999&limit=20`, {
      headers: { Cookie: c1Cookie },
    });
    const beyondPageData = await beyondPageRes.json();
    allResponsesToCheckForSensitiveData.push(beyondPageData);

    if (
      beyondPageRes.status === 200 &&
      Array.isArray(beyondPageData.data) &&
      beyondPageData.data.length === 0 &&
      beyondPageData.pagination?.page === 999
    ) {
      console.log('✅ Test 20 Passed: Pagination beyond total returns empty array without error');
      passedTests++;
    } else {
      console.error('❌ Test 20 Failed: Pagination beyond total handled incorrectly', beyondPageData);
    }

    // -------------------------------------------------------------
    // Test 21: unread-count remains correct
    // -------------------------------------------------------------
    const unreadCountRes = await fetch(`${baseUrl}/notifications/unread-count`, {
      headers: { Cookie: c1Cookie },
    });
    const unreadCountData = await unreadCountRes.json();
    allResponsesToCheckForSensitiveData.push(unreadCountData);

    const actualUnread = await Notification.countDocuments({
      userId: collector1._id,
      isRead: false,
    });

    if (unreadCountRes.status === 200 && unreadCountData.data?.count === actualUnread) {
      console.log(`✅ Test 21 Passed: unread-count accurately returned (${unreadCountData.data.count})`);
      passedTests++;
    } else {
      console.error('❌ Test 21 Failed: unread-count mismatch', unreadCountData);
    }

    // -------------------------------------------------------------
    // Test 22: read-all remains correct
    // -------------------------------------------------------------
    const readAllRes = await fetch(`${baseUrl}/notifications/read-all`, {
      method: 'PATCH',
      headers: { Cookie: c1Cookie },
    });
    const readAllData = await readAllRes.json();
    allResponsesToCheckForSensitiveData.push(readAllData);

    const unreadAfterReadAll = await Notification.countDocuments({
      userId: collector1._id,
      isRead: false,
    });

    if (readAllRes.status === 200 && unreadAfterReadAll === 0) {
      console.log('✅ Test 22 Passed: read-all marks all user notifications as read');
      passedTests++;
    } else {
      console.error('❌ Test 22 Failed: Unread notifications remain after read-all', unreadAfterReadAll);
    }

    // -------------------------------------------------------------
    // Test 25: System notification helper can create a valid system notification
    // -------------------------------------------------------------
    const sysNotif = await createSystemNotification({
      userId: collector2._id,
      title: 'Platform Maintenance Notice',
      message: 'Scheduled maintenance will occur on Sunday at 02:00 AM IST.',
      metadata: { maintenanceWindow: '2h' },
      eventKey: `system:maintenance:2026-10-01:${collector2._id}`,
    });

    if (
      sysNotif &&
      sysNotif.type === 'system' &&
      sysNotif.title === 'Platform Maintenance Notice' &&
      sysNotif.userId.toString() === collector2._id.toString()
    ) {
      console.log('✅ Test 25 Passed: System notification helper successfully created valid notification');
      passedTests++;
    } else {
      console.error('❌ Test 25 Failed: Could not create system notification', sysNotif);
    }

    // -------------------------------------------------------------
    // Tests 23 & 24: No passwordHash or sensitive auth data appears anywhere in responses or metadata
    // -------------------------------------------------------------
    let sensitiveFound = false;
    const jsonStrings = allResponsesToCheckForSensitiveData.map((r) => JSON.stringify(r));
    for (const json of jsonStrings) {
      if (
        json.includes('passwordHash') ||
        json.includes('$2a$') ||
        json.includes('$2b$') ||
        json.includes('jwtSecret')
      ) {
        sensitiveFound = true;
        break;
      }
    }

    if (!sensitiveFound) {
      console.log('✅ Tests 23 & 24 Passed: No passwordHash or sensitive authentication data appears in responses or metadata');
      passedTests += 2;
    } else {
      console.error('❌ Tests 23 & 24 Failed: Sensitive authentication data exposed in responses!');
      throw new Error('Security check failed: Sensitive auth data found');
    }

    console.log(`\n🎉 Phase 5B Notification Reliability & Completeness Tests Passed: ${passedTests}/${totalTests}`);

    if (passedTests !== totalTests) {
      throw new Error(`Only ${passedTests}/${totalTests} tests passed`);
    }
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

runPhase5bTests()
  .then(() => {
    console.log('All Phase 5B tests completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Phase 5B test suite failed:', err);
    process.exit(1);
  });
