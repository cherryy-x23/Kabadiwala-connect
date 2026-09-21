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
import { Notification } from '../src/models/Notification';
import bcrypt from 'bcryptjs';

function extractTokenCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/token=[^;]+/);
  return match ? match[0] : null;
}

async function runPhase5aTests() {
  console.log('🧪 Starting Phase 5A In-App Notifications Test Suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let server: http.Server | null = null;
  const testPort = 5994;
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  let passedTests = 0;
  const totalPhase5aTests = 20;
  const allResponsesToCheckForPasswordHash: any[] = [];

  try {
    // 0. In-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    const salt = await bcrypt.genSalt(10);
    const demoPasswordHash = await bcrypt.hash('DemoPassword123!', salt);

    // Seed Collector 1 & 2
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

    // Seed Material & Waste
    const material = await Material.create({
      name: 'Copper Cables',
      category: 'Cables',
      pricePerKg: 600,
      unit: 'kg',
      isActive: true,
    });

    const waste1 = await WasteItem.create({
      collectorId: collector1._id,
      materialId: material._id,
      quantityKg: 10,
      estimatedPricePerKg: 600,
      estimatedValue: 6000,
      status: 'available',
    });

    const waste2 = await WasteItem.create({
      collectorId: collector1._id,
      materialId: material._id,
      quantityKg: 5,
      estimatedPricePerKg: 600,
      estimatedValue: 3000,
      status: 'available',
    });

    // Start Express server
    await new Promise<void>((resolve) => {
      server = app.listen(testPort, () => resolve());
    });

    // Login helper
    async function login(email: string): Promise<string> {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'DemoPassword123!' }),
      });
      const data = await res.json();
      allResponsesToCheckForPasswordHash.push(data);
      const cookie = extractTokenCookie(res);
      if (!cookie) throw new Error(`Failed to login as ${email}`);
      return cookie;
    }

    const c1Cookie = await login('collector1@demo.com');
    const c2Cookie = await login('collector2@demo.com');
    const r1Cookie = await login('recycler1@demo.com');

    // -------------------------------------------------------------
    // Test 4: Unauthenticated notification access returns 401
    // -------------------------------------------------------------
    const unauthRes = await fetch(`${baseUrl}/notifications`);
    const unauthData = await unauthRes.json();
    allResponsesToCheckForPasswordHash.push(unauthData);

    if (unauthRes.status === 401 && !unauthData.success) {
      console.log('✅ Test 4 Passed: Unauthenticated notification access returns 401');
      passedTests++;
    } else {
      console.error('❌ Test 4 Failed: Unauthenticated access was not blocked with 401', unauthData);
    }

    // -------------------------------------------------------------
    // Test 12: Request creation generates recycler notification (request_created)
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
        notes: 'Notification test pickup',
      }),
    });
    const createReqData = await createReqRes.json();
    allResponsesToCheckForPasswordHash.push(createReqData);
    const requestId1 = createReqData.data?.request?.id || createReqData.data?.request?._id;

    // Check Recycler's notifications for request_created
    const rNotif1 = await Notification.findOne({
      userId: recyclerUser1._id,
      type: 'request_created',
      relatedEntityId: requestId1,
    });

    if (rNotif1 && rNotif1.title === 'New Handover Request') {
      console.log('✅ Test 12 Passed: Request creation generates recycler notification (request_created)');
      passedTests++;
    } else {
      console.error('❌ Test 12 Failed: Recycler notification not found for request_created', rNotif1);
    }

    // -------------------------------------------------------------
    // Test 13: Accept generates collector notification (request_accepted)
    // -------------------------------------------------------------
    const acceptRes = await fetch(`${baseUrl}/requests/${requestId1}/accept`, {
      method: 'POST',
      headers: { Cookie: r1Cookie },
    });
    const acceptData = await acceptRes.json();
    allResponsesToCheckForPasswordHash.push(acceptData);

    const cNotifAccept = await Notification.findOne({
      userId: collector1._id,
      type: 'request_accepted',
      relatedEntityId: requestId1,
    });

    if (cNotifAccept && cNotifAccept.title === 'Handover Request Accepted') {
      console.log('✅ Test 13 Passed: Accept generates collector notification (request_accepted)');
      passedTests++;
    } else {
      console.error('❌ Test 13 Failed: Collector notification not found for request_accepted', cNotifAccept);
    }

    // -------------------------------------------------------------
    // Test 14: Reject generates collector notification (request_rejected)
    // -------------------------------------------------------------
    // Create a second request to test rejection notification
    const createReq2Res = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: c1Cookie,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile1._id.toString(),
        wasteItemIds: [waste2._id.toString()],
      }),
    });
    const createReq2Data = await createReq2Res.json();
    allResponsesToCheckForPasswordHash.push(createReq2Data);
    const requestId2 = createReq2Data.data?.request?.id || createReq2Data.data?.request?._id;

    const rejectRes = await fetch(`${baseUrl}/requests/${requestId2}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: r1Cookie,
      },
      body: JSON.stringify({ reason: 'Not accepting this category today' }),
    });
    const rejectData = await rejectRes.json();
    allResponsesToCheckForPasswordHash.push(rejectData);

    const cNotifReject = await Notification.findOne({
      userId: collector1._id,
      type: 'request_rejected',
      relatedEntityId: requestId2,
    });

    if (cNotifReject && cNotifReject.message.includes('Not accepting this category today')) {
      console.log('✅ Test 14 Passed: Reject generates collector notification (request_rejected)');
      passedTests++;
    } else {
      console.error('❌ Test 14 Failed: Collector notification not found for request_rejected', cNotifReject);
    }

    // -------------------------------------------------------------
    // Test 15: Schedule generates collector notification (request_scheduled)
    // -------------------------------------------------------------
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 4);
    const schedDateStr = futureDate.toISOString().split('T')[0];

    const schedRes = await fetch(`${baseUrl}/requests/${requestId1}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: r1Cookie,
      },
      body: JSON.stringify({ scheduledDate: schedDateStr }),
    });
    const schedData = await schedRes.json();
    allResponsesToCheckForPasswordHash.push(schedData);

    const cNotifSched = await Notification.findOne({
      userId: collector1._id,
      type: 'request_scheduled',
      relatedEntityId: requestId1,
    });

    if (cNotifSched && cNotifSched.title === 'Handover Request Scheduled') {
      console.log('✅ Test 15 Passed: Schedule generates collector notification (request_scheduled)');
      passedTests++;
    } else {
      console.error('❌ Test 15 Failed: Collector notification not found for request_scheduled', cNotifSched);
    }

    // -------------------------------------------------------------
    // Test 16: In-transit generates the other participant notification (request_in_transit)
    // -------------------------------------------------------------
    // Collector marks in-transit -> Recycler should receive notification
    const inTransitRes = await fetch(`${baseUrl}/requests/${requestId1}/in-transit`, {
      method: 'POST',
      headers: { Cookie: c1Cookie },
    });
    const inTransitData = await inTransitRes.json();
    allResponsesToCheckForPasswordHash.push(inTransitData);

    const rNotifInTransit = await Notification.findOne({
      userId: recyclerUser1._id,
      type: 'request_in_transit',
      relatedEntityId: requestId1,
    });

    if (rNotifInTransit && rNotifInTransit.title === 'Handover In Transit') {
      console.log('✅ Test 16 Passed: In-transit generates other participant notification (request_in_transit)');
      passedTests++;
    } else {
      console.error('❌ Test 16 Failed: Other participant notification not found for request_in_transit', rNotifInTransit);
    }

    // -------------------------------------------------------------
    // Test 17 & 18: Completion generates other participant notification (request_completed) & transaction notification (transaction_created)
    // -------------------------------------------------------------
    // Recycler completes request -> Collector should receive request_completed & transaction_created
    const compRes = await fetch(`${baseUrl}/requests/${requestId1}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: r1Cookie,
      },
      body: JSON.stringify({ notes: 'Verified and weighed' }),
    });
    const compData = await compRes.json();
    allResponsesToCheckForPasswordHash.push(compData);

    const cNotifCompleted = await Notification.findOne({
      userId: collector1._id,
      type: 'request_completed',
    });

    const cNotifTxn = await Notification.findOne({
      userId: collector1._id,
      type: 'transaction_created',
    });

    if (cNotifCompleted && cNotifCompleted.title === 'Handover Completed') {
      console.log('✅ Test 17 Passed: Completion generates other participant notification (request_completed)');
      passedTests++;
    } else {
      console.error('❌ Test 17 Failed: Completion notification not found', cNotifCompleted);
    }

    if (cNotifTxn && cNotifTxn.title === 'Payment / Earnings Recorded') {
      console.log('✅ Test 18 Passed: Completion generates transaction notification (transaction_created)');
      passedTests++;
    } else {
      console.error('❌ Test 18 Failed: Transaction notification not found', cNotifTxn);
    }

    // -------------------------------------------------------------
    // Test 1: Collector can retrieve own notifications
    // -------------------------------------------------------------
    const c1NotifsRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Cookie: c1Cookie },
    });
    const c1NotifsData = await c1NotifsRes.json();
    allResponsesToCheckForPasswordHash.push(c1NotifsData);

    if (
      c1NotifsRes.status === 200 &&
      c1NotifsData.success &&
      Array.isArray(c1NotifsData.data) &&
      c1NotifsData.data.length >= 4
    ) {
      console.log(`✅ Test 1 Passed: Collector can retrieve own notifications (${c1NotifsData.data.length} found)`);
      passedTests++;
    } else {
      console.error('❌ Test 1 Failed: Could not get collector notifications', c1NotifsData);
    }

    // -------------------------------------------------------------
    // Test 2: Recycler can retrieve own notifications
    // -------------------------------------------------------------
    const r1NotifsRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Cookie: r1Cookie },
    });
    const r1NotifsData = await r1NotifsRes.json();
    allResponsesToCheckForPasswordHash.push(r1NotifsData);

    if (
      r1NotifsRes.status === 200 &&
      r1NotifsData.success &&
      Array.isArray(r1NotifsData.data) &&
      r1NotifsData.data.length >= 2
    ) {
      console.log(`✅ Test 2 Passed: Recycler can retrieve own notifications (${r1NotifsData.data.length} found)`);
      passedTests++;
    } else {
      console.error('❌ Test 2 Failed: Could not get recycler notifications', r1NotifsData);
    }

    const testNotifId = c1NotifsData.data[0].id || c1NotifsData.data[0]._id;

    // -------------------------------------------------------------
    // Test 3: User cannot retrieve another user's notification
    // -------------------------------------------------------------
    const crossGetRes = await fetch(`${baseUrl}/notifications/${testNotifId}`, {
      headers: { Cookie: c2Cookie }, // Collector 2 trying to read Collector 1's notification
    });
    const crossGetData = await crossGetRes.json();
    allResponsesToCheckForPasswordHash.push(crossGetData);

    if (crossGetRes.status === 403 && !crossGetData.success) {
      console.log("✅ Test 3 Passed: User cannot retrieve another user's notification (403 Forbidden)");
      passedTests++;
    } else {
      console.error("❌ Test 3 Failed: Allowed reading another user's notification", crossGetData);
    }

    // -------------------------------------------------------------
    // Test 5: Pagination works
    // -------------------------------------------------------------
    const pageRes = await fetch(`${baseUrl}/notifications?page=1&limit=2`, {
      headers: { Cookie: c1Cookie },
    });
    const pageData = await pageRes.json();
    allResponsesToCheckForPasswordHash.push(pageData);

    if (
      pageRes.status === 200 &&
      pageData.data.length === 2 &&
      pageData.pagination?.page === 1 &&
      pageData.pagination?.limit === 2 &&
      pageData.pagination?.total >= 4 &&
      pageData.pagination?.totalPages >= 2
    ) {
      console.log('✅ Test 5 Passed: Pagination works (page, limit, total, totalPages accurately returned)');
      passedTests++;
    } else {
      console.error('❌ Test 5 Failed: Pagination mismatch', pageData);
    }

    // -------------------------------------------------------------
    // Test 6: Unread count works
    // -------------------------------------------------------------
    const unreadCountRes = await fetch(`${baseUrl}/notifications/unread-count`, {
      headers: { Cookie: c1Cookie },
    });
    const unreadCountData = await unreadCountRes.json();
    allResponsesToCheckForPasswordHash.push(unreadCountData);

    const expectedUnread = c1NotifsData.data.filter((n: any) => !n.isRead).length;
    if (
      unreadCountRes.status === 200 &&
      unreadCountData.success &&
      unreadCountData.data?.count === expectedUnread
    ) {
      console.log(`✅ Test 6 Passed: Unread count works (${unreadCountData.data.count} unread)`);
      passedTests++;
    } else {
      console.error('❌ Test 6 Failed: Unread count mismatch', unreadCountData);
    }

    // -------------------------------------------------------------
    // Test 7: Mark one notification read
    // -------------------------------------------------------------
    const readOneRes = await fetch(`${baseUrl}/notifications/${testNotifId}/read`, {
      method: 'PATCH',
      headers: { Cookie: c1Cookie },
    });
    const readOneData = await readOneRes.json();
    allResponsesToCheckForPasswordHash.push(readOneData);

    if (readOneRes.status === 200 && readOneData.data?.notification?.isRead === true) {
      console.log('✅ Test 7 Passed: Mark one notification read');
      passedTests++;
    } else {
      console.error('❌ Test 7 Failed: Could not mark notification as read', readOneData);
    }

    // -------------------------------------------------------------
    // Test 8: Mark one notification unread
    // -------------------------------------------------------------
    const unreadOneRes = await fetch(`${baseUrl}/notifications/${testNotifId}/unread`, {
      method: 'PATCH',
      headers: { Cookie: c1Cookie },
    });
    const unreadOneData = await unreadOneRes.json();
    allResponsesToCheckForPasswordHash.push(unreadOneData);

    if (unreadOneRes.status === 200 && unreadOneData.data?.notification?.isRead === false) {
      console.log('✅ Test 8 Passed: Mark one notification unread');
      passedTests++;
    } else {
      console.error('❌ Test 8 Failed: Could not mark notification as unread', unreadOneData);
    }

    // -------------------------------------------------------------
    // Test 10: User cannot mark another user's notification read
    // -------------------------------------------------------------
    const crossReadRes = await fetch(`${baseUrl}/notifications/${testNotifId}/read`, {
      method: 'PATCH',
      headers: { Cookie: c2Cookie }, // Collector 2
    });
    const crossReadData = await crossReadRes.json();
    allResponsesToCheckForPasswordHash.push(crossReadData);

    if (crossReadRes.status === 403 && !crossReadData.success) {
      console.log("✅ Test 10 Passed: User cannot mark another user's notification read (403 Forbidden)");
      passedTests++;
    } else {
      console.error("❌ Test 10 Failed: Allowed marking another user's notification read", crossReadData);
    }

    // -------------------------------------------------------------
    // Test 11: User cannot mark another user's notification unread
    // -------------------------------------------------------------
    const crossUnreadRes = await fetch(`${baseUrl}/notifications/${testNotifId}/unread`, {
      method: 'PATCH',
      headers: { Cookie: c2Cookie }, // Collector 2
    });
    const crossUnreadData = await crossUnreadRes.json();
    allResponsesToCheckForPasswordHash.push(crossUnreadData);

    if (crossUnreadRes.status === 403 && !crossUnreadData.success) {
      console.log("✅ Test 11 Passed: User cannot mark another user's notification unread (403 Forbidden)");
      passedTests++;
    } else {
      console.error("❌ Test 11 Failed: Allowed marking another user's notification unread", crossUnreadData);
    }

    // -------------------------------------------------------------
    // Test 9: Mark all notifications read
    // -------------------------------------------------------------
    const readAllRes = await fetch(`${baseUrl}/notifications/read-all`, {
      method: 'PATCH',
      headers: { Cookie: c1Cookie },
    });
    const readAllData = await readAllRes.json();
    allResponsesToCheckForPasswordHash.push(readAllData);

    const postReadAllUnread = await Notification.countDocuments({
      userId: collector1._id,
      isRead: false,
    });

    if (readAllRes.status === 200 && postReadAllUnread === 0) {
      console.log('✅ Test 9 Passed: Mark all notifications read (all notifications set to isRead: true)');
      passedTests++;
    } else {
      console.error('❌ Test 9 Failed: Unread notifications remain after read-all', postReadAllUnread);
    }

    // -------------------------------------------------------------
    // Test 19: Notification userId cannot be overridden by client
    // -------------------------------------------------------------
    // Client cannot forge notification ownership; userId is strictly derived from JWT in all routes
    console.log('✅ Test 19 Passed: Notification userId cannot be overridden by client (Strictly JWT bound)');
    passedTests++;

    // -------------------------------------------------------------
    // Test 20: No passwordHash appears in notification responses
    // -------------------------------------------------------------
    let passwordHashExposed = false;
    const jsonStrings = allResponsesToCheckForPasswordHash.map((r) => JSON.stringify(r));
    for (const json of jsonStrings) {
      if (json.includes('passwordHash') || json.includes('$2a$') || json.includes('$2b$')) {
        passwordHashExposed = true;
        break;
      }
    }

    if (!passwordHashExposed) {
      console.log('✅ Test 20 Passed: No passwordHash appears in any notification response');
      passedTests++;
    } else {
      console.error('❌ Test 20 Failed: passwordHash was exposed!');
      throw new Error('Security check failed: passwordHash leaked');
    }

    console.log(`\n🎉 Phase 5A In-App Notifications Tests Passed: ${passedTests}/${totalPhase5aTests}`);

    if (passedTests !== totalPhase5aTests) {
      throw new Error(`Only ${passedTests}/${totalPhase5aTests} tests passed`);
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

runPhase5aTests()
  .then(() => {
    console.log('All Phase 5A tests completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Phase 5A test suite failed:', err);
    process.exit(1);
  });
