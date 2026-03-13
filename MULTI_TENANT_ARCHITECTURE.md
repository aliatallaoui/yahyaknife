# Multi-Tenant SaaS Architecture — COD Flow Platform

> Complete architecture design for production-grade multi-tenancy.
> Stack: Express + MongoDB/Mongoose + React + Vite + Tailwind

---

## Table of Contents

1. [What Is a Tenant](#1-what-is-a-tenant)
2. [Current State Audit](#2-current-state-audit)
3. [Data Isolation Strategy](#3-data-isolation-strategy)
4. [Tenant Domain Model](#4-tenant-domain-model)
5. [Authentication Flow](#5-authentication-flow)
6. [Authorization Flow](#6-authorization-flow)
7. [Database Design Rules](#7-database-design-rules)
8. [Backend Service Organization](#8-backend-service-organization)
9. [Tenant Context Flow](#9-tenant-context-flow)
10. [Background Jobs](#10-background-jobs)
11. [File Storage](#11-file-storage)
12. [Configuration & Settings](#12-configuration--settings)
13. [Billing & Subscriptions](#13-billing--subscriptions)
14. [Tenant Lifecycle](#14-tenant-lifecycle)
15. [DevOps & Infrastructure](#15-devops--infrastructure)
16. [Scaling Strategy](#16-scaling-strategy)
17. [Security](#17-security)
18. [Observability & Monitoring](#18-observability--monitoring)
19. [Backups & Recovery](#19-backups--recovery)
20. [Developer Guardrails](#20-developer-guardrails)
21. [Implementation Roadmap](#21-implementation-roadmap)

---

## 1. What Is a Tenant

A **tenant** is a single business/company/organization using the platform. It is the top-level isolation boundary.

```
Platform (COD Flow)
├── Tenant A (Boutique Lina — Algiers)
│   ├── Owner: Lina
│   ├── 3 agents, 2 managers
│   ├── 12,000 orders
│   ├── 800 customers
│   ├── 45 products
│   └── Settings: DZD, Africa/Algiers, Arabic
│
├── Tenant B (Tech Store DZ — Oran)
│   ├── Owner: Karim
│   ├── 8 agents, 1 manager
│   ├── 50,000 orders
│   ├── 3,200 customers
│   ├── 200 products
│   └── Settings: DZD, Africa/Algiers, French
│
└── Tenant C (Fashion House — Constantine)
    └── ...
```

**Each tenant has its own isolated:**
- Users (owner, managers, agents, employees)
- Orders, customers, shipments
- Products and inventory
- Couriers and shipping config
- Analytics and reports
- HR (employees, attendance, payroll)
- Settings and preferences
- Roles and permissions

**Users never see another tenant's data. Period.**

---

## 2. Current State Audit

### What EXISTS today (working correctly)

| Component | Status | Notes |
|-----------|--------|-------|
| Tenant model | ✅ | `Tenant.js` with plan, subscription, settings |
| User → Tenant link | ⚠️ | Field exists but is **optional** (not `required: true`) |
| Auth middleware tenant resolution | ✅ | `req.user.tenant` populated on every request |
| Subscription gate | ✅ | 14-day trial, 402 on expiry, 2-min cache |
| 30 tenant-scoped models | ✅ | Order, Customer, Courier, Employee, etc. |
| Controller-level `tenant: req.user.tenant` | ✅ | Consistent across all controllers |
| Role isolation | ✅ | Compound unique `{ name, tenant }` |
| Audit trail | ✅ | AuditLog includes tenant on every action |
| Request logging with tenant | ✅ | pino-http logs include tenant ID |
| Permission catalog | ✅ | 60+ permissions in `shared/constants/permissions.js` |

### What NEEDS fixing

| Issue | Severity | Fix |
|-------|----------|-----|
| `User.tenant` is optional, not required | **CRITICAL** | Make required in schema |
| JWT doesn't include tenant ID | Medium | Add to token payload |
| No tenant null-guard middleware | High | Add after `protect` middleware |
| Shared models (Product, Supplier) have no tenant | **By design** | Must decide: keep shared or scope per-tenant |
| No multi-tenant user support | Low | Currently 1 user = 1 tenant (acceptable for now) |
| Cron jobs may not iterate per-tenant | High | Verify and fix |
| No tenant management endpoints | Medium | Need CRUD for tenant settings |

---

## 3. Data Isolation Strategy

### The Three Approaches

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **Shared DB + tenant_id** | Single database, every collection has `tenant` field | Simple, cheap, easy migrations | Query discipline required, no physical isolation |
| **Schema-per-tenant** | N/A for MongoDB (no schema concept like PostgreSQL) | — | — |
| **Database-per-tenant** | Each tenant gets own MongoDB database | Full isolation, easy backups | Expensive, hard migrations, connection pool explosion |
| **Hybrid** | Shared DB for small tenants, dedicated DB for enterprise | Best of both | Complex routing logic |

### Chosen Approach: Shared Database + tenant_id (Row-Level Isolation)

**Why this is correct for COD Flow:**

1. **Cost** — One MongoDB cluster serves all tenants. No per-tenant DB overhead.
2. **Migrations** — One schema change applies everywhere. No N-database migration nightmare.
3. **Queries** — Compound indexes `{ tenant: 1, ... }` make tenant-scoped queries fast.
4. **Scaling** — MongoDB sharding can use `tenant` as part of shard key when needed.
5. **Simplicity** — Every developer understands the pattern: add `tenant` to query.
6. **Current reality** — This is already what the codebase does with 30 models.

**When to consider per-tenant DB:**
- An enterprise customer demands physical isolation (contractual/legal)
- One tenant has 10M+ orders and needs dedicated resources
- At that point, implement hybrid: route that tenant to a dedicated cluster

### Isolation Guarantee

```
RULE: Every document in a tenant-scoped collection MUST have a `tenant` field.
RULE: Every query on a tenant-scoped collection MUST filter by `tenant`.
RULE: Every index on a tenant-scoped collection MUST start with `tenant`.
```

---

## 4. Tenant Domain Model

### Core Entities and Their Relationships

```
┌─────────────────────────────────────────┐
│                 TENANT                   │
│  (one company/business/organization)    │
├─────────────────────────────────────────┤
│  _id                                    │
│  name: "Boutique Lina"                  │
│  slug: "boutique-lina"                  │
│  owner: ObjectId → User                 │
│  planTier: Free|Basic|Pro|Enterprise    │
│  subscription: {                        │
│    status: trialing|active|past_due|... │
│    trialEndsAt: Date                    │
│    currentPeriodEnd: Date               │
│    stripeCustomerId: String             │
│  }                                      │
│  settings: {                            │
│    currency: "DZD"                      │
│    timezone: "Africa/Algiers"           │
│    locale: "ar-DZ"                      │
│    defaultCourier: ObjectId             │
│    businessPhone: String                │
│    businessAddress: String              │
│    logo: String (URL)                   │
│  }                                      │
│  limits: {                              │
│    maxUsers: 5                          │
│    maxOrdersPerMonth: 1000              │
│    maxProducts: 100                     │
│  }                                      │
│  isActive: true                         │
│  createdAt, updatedAt                   │
└──────────┬──────────────────────────────┘
           │
           │ 1:N
           ▼
┌─────────────────────────────────────────┐
│                  USER                    │
│  (a person who can log in)              │
├─────────────────────────────────────────┤
│  _id                                    │
│  tenant: ObjectId → Tenant (REQUIRED)   │
│  name: "Lina Bouzid"                    │
│  email: "lina@boutiquelina.com"         │
│  phone: "0555123456"                    │
│  passwordHash: "..."                    │
│  role: ObjectId → Role                  │
│  status: active|suspended|invited       │
│  lastLogin: Date                        │
│  refreshToken: String (select: false)   │
│  createdAt, updatedAt                   │
└──────────┬──────────────────────────────┘
           │
           │ N:1
           ▼
┌─────────────────────────────────────────┐
│                  ROLE                    │
│  (defines what a user can do)           │
├─────────────────────────────────────────┤
│  _id                                    │
│  name: "Call Center Agent"              │
│  tenant: ObjectId|null                  │
│         null = system role (shared)     │
│         ObjectId = tenant custom role   │
│  permissions: [String]                  │
│    e.g. ["orders.view","callcenter..."] │
│  isSystem: true|false                   │
│  createdAt, updatedAt                   │
│                                         │
│  UNIQUE: { name, tenant }               │
└─────────────────────────────────────────┘
```

### Key Relationships Explained

```
TENANT ──1:N──> USER         "A tenant has many users"
USER   ──N:1──> ROLE         "Each user has one role"
ROLE   ──1:N──> PERMISSION   "Each role has many permissions"
TENANT ──1:N──> ORDER        "A tenant has many orders"
TENANT ──1:N──> CUSTOMER     "A tenant has many customers"
TENANT ──1:N──> COURIER      "A tenant has many couriers"
... (all tenant-scoped entities follow this pattern)
```

### Terminology

| Term | Definition |
|------|-----------|
| **Tenant** | The company/business. The isolation boundary. |
| **User** | A person with login credentials. Always belongs to exactly one tenant. |
| **Role** | A named set of permissions. Can be system-wide (tenant=null) or tenant-custom. |
| **Permission** | A string like `orders.view` that grants access to a specific action. |
| **Owner** | The user who created the tenant. Has the "Owner/Founder" system role with all permissions. |
| **Membership** | Currently implicit (User.tenant + User.role). Not a separate model. |

### Why No Separate Membership Model (Yet)

A separate `TenantMembership` model is needed when:
- Users can belong to **multiple** tenants
- You need invitation workflows with pending states
- You need per-tenant role overrides for the same user

**Current state:** One user = one tenant. This is correct for Phase 1.

**When to add TenantMembership:**
- When you add a "platform admin" concept (Anthropic-style: one person manages multiple workspaces)
- When agencies manage multiple client businesses
- Estimated: when you have 50+ tenants with management overlap

---

## 5. Authentication Flow

### Current Flow (Working)

```
Client                    Server                      Database
  │                         │                            │
  ├──POST /api/auth/login──►│                            │
  │  {email, password}      │                            │
  │                         ├──User.findOne({email})────►│
  │                         │◄──user (with tenant)───────│
  │                         │                            │
  │                         ├──bcrypt.compare()          │
  │                         │                            │
  │                         ├──jwt.sign({id: user._id})  │
  │                         │  (1-day access token)      │
  │                         │                            │
  │                         ├──generate refreshToken     │
  │                         │  (30-day, saved to User)   │
  │                         │                            │
  │◄──{token, refreshToken, │                            │
  │    user, subscription}──│                            │
  │                         │                            │
  ├──GET /api/orders────────►                            │
  │  Authorization: Bearer  │                            │
  │                         ├──jwt.verify(token)         │
  │                         ├──User.findById(decoded.id) │
  │                         │  (cached 10 min)           │
  │                         ├──req.user = user           │
  │                         │  req.user.tenant = "abc"   │
  │                         │                            │
  │                         ├──Tenant subscription check │
  │                         │  (cached 2 min)            │
  │                         │                            │
  │                         ├──Permission check          │
  │                         │  authorize('orders.view')  │
  │                         │                            │
  │                         ├──Order.find({              │
  │                         │    tenant: req.user.tenant  │
  │                         │  })                        │
  │                         │                            │
  │◄──{data: orders}────────│                            │
```

### Recommended Improvements

#### 1. Include tenant in JWT payload

```javascript
// CURRENT (lightweight but requires DB hit)
const token = jwt.sign({ id: user._id }, SECRET, { expiresIn: '1d' });

// RECOMMENDED (allows offline tenant verification)
const token = jwt.sign(
  { id: user._id, tenant: user.tenant.toString() },
  SECRET,
  { expiresIn: '1d' }
);
```

**Why:** If cache expires and DB is momentarily slow, tenant is still in token. Also enables edge-level tenant routing in the future.

#### 2. Registration with Tenant Creation

```
New User Signs Up
  │
  ├── Provides businessName?
  │     YES → Create new Tenant (14-day trial)
  │           Create User (tenant = new tenant, role = Owner/Founder)
  │           Return token + subscription info
  │
  │     NO → Provides tenantId (invited)?
  │           YES → Validate tenant exists + is active
  │                 Create User (tenant = existing, role = from invite)
  │                 Return token
  │
  │           NO → REJECT (every user must have a tenant)
```

#### 3. Invite Flow

```
Owner/Manager sends invite
  │
  ├── POST /api/tenants/invite
  │   { email, roleId }
  │
  ├── Server creates InviteToken (signed, 7-day expiry)
  │   Contains: { tenantId, email, roleId }
  │
  ├── Send email with invite link
  │   /join?token=xxx
  │
  ├── Invitee clicks link
  │   POST /api/auth/register-invited
  │   { token, name, password }
  │
  ├── Server validates invite token
  │   Creates User with tenant + role from invite
  │   Returns auth token
```

---

## 6. Authorization Flow

### Four-Layer Check (Every Request)

```
Layer 1: AUTHENTICATION
  └── Is the JWT valid? Is the user real?
      ✗ → 401 Unauthorized

Layer 2: TENANT STATUS
  └── Is the tenant active? Is subscription valid?
      ✗ → 402 Payment Required / 403 Suspended

Layer 3: PERMISSION
  └── Does the user's role include the required permission?
      ✗ → 403 Forbidden

Layer 4: RESOURCE OWNERSHIP
  └── Does the requested resource belong to this tenant?
      ✗ → 404 Not Found (never 403 — don't reveal existence)
```

### Implementation Pattern

```javascript
// routes/orders.js
router.get('/',
  protect,                        // Layer 1: auth
  // Layer 2: subscription check is inside protect middleware
  authorize(PERMS.ORDERS_VIEW),   // Layer 3: permission
  orderController.getOrders       // Layer 4: tenant scope in query
);

// controllers/orderController.js
exports.getOrders = async (req, res) => {
  const orders = await Order.find({
    tenant: req.user.tenant,      // Layer 4: tenant isolation
    deletedAt: null
  });
  // ...
};
```

### Why Frontend Visibility Is NOT Enough

```
WRONG:
  "I'll just hide the button on the frontend"

RIGHT:
  Backend MUST enforce. Frontend is cosmetic.
  An attacker with curl/Postman bypasses all frontend checks.
```

**Every endpoint must:**
1. Verify the user is authenticated
2. Verify the tenant is active
3. Verify the user has the permission
4. Scope all queries to `tenant: req.user.tenant`

### Role Hierarchy (Recommended)

```
Owner/Founder     → ALL permissions (immutable)
Super Admin       → ALL permissions (assignable)
Manager           → Most permissions except billing/tenant deletion
Team Lead         → Department-level permissions
Call Center Agent  → callcenter.*, orders.view
Warehouse Agent   → inventory.*, orders.view
Finance Agent     → finance.*, orders.view
Viewer            → *.view only (read-only)
Custom Role       → Any combination (tenant creates their own)
```

---

## 7. Database Design Rules

### Rule 1: Every tenant-scoped collection MUST have `tenant` field

```javascript
// CORRECT
const OrderSchema = new Schema({
  tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
  // ...
});

// WRONG — missing tenant
const OrderSchema = new Schema({
  // no tenant field!
  orderId: String,
  // ...
});
```

### Rule 2: Compound indexes MUST start with tenant

```javascript
// CORRECT — tenant-first compound indexes
OrderSchema.index({ tenant: 1, createdAt: -1 });
OrderSchema.index({ tenant: 1, status: 1, deletedAt: 1 });
OrderSchema.index({ tenant: 1, customer: 1 });

// WRONG — tenant is not first
OrderSchema.index({ createdAt: -1, tenant: 1 });  // Full scan across tenants!
OrderSchema.index({ status: 1 });                  // No tenant isolation!
```

### Rule 3: Unique constraints MUST include tenant

```javascript
// CORRECT — unique within tenant
OrderSchema.index({ tenant: 1, orderId: 1 }, { unique: true });
RoleSchema.index({ tenant: 1, name: 1 }, { unique: true });

// WRONG — globally unique (cross-tenant collision)
OrderSchema.index({ orderId: 1 }, { unique: true });
```

### Rule 4: No query without tenant scope

```javascript
// CORRECT
const orders = await Order.find({ tenant: req.user.tenant, deletedAt: null });

// WRONG — reads ALL tenants' data!
const orders = await Order.find({ deletedAt: null });

// WRONG — trusting frontend-provided tenant
const orders = await Order.find({ tenant: req.body.tenantId });

// CORRECT — always from req.user.tenant (server-side)
const tenantId = req.user.tenant; // Set by auth middleware, never from client
```

### Rule 5: Soft delete pattern

```javascript
// CORRECT — filter by deletedAt
const customers = await Customer.find({
  tenant: req.user.tenant,
  deletedAt: null  // NOT { $exists: false } — use null match
});

// Soft delete
await Customer.updateOne(
  { _id: id, tenant: req.user.tenant },
  { deletedAt: new Date() }
);
```

### Collection Classification

**Tenant-Scoped (30 collections) — MUST have `tenant` field:**

| Collection | Index Strategy |
|-----------|---------------|
| Order | `{ tenant:1, createdAt:-1 }`, `{ tenant:1, status:1, deletedAt:1 }` |
| Customer | `{ tenant:1, status:1, _id:-1 }`, `{ tenant:1, phone:1 }` |
| Courier | `{ tenant:1, deletedAt:1 }` |
| Shipment | `{ tenant:1, order:1 }`, `{ tenant:1, trackingId:1 }` |
| Employee | `{ tenant:1, deletedAt:1 }` |
| Attendance | `{ tenant:1, date:1 }` |
| Payroll | `{ tenant:1, month:1 }` |
| AuditLog | `{ tenant:1, createdAt:-1 }` |
| Role | `{ tenant:1, name:1 }` unique |
| Revenue | `{ tenant:1, date:1 }` |
| CallNote | `{ tenant:1, order:1 }` |
| DailyRollup | `{ tenant:1, date:1 }` unique |
| ... | Same pattern for all 30 |

**Shared (Platform-Wide) — Intentionally NO tenant field:**

| Collection | Reason |
|-----------|--------|
| Product | Shared catalog (knife models available to all) |
| ProductVariant | Variants of shared products |
| Category | Shared product categories |
| Supplier | Shared supplier directory |
| Warehouse | Shared physical locations |
| CourierSetting | Shared courier API configs |
| CourierCoverage | Shared coverage zones |
| CourierPricing | Shared pricing rules |

**Decision: Should Products Be Tenant-Scoped?**

Current: Shared. This works if all tenants sell from the same product catalog (e.g., workshop products).

If each tenant has their own products → Add `tenant` field to Product, ProductVariant, Category. This is a **breaking migration** that should be planned carefully.

**Recommendation:** Keep shared for now. Add tenant-scoping to Product when:
- Tenants are different businesses (not all selling the same workshop's knives)
- One tenant's product shouldn't be visible to another

---

## 8. Backend Service Organization

### Domain Structure

```
backend/
├── middleware/
│   ├── authMiddleware.js        ← protect + authorize + subscription gate
│   ├── tenantGuard.js           ← NEW: ensures req.user.tenant exists
│   └── requestId.js             ← correlation ID
│
├── domains/
│   ├── auth/
│   │   ├── auth.controller.js
│   │   ├── auth.routes.js
│   │   └── auth.service.js      ← login, register, refresh, invite
│   │
│   ├── tenants/
│   │   ├── tenant.controller.js ← NEW: CRUD tenant settings
│   │   ├── tenant.routes.js
│   │   └── tenant.service.js    ← create, update, suspend, delete
│   │
│   ├── orders/
│   │   ├── order.controller.js
│   │   ├── order.routes.js
│   │   ├── order.service.js     ← createOrder, updateOrder (state machine)
│   │   └── order.statemachine.js
│   │
│   ├── dispatch/
│   │   └── shipment.service.js
│   │
│   └── ... (customers, couriers, inventory, hr, analytics, billing)
│
├── shared/
│   ├── constants/
│   │   ├── permissions.js       ← PERMS catalog
│   │   └── orderStatuses.js     ← status enums
│   ├── errors/
│   │   ├── AppError.js
│   │   └── errorHandler.js
│   ├── utils/
│   │   ├── ApiResponse.js
│   │   ├── auditLog.js
│   │   └── retryAsync.js
│   └── middleware/
│       ├── paginate.js
│       └── requestId.js
│
├── models/                      ← Mongoose schemas
├── jobs/                        ← Background jobs (tenant-aware)
├── services/                    ← Shared services (cache, queue, message)
└── server.js                    ← Express app setup
```

### Tenant Scoping Pattern (Per Domain)

```javascript
// WHERE tenant scoping happens — SERVICE LAYER
// NOT in controllers, NOT in routes

// domains/orders/order.service.js
class OrderService {
  static async createOrder(tenantId, orderData, actorId) {
    //                      ^^^^^^^^
    // tenantId is ALWAYS the first parameter
    // It comes from req.user.tenant (set by auth middleware)
    // NEVER from req.body or req.params

    const order = await Order.create({
      tenant: tenantId,     // ← tenant scoping
      ...orderData,
      createdBy: actorId,
    });
    return order;
  }

  static async getOrders(tenantId, filters, pagination) {
    return Order.find({
      tenant: tenantId,     // ← tenant scoping
      deletedAt: null,
      ...filters,
    })
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit)
    .lean();
  }
}
```

### Guardrail: Tenant-Scoped Base Repository

```javascript
// shared/utils/tenantRepo.js — NEW
// A base helper that prevents forgetting tenant scope

class TenantRepo {
  constructor(model) {
    this.model = model;
  }

  find(tenantId, filter = {}, options = {}) {
    if (!tenantId) throw new Error('tenantId is required for tenant-scoped query');
    return this.model.find({ tenant: tenantId, deletedAt: null, ...filter })
      .sort(options.sort || { createdAt: -1 })
      .skip(options.skip || 0)
      .limit(options.limit || 50)
      .lean();
  }

  findById(tenantId, id) {
    if (!tenantId) throw new Error('tenantId is required');
    return this.model.findOne({ _id: id, tenant: tenantId, deletedAt: null }).lean();
  }

  create(tenantId, data) {
    if (!tenantId) throw new Error('tenantId is required');
    return this.model.create({ tenant: tenantId, ...data });
  }

  updateOne(tenantId, id, update) {
    if (!tenantId) throw new Error('tenantId is required');
    return this.model.findOneAndUpdate(
      { _id: id, tenant: tenantId, deletedAt: null },
      update,
      { new: true }
    );
  }

  softDelete(tenantId, id) {
    if (!tenantId) throw new Error('tenantId is required');
    return this.model.updateOne(
      { _id: id, tenant: tenantId },
      { deletedAt: new Date() }
    );
  }
}

// Usage:
const orderRepo = new TenantRepo(Order);
const orders = await orderRepo.find(req.user.tenant, { status: 'Confirmed' });
```

---

## 9. Tenant Context Flow

### Request → Response Pipeline

```
HTTP Request (Bearer token)
    │
    ▼
┌─────────────────────────┐
│  1. requestId middleware │  Generate X-Request-Id (UUID)
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  2. pino-http logging   │  Log: method, url, requestId
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  3. protect middleware   │  JWT verify → User.findById (cached)
│     (authMiddleware)     │  Sets: req.user = { _id, name, email, tenant, role }
│                          │  Checks: subscription status (trialing/active)
│                          │  Rejects: 401 (bad token), 402 (expired sub)
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  4. tenantGuard          │  Validates: req.user.tenant is not null/undefined
│     (NEW middleware)     │  Rejects: 400 "No tenant context"
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  5. authorize(PERM)     │  Checks: req.user.role.permissions.includes(PERM)
│                          │  Rejects: 403 Forbidden
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  6. Controller           │  Extracts params, calls service
│                          │  Passes: req.user.tenant to service
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  7. Service Layer        │  Business logic + validation
│                          │  ALL queries include tenant scope
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  8. Database (MongoDB)   │  Compound index: { tenant: 1, ... }
│                          │  Only returns this tenant's data
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  9. Response             │  ApiResponse.ok(data)
│                          │  Headers: X-Request-Id
└─────────────────────────┘
```

### Context Propagation in Different Scenarios

#### API Requests
```javascript
// Tenant from auth middleware → req.user.tenant
// Passed explicitly to service layer
const orders = await OrderService.getOrders(req.user.tenant, filters);
```

#### Background Jobs
```javascript
// Jobs MUST carry tenantId in their payload
await queue.add('daily-rollup', {
  tenantId: tenant._id.toString(),
  date: '2026-03-13',
  triggeredBy: 'scheduler',
});

// Job processor extracts tenant from payload
async function processDailyRollup(job) {
  const { tenantId, date } = job.data;
  // ALL queries inside use tenantId
  const orders = await Order.find({ tenant: tenantId, ... });
}
```

#### WebSocket / Realtime
```javascript
// On connection, authenticate and extract tenant
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const decoded = jwt.verify(token, SECRET);
  const user = await User.findById(decoded.id);
  socket.tenantId = user.tenant;
  socket.userId = user._id;
  next();
});

// Join tenant-specific room
socket.join(`tenant:${socket.tenantId}`);

// Broadcast only to same tenant
io.to(`tenant:${tenantId}`).emit('order:updated', data);
```

#### Exports
```javascript
// Export file scoped to tenant
const filePath = `exports/${tenantId}/orders-${date}.xlsx`;
// Query scoped to tenant
const orders = await Order.find({ tenant: tenantId }).lean();
```

---

## 10. Background Jobs

### Tenant-Aware Job Architecture

```
┌──────────────────────────────────────────────────────┐
│                    JOB QUEUE (BullMQ / Agenda)        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Every job payload MUST include:                     │
│  {                                                   │
│    tenantId: ObjectId,                               │
│    actorId: ObjectId (optional),                     │
│    requestId: String (for tracing),                  │
│    ...jobSpecificData                                │
│  }                                                   │
│                                                      │
│  Job types:                                          │
│  ├── daily-rollup        (per-tenant analytics)      │
│  ├── weekly-report       (per-tenant weekly summary) │
│  ├── courier-sync        (per-tenant shipment sync)  │
│  ├── export-orders       (per-tenant file export)    │
│  ├── send-notification   (per-tenant SMS/email)      │
│  ├── reorder-check       (per-tenant stock alerts)   │
│  ├── billing-usage       (per-tenant usage calc)     │
│  └── data-cleanup        (per-tenant archive)        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Scheduler Pattern (Cron Jobs That Run Per-Tenant)

```javascript
// jobs/scheduler.js — CORRECT pattern

const runForAllTenants = async (jobName, jobFn) => {
  const tenants = await Tenant.find({ isActive: true }).select('_id name').lean();
  logger.info({ jobName, tenantCount: tenants.length }, 'Starting per-tenant job');

  for (const tenant of tenants) {
    try {
      await jobFn(tenant._id);
      logger.info({ jobName, tenantId: tenant._id }, 'Tenant job completed');
    } catch (err) {
      // One tenant failure must NOT block others
      logger.error({ jobName, tenantId: tenant._id, err: err.message }, 'Tenant job failed');
      Sentry?.captureException(err, { tags: { tenantId: tenant._id, job: jobName } });
    }
  }
};

// Usage:
cron.schedule('30 0 * * *', () => runForAllTenants('daily-rollup', runDailyRollup));
cron.schedule('59 23 * * 0', () => runForAllTenants('weekly-report', runWeeklyReport));
```

### Preventing Tenant Queue Starvation

```
Problem: Tenant A exports 100,000 orders. This blocks all workers.
         Tenant B's 100-order export waits 30 minutes.

Solution 1: Per-tenant concurrency limits
  queue.add('export', { tenantId }, {
    groupKey: tenantId,     // BullMQ Pro feature
    maxConcurrency: 2,      // Max 2 concurrent jobs per tenant
  });

Solution 2: Priority queues
  Small tenants get higher priority.
  Large exports go to low-priority queue.

Solution 3: Dedicated worker pools (at scale)
  Critical queue: order processing, courier sync (fast, < 5s)
  Batch queue: exports, analytics, reports (slow, can wait)
```

---

## 11. File Storage

### Directory Structure

```
storage/
├── {tenantId}/
│   ├── products/
│   │   ├── {productId}/
│   │   │   ├── main.jpg
│   │   │   ├── thumb.jpg
│   │   │   └── gallery-1.jpg
│   │   └── ...
│   │
│   ├── exports/
│   │   ├── orders-2026-03-13.xlsx
│   │   ├── customers-2026-03.csv
│   │   └── ...
│   │
│   ├── invoices/
│   │   ├── INV-2026-001.pdf
│   │   └── ...
│   │
│   ├── hr/
│   │   ├── employees/
│   │   │   ├── {employeeId}/
│   │   │   │   ├── id-card.jpg
│   │   │   │   └── contract.pdf
│   │   │   └── ...
│   │   └── payslips/
│   │       └── 2026-03/
│   │           └── {employeeId}.pdf
│   │
│   ├── labels/
│   │   ├── {shipmentId}.pdf
│   │   └── ...
│   │
│   └── branding/
│       ├── logo.png
│       └── favicon.ico
│
└── platform/                   ← NOT tenant-scoped
    ├── shared-assets/
    └── system-reports/
```

### Access Control

```javascript
// RULE: File access MUST verify tenant ownership

// S3/Cloudflare R2 path includes tenantId
const key = `${req.user.tenant}/exports/${filename}`;

// Generate signed URL (expires in 15 min)
const url = s3.getSignedUrl('getObject', {
  Bucket: BUCKET,
  Key: key,
  Expires: 900,
});

// NEVER serve files without tenant verification
app.get('/files/:tenantId/:path*', protect, (req, res) => {
  if (req.params.tenantId !== req.user.tenant.toString()) {
    return res.status(404).json({ message: 'Not found' });
  }
  // ... serve file
});
```

---

## 12. Configuration & Settings

### Four Levels of Configuration

```
Level 1: PLATFORM (global, all tenants)
  ├── Supported couriers
  ├── Platform features/flags
  ├── Default pricing rules
  ├── System roles
  └── Stored in: env vars + platform config collection

Level 2: TENANT (per-organization)
  ├── Company name, logo
  ├── Currency, timezone, locale
  ├── Default courier
  ├── COD settings (fee structure, payment methods)
  ├── Notification preferences
  ├── Business hours
  ├── Auto-confirm rules
  └── Stored in: Tenant.settings subdocument

Level 3: USER PREFERENCES (per-user within tenant)
  ├── Language preference
  ├── Dashboard layout
  ├── Notification channels
  ├── Theme (dark/light)
  └── Stored in: User.preferences subdocument

Level 4: MODULE SETTINGS (per-tenant per-module)
  ├── Call center: auto-assign rules, scripts
  ├── Inventory: reorder thresholds
  ├── Analytics: report schedule
  └── Stored in: dedicated settings collections with tenant scope
```

### Tenant Settings Schema

```javascript
// Inside Tenant model
settings: {
  // Branding
  companyName: String,
  logo: String,
  brandColor: { type: String, default: '#4F46E5' },

  // Regional
  currency: { type: String, default: 'DZD' },
  timezone: { type: String, default: 'Africa/Algiers' },
  locale: { type: String, default: 'ar-DZ' },

  // Business
  defaultCourier: { type: ObjectId, ref: 'Courier' },
  businessPhone: String,
  businessAddress: String,
  businessHours: {
    open: { type: String, default: '08:00' },
    close: { type: String, default: '18:00' },
    workDays: { type: [Number], default: [0, 1, 2, 3, 4] }, // Sun-Thu
  },

  // COD
  codSettings: {
    defaultFeeType: { type: String, enum: ['flat', 'percentage'], default: 'flat' },
    defaultFee: { type: Number, default: 0 },
    paymentMethods: { type: [String], default: ['cash'] },
  },

  // Notifications
  notifications: {
    orderConfirmSms: { type: Boolean, default: false },
    dispatchSms: { type: Boolean, default: false },
    deliverySms: { type: Boolean, default: false },
    smsGateway: String,
    smsApiKey: String,
  },
}
```

### Efficient Retrieval

```javascript
// Cache tenant settings (changes rarely)
const getTenantSettings = async (tenantId) => {
  const cacheKey = `tenant:settings:${tenantId}`;
  let settings = await cache.get(cacheKey);
  if (!settings) {
    const tenant = await Tenant.findById(tenantId).select('settings limits').lean();
    settings = tenant;
    await cache.set(cacheKey, settings, 300); // 5 min cache
  }
  return settings;
};

// Invalidate on update
const updateTenantSettings = async (tenantId, updates) => {
  await Tenant.updateOne({ _id: tenantId }, { $set: updates });
  await cache.del(`tenant:settings:${tenantId}`);
};
```

---

## 13. Billing & Subscriptions

### Plan Tiers

```
┌──────────┬──────────┬──────────┬──────────┬─────────────┐
│          │  Free    │  Basic   │  Pro     │  Enterprise │
├──────────┼──────────┼──────────┼──────────┼─────────────┤
│ Users    │  2       │  5       │  20      │  Unlimited  │
│ Orders/mo│  100     │  2,000   │  20,000  │  Unlimited  │
│ Products │  20      │  200     │  2,000   │  Unlimited  │
│ Couriers │  1       │  3       │  10      │  Unlimited  │
│ Exports  │  ✗       │  ✓       │  ✓       │  ✓          │
│ Analytics│  Basic   │  Standard│  Advanced│  Custom     │
│ API      │  ✗       │  ✗       │  ✓       │  ✓          │
│ SMS      │  ✗       │  50/mo   │  500/mo  │  Custom     │
│ Support  │  Community│ Email   │  Priority│  Dedicated  │
│ Price/mo │  0 DZD   │  5,000   │  15,000  │  Custom     │
└──────────┴──────────┴──────────┴──────────┴─────────────┘
```

### Limit Enforcement

```javascript
// middleware/planLimits.js — NEW

const checkPlanLimit = (resource) => async (req, res, next) => {
  const tenant = await Tenant.findById(req.user.tenant)
    .select('limits planTier')
    .lean();

  const limits = tenant.limits;
  let current;

  switch (resource) {
    case 'users':
      current = await User.countDocuments({ tenant: req.user.tenant, status: 'active' });
      if (current >= limits.maxUsers) {
        return res.status(403).json({
          message: `User limit reached (${limits.maxUsers}). Upgrade your plan.`,
          code: 'PLAN_LIMIT_USERS',
        });
      }
      break;

    case 'orders':
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      current = await Order.countDocuments({
        tenant: req.user.tenant,
        createdAt: { $gte: startOfMonth },
      });
      if (current >= limits.maxOrdersPerMonth) {
        return res.status(403).json({
          message: `Monthly order limit reached (${limits.maxOrdersPerMonth}).`,
          code: 'PLAN_LIMIT_ORDERS',
        });
      }
      break;

    case 'products':
      current = await Product.countDocuments({ tenant: req.user.tenant });
      if (current >= limits.maxProducts) {
        return res.status(403).json({
          message: `Product limit reached (${limits.maxProducts}).`,
          code: 'PLAN_LIMIT_PRODUCTS',
        });
      }
      break;
  }

  next();
};

// Usage in routes:
router.post('/orders', protect, authorize(PERMS.ORDERS_CREATE), checkPlanLimit('orders'), createOrder);
router.post('/users/invite', protect, authorize(PERMS.USERS_CREATE), checkPlanLimit('users'), inviteUser);
```

### Soft Limits vs Hard Limits

```
SOFT LIMITS (warning, allow overage temporarily):
  - Orders per month: warn at 90%, allow up to 110%
  - Storage: warn at 80%, allow up to 120%
  - Action: Show banner, send email to owner

HARD LIMITS (block immediately):
  - Users: cannot add more than plan allows
  - API rate: 429 Too Many Requests
  - Action: Return 403 with upgrade prompt

GRACE PERIOD:
  - Subscription expired → 7-day grace period (read-only mode)
  - After grace → full suspension (only /auth/me and billing endpoints work)
```

### Subscription State Machine

```
  Trial (14 days)
      │
      ├──pays──→ Active ◄──────────────────┐
      │              │                      │
      │              ├──payment fails──→ Past Due (3 retries, 7 days)
      │              │                      │
      │              │                      ├──pays──→ Active
      │              │                      │
      │              │                      └──gives up──→ Canceled
      │              │
      │              └──user cancels──→ Canceled
      │                                     │
      └──expires──→ Expired                 │
                      │                     │
                      └──pays──→ Active ◄───┘
```

---

## 14. Tenant Lifecycle

### Phase 1: Sign Up

```
User visits landing page
  → Clicks "Start Free Trial"
  → Fills: name, email, password, business name
  → Backend:
    1. Create Tenant { name: businessName, planTier: 'Free', subscription.status: 'trialing' }
    2. Create User { tenant: newTenant._id, role: 'Owner/Founder' }
    3. Generate JWT
    4. Return: token + user + subscription info
  → Frontend: redirect to onboarding
```

### Phase 2: Onboarding

```
First login detected (no orders yet)
  → Show onboarding wizard:
    Step 1: Company settings (currency, timezone, phone)
    Step 2: Add first product (or import)
    Step 3: Connect courier (API key)
    Step 4: Invite team (optional)
    Step 5: Create first order (guided)
  → Backend:
    1. PATCH /api/tenants/settings → update Tenant.settings
    2. POST /api/inventory/products → create products
    3. POST /api/couriers → add courier
    4. POST /api/tenants/invite → send team invite
```

### Phase 3: Active Use

```
Normal operations:
  - Orders flow in (manual or API/webhook)
  - Agents process orders in call center
  - Dispatchers send to couriers
  - Analytics build automatically
  - HR manages employees
```

### Phase 4: Plan Upgrade

```
User clicks "Upgrade" in settings
  → Shows plan comparison
  → Selects plan
  → Payment flow (Stripe/Chargily/manual)
  → Backend:
    1. Update Tenant.planTier
    2. Update Tenant.limits (new limits)
    3. Update Tenant.subscription.status = 'active'
    4. Update Tenant.subscription.currentPeriodEnd
    5. Flush tenant cache
```

### Phase 5: Suspension

```
Reasons: payment failed, TOS violation, manual admin action

Backend:
  1. Tenant.isActive = false
  2. Tenant.subscription.status = 'canceled' or 'expired'
  3. Auth middleware returns 402/403 for all protected routes
  4. Users see: "Your account is suspended" page
  5. Only accessible: /auth/me, /billing (to reactivate)
  6. Data is preserved (NOT deleted)
```

### Phase 6: Reactivation

```
Owner pays overdue balance or admin reactivates

Backend:
  1. Tenant.isActive = true
  2. Tenant.subscription.status = 'active'
  3. Flush all caches for this tenant
  4. Users can access normally again
```

### Phase 7: Deletion / Archival

```
Owner requests account deletion OR admin purges

Soft Delete (default):
  1. Tenant.isActive = false
  2. Tenant.deletedAt = new Date()
  3. All users deactivated
  4. Data preserved for 90 days

Hard Delete (after 90 days or by request):
  1. Delete all tenant-scoped documents:
     - Orders, Customers, Couriers, Shipments, Employees...
     - AuditLogs, DailyRollups, CallNotes...
     - Roles (where tenant = this tenant)
     - Users (where tenant = this tenant)
  2. Delete Tenant document
  3. Delete files from storage: /storage/{tenantId}/*
  4. Log deletion in platform audit (not tenant audit — it's deleted)

SAFETY:
  - Hard delete requires: owner confirmation + 72h cooling period
  - Admin override available for legal/compliance
  - Export data before deletion (mandatory step in UI)
```

---

## 15. DevOps & Infrastructure

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        INTERNET                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │   CDN (Cloudflare)  │  Static assets, DDoS protection
            │   + DNS             │  SSL termination
            └──────────┬──────────┘
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
  ┌─────────────────┐    ┌─────────────────┐
  │  Frontend        │    │  API Server      │
  │  (Vercel)        │    │  (Render/Railway) │
  │  React SPA       │    │  Express.js       │
  │  CDN-cached      │    │  2-4 instances    │
  └─────────────────┘    └────────┬──────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼              ▼
           ┌──────────────┐ ┌──────────┐ ┌──────────────┐
           │  MongoDB      │ │  Redis   │ │  Queue       │
           │  Atlas        │ │  (Cache) │ │  (BullMQ)    │
           │  M10+ cluster │ │  Upstash │ │  or Agenda   │
           │  with replicas│ │          │ │              │
           └──────────────┘ └──────────┘ └──────┬───────┘
                                                │
                                                ▼
                                        ┌──────────────┐
                                        │  Workers      │
                                        │  (background  │
                                        │   job         │
                                        │   processors) │
                                        └──────────────┘

  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │  Object Store │  │  Sentry      │  │  Logging     │
  │  (R2/S3)     │  │  (errors)    │  │  (pino →     │
  │  files,      │  │              │  │   Datadog/   │
  │  exports     │  │              │  │   Grafana)   │
  └──────────────┘  └──────────────┘  └──────────────┘
```

### Environment Separation

```
ENVIRONMENTS:
  ├── development  (local machine, local MongoDB)
  ├── staging      (Render preview, Atlas dev cluster)
  └── production   (Render prod, Atlas prod cluster)

SECRETS:
  ├── MONGO_URI          (per environment)
  ├── JWT_SECRET         (per environment, NEVER shared)
  ├── SENTRY_DSN         (per environment)
  ├── CORS_ORIGIN        (per environment)
  ├── SMS_GATEWAY_URL    (shared or per environment)
  ├── SMS_API_KEY        (per environment)
  ├── STRIPE_SECRET_KEY  (per environment)
  └── REDIS_URL          (per environment)

RULE: Production secrets are NEVER in .env files committed to git.
      Use Render/Railway environment variables or secrets manager.
```

### CI/CD Pipeline

```
Push to main
  │
  ├── GitHub Actions:
  │   ├── Lint (ESLint backend + frontend)
  │   ├── Build (vite build)
  │   ├── Test (if tests exist)
  │   └── Security audit (npm audit)
  │
  ├── If all pass:
  │   ├── Backend auto-deploys to Render
  │   └── Frontend auto-deploys to Vercel
  │
  └── Post-deploy:
      ├── Health check: GET /health
      ├── Smoke test: key endpoints respond
      └── Sentry release tracking
```

### Migration Strategy

```
MongoDB doesn't have traditional migrations, but schema changes need management:

1. ADDITIVE CHANGES (safe):
   - Add new field with default → No migration needed
   - Add new collection → Just deploy new code
   - Add new index → Run script, non-blocking

2. BREAKING CHANGES (need migration script):
   - Rename field → Write migration script, run before deploy
   - Change field type → Write migration + backfill script
   - Add required field → Backfill existing documents first

PATTERN:
  backend/scripts/migrate_*.js  ← Named migrations
  Run manually or via deploy hook
  Always idempotent (safe to run twice)
  Always log progress with tenant context
```

---

## 16. Scaling Strategy

### Phase 1: 1-50 Tenants (Current)

```
Infrastructure:
  - 1 API server (Render, 1GB RAM)
  - MongoDB Atlas M10 (shared cluster)
  - In-memory cache (node-cache)
  - No queue (inline processing)

Bottleneck: None. Everything fits in one server.
Cost: ~$50/month
```

### Phase 2: 50-500 Tenants

```
Infrastructure:
  - 2-4 API servers (Render, auto-scale)
  - MongoDB Atlas M30 (dedicated, 8GB RAM)
  - Redis (Upstash, for shared cache + session)
  - BullMQ queue (Redis-backed)
  - 1-2 worker instances

New needs:
  - Shared cache (node-cache → Redis)
  - Background job queue
  - Read replicas for analytics queries
  - Connection pooling tuned (maxPoolSize: 50)

Cost: ~$200-500/month
```

### Phase 3: 500-5,000 Tenants

```
Infrastructure:
  - 4-8 API servers (auto-scaling group)
  - MongoDB Atlas M50+ (16GB+, dedicated)
  - MongoDB read replica for analytics
  - Redis cluster (for cache + queues)
  - 2-4 worker instances
  - CDN for all static assets + exports
  - Object storage (R2/S3) for files

New needs:
  - Separate analytics database (or read replica)
  - Rate limiting per tenant
  - Queue priority by tenant plan
  - Monitoring dashboard per tenant
  - Automated backup verification

Cost: ~$1,000-3,000/month
```

### Phase 4: 5,000+ Tenants

```
Infrastructure:
  - Kubernetes or managed container service
  - MongoDB sharded cluster (shard key: tenant)
  - Redis Sentinel/Cluster
  - Dedicated analytics pipeline (MongoDB → ClickHouse/BigQuery)
  - Per-tenant rate limiting + circuit breakers
  - Multi-region deployment

New needs:
  - Shard by tenant for hot collections (Orders, Customers)
  - Archive old data (>1 year) to cold storage
  - Dedicated DB for enterprise tenants (hybrid model)
  - API gateway with tenant-aware routing
  - Feature flags per tenant/plan

Cost: $5,000-20,000+/month
```

### Hot Tenant Strategy

```
Problem: One tenant has 10x more orders than average.
         Their queries slow down the shared database.

Solution 1: Query-level
  - Compound indexes ensure queries only scan that tenant's data
  - { tenant: 1, createdAt: -1 } means MongoDB only touches that tenant's B-tree branch

Solution 2: Cache-level
  - Heavy tenant's dashboard gets longer cache TTL
  - Pre-compute analytics for large tenants

Solution 3: Infrastructure-level (at scale)
  - Move hot tenant to dedicated MongoDB instance
  - Route their requests to dedicated API pool
  - This is the "hybrid" model
```

---

## 17. Security

### Threat Model for Multi-Tenancy

```
THREAT 1: Cross-Tenant Data Leak
  Attack: Tenant A queries Tenant B's orders
  Defense: ALL queries include { tenant: req.user.tenant }
           Never trust tenant from client payload
           Use TenantRepo helper that forces tenant param

THREAT 2: Insecure Direct Object Reference (IDOR)
  Attack: User changes orderId in URL to access another tenant's order
  Defense: Always query with BOTH _id AND tenant
           Order.findOne({ _id: id, tenant: req.user.tenant })
           Return 404 (not 403) to avoid leaking existence

THREAT 3: Permission Escalation
  Attack: Agent modifies their role to gain admin permissions
  Defense: Role updates require PERMS.ROLES_MANAGE permission
           Role assignment requires higher privilege than role being assigned
           System roles cannot be modified by tenants

THREAT 4: Invite Flow Abuse
  Attack: User forges invite token to join another tenant
  Defense: Invite tokens are JWT-signed with tenant + email + role
           Token has short expiry (7 days)
           Email must match the invited email exactly
           Used tokens are invalidated

THREAT 5: Export Leak
  Attack: Tenant A accesses Tenant B's export file
  Defense: Export files stored under /tenant/{tenantId}/exports/
           Signed URLs with 15-min expiry
           File access middleware verifies req.user.tenant matches path

THREAT 6: Stale Session Tenant Confusion
  Attack: User switches browser tabs between tenants (future multi-tenant feature)
  Defense: JWT includes tenantId — verified on every request
           Token refresh includes tenant context
           Frontend must include tenant in all API calls

THREAT 7: Mass Assignment
  Attack: User sends { tenant: "other-tenant-id" } in request body
  Defense: NEVER read tenant from request body
           Always use req.user.tenant (set by auth middleware)
           Explicit field extraction (already done in Phase 10)
```

### Security Checklist

```
✅ Helmet security headers (CSP, HSTS, X-Frame-Options)
✅ CORS fail-closed in production
✅ Rate limiting: 200 req/min/IP
✅ Request timeout: 30s
✅ JWT access token: 1-day expiry
✅ Refresh token rotation: 30-day
✅ Password minimum: 12 characters
✅ x-powered-by disabled
✅ Explicit field extraction on create endpoints
✅ CastError → 400 (not 500)

TODO:
☐ Add tenant to JWT payload
☐ Add tenantGuard middleware
☐ Make User.tenant required
☐ Add CSRF protection for cookie-based auth (if ever added)
☐ Add account lockout after N failed login attempts
☐ Add IP allowlist option for enterprise tenants
```

---

## 18. Observability & Monitoring

### What to Track

```
REQUEST METRICS:
  - request_duration_ms (p50, p95, p99) — by tenant
  - request_count — by tenant, by endpoint
  - error_rate — by tenant, by error code
  - 5xx_rate — aggregated + by tenant

DATABASE METRICS:
  - query_duration_ms — slow query log (>100ms)
  - connection_pool_usage — active/available
  - index_misses — queries not using indexes
  - collection_sizes — by tenant (sampled)

QUEUE METRICS:
  - job_completion_time — by job type, by tenant
  - queue_depth — jobs waiting
  - failed_jobs — by type, by tenant
  - retry_count — by job

BUSINESS METRICS:
  - orders_created — by tenant, daily
  - orders_processed — by tenant, by agent
  - active_users — by tenant, daily
  - api_calls — by tenant (for billing)
  - storage_usage — by tenant

TENANT HEALTH:
  - subscription_status — active/expired/past_due
  - last_activity — when was tenant last active?
  - integration_status — courier API health per tenant
```

### Log Structure

```javascript
// Every log line includes:
{
  level: 'info',
  time: '2026-03-13T10:30:00Z',
  requestId: 'req_abc123',        // Correlation ID
  tenant: '65f1a2b3c4d5e6f7',     // Tenant isolation
  userId: '65f1a2b3c4d5e6f8',     // Actor
  method: 'POST',
  url: '/api/orders',
  statusCode: 201,
  responseTime: 45,
  msg: 'Order created',
}

// Error logs also include:
{
  level: 'error',
  err: {
    type: 'AppError',
    message: 'Invalid status transition',
    stack: '...',
  },
  // Same context fields as above
}
```

### Debugging Workflow

```
"Tenant X reports orders not loading"

1. Search logs by tenantId:
   grep tenantId=X | grep /api/orders

2. Find requestIds for failed requests:
   grep tenantId=X | grep statusCode=500

3. Trace full request by requestId:
   grep requestId=req_abc123

4. Check Sentry for errors tagged with tenantId=X

5. Check MongoDB slow query log for tenant X queries

6. Check queue for stuck jobs with tenantId=X
```

---

## 19. Backups & Recovery

### Backup Strategy

```
AUTOMATED:
  - MongoDB Atlas continuous backup (point-in-time recovery)
  - Daily snapshots retained 7 days
  - Weekly snapshots retained 4 weeks
  - Monthly snapshots retained 12 months

MANUAL (before risky operations):
  - mongodump before schema migrations
  - Collection-level export before bulk updates

FILE STORAGE:
  - R2/S3 versioning enabled
  - Cross-region replication for production
```

### Tenant-Safe Recovery

```
SCENARIO: "Tenant X accidentally deleted all their orders"

WRONG approach:
  Restore entire database from backup
  → Overwrites ALL tenants' data
  → Other tenants lose recent changes

CORRECT approach:
  1. Identify the time of deletion
  2. Use point-in-time recovery to a SEPARATE cluster
  3. On separate cluster, query:
     db.orders.find({ tenant: ObjectId("X"), deletedAt: { $ne: null } })
  4. Export only Tenant X's deleted orders
  5. Import them back to production with { deletedAt: null }
  6. Verify with tenant

BEST approach:
  - Soft delete is the default (deletedAt timestamp, not real deletion)
  - "Trash" feature: show recently deleted items for 30 days
  - Hard delete only after 30-day retention
  - AuditLog tracks who deleted what, when
```

### Disaster Recovery

```
RTO (Recovery Time Objective): 1 hour
RPO (Recovery Point Objective): 5 minutes (continuous backup)

PLAN:
  1. MongoDB Atlas handles DB failover automatically (replica set)
  2. API servers: Render auto-restarts failed instances
  3. If primary region fails:
     a. DNS failover to backup region
     b. MongoDB Atlas multi-region replica takes over
     c. API redeploys to backup region
  4. Communication: status page + email to tenant owners
```

---

## 20. Developer Guardrails

### Rule 1: No Query Without Tenant Scope

```javascript
// BAD — will be caught in code review
const orders = await Order.find({ status: 'Confirmed' });

// GOOD
const orders = await Order.find({
  tenant: req.user.tenant,
  status: 'Confirmed',
  deletedAt: null,
});

// BEST — use TenantRepo (impossible to forget tenant)
const orders = await orderRepo.find(req.user.tenant, { status: 'Confirmed' });
```

### Rule 2: Never Trust Client for Tenant

```javascript
// BAD — client can send any tenantId
const orders = await Order.find({ tenant: req.body.tenantId });

// BAD — client can manipulate params
const orders = await Order.find({ tenant: req.params.tenantId });

// GOOD — always from auth middleware
const orders = await Order.find({ tenant: req.user.tenant });
```

### Rule 3: Explicit Field Extraction on Create

```javascript
// BAD — mass assignment (client can inject tenant, role, etc.)
const courier = await Courier.create(req.body);

// GOOD — explicit extraction
const { name, phone, apiKey, zones } = req.body;
const courier = await Courier.create({
  tenant: req.user.tenant,
  name, phone, apiKey, zones,
  createdBy: req.user._id,
});
```

### Rule 4: Tenant Middleware Required on All Protected Routes

```javascript
// server.js — apply tenant guard globally after auth
app.use('/api', (req, res, next) => {
  // Skip public routes
  if (req.path.startsWith('/api/auth/login') ||
      req.path.startsWith('/api/auth/register') ||
      req.path === '/health') {
    return next();
  }
  // For all other routes, tenant must exist after auth
  if (req.user && !req.user.tenant) {
    return res.status(400).json({ message: 'No tenant context' });
  }
  next();
});
```

### Rule 5: Test for Cross-Tenant Leaks

```javascript
// Integration test pattern
describe('Tenant Isolation', () => {
  it('Tenant A cannot see Tenant B orders', async () => {
    // Create order as Tenant B
    const orderB = await createOrderAsTenantB();

    // Try to access as Tenant A
    const res = await request(app)
      .get(`/api/sales/orders/${orderB._id}`)
      .set('Authorization', `Bearer ${tenantAToken}`);

    expect(res.status).toBe(404);  // Not found, not 403
  });

  it('Tenant A cannot update Tenant B order', async () => {
    const orderB = await createOrderAsTenantB();

    const res = await request(app)
      .put(`/api/sales/orders/${orderB._id}`)
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({ status: 'Cancelled' });

    expect(res.status).toBe(404);

    // Verify order was not modified
    const order = await Order.findById(orderB._id);
    expect(order.status).not.toBe('Cancelled');
  });
});
```

### Rule 6: Audit Critical Actions

```javascript
// These actions MUST be logged to AuditLog:
const AUDITED_ACTIONS = [
  'CREATE_ORDER', 'UPDATE_ORDER_STATUS', 'DELETE_ORDER',
  'CREATE_USER', 'UPDATE_USER_ROLE', 'DELETE_USER',
  'CREATE_COURIER', 'DELETE_COURIER',
  'UPDATE_TENANT_SETTINGS',
  'EXPORT_DATA',
  'PAYROLL_APPROVED', 'PAYROLL_PAID',
  'LOGIN_SUCCESS', 'LOGIN_FAILED',
  'INVITE_SENT', 'INVITE_ACCEPTED',
];
```

---

## 21. Implementation Roadmap

### Phase A: Foundation Fixes (1-2 days) — CRITICAL

```
Priority: CRITICAL — fix before onboarding any new tenant

1. Make User.tenant required in schema
   File: backend/models/User.js
   Change: tenant: { type: ObjectId, ref: 'Tenant', required: true }

2. Add tenantGuard middleware
   File: backend/middleware/tenantGuard.js (NEW)
   Logic: if (!req.user?.tenant) return 400

3. Wire tenantGuard after protect in server.js

4. Add tenant to JWT payload
   File: backend/controllers/authController.js
   Change: jwt.sign({ id: user._id, tenant: user.tenant })

5. Verify all cron jobs iterate per-tenant
   Files: backend/cron/scheduler.js, backend/jobs/*.js
   Pattern: runForAllTenants(name, fn)
```

### Phase B: Tenant Management (3-5 days)

```
Priority: HIGH — needed for self-service

1. Create tenant management endpoints:
   GET    /api/tenants/me          → current tenant info
   PATCH  /api/tenants/me/settings → update settings
   GET    /api/tenants/me/usage    → current usage vs limits
   POST   /api/tenants/me/invite   → invite team member
   DELETE /api/tenants/me          → request deletion (soft)

2. Create invitation system:
   - InviteToken model or signed JWT
   - POST /api/auth/register-invited endpoint
   - Email sending (or at least generate invite link)

3. Create tenant settings page (frontend):
   - Company info, branding
   - Plan & usage display
   - Team management (list users, change roles, remove)
```

### Phase C: Billing & Plan Enforcement (5-7 days)

```
Priority: HIGH — needed for monetization

1. Define plan tiers and limits in Tenant model
2. Create checkPlanLimit middleware
3. Wire limit checks on creation endpoints
4. Create billing/subscription management endpoints
5. Integrate payment provider (Stripe or Chargily)
6. Create upgrade/downgrade flow
7. Create usage tracking (orders/month, users, storage)
```

### Phase D: Shared → Tenant-Scoped Models (3-5 days)

```
Priority: MEDIUM — needed when onboarding different businesses

IF tenants are different businesses (not all the same workshop):
1. Add tenant field to Product, ProductVariant, Category
2. Write migration script to assign existing products to current tenant
3. Update all product queries to include tenant scope
4. Update frontend product views
5. Update inventory logic
```

### Phase E: Multi-Tenant User Support (2-3 days)

```
Priority: LOW — only needed when agencies/admins manage multiple businesses

1. Create TenantMembership model
   { user, tenant, role, status, invitedAt, joinedAt }

2. Allow user to belong to multiple tenants

3. Add tenant switching:
   POST /api/auth/switch-tenant { tenantId }
   → Validates membership
   → Issues new JWT with new tenant context

4. Frontend: tenant switcher in header/sidebar
```

### Phase F: Platform Admin (2-3 days)

```
Priority: LOW — needed for internal ops

1. Create platform admin role (super-tenant)
2. Admin dashboard:
   - List all tenants
   - View tenant health
   - Suspend/reactivate tenants
   - Impersonate tenant (for support)
   - View platform-wide analytics
3. Admin endpoints with elevated permissions
```

### Phase G: Advanced Operations (Ongoing)

```
Priority: LOW — scale-dependent

1. TenantRepo base class for all services
2. Per-tenant rate limiting
3. Queue priority by plan tier
4. Automated usage-based billing
5. Tenant data export (GDPR-style)
6. Cross-tenant analytics (platform metrics)
7. Webhook system for tenant integrations
```

---

## Summary

```
ARCHITECTURE:           Shared Database + Row-Level Isolation (tenant_id)
ISOLATION GUARANTEE:    Every query, every index, every document scoped to tenant
AUTH:                   JWT with tenant ID + cached user lookup + subscription gate
AUTHORIZATION:          4-layer: Auth → Tenant Status → Permission → Resource Ownership
BACKGROUND JOBS:        All jobs carry tenantId, per-tenant iteration, failure isolation
FILE STORAGE:           /tenant/{id}/... path convention, signed URLs
BILLING:                Plan tiers with soft/hard limits, subscription state machine
SECURITY:               Never trust client for tenant, 404 not 403, audit everything
SCALING:                Compound indexes → read replicas → sharding → hybrid per-tenant DB
DEVELOPER GUARDRAILS:   TenantRepo helper, tenantGuard middleware, no raw queries
```

**This architecture supports growing from 1 tenant to 10,000+ tenants without changing the fundamental design. The transition points are clearly marked — you scale infrastructure, not architecture.**
