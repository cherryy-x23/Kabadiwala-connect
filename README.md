# Kabadiwala Connect

**Kabadiwala Connect** is a full-stack digital platform connecting informal e-waste collectors (kabadiwalas) with formal recyclers, establishing an end-to-end structured e-waste handover workflow with verified tracking, digital records, simulated settlements, geospatial discovery, and an intelligent AI assistant (KabiAI).

---

## 1. Overview & Architecture

Kabadiwala Connect bridges the gap between the informal e-waste collection ecosystem and authorized recyclers. It formalizes material handovers, enforces transparent tracking, and ensures safe handling and fair pricing.

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (React)                 │
│  - Public Portal, Collector Portal, Recycler Portal, Admin  │
│  - Leaflet / OpenStreetMap for Geospatial Map & Discovery   │
│  - KabiAI Assistant Interface                               │
│  - Role-based Authentication & Session Restoration (/auth/me)│
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON (CORS + HttpOnly Cookie)
┌──────────────────────────────▼──────────────────────────────┐
│                    Express.js Backend API                   │
│  - RESTful API Endpoints (/api/v1)                          │
│  - JWT Authentication in HttpOnly Cookies (Zero JS Token)   │
│  - Zod Request Validation & Role-Based Access Control       │
│  - State Machine for Handover Requests                      │
│  - Geospatial Queries ($nearSphere / 2dsphere index)        │
│  - KabiAI Assistant Service (Gemini API / Mock Fallback)    │
│  - Automated Notifications & Simulated Settlement Engine    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Mongoose ODM
┌──────────────────────────────▼──────────────────────────────┐
│                     MongoDB Database                        │
│  - Users, Collectors, Recyclers (with 2dsphere location)    │
│  - Materials, WasteItems, HandoverRequests                  │
│  - HandoverRecords (Immutable), Transactions (Simulated)    │
│  - Notifications, AI Conversations & Messages               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

- **Frontend**: Next.js (App / Pages), React 18, TypeScript, Tailwind CSS, Lucide Icons, Leaflet / OpenStreetMap.
- **Backend**: Node.js, Express.js, TypeScript, Mongoose ODM.
- **Database**: MongoDB (with Geospatial `2dsphere` index).
- **Authentication**: JSON Web Tokens (JWT) stored in `HttpOnly`, `SameSite=Lax` cookies, bcrypt password hashing.
- **Validation**: Zod schema validation.
- **AI Integration**: KabiAI Assistant powered by Google Gemini API (`@google/genai`) with offline deterministic Mock Provider fallback.

---

## 3. Demo Credentials

For testing and hackathon demonstration, the platform includes pre-seeded accounts:

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Collector** | `collector@demo.com` | `DemoPassword123!` | Informal waste collector with pre-loaded waste items and requests |
| **Recycler** | `recycler@demo.com` | `DemoPassword123!` | Certified recycling center with verified location coordinates |
| **Admin** | `admin@demo.com` | `DemoPassword123!` | System administrator with access to catalog, users, and audit logs |

---

## 4. Setup & Installation

### Prerequisites
- Node.js (v18 or v20 recommended)
- MongoDB running locally on `mongodb://localhost:27017` (or a remote MongoDB connection string)
- npm or yarn

### 1. Backend Setup

1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Ensure variables are properly set:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/kabadiwala_connect
   JWT_SECRET=kabadiwala_connect_dev_jwt_secret_key_2025_secure_random
   JWT_EXPIRES_IN=7d
   FRONTEND_URL=http://localhost:3000
   NODE_ENV=development
   # Optional: Set your real Gemini API Key for KabiAI
   GEMINI_API_KEY=
   ```
4. Seed the database with initial materials and demo accounts:
   ```bash
   npm run seed
   ```
5. Start the backend development server:
   ```bash
   npm run dev
   ```
   The backend API will run on `http://localhost:5000/api/v1`.

### 2. Frontend Setup

1. Open a new terminal in the project root directory:
   ```bash
   cd ..
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Ensure variables are properly set:
   ```env
   NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:3000`.

---

## 5. End-to-End Workflow

The platform follows a verified lifecycle for e-waste handling:

1. **Collector Adds E-Waste**: The collector enters waste items (e.g., motherboards, batteries, laptops) with estimated weight and condition.
2. **Recycler Discovery**: Collector searches for authorized recyclers by proximity (radius filtering) or accepted material types on an interactive OpenStreetMap.
3. **Handover Request Created**: Collector sends a handover request with selected waste items to a specific recycler.
4. **Recycler Acceptance & Scheduling**: The recycler reviews the request, accepts it, schedules pickup/drop-off, and marks it in-transit.
5. **Verified Handover & Digital Records**:
   - The recycler completes the handover upon receiving items.
   - Waste status transitions to `handed_over`.
   - An immutable `HandoverRecord` is minted.
   - An associated `Transaction` record is created.
6. **Simulated Settlement**: The system calculates payments according to pre-configured material rates, clearly labeled as a **simulated settlement** for demonstrative and audit purposes.
7. **KabiAI Assistant**: Collectors and recyclers can ask questions about e-waste safety, material values, and platform workflows.

---

## 6. Testing & Regression Suites

Comprehensive automated test suites cover every layer of the platform:

```bash
cd backend

# Run Phase 9 Final Verification Suite
npm run test:phase9

# Run Individual Phase Suites
npm run test:phase1
npm run test:phase2
npm run test:phase3
npm run test:phase4a
npm run test:phase4b
npm run test:phase5a
npm run test:phase5b
npm run test:phase6a
npm run test:phase6b
npm run test:phase7a
npm run test:phase7b
npm run test:phase7c
npm run test:phase7d
npm run test:phase8
```

---

## 7. Important Scope & Platform Limitations

- **Simulated Settlement**: Payment settlements and transaction balances are strictly simulated for hackathon demonstration. No real bank accounts or financial payment gateways are integrated.
- **No Government / Municipal Integration**: There is no direct integration with GHMC (Greater Hyderabad Municipal Corporation) or governmental APIs.
- **No Direct SMS / WhatsApp Gateways**: Notifications are delivered in-app through the platform notification center.
- **Maps**: Maps are powered by OpenStreetMap and Leaflet without commercial vendor locks.
- **KabiAI**: Powered by Google Gemini when `GEMINI_API_KEY` is present in the backend `.env`. When unconfigured, a deterministic offline Mock Provider gracefully handles queries. Gemini API keys are strictly backend-only and never exposed to the frontend.
