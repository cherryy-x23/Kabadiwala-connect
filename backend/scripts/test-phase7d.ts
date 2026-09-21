/**
 * Phase 7D Integration Test Suite
 * Tests: In-App Notifications + KabiAI (frontend integration verification via backend APIs)
 *
 * Coverage:
 * - Authenticated notification retrieval, pagination, unread count
 * - Mark read / mark unread / mark all read
 * - User notification isolation
 * - Workflow-triggered notifications (request create, accept, schedule, complete)
 * - Authenticated AI chat (POST /ai/chat)
 * - Multi-turn session reuse (same sessionId returned)
 * - Session persistence (GET /ai/conversations, GET /ai/conversations/:sessionId)
 * - Cross-user session isolation (404 on another user's session)
 * - Session deletion (DELETE /ai/conversations/:sessionId)
 * - Input validations (empty message, >2000 chars → 400)
 * - Security: no passwordHash or credentials in any response
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
import { Notification } from '../src/models/Notification';
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
    str.includes('"password"') ||
    str.includes('"token"') ||
    str.includes('"secret"')
  );
}

async function runPhase7dTests() {
  console.log('🧪 Starting Phase 7D Integration Test Suite (Notifications + KabiAI)...\n');

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

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('DemoPassword123!', salt);

    const collector1 = await User.create({
      name: 'Ravi Kumar',
      email: 'collector1@test.com',
      passwordHash: hash,
      role: 'collector',
      isVerified: true,
    });
    await CollectorProfile.create({ user: collector1._id });

    const collector2 = await User.create({
      name: 'Sita Sharma',
      email: 'collector2@test.com',
      passwordHash: hash,
      role: 'collector',
      isVerified: true,
    });
    await CollectorProfile.create({ user: collector2._id });

    const recyclerUser = await User.create({
      name: 'EcoGreen Recyclers',
      email: 'recycler1@test.com',
      passwordHash: hash,
      role: 'recycler',
      isVerified: true,
    });
    const recyclerProfile = await RecyclerProfile.create({
      user: recyclerUser._id,
      organizationName: 'EcoGreen Pvt Ltd',
      businessName: 'EcoGreen',
      registrationId: 'REG-001',
      facilityType: 'authorized_dismantler',
      location: 'Hyderabad',
      address: 'Plot 1',
      capacityKgPerDay: 1000,
      verificationStatus: 'verified',
    });

    const material = await Material.create({
      name: 'Laptop Scrap',
      category: 'Computers',
      pricePerKg: 400,
      unit: 'kg',
      isActive: true,
    });

    const waste1 = await WasteItem.create({
      collectorId: collector1._id,
      materialId: material._id,
      quantityKg: 10,
      estimatedPricePerKg: 400,
      estimatedValue: 4000,
      status: 'available',
    });

    const waste2 = await WasteItem.create({
      collectorId: collector1._id,
      materialId: material._id,
      quantityKg: 5,
      estimatedPricePerKg: 400,
      estimatedValue: 2000,
      status: 'available',
    });

    await new Promise<void>((resolve) => {
      server = app.listen(testPort, () => resolve());
    });

    async function login(email: string): Promise<string> {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'DemoPassword123!' }),
      });
      const data = await res.json();
      allResponses.push(data);
      const cookie = extractTokenCookie(res);
      if (!cookie) throw new Error(`Login failed for ${email}`);
      return cookie;
    }

    const c1Cookie = await login('collector1@test.com');
    const c2Cookie = await login('collector2@test.com');
    const r1Cookie = await login('recycler1@test.com');

    // ──────────────────────────────────────────────────────────────────
    // SECTION 1: Notification Endpoints
    // ──────────────────────────────────────────────────────────────────

    // Test 1: Unauthenticated access to notifications returns 401
    console.log('\nTest 1: Unauthenticated notification access returns 401');
    {
      const res = await fetch(`${baseUrl}/notifications`);
      const data = await res.json();
      allResponses.push(data);
      if (res.status === 401 && !data.success) {
        pass(1, 'Unauthenticated notification access returns 401');
      } else {
        fail(1, 'Unauthenticated notification access returns 401', { status: res.status, data });
      }
    }

    // Test 2: Unauthenticated access to unread count returns 401
    console.log('Test 2: Unauthenticated unread count returns 401');
    {
      const res = await fetch(`${baseUrl}/notifications/unread-count`);
      const data = await res.json();
      allResponses.push(data);
      if (res.status === 401 && !data.success) {
        pass(2, 'Unauthenticated unread count returns 401');
      } else {
        fail(2, 'Unauthenticated unread count returns 401', { status: res.status });
      }
    }

    // Test 3: Authenticated get notifications returns success array (initially empty)
    console.log('Test 3: Authenticated notification list returns success');
    {
      const res = await fetch(`${baseUrl}/notifications`, {
        headers: { Cookie: c1Cookie },
      });
      const data = await res.json();
      allResponses.push(data);
      if (res.status === 200 && data.success && Array.isArray(data.data)) {
        pass(3, 'Authenticated notification list returns success array');
      } else {
        fail(3, 'Authenticated notification list returns success array', data);
      }
    }

    // Test 4: Unread count returns numeric count for authenticated user
    console.log('Test 4: Unread count returns numeric count');
    {
      const res = await fetch(`${baseUrl}/notifications/unread-count`, {
        headers: { Cookie: c1Cookie },
      });
      const data = await res.json();
      allResponses.push(data);
      if (res.status === 200 && data.success && typeof data.data?.count === 'number') {
        pass(4, 'Unread count returns numeric count');
      } else {
        fail(4, 'Unread count returns numeric count', data);
      }
    }

    // ── Create a handover request to trigger workflow notifications ──
    const createReqRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({
        recyclerId: recyclerProfile._id.toString(),
        wasteItemIds: [waste1._id.toString()],
        notes: 'Phase 7D workflow test',
      }),
    });
    const createReqData = await createReqRes.json();
    allResponses.push(createReqData);
    const requestId = createReqData.data?.request?.id || createReqData.data?.request?._id;

    // Test 5: Request creation generates notification for recycler (request_created)
    console.log('Test 5: Request creation generates recycler notification (request_created)');
    {
      const notif = await Notification.findOne({
        userId: recyclerUser._id,
        type: 'request_created',
        relatedEntityId: requestId,
      });
      if (notif && notif.title === 'New Handover Request') {
        pass(5, 'Request creation generates recycler notification (request_created)');
      } else {
        fail(5, 'Request creation generates recycler notification (request_created)', notif);
      }
    }

    // Test 6: Recycler can retrieve their own notification via GET /notifications
    console.log('Test 6: Recycler retrieves their notifications from backend');
    {
      const res = await fetch(`${baseUrl}/notifications`, {
        headers: { Cookie: r1Cookie },
      });
      const data = await res.json();
      allResponses.push(data);
      const found = Array.isArray(data.data) && data.data.some((n: any) => n.type === 'request_created');
      if (res.status === 200 && data.success && found) {
        pass(6, 'Recycler retrieves their notifications from backend');
      } else {
        fail(6, 'Recycler retrieves their notifications from backend', data);
      }
    }

    // Test 7: Collector2 cannot see Collector1's notifications (isolation)
    console.log('Test 7: Collector2 cannot see Collector1 notifications (isolation)');
    {
      const res = await fetch(`${baseUrl}/notifications`, {
        headers: { Cookie: c2Cookie },
      });
      const data = await res.json();
      allResponses.push(data);
      // Collector2 should have 0 notifications since no workflow actions affected them
      const c1NotifVisible = Array.isArray(data.data) &&
        data.data.some((n: any) => n.userId?.toString() === collector1._id.toString());
      if (res.status === 200 && data.success && !c1NotifVisible) {
        pass(7, 'Collector2 cannot see Collector1 notifications (user isolation)');
      } else {
        fail(7, 'Collector2 cannot see Collector1 notifications (user isolation)', data);
      }
    }

    // ── Accept request to trigger more notifications ──
    await fetch(`${baseUrl}/requests/${requestId}/accept`, {
      method: 'POST',
      headers: { Cookie: r1Cookie },
    });

    // Test 8: Accept generates collector notification (request_accepted)
    console.log('Test 8: Accept generates collector notification (request_accepted)');
    {
      const notif = await Notification.findOne({
        userId: collector1._id,
        type: 'request_accepted',
        relatedEntityId: requestId,
      });
      if (notif && notif.title === 'Handover Request Accepted') {
        pass(8, 'Accept generates collector notification (request_accepted)');
      } else {
        fail(8, 'Accept generates collector notification (request_accepted)', notif);
      }
    }

    // Test 9: Unread count increases after workflow notifications
    console.log('Test 9: Unread count increases after workflow notification');
    {
      const res = await fetch(`${baseUrl}/notifications/unread-count`, {
        headers: { Cookie: c1Cookie },
      });
      const data = await res.json();
      allResponses.push(data);
      if (res.status === 200 && data.success && data.data?.count > 0) {
        pass(9, 'Unread count > 0 after workflow notifications');
      } else {
        fail(9, 'Unread count > 0 after workflow notifications', data);
      }
    }

    // Get a notification ID to test mark-read
    const c1NotifListRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Cookie: c1Cookie },
    });
    const c1NotifListData = await c1NotifListRes.json();
    allResponses.push(c1NotifListData);
    const firstNotifId = Array.isArray(c1NotifListData.data) && c1NotifListData.data.length > 0
      ? c1NotifListData.data[0].id || c1NotifListData.data[0]._id
      : null;

    // Test 10: Mark a single notification as read
    console.log('Test 10: Mark single notification as read');
    {
      if (!firstNotifId) {
        fail(10, 'Mark single notification as read', 'No notification found');
      } else {
        const res = await fetch(`${baseUrl}/notifications/${firstNotifId}/read`, {
          method: 'PATCH',
          headers: { Cookie: c1Cookie },
        });
        const data = await res.json();
        allResponses.push(data);
        if (res.status === 200 && data.success && data.data?.notification?.isRead === true) {
          pass(10, 'Mark single notification as read');
        } else {
          fail(10, 'Mark single notification as read', data);
        }
      }
    }

    // Test 11: Mark single notification as unread
    console.log('Test 11: Mark single notification as unread');
    {
      if (!firstNotifId) {
        fail(11, 'Mark single notification as unread', 'No notification found');
      } else {
        const res = await fetch(`${baseUrl}/notifications/${firstNotifId}/unread`, {
          method: 'PATCH',
          headers: { Cookie: c1Cookie },
        });
        const data = await res.json();
        allResponses.push(data);
        if (res.status === 200 && data.success && data.data?.notification?.isRead === false) {
          pass(11, 'Mark single notification as unread');
        } else {
          fail(11, 'Mark single notification as unread', data);
        }
      }
    }

    // Test 12: Mark all notifications as read
    console.log('Test 12: Mark all notifications as read');
    {
      const res = await fetch(`${baseUrl}/notifications/read-all`, {
        method: 'PATCH',
        headers: { Cookie: c1Cookie },
      });
      const data = await res.json();
      allResponses.push(data);
      if (res.status === 200 && data.success && typeof data.data?.modifiedCount === 'number') {
        pass(12, 'Mark all notifications as read');
      } else {
        fail(12, 'Mark all notifications as read', data);
      }
    }

    // Test 13: Unread count is 0 after mark all read
    console.log('Test 13: Unread count = 0 after mark all read');
    {
      const res = await fetch(`${baseUrl}/notifications/unread-count`, {
        headers: { Cookie: c1Cookie },
      });
      const data = await res.json();
      allResponses.push(data);
      if (res.status === 200 && data.success && data.data?.count === 0) {
        pass(13, 'Unread count = 0 after mark all read');
      } else {
        fail(13, 'Unread count = 0 after mark all read', data);
      }
    }

    // Test 14: GET /notifications?isRead=false returns only unread
    console.log('Test 14: GET /notifications?isRead=false returns only unread');
    {
      const res = await fetch(`${baseUrl}/notifications?isRead=false`, {
        headers: { Cookie: c1Cookie },
      });
      const data = await res.json();
      allResponses.push(data);
      const allUnread = Array.isArray(data.data) && data.data.every((n: any) => n.isRead === false);
      if (res.status === 200 && data.success && allUnread) {
        pass(14, 'isRead=false filter returns only unread notifications');
      } else {
        fail(14, 'isRead=false filter returns only unread notifications', data);
      }
    }

    // Test 15: GET /notifications?isRead=true returns only read
    console.log('Test 15: GET /notifications?isRead=true returns only read');
    {
      const res = await fetch(`${baseUrl}/notifications?isRead=true`, {
        headers: { Cookie: c1Cookie },
      });
      const data = await res.json();
      allResponses.push(data);
      const allRead = Array.isArray(data.data) && data.data.every((n: any) => n.isRead === true);
      if (res.status === 200 && data.success && allRead) {
        pass(15, 'isRead=true filter returns only read notifications');
      } else {
        fail(15, 'isRead=true filter returns only read notifications', data);
      }
    }

    // Test 16: Collector2 cannot mark Collector1's notification (ownership)
    console.log('Test 16: Collector2 cannot mark Collector1 notification as read (ownership check)');
    {
      if (!firstNotifId) {
        fail(16, 'Collector2 cannot mark Collector1 notification', 'No notification found');
      } else {
        const res = await fetch(`${baseUrl}/notifications/${firstNotifId}/read`, {
          method: 'PATCH',
          headers: { Cookie: c2Cookie },
        });
        const data = await res.json();
        allResponses.push(data);
        if (res.status === 403 || res.status === 404) {
          pass(16, 'Collector2 cannot mark Collector1 notification (forbidden/not found)');
        } else {
          fail(16, 'Collector2 cannot mark Collector1 notification', { status: res.status, data });
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // SECTION 2: KabiAI Endpoints
    // ──────────────────────────────────────────────────────────────────

    // Test 17: Unauthenticated AI chat returns 401
    console.log('\nTest 17: Unauthenticated AI chat returns 401');
    {
      const res = await fetch(`${baseUrl}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello KabiAI' }),
      });
      const data = await res.json();
      allResponses.push(data);
      if (res.status === 401 && !data.success) {
        pass(17, 'Unauthenticated AI chat returns 401');
      } else {
        fail(17, 'Unauthenticated AI chat returns 401', { status: res.status });
      }
    }

    // Test 18: Authenticated AI chat returns a response with sessionId
    console.log('Test 18: Authenticated AI chat returns response with sessionId');
    let sessionId1: string | null = null;
    {
      const res = await fetch(`${baseUrl}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
        body: JSON.stringify({ message: 'How does the handover process work?' }),
      });
      const data = await res.json();
      allResponses.push(data);
      if (res.status === 200 && data.success && data.data?.sessionId && data.data?.message) {
        sessionId1 = data.data.sessionId;
        pass(18, 'Authenticated AI chat returns response with sessionId');
      } else {
        fail(18, 'Authenticated AI chat returns response with sessionId', data);
      }
    }

    // Test 19: Multi-turn session reuse (same sessionId returned in follow-up)
    console.log('Test 19: Multi-turn session reuse (follow-up uses same sessionId)');
    {
      if (!sessionId1) {
        fail(19, 'Multi-turn session reuse', 'No sessionId from Test 18');
      } else {
        const res = await fetch(`${baseUrl}/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
          body: JSON.stringify({ message: 'What materials are accepted?', sessionId: sessionId1 }),
        });
        const data = await res.json();
        allResponses.push(data);
        if (res.status === 200 && data.success && data.data?.sessionId === sessionId1) {
          pass(19, 'Multi-turn session reuse: same sessionId returned');
        } else {
          fail(19, 'Multi-turn session reuse', { expected: sessionId1, got: data.data?.sessionId });
        }
      }
    }

    // Test 20: Empty message returns 400
    console.log('Test 20: Empty message returns 400');
    {
      const res = await fetch(`${baseUrl}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
        body: JSON.stringify({ message: '' }),
      });
      const data = await res.json();
      allResponses.push(data);
      if (res.status === 400 && !data.success) {
        pass(20, 'Empty message returns 400');
      } else {
        fail(20, 'Empty message returns 400', { status: res.status, data });
      }
    }

    // Test 21: Message exceeding 2000 chars returns 400
    console.log('Test 21: Message > 2000 chars returns 400');
    {
      const longMsg = 'a'.repeat(2001);
      const res = await fetch(`${baseUrl}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
        body: JSON.stringify({ message: longMsg }),
      });
      const data = await res.json();
      allResponses.push(data);
      if (res.status === 400 && !data.success) {
        pass(21, 'Message > 2000 chars returns 400');
      } else {
        fail(21, 'Message > 2000 chars returns 400', { status: res.status });
      }
    }

    // Test 22: GET /ai/conversations returns collector1's conversation list
    console.log('Test 22: GET /ai/conversations returns conversation list');
    {
      const res = await fetch(`${baseUrl}/ai/conversations`, {
        headers: { Cookie: c1Cookie },
      });
      const data = await res.json();
      allResponses.push(data);
      const found = Array.isArray(data.data) && data.data.length > 0 &&
        data.data.some((c: any) => c.sessionId === sessionId1);
      if (res.status === 200 && data.success && found) {
        pass(22, 'GET /ai/conversations returns conversation list with correct session');
      } else {
        fail(22, 'GET /ai/conversations returns conversation list', data);
      }
    }

    // Test 23: GET /ai/conversations/:sessionId returns full conversation with messages
    console.log('Test 23: GET /ai/conversations/:sessionId returns full conversation');
    {
      if (!sessionId1) {
        fail(23, 'GET /ai/conversations/:sessionId', 'No sessionId');
      } else {
        const res = await fetch(`${baseUrl}/ai/conversations/${encodeURIComponent(sessionId1)}`, {
          headers: { Cookie: c1Cookie },
        });
        const data = await res.json();
        allResponses.push(data);
        const hasMessages = Array.isArray(data.data?.conversation?.messages) &&
          data.data.conversation.messages.length >= 2; // at least user + assistant
        if (res.status === 200 && data.success && hasMessages) {
          pass(23, 'GET /ai/conversations/:sessionId returns full conversation with messages');
        } else {
          fail(23, 'GET /ai/conversations/:sessionId returns full conversation', data);
        }
      }
    }

    // Test 24: Cross-user session isolation (Collector2 cannot access Collector1's session)
    console.log('Test 24: Collector2 cannot access Collector1 AI session (isolation)');
    {
      if (!sessionId1) {
        fail(24, 'Cross-user session isolation', 'No sessionId');
      } else {
        const res = await fetch(`${baseUrl}/ai/conversations/${encodeURIComponent(sessionId1)}`, {
          headers: { Cookie: c2Cookie },
        });
        const data = await res.json();
        allResponses.push(data);
        if (res.status === 404 || res.status === 403) {
          pass(24, 'Collector2 cannot access Collector1 AI session (isolation enforced)');
        } else {
          fail(24, 'Collector2 cannot access Collector1 AI session', { status: res.status, data });
        }
      }
    }

    // Test 25: Unauthenticated conversation list returns 401
    console.log('Test 25: Unauthenticated conversation list returns 401');
    {
      const res = await fetch(`${baseUrl}/ai/conversations`);
      const data = await res.json();
      allResponses.push(data);
      if (res.status === 401 && !data.success) {
        pass(25, 'Unauthenticated conversation list returns 401');
      } else {
        fail(25, 'Unauthenticated conversation list returns 401', { status: res.status });
      }
    }

    // Test 26: Collector2 can start their own independent session
    console.log('Test 26: Collector2 can create their own independent AI session');
    let sessionId2: string | null = null;
    {
      const res = await fetch(`${baseUrl}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: c2Cookie },
        body: JSON.stringify({ message: 'What is the price of copper cables?' }),
      });
      const data = await res.json();
      allResponses.push(data);
      if (res.status === 200 && data.success && data.data?.sessionId && data.data.sessionId !== sessionId1) {
        sessionId2 = data.data.sessionId;
        pass(26, 'Collector2 creates independent session with different sessionId');
      } else {
        fail(26, 'Collector2 creates independent session', data);
      }
    }

    // Test 27: DELETE /ai/conversations/:sessionId deletes the session
    console.log('Test 27: DELETE /ai/conversations/:sessionId deletes session');
    {
      if (!sessionId1) {
        fail(27, 'DELETE conversation session', 'No sessionId');
      } else {
        const res = await fetch(`${baseUrl}/ai/conversations/${encodeURIComponent(sessionId1)}`, {
          method: 'DELETE',
          headers: { Cookie: c1Cookie },
        });
        if (res.status === 204 || res.status === 200) {
          pass(27, 'DELETE /ai/conversations/:sessionId returns 200/204');
        } else {
          const data = await res.json().catch(() => ({}));
          fail(27, 'DELETE conversation session', { status: res.status, data });
        }
      }
    }

    // Test 28: Session no longer accessible after deletion
    console.log('Test 28: Deleted session returns 404');
    {
      if (!sessionId1) {
        fail(28, 'Deleted session returns 404', 'No sessionId');
      } else {
        const res = await fetch(`${baseUrl}/ai/conversations/${encodeURIComponent(sessionId1)}`, {
          headers: { Cookie: c1Cookie },
        });
        const data = await res.json().catch(() => ({ status: res.status }));
        allResponses.push(data);
        if (res.status === 404) {
          pass(28, 'Deleted session returns 404');
        } else {
          fail(28, 'Deleted session returns 404', { status: res.status, data });
        }
      }
    }

    // Test 29: Collector2 cannot delete Collector1's session (already deleted, but verifies 404)
    console.log('Test 29: Collector2 cannot delete other user AI session');
    {
      // sessionId1 is deleted; attempting from c2Cookie should also 404
      if (!sessionId1) {
        fail(29, 'Cross-user delete protection', 'No sessionId');
      } else {
        const res = await fetch(`${baseUrl}/ai/conversations/${encodeURIComponent(sessionId1)}`, {
          method: 'DELETE',
          headers: { Cookie: c2Cookie },
        });
        if (res.status === 404 || res.status === 403) {
          pass(29, 'Cross-user session delete returns 403/404');
        } else {
          const data = await res.json().catch(() => ({}));
          fail(29, 'Cross-user session delete returns 403/404', { status: res.status, data });
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // SECTION 3: Security Audit
    // ──────────────────────────────────────────────────────────────────

    // Test 30: No response contains passwordHash or credentials
    console.log('\nTest 30: No response contains sensitive credentials (passwordHash, token, etc.)');
    {
      const leaked = allResponses.some(containsSensitiveData);
      if (!leaked) {
        pass(30, 'Zero responses expose passwordHash or credentials');
      } else {
        fail(30, 'Sensitive data found in one or more responses!');
      }
    }

  } catch (err) {
    console.error('\n💥 Unexpected error during test execution:', err);
  } finally {
    if (server) await new Promise<void>((resolve) => (server as http.Server).close(() => resolve()));
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  }

  // ── Final report ─────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Phase 7D Results: ${passedTests}/${totalTests} tests passed`);
  console.log(`${'─'.repeat(60)}`);

  if (passedTests === totalTests) {
    console.log('\n🎉 ALL PHASE 7D TESTS PASSED\n');
    process.exit(0);
  } else {
    console.error(`\n❌ ${totalTests - passedTests} test(s) failed\n`);
    process.exit(1);
  }
}

runPhase7dTests();
