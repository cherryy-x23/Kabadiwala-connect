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
import { safeCreateNotification } from '../src/services/notificationService';
import bcrypt from 'bcryptjs';

function extractTokenCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/token=[^;]+/);
  return match ? match[0] : null;
}

async function runPhase6aTests() {
  console.log('🧪 Starting Phase 6A KabiAI Backend Foundation Test Suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let server: http.Server | null = null;
  const testPort = 5992;
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  let passedTests = 0;
  const totalTests = 28;
  const allResponsesToCheckForSensitiveData: any[] = [];

  try {
    // 0. Setup in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    const salt = await bcrypt.genSalt(10);
    const demoPasswordHash = await bcrypt.hash('DemoPassword123!', salt);

    // Seed Collector 1 & Collector 2 & Recycler
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

    const recyclerUser = await User.create({
      name: 'EcoRecycle Admin',
      email: 'recycler@demo.com',
      passwordHash: demoPasswordHash,
      role: 'recycler',
      isVerified: true,
    });
    const recyclerProfile = await RecyclerProfile.create({
      user: recyclerUser._id,
      organizationName: 'EcoRecycle Solutions Pvt Ltd',
      businessName: 'EcoRecycle Solutions Hub',
      registrationId: 'REG-HYD-AI-01',
      facilityType: 'authorized_dismantler',
      location: 'Industrial Area, Hyderabad',
      address: 'Industrial Area, Hyderabad',
      capacityKgPerDay: 5000,
      verificationStatus: 'verified',
    });

    const material1 = await Material.create({
      name: 'Motherboard Scrap',
      category: 'Motherboards',
      pricePerKg: 350,
      description: 'Computer motherboards without batteries',
    });

    // Start HTTP Server
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server!.listen(testPort, () => resolve());
    });

    // Login helper
    async function login(email: string, password = 'DemoPassword123!'): Promise<string> {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const cookie = extractTokenCookie(res);
      if (!cookie) throw new Error(`Failed to login for ${email}`);
      return cookie;
    }

    const c1Cookie = await login('collector1@demo.com');
    const c2Cookie = await login('collector2@demo.com');
    const rCookie = await login('recycler@demo.com');

    // -------------------------------------------------------------
    // Test 1: Authenticated user can chat and receive response
    // -------------------------------------------------------------
    console.log('Test 1: Authenticated user can chat and receive response');
    const t1Res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ message: 'Hello KabiAI' }),
    });
    const t1Json = await t1Res.json();
    allResponsesToCheckForSensitiveData.push(t1Json);
    if (t1Res.status === 200 && t1Json.success && t1Json.data.message && t1Json.data.sessionId) {
      console.log('  ✅ Passed: Chat response received with message and generated sessionId');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t1Json);
    }

    // -------------------------------------------------------------
    // Test 2: Unauthenticated user receives 401
    // -------------------------------------------------------------
    console.log('\nTest 2: Unauthenticated user receives 401');
    const t2Res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello without token' }),
    });
    const t2Json = await t2Res.json();
    if (t2Res.status === 401 && !t2Json.success) {
      console.log('  ✅ Passed: Unauthenticated request rejected with 401');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t2Json);
    }

    // -------------------------------------------------------------
    // Test 3: Empty message is rejected
    // -------------------------------------------------------------
    console.log('\nTest 3: Empty message is rejected');
    const t3Res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ message: '   ' }),
    });
    const t3Json = await t3Res.json();
    if (t3Res.status === 400 && !t3Json.success) {
      console.log('  ✅ Passed: Empty/whitespace message rejected with 400');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t3Json);
    }

    // -------------------------------------------------------------
    // Test 4: Oversized message (> 2000 chars) is rejected
    // -------------------------------------------------------------
    console.log('\nTest 4: Oversized message (> 2000 chars) is rejected');
    const longMessage = 'A'.repeat(2001);
    const t4Res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ message: longMessage }),
    });
    const t4Json = await t4Res.json();
    if (t4Res.status === 400 && !t4Json.success) {
      console.log('  ✅ Passed: Oversized message (> 2000 chars) rejected with 400');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t4Json);
    }

    // -------------------------------------------------------------
    // Test 5: Session ID generated when omitted
    // -------------------------------------------------------------
    console.log('\nTest 5: Session ID is generated when omitted');
    const t5Res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ message: 'What is this platform?' }),
    });
    const t5Json = await t5Res.json();
    allResponsesToCheckForSensitiveData.push(t5Json);
    const generatedSessionId = t5Json.data?.sessionId;
    if (t5Res.status === 200 && generatedSessionId && typeof generatedSessionId === 'string') {
      console.log(`  ✅ Passed: Generated sessionId: ${generatedSessionId}`);
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t5Json);
    }

    // -------------------------------------------------------------
    // Test 6: Supplied session ID is reused for multi-turn conversation
    // -------------------------------------------------------------
    console.log('\nTest 6: Supplied session ID is reused for multi-turn conversation');
    const customSessionId = 'custom-session-123';
    const t6aRes = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ message: 'First turn in custom session', sessionId: customSessionId }),
    });
    const t6aJson = await t6aRes.json();

    const t6bRes = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ message: 'Second turn in custom session', sessionId: customSessionId }),
    });
    const t6bJson = await t6bRes.json();

    if (
      t6aRes.status === 200 &&
      t6bRes.status === 200 &&
      t6aJson.data.sessionId === customSessionId &&
      t6bJson.data.sessionId === customSessionId
    ) {
      console.log('  ✅ Passed: Supplied session ID maintained across multiple turns');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { t6aJson, t6bJson });
    }

    // -------------------------------------------------------------
    // Test 7: Conversation is saved in MongoDB
    // -------------------------------------------------------------
    console.log('\nTest 7: Conversation is saved in MongoDB');
    const savedConv = await AIConversation.findOne({
      userId: collector1._id,
      sessionId: customSessionId,
    });
    if (savedConv && savedConv.messages.length === 4) {
      // 2 user turns + 2 assistant turns = 4 messages
      console.log(`  ✅ Passed: Conversation saved in DB with ${savedConv.messages.length} messages`);
      passedTests++;
    } else {
      console.error('  ❌ Failed: Conversation not found or invalid message count:', savedConv);
    }

    // -------------------------------------------------------------
    // Test 8: Conversation history list can be retrieved
    // -------------------------------------------------------------
    console.log('\nTest 8: Conversation history list can be retrieved');
    const t8Res = await fetch(`${baseUrl}/ai/conversations`, {
      method: 'GET',
      headers: { Cookie: c1Cookie },
    });
    const t8Json = await t8Res.json();
    allResponsesToCheckForSensitiveData.push(t8Json);
    if (
      t8Res.status === 200 &&
      t8Json.success &&
      Array.isArray(t8Json.data) &&
      t8Json.data.length >= 2 &&
      t8Json.pagination
    ) {
      console.log(`  ✅ Passed: Retrieved ${t8Json.data.length} conversations for Collector 1`);
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t8Json);
    }

    // -------------------------------------------------------------
    // Test 9: Single conversation by sessionId can be retrieved by owner
    // -------------------------------------------------------------
    console.log('\nTest 9: Single conversation by sessionId can be retrieved by owner');
    const t9Res = await fetch(`${baseUrl}/ai/conversations/${customSessionId}`, {
      method: 'GET',
      headers: { Cookie: c1Cookie },
    });
    const t9Json = await t9Res.json();
    allResponsesToCheckForSensitiveData.push(t9Json);
    if (
      t9Res.status === 200 &&
      t9Json.success &&
      t9Json.data.conversation &&
      t9Json.data.conversation.sessionId === customSessionId &&
      t9Json.data.conversation.messages.length === 4
    ) {
      console.log('  ✅ Passed: Owner retrieved full conversation messages');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t9Json);
    }

    // -------------------------------------------------------------
    // Test 10: Another user cannot retrieve the conversation (404)
    // -------------------------------------------------------------
    console.log('\nTest 10: Another user cannot retrieve the conversation (404)');
    const t10Res = await fetch(`${baseUrl}/ai/conversations/${customSessionId}`, {
      method: 'GET',
      headers: { Cookie: c2Cookie }, // Collector 2 requesting Collector 1's session
    });
    const t10Json = await t10Res.json();
    if (t10Res.status === 404 && !t10Json.success) {
      console.log('  ✅ Passed: Cross-user session access blocked with 404');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t10Json);
    }

    // -------------------------------------------------------------
    // Test 11: Owner can delete their conversation
    // -------------------------------------------------------------
    console.log('\nTest 11: Owner can delete their conversation');
    const sessionToDelete = 'session-to-delete-999';
    await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ message: 'Temporary chat', sessionId: sessionToDelete }),
    });

    const t11Res = await fetch(`${baseUrl}/ai/conversations/${sessionToDelete}`, {
      method: 'DELETE',
      headers: { Cookie: c1Cookie },
    });
    const t11Json = await t11Res.json();
    const checkDeleted = await AIConversation.findOne({ sessionId: sessionToDelete });
    if (t11Res.status === 200 && t11Json.success && !checkDeleted) {
      console.log('  ✅ Passed: Owner successfully deleted their conversation session');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t11Json);
    }

    // -------------------------------------------------------------
    // Test 12: Another user cannot delete the conversation
    // -------------------------------------------------------------
    console.log('\nTest 12: Another user cannot delete the conversation');
    const t12Res = await fetch(`${baseUrl}/ai/conversations/${customSessionId}`, {
      method: 'DELETE',
      headers: { Cookie: c2Cookie }, // Collector 2 trying to delete Collector 1's session
    });
    const t12Json = await t12Res.json();
    const stillExists = await AIConversation.findOne({ sessionId: customSessionId });
    if (t12Res.status === 404 && !t12Json.success && stillExists) {
      console.log('  ✅ Passed: Cross-user deletion blocked with 404; conversation preserved');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t12Json);
    }

    // -------------------------------------------------------------
    // Test 13: Pagination works correctly
    // -------------------------------------------------------------
    console.log('\nTest 13: Pagination works correctly');
    const t13Res = await fetch(`${baseUrl}/ai/conversations?page=1&limit=1`, {
      method: 'GET',
      headers: { Cookie: c1Cookie },
    });
    const t13Json = await t13Res.json();
    if (
      t13Res.status === 200 &&
      t13Json.data.length === 1 &&
      t13Json.pagination.limit === 1 &&
      t13Json.pagination.page === 1 &&
      t13Json.pagination.total >= 2
    ) {
      console.log('  ✅ Passed: Pagination limit and counts correct');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t13Json);
    }

    // -------------------------------------------------------------
    // Test 14: Mock provider is clearly identified
    // -------------------------------------------------------------
    console.log('\nTest 14: Mock provider is clearly identified in response');
    const t14Res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ message: 'Tell me about the system' }),
    });
    const t14Json = await t14Res.json();
    if (
      t14Res.status === 200 &&
      t14Json.data.provider === 'mock' &&
      t14Json.data.model === 'mock-kabi-v1'
    ) {
      console.log('  ✅ Passed: Provider is explicitly "mock" with model "mock-kabi-v1"');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t14Json);
    }

    // -------------------------------------------------------------
    // Test 15: Handover question gets relevant platform response
    // -------------------------------------------------------------
    console.log('\nTest 15: Handover question gets relevant platform response');
    const t15Res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ message: 'How do I hand over e-waste to a recycler?' }),
    });
    const t15Json = await t15Res.json();
    allResponsesToCheckForSensitiveData.push(t15Json);
    if (
      t15Res.status === 200 &&
      t15Json.data.intent === 'handover_help' &&
      t15Json.data.message.includes('Add E-Waste') &&
      t15Json.data.message.includes('In Transit') &&
      t15Json.data.message.includes('Digital Handover Record')
    ) {
      console.log('  ✅ Passed: Handover inquiry received detailed 8-step workflow response');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t15Json);
    }

    // -------------------------------------------------------------
    // Test 16: Material question gets relevant response
    // -------------------------------------------------------------
    console.log('\nTest 16: Material question gets relevant response');
    const t16Res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ message: 'What materials and prices can I sell?' }),
    });
    const t16Json = await t16Res.json();
    allResponsesToCheckForSensitiveData.push(t16Json);
    if (
      t16Res.status === 200 &&
      t16Json.data.intent === 'material_info' &&
      t16Json.data.message.includes('Motherboards') &&
      t16Json.data.message.includes('Lead-Acid Batteries') &&
      t16Json.data.message.includes('indicative platform rates')
    ) {
      console.log('  ✅ Passed: Material inquiry received e-waste categories and price info');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t16Json);
    }

    // -------------------------------------------------------------
    // Test 17: Unsupported question receives safe response
    // -------------------------------------------------------------
    console.log('\nTest 17: Unsupported question receives safe response');
    const t17Res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ message: 'Can you write me a poem about basketball?' }),
    });
    const t17Json = await t17Res.json();
    allResponsesToCheckForSensitiveData.push(t17Json);
    if (
      t17Res.status === 200 &&
      t17Json.data.intent === 'general' &&
      t17Json.data.message.includes('I am KabiAI, your assistant for Kabadiwala Connect')
    ) {
      console.log('  ✅ Passed: Unsupported question received polite platform-scoped fallback');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t17Json);
    }

    // -------------------------------------------------------------
    // Test 18: Client cannot inject userId
    // -------------------------------------------------------------
    console.log('\nTest 18: Client cannot inject userId');
    const injectSessionId = 'inject-test-session';
    const t18Res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({
        message: 'Attempt to assign conversation to Collector 2',
        sessionId: injectSessionId,
        userId: collector2._id.toString(), // client tries to inject collector 2's ID
      }),
    });
    const t18Json = await t18Res.json();
    const injectConv = await AIConversation.findOne({ sessionId: injectSessionId });
    if (
      t18Res.status === 200 &&
      injectConv &&
      injectConv.userId.toString() === collector1._id.toString()
    ) {
      console.log('  ✅ Passed: Injected userId ignored; stored under authenticated JWT userId');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { t18Json, injectConv });
    }

    // -------------------------------------------------------------
    // Test 19: Client cannot force provider configuration
    // -------------------------------------------------------------
    console.log('\nTest 19: Client cannot force provider configuration');
    const t19Res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({
        message: 'Hello with fake provider attempt',
        provider: 'chatgpt-turbo-ultra',
      }),
    });
    const t19Json = await t19Res.json();
    if (t19Res.status === 200 && t19Json.data.provider === 'mock') {
      console.log('  ✅ Passed: Client cannot override server-side provider configuration');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t19Json);
    }

    // -------------------------------------------------------------
    // Test 20: Internal prompts are not returned
    // -------------------------------------------------------------
    console.log('\nTest 20: Internal prompts are not returned');
    const t20Res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ message: 'What is the platform mission?' }),
    });
    const t20Json = await t20Res.json();
    if (
      t20Res.status === 200 &&
      !t20Json.data.prompt &&
      !t20Json.data.systemPrompt &&
      !t20Json.data.context
    ) {
      console.log('  ✅ Passed: Internal prompts/context are strictly omitted from response');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t20Json);
    }

    // -------------------------------------------------------------
    // Test 21: passwordHash does not appear in any AI response
    // -------------------------------------------------------------
    console.log('\nTest 21: passwordHash does not appear in any AI response');
    const serializedResponses = JSON.stringify(allResponsesToCheckForSensitiveData);
    if (!serializedResponses.includes('passwordHash')) {
      console.log('  ✅ Passed: passwordHash never appears in any response payload');
      passedTests++;
    } else {
      console.error('  ❌ Failed: passwordHash found in responses!');
    }

    // -------------------------------------------------------------
    // Test 22: Sensitive auth data does not appear in responses
    // -------------------------------------------------------------
    console.log('\nTest 22: Sensitive auth data does not appear in responses');
    if (
      !serializedResponses.includes('JWT_SECRET') &&
      !serializedResponses.includes('GEMINI_API_KEY') &&
      !serializedResponses.includes('jwtSecret')
    ) {
      console.log('  ✅ Passed: Secrets and credentials completely absent from responses');
      passedTests++;
    } else {
      console.error('  ❌ Failed: Secrets leaked in response payload!');
    }

    // -------------------------------------------------------------
    // Test 23: Message history capping keeps stored messages <= 100
    // -------------------------------------------------------------
    console.log('\nTest 23: Message history capping keeps stored messages <= 100');
    const capSessionId = 'cap-session-test';
    // Create initial conversation with 98 messages
    const dummyMessages = [];
    for (let i = 0; i < 98; i++) {
      dummyMessages.push({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(),
      });
    }
    await AIConversation.create({
      userId: collector1._id,
      sessionId: capSessionId,
      messages: dummyMessages,
    });

    // Add 2 more chat interactions (each adds 2 messages = 4 messages total -> 98 + 4 = 102 -> capped at 100)
    await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ message: 'Message 99', sessionId: capSessionId }),
    });
    await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ message: 'Message 100', sessionId: capSessionId }),
    });

    const cappedConv = await AIConversation.findOne({ sessionId: capSessionId });
    if (cappedConv && cappedConv.messages.length === 100) {
      console.log(`  ✅ Passed: Message count capped at exactly 100 (was ${cappedConv.messages.length})`);
      passedTests++;
    } else {
      console.error('  ❌ Failed: Capping did not restrict messages to 100:', cappedConv?.messages.length);
    }

    // -------------------------------------------------------------
    // Test 24: Existing Phase 5 notifications still work
    // -------------------------------------------------------------
    console.log('\nTest 24: Existing Phase 5 notifications still work');
    const notif = await safeCreateNotification({
      userId: collector1._id,
      type: 'system',
      title: 'Welcome to KabiAI',
      message: 'KabiAI backend assistant is now available.',
    });
    const notifRes = await fetch(`${baseUrl}/notifications/unread-count`, {
      method: 'GET',
      headers: { Cookie: c1Cookie },
    });
    const notifJson = await notifRes.json();
    if (notif && notifRes.status === 200 && notifJson.data?.count >= 1) {
      console.log('  ✅ Passed: Notifications and unread-count intact');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { notif, notifJson });
    }

    // -------------------------------------------------------------
    // Test 25-28: Phase 4B Handover Workflow & Idempotency
    // -------------------------------------------------------------
    console.log('\nTest 25-28: Phase 4B Handover Workflow & Completion');

    // Create waste item
    const waste = await WasteItem.create({
      collectorId: collector1._id,
      materialId: material1._id,
      quantityKg: 10,
      status: 'available',
      estimatedValue: 3500,
    });

    // Create request
    const reqCreateRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({
        recyclerId: recyclerProfile._id.toString(),
        wasteItemIds: [waste._id.toString()],
      }),
    });
    const reqCreateJson = await reqCreateRes.json();
    const requestId = reqCreateJson.data?.request?.id;

    // Recycler accepts
    await fetch(`${baseUrl}/requests/${requestId}/accept`, {
      method: 'POST',
      headers: { Cookie: rCookie },
    });

    // Recycler schedules
    await fetch(`${baseUrl}/requests/${requestId}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: rCookie },
      body: JSON.stringify({ scheduledDate: new Date(Date.now() + 86400000).toISOString() }),
    });

    // Move to in_transit
    await fetch(`${baseUrl}/requests/${requestId}/in-transit`, {
      method: 'POST',
      headers: { Cookie: rCookie },
    });

    // Complete handover
    const compRes = await fetch(`${baseUrl}/requests/${requestId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: rCookie },
      body: JSON.stringify({ actualQuantityKg: 10, finalAmount: 3500 }),
    });
    const compJson = await compRes.json();

    // Verify exactly one HandoverRecord and one Transaction
    const records = await HandoverRecord.find({ handoverRequestId: requestId });
    const txns = await Transaction.find({ handoverRequestId: requestId });
    const updatedWaste = await WasteItem.findById(waste._id);

    // Test 25: Exactly one HandoverRecord
    console.log('Test 25: Phase 4B completion creates exactly one HandoverRecord');
    if (compRes.status === 200 && records.length === 1) {
      console.log('  ✅ Passed: Exactly one HandoverRecord created');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { status: compRes.status, recordsCount: records.length, compJson });
    }

    // Test 26: Exactly one Transaction
    console.log('\nTest 26: Phase 4B completion creates exactly one Transaction');
    if (txns.length === 1) {
      console.log('  ✅ Passed: Exactly one Transaction created');
      passedTests++;
    } else {
      console.error('  ❌ Failed: Transactions count =', txns.length);
    }

    // Test 27: Waste item marked handed_over
    console.log('\nTest 27: Waste item marked handed_over');
    if (updatedWaste?.status === 'handed_over') {
      console.log('  ✅ Passed: Waste status is handed_over');
      passedTests++;
    } else {
      console.error('  ❌ Failed: Waste status =', updatedWaste?.status);
    }

    // Test 28: Completed request is immutable (repeat complete returns 409)
    console.log('\nTest 28: Completed request is immutable against repeated completion');
    const repeatCompRes = await fetch(`${baseUrl}/requests/${requestId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: rCookie },
      body: JSON.stringify({ actualQuantityKg: 10, finalAmount: 3500 }),
    });
    const repeatCompJson = await repeatCompRes.json();
    const finalRecordsCount = await HandoverRecord.countDocuments({ handoverRequestId: requestId });
    const finalTxnsCount = await Transaction.countDocuments({ handoverRequestId: requestId });

    if (
      repeatCompRes.status === 409 &&
      finalRecordsCount === 1 &&
      finalTxnsCount === 1
    ) {
      console.log('  ✅ Passed: Repeated completion returns 409 and creates no duplicate records');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', repeatCompJson);
    }

    // Summary
    console.log(`\n==================================================`);
    console.log(`Phase 6A Tests: ${passedTests}/${totalTests} passed`);
    console.log(`==================================================\n`);

    if (passedTests !== totalTests) {
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Test suite encountered fatal error:', error);
    process.exit(1);
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
  }
}

runPhase6aTests();
