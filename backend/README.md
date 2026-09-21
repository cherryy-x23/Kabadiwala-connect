# Kabadiwala Connect — Backend API (Phase 1)

Production-style Express + TypeScript + MongoDB backend foundation for the Kabadiwala Connect prototype.

---

## 1. Prerequisites

- **Node.js**: v18+ (tested with Node.js v24.12.0)
- **npm** or **pnpm**
- **MongoDB**: Local Community Server (default port `27017`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster connection URI.

---

## 2. Environment Variables

The backend uses a validated `.env` file based on `.env.example`.

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | Port the Express server listens on | `5000` |
| `NODE_ENV` | Application runtime environment | `development` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/kabadiwala_connect` |
| `JWT_SECRET` | Secret key for JWT signing (Phase 2) | Secure random secret string |
| `CLIENT_URL` | Allowed origin for CORS | `http://localhost:3000` |

### Setting up `.env`:
```bash
cp .env.example .env
```
Ensure `MONGO_URI` points to a reachable MongoDB instance.

---

## 3. Installation

From the `backend/` directory:

```bash
npm install
```

---

## 4. Starting MongoDB

### Option A: Local MongoDB
Ensure your MongoDB service is running:
```bash
# Windows service
net start MongoDB

# Or running mongod manually
mongod --dbpath "C:\data\db"
```

### Option B: MongoDB Atlas (Cloud)
In `backend/.env`, set:
```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/kabadiwala_connect?retryWrites=true&w=majority
```

---

## 5. Running the Backend

### Development Mode (with hot-reload via `tsx`):
```bash
npm run dev
```

### Production Build & Run:
```bash
npm run build
npm start
```

---

## 6. Running the Database Seed Script

Populate the database with initial demo users and scrap materials:

```bash
npm run seed
```

### Demo Credentials (Development Testing Only)

> **IMPORTANT**: These accounts are strictly for local development and prototyping. Passwords are securely hashed with `bcrypt`.

| Role | Email | Password |
|---|---|---|
| **Collector** | `collector@demo.com` | `DemoPassword123!` |
| **Recycler** | `recycler@demo.com` | `DemoPassword123!` |
| **Admin** | `admin@demo.com` | `DemoPassword123!` |

---

## 7. Health Check Endpoint

### `GET /api/v1/health`

Verify server status and live database connectivity:

```bash
curl http://localhost:5000/api/v1/health
```

#### Successful Response (`200 OK`):
```json
{
  "success": true,
  "message": "Kabadiwala Connect API is running",
  "database": "connected"
}
```

#### Database Unreachable Response (`503 Service Unavailable`):
```json
{
  "success": false,
  "message": "Kabadiwala Connect API is running",
  "database": "disconnected"
}
```

---

## 8. Current Models (Phase 1 - 3)

- **`User`**: Identity, email, phone, hashed password, role (`collector`, `recycler`, `admin`), `isVerified`, verification status.
- **`CollectorProfile`**: Collection metrics (`totalCollected`, `totalEarnings`, `completedHandovers`), preferences.
- **`RecyclerProfile`**: Facility info, business name, registration ID, accepted scrap types, operating hours, address.
- **`Material`**: E-waste scrap pricing catalog (`pricePerKg`, `indicativePrice`, `priceTrend`, `unit`, `isActive`).
- **`WasteItem`**: Collector's e-waste inventory (`collectorId`, `materialId`, `quantityKg`, `estimatedValue`, `notes`, `status: available|reserved|handed_over`, `isDeleted`).

---

## 9. Authentication & RBAC Endpoints (Phase 2)

All authentication endpoints are prefixed with `/api/v1/auth`. Authentication state is managed via secure `HttpOnly` cookies.

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/v1/auth/register` | `POST` | Public | Register a new user (`collector` or `recycler` only). Sets HttpOnly JWT cookie. |
| `/api/v1/auth/login` | `POST` | Public | Authenticate user with email and password. Sets HttpOnly JWT cookie. |
| `/api/v1/auth/me` | `GET` | Authenticated | Retrieve current user profile (`requireAuth`). |
| `/api/v1/auth/logout` | `POST` | Public / Auth | Clear authentication cookie. |
| `/api/v1/auth/test/collector` | `GET` | Collector | Development test endpoint (`requireRole('collector')`). |
| `/api/v1/auth/test/admin` | `GET` | Admin | Development test endpoint (`requireRole('admin')`). |

---

## 10. Materials, Recyclers & Waste Endpoints (Phase 3)

### Materials Catalog (`/api/v1/materials`)
| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/v1/materials` | `GET` | Public | List active materials. Optional query: `?category=...&search=...`. |
| `/api/v1/materials/:id` | `GET` | Public | Get details for an active material. |
| `/api/v1/materials` | `POST` | Admin | Create a new material (`requireRole('admin')`). |
| `/api/v1/materials/:id` | `PATCH` | Admin | Update pricing or category (`requireRole('admin')`). |
| `/api/v1/materials/:id` | `DELETE` | Admin | Soft-deactivate material (`isActive: false`). |

### Recycler Catalog (`/api/v1/recyclers`)
| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/v1/recyclers` | `GET` | Public | List active recycler facilities. Optional query: `?material=...`. |
| `/api/v1/recyclers/:id` | `GET` | Public | Get single recycler facility profile and accepted materials. |
| `/api/v1/recyclers/me` | `GET` | Recycler | Get logged-in recycler facility profile (`requireRole('recycler')`). |
| `/api/v1/recyclers/me` | `PATCH` | Recycler | Update editable facility profile info (operating hours, contact, about). |

### Collector Waste Ingestion (`/api/v1/waste`)
| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/v1/waste` | `POST` | Collector | Create waste item. `estimatedValue` is calculated server-side (`quantityKg × material.pricePerKg`). |
| `/api/v1/waste/my` | `GET` | Collector | List authenticated collector's non-deleted waste items. |
| `/api/v1/waste/:id` | `GET` | Collector | View single waste item (enforces strict ownership). |
| `/api/v1/waste/:id` | `PATCH` | Collector | Edit waste item if status is `available`. Recalculates valuation. |
| `/api/v1/waste/:id` | `DELETE` | Collector | Soft-delete waste item if status is `available`. |

---

## 11. Handover Request Endpoints (Phase 4A)

### Handover Requests (`/api/v1/requests`)
| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/v1/requests` | `POST` | Collector | Create handover request. Verifies waste ownership & availability, prevents duplicate active requests, calculates `totalQuantityKg` & `estimatedValue` server-side. Initial status: `pending`. |
| `/api/v1/requests/my` | `GET` | Collector | List authenticated collector's handover requests with populated recycler info. |
| `/api/v1/requests/incoming` | `GET` | Recycler | List requests addressed to authenticated recycler facility. |
| `/api/v1/requests/:id` | `GET` | Collector/Recycler | View request details. Strict ownership check (only owning collector or assigned recycler). |
| `/api/v1/requests/:id/cancel` | `POST` | Collector | Cancel request. Allowed only when status is `pending` or `accepted`. |
| `/api/v1/requests/:id/accept` | `POST` | Recycler | Assigned recycler accepts request (`pending` -> `accepted`). |
| `/api/v1/requests/:id/reject` | `POST` | Recycler | Assigned recycler rejects request (`pending` -> `rejected`) with optional reason. |
| `/api/v1/requests/:id/schedule` | `POST` | Recycler | Assigned recycler schedules pickup date (`accepted` -> `scheduled`). Blocks past dates. |
| `/api/v1/requests/:id/in-transit` | `POST` | Collector/Recycler | Associated collector or recycler marks pickup as in-transit (`scheduled` -> `in_transit`). |
| `/api/v1/requests/:id/complete` | `POST` | Collector/Recycler | Completes request (`in_transit` -> `completed`), generates `HandoverRecord`, creates `Transaction`, marks waste as `handed_over`. Idempotency-safe. |

---

## 12. Digital Handover Record & Transaction Endpoints (Phase 4B)

### Digital Handover Records (`/api/v1/handover-records`)
| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/v1/handover-records/my` | `GET` | Collector | View completed handover records for authenticated collector. |
| `/api/v1/handover-records/incoming` | `GET` | Recycler | View completed handover records for authenticated recycler. |
| `/api/v1/handover-records/:id` | `GET` | Collector/Recycler | View single handover record (only accessible by involved parties). |

### Financial Transactions (`/api/v1/transactions`)
| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/v1/transactions/my` | `GET` | Collector | View transaction/earnings history for authenticated collector. |
| `/api/v1/transactions/incoming` | `GET` | Recycler | View transaction/payout history for authenticated recycler facility. |
| `/api/v1/transactions/:id` | `GET` | Collector/Recycler | View single transaction record (only accessible by involved parties). |

---

## 13. In-App Notification Endpoints (Phase 5A)

### In-App Notifications (`/api/v1/notifications`)
| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/v1/notifications` | `GET` | Authenticated | List notifications for authenticated user with pagination (`?page=1&limit=20&isRead=false`). |
| `/api/v1/notifications/unread-count` | `GET` | Authenticated | Get total unread notifications count for authenticated user. |
| `/api/v1/notifications/read-all` | `PATCH` | Authenticated | Mark all notifications belonging to authenticated user as read. |
| `/api/v1/notifications/:id` | `GET` | Authenticated | Get single notification detail (strict recipient ownership guard). |
| `/api/v1/notifications/:id/read` | `PATCH` | Authenticated | Mark single notification as read. |
| `/api/v1/notifications/:id/unread` | `PATCH` | Authenticated | Mark single notification as unread. |

---

## 14. Running Automated Test Suites

```bash
# Run Phase 1 Database & Health tests
npm run test:phase1

# Run Phase 2 Authentication & RBAC tests (17 assertions)
npm run test:phase2

# Run Phase 3 Materials, Recycler Catalog & Waste tests (30 assertions)
npm run test:phase3

# Run Phase 4A Core Handover Request Workflow tests (24 assertions)
npm run test:phase4a

# Run Phase 4B Digital Handover Record & Transaction tests (28 assertions)
npm run test:phase4b

# Run Phase 5A In-App Notifications tests (20 assertions)
npm run test:phase5a

# Run Phase 5B Notification Reliability & Completeness tests (30 assertions)
npm run test:phase5b
```





