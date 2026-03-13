#!/usr/bin/env node
/**
 * Stress-Test Seed Script
 * Generates 100 tenants with full realistic data across ALL models.
 * Run: node backend/scripts/stressTestSeed.js
 *
 * Expected totals (approximate):
 *   100 tenants, 500 users, 100 roles, 500 tenant memberships
 *   400 categories, 1200 products, 3600 variants
 *   5000 customers, 15000 orders, 30000 order items
 *   500 employees, 15000 attendance, 500 payrolls
 *   1000 couriers, 3000 shipments
 *   200 sales channels, 400 landing pages, 8000 page events
 *   500 agent profiles, 5000 call notes
 *   200 support tickets, 500 leave requests
 *   3000 expenses, 3000 revenues
 *   100 webhooks, 500 webhook deliveries
 *   100 usage records
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

// ── Models ──────────────────────────────────────────────────────────
const Tenant            = require('../models/Tenant');
const User              = require('../models/User');
const Role              = require('../models/Role');
const TenantMembership  = require('../models/TenantMembership');
const Category          = require('../models/Category');
const Product           = require('../models/Product');
const ProductVariant    = require('../models/ProductVariant');
const Customer          = require('../models/Customer');
const Order             = require('../models/Order');
const OrderItem         = require('../models/OrderItem');
const OrderNote         = require('../models/OrderNote');
const OrderStatusHistory= require('../models/OrderStatusHistory');
const Employee          = require('../models/Employee');
const Attendance        = require('../models/Attendance');
const Payroll           = require('../models/Payroll');
const LeaveRequest      = require('../models/LeaveRequest');
const Courier           = require('../models/Courier');
const Shipment          = require('../models/Shipment');
const Expense           = require('../models/Expense');
const Revenue           = require('../models/Revenue');
const SalesChannel      = require('../models/SalesChannel');
const LandingPage       = require('../models/LandingPage');
const PageEvent         = require('../models/PageEvent');
const AgentProfile      = require('../models/AgentProfile');
const CallNote          = require('../models/CallNote');
const SupportTicket     = require('../models/SupportTicket');
const Webhook           = require('../models/Webhook');
const WebhookDelivery   = require('../models/WebhookDelivery');
const UsageRecord       = require('../models/UsageRecord');
const WorkerProductivity= require('../models/WorkerProductivity');
const WorkerReward      = require('../models/WorkerReward');
const DailyRollup       = require('../models/DailyRollup');
const KPISnapshot       = require('../models/KPISnapshot');
const AssignmentRule    = require('../models/AssignmentRule');
const AssignmentHistory = require('../models/AssignmentHistory');

// ── Algerian Reference Data ─────────────────────────────────────────
const WILAYAS = [
  { code: '01', name: 'Adrar', communes: ['Adrar', 'Timimoun', 'Reggane'] },
  { code: '02', name: 'Chlef', communes: ['Chlef', 'Ténès', 'Boukadir'] },
  { code: '03', name: 'Laghouat', communes: ['Laghouat', 'Aflou', 'Hassi R\'Mel'] },
  { code: '04', name: 'Oum El Bouaghi', communes: ['Oum El Bouaghi', 'Ain Beida', 'Ain M\'lila'] },
  { code: '05', name: 'Batna', communes: ['Batna', 'Barika', 'Ain Touta'] },
  { code: '06', name: 'Béjaïa', communes: ['Béjaïa', 'Akbou', 'Sidi Aich'] },
  { code: '07', name: 'Biskra', communes: ['Biskra', 'Tolga', 'Ouled Djellal'] },
  { code: '08', name: 'Béchar', communes: ['Béchar', 'Kenadsa', 'Abadla'] },
  { code: '09', name: 'Blida', communes: ['Blida', 'Boufarik', 'Bouinan'] },
  { code: '10', name: 'Bouira', communes: ['Bouira', 'Lakhdaria', 'Sour El Ghozlane'] },
  { code: '11', name: 'Tamanrasset', communes: ['Tamanrasset', 'In Salah', 'Abalessa'] },
  { code: '12', name: 'Tébessa', communes: ['Tébessa', 'Bir El Ater', 'Cheria'] },
  { code: '13', name: 'Tlemcen', communes: ['Tlemcen', 'Maghnia', 'Ghazaouet'] },
  { code: '14', name: 'Tiaret', communes: ['Tiaret', 'Sougueur', 'Frenda'] },
  { code: '15', name: 'Tizi Ouzou', communes: ['Tizi Ouzou', 'Azazga', 'Draa El Mizan'] },
  { code: '16', name: 'Alger', communes: ['Bab El Oued', 'Hussein Dey', 'Kouba', 'El Biar', 'Birkhadem', 'Dar El Beida', 'Rouiba'] },
  { code: '17', name: 'Djelfa', communes: ['Djelfa', 'Messaad', 'Ain Oussera'] },
  { code: '18', name: 'Jijel', communes: ['Jijel', 'El Milia', 'Taher'] },
  { code: '19', name: 'Sétif', communes: ['Sétif', 'El Eulma', 'Ain Oulmene'] },
  { code: '20', name: 'Saïda', communes: ['Saïda', 'Ain El Hadjar', 'Youb'] },
  { code: '21', name: 'Skikda', communes: ['Skikda', 'Azzaba', 'Collo'] },
  { code: '22', name: 'Sidi Bel Abbès', communes: ['Sidi Bel Abbès', 'Ain Temouchent', 'Telagh'] },
  { code: '23', name: 'Annaba', communes: ['Annaba', 'El Bouni', 'El Hadjar'] },
  { code: '24', name: 'Guelma', communes: ['Guelma', 'Bouchegouf', 'Oued Zenati'] },
  { code: '25', name: 'Constantine', communes: ['Constantine', 'El Khroub', 'Ain Smara'] },
  { code: '26', name: 'Médéa', communes: ['Médéa', 'Berrouaghia', 'Ksar El Boukhari'] },
  { code: '27', name: 'Mostaganem', communes: ['Mostaganem', 'Ain Nouissy', 'Hassi Mameche'] },
  { code: '28', name: 'M\'Sila', communes: ['M\'Sila', 'Bou Saada', 'Ain El Melh'] },
  { code: '29', name: 'Mascara', communes: ['Mascara', 'Sig', 'Tighennif'] },
  { code: '30', name: 'Ouargla', communes: ['Ouargla', 'Hassi Messaoud', 'Touggourt'] },
  { code: '31', name: 'Oran', communes: ['Oran', 'Bir El Djir', 'Es Sénia', 'Ain Turk', 'Arzew'] },
  { code: '32', name: 'El Bayadh', communes: ['El Bayadh', 'Bougtob', 'Brezina'] },
  { code: '33', name: 'Illizi', communes: ['Illizi', 'Djanet', 'In Amenas'] },
  { code: '34', name: 'Bordj Bou Arréridj', communes: ['Bordj Bou Arréridj', 'Ras El Oued', 'Bir Kasd Ali'] },
  { code: '35', name: 'Boumerdès', communes: ['Boumerdès', 'Dellys', 'Bordj Menaiel'] },
  { code: '36', name: 'El Tarf', communes: ['El Tarf', 'El Kala', 'Besbes'] },
  { code: '37', name: 'Tindouf', communes: ['Tindouf'] },
  { code: '38', name: 'Tissemsilt', communes: ['Tissemsilt', 'Theniet El Had', 'Bordj Bou Naama'] },
  { code: '39', name: 'El Oued', communes: ['El Oued', 'Guemar', 'Djamaa'] },
  { code: '40', name: 'Khenchela', communes: ['Khenchela', 'Kais', 'Ain Touila'] },
  { code: '41', name: 'Souk Ahras', communes: ['Souk Ahras', 'Sedrata', 'Taoura'] },
  { code: '42', name: 'Tipaza', communes: ['Tipaza', 'Cherchell', 'Koléa'] },
  { code: '43', name: 'Mila', communes: ['Mila', 'Chelghoum Laïd', 'Ferdjioua'] },
  { code: '44', name: 'Ain Defla', communes: ['Ain Defla', 'Miliana', 'Khemis Miliana'] },
  { code: '45', name: 'Naama', communes: ['Naama', 'Mécheria', 'Ain Sefra'] },
  { code: '46', name: 'Ain Témouchent', communes: ['Ain Témouchent', 'El Amria', 'El Malah'] },
  { code: '47', name: 'Ghardaïa', communes: ['Ghardaïa', 'Metlili', 'Berriane'] },
  { code: '48', name: 'Relizane', communes: ['Relizane', 'Oued Rhiou', 'Mazouna'] },
];

// Business types for realistic tenant names
const BUSINESS_TYPES = [
  'Store', 'Shop', 'Boutique', 'Market', 'Express', 'Hub', 'Center',
  'Collection', 'Fashion', 'Tech', 'Beauty', 'Home', 'Garden', 'Sport',
  'Electronics', 'Cosmetics', 'Accessories', 'Shoes', 'Clothing', 'Gadgets'
];

const ARABIC_NAMES = [
  'أحمد', 'محمد', 'يوسف', 'عمر', 'خالد', 'إبراهيم', 'عبد الله', 'سعيد',
  'مصطفى', 'حسين', 'طارق', 'ياسين', 'كريم', 'رضا', 'بلال', 'فاروق',
  'عادل', 'نبيل', 'جمال', 'وليد', 'سمير', 'فيصل', 'منير', 'هشام',
  'فاطمة', 'عائشة', 'مريم', 'خديجة', 'نور', 'سارة', 'ليلى', 'هدى',
  'أمينة', 'حنان', 'سميرة', 'نادية', 'زينب', 'رقية', 'ياسمين', 'إيمان'
];

const LAST_NAMES = [
  'بن عمر', 'بوزيد', 'مرابط', 'بلقاسم', 'خليفي', 'بن يوسف', 'حدادي',
  'بوعلام', 'سعداوي', 'زيتوني', 'مسعودي', 'بوشناق', 'عمراني', 'بوحجر',
  'قرماني', 'بوعبد الله', 'لعريبي', 'بوطالبي', 'مخلوفي', 'دراجي'
];

const PRODUCT_CATALOG = [
  { cat: 'Electronics', items: ['Wireless Earbuds', 'Phone Case', 'USB Cable', 'Power Bank', 'Smart Watch', 'Bluetooth Speaker', 'Screen Protector', 'Car Charger'] },
  { cat: 'Fashion', items: ['T-Shirt', 'Jeans', 'Sneakers', 'Dress', 'Jacket', 'Scarf', 'Belt', 'Sunglasses', 'Handbag', 'Cap'] },
  { cat: 'Beauty', items: ['Face Cream', 'Lipstick', 'Perfume', 'Hair Oil', 'Mascara', 'Foundation', 'Nail Polish', 'Serum'] },
  { cat: 'Home', items: ['Cushion Cover', 'Candle Set', 'Wall Clock', 'Blanket', 'Rug', 'Vase', 'Storage Box', 'Towel Set'] },
  { cat: 'Kitchen', items: ['Blender', 'Coffee Mug', 'Knife Set', 'Pot Set', 'Spice Rack', 'Food Container', 'Cutting Board'] },
  { cat: 'Kids', items: ['Toy Car', 'Puzzle', 'Coloring Book', 'Backpack', 'Water Bottle', 'Lego Set', 'Stuffed Animal'] },
  { cat: 'Sports', items: ['Yoga Mat', 'Dumbbells', 'Resistance Bands', 'Jump Rope', 'Sports Bag', 'Water Bottle'] },
  { cat: 'Books', items: ['Novel', 'Cookbook', 'Self Help Book', 'Journal', 'Planner', 'Notebook'] },
];

const DEPARTMENTS = ['Operations', 'Warehouse', 'Dispatch', 'Customer Support', 'Finance', 'Sales', 'Marketing', 'HR'];
const JOB_ROLES = {
  Operations: ['Operations Manager', 'Operations Coordinator', 'Logistics Lead'],
  Warehouse: ['Warehouse Manager', 'Stock Handler', 'Inventory Clerk'],
  Dispatch: ['Dispatch Manager', 'Dispatch Rider', 'Shipping Coordinator'],
  'Customer Support': ['Support Lead', 'Support Agent', 'Quality Monitor'],
  Finance: ['Finance Manager', 'Accountant', 'Financial Analyst'],
  Sales: ['Sales Manager', 'Sales Agent', 'Account Manager'],
  Marketing: ['Marketing Manager', 'Social Media Manager', 'Content Creator'],
  HR: ['HR Manager', 'HR Coordinator', 'Recruiter']
};

const ORDER_STATUSES = [
  'New', 'Call 1', 'Call 2', 'Call 3', 'No Answer', 'Confirmed',
  'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped',
  'Out for Delivery', 'Delivered', 'Paid', 'Cancelled', 'Refused', 'Returned'
];

const ORDER_CHANNELS = ['Website', 'WhatsApp', 'Facebook', 'TikTok', 'Instagram', 'Manual', 'Direct', 'LandingPage'];

const COURIER_NAMES = ['Ecotrack Express', 'Yalidin Delivery', 'ZR Express', 'Maystro Livraison', 'Procolis DZ', 'Guepex', 'Ozone Express', 'Alger Express', 'Jumia Logistics', 'Flash Delivery'];

const PLAN_TIERS = ['Free', 'Basic', 'Pro', 'Enterprise'];
const PLAN_LIMITS = {
  Free:       { maxUsers: 2, maxOrdersPerMonth: 100, maxProducts: 20, maxCouriers: 1, smsPerMonth: 0, exportEnabled: false, apiEnabled: false },
  Basic:      { maxUsers: 5, maxOrdersPerMonth: 500, maxProducts: 100, maxCouriers: 3, smsPerMonth: 100, exportEnabled: true, apiEnabled: false },
  Pro:        { maxUsers: 15, maxOrdersPerMonth: 5000, maxProducts: 500, maxCouriers: 10, smsPerMonth: 1000, exportEnabled: true, apiEnabled: true },
  Enterprise: { maxUsers: 100, maxOrdersPerMonth: 50000, maxProducts: 5000, maxCouriers: 50, smsPerMonth: 10000, exportEnabled: true, apiEnabled: true },
};

const BRAND_COLORS = ['#4F46E5', '#059669', '#DC2626', '#D97706', '#7C3AED', '#2563EB', '#DB2777', '#0891B2', '#65A30D', '#EA580C'];

// ── Helpers ─────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(n, arr.length));
};
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max) => +(Math.random() * (max - min) + min).toFixed(2);
const phone = () => `0${pick(['5', '6', '7'])}${String(rand(10000000, 99999999))}`;
const dateAgo = (maxDays) => {
  const d = new Date();
  d.setDate(d.getDate() - rand(0, maxDays));
  d.setHours(rand(0, 23), rand(0, 59), rand(0, 59));
  return d;
};
const dateStr = (d) => d.toISOString().split('T')[0];
const uuid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

let counters = {};
const track = (name, n = 1) => { counters[name] = (counters[name] || 0) + n; };

// ── Batch Insert Helper ─────────────────────────────────────────────
async function bulkInsert(Model, docs, label) {
  if (!docs.length) return [];
  const BATCH = 1000;
  const results = [];
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH);
    const inserted = await Model.insertMany(batch, { ordered: false });
    results.push(...inserted);
  }
  track(label, docs.length);
  return results;
}

// ── Main ────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';
const NUM_TENANTS = 100;

async function run() {
  const startTime = Date.now();
  console.log(`\n🏗️  Stress-Test Seed — ${NUM_TENANTS} tenants with full data`);
  console.log(`📦 Connecting to ${MONGO_URI.replace(/\/\/.*@/, '//***@')}...\n`);

  await mongoose.connect(MONGO_URI);

  // ── WIPE seeded data (only stress-test data, identified by name pattern) ──
  console.log('🧹 Clearing previous stress-test data...');
  // Drop ALL collections for a clean slate
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    await db.dropCollection(col.name);
  }

  // Ensure all indexes are rebuilt by calling ensureIndexes on each model
  const allModels = [
    Tenant, User, Role, TenantMembership,
    Category, Product, ProductVariant, Customer, Courier,
    Order, OrderItem, OrderNote, OrderStatusHistory,
    Employee, Attendance, Payroll, LeaveRequest,
    Shipment, Expense, Revenue,
    SalesChannel, LandingPage, PageEvent,
    AgentProfile, CallNote, SupportTicket,
    Webhook, WebhookDelivery, UsageRecord,
    WorkerProductivity, WorkerReward,
    DailyRollup, KPISnapshot,
    AssignmentRule, AssignmentHistory,
  ];
  await Promise.all(allModels.map(M => M.createIndexes()));

  console.log('✅ Database cleared & indexes rebuilt.\n');

  // ══════════════════════════════════════════════════════════════════
  // PHASE 1: Create Tenants + Owners + Roles
  // ══════════════════════════════════════════════════════════════════
  console.log('📋 Phase 1: Tenants, Roles, Users...');

  const tenants = [];
  const allRoles = [];
  const allUsers = [];
  const allMemberships = [];

  for (let t = 0; t < NUM_TENANTS; t++) {
    const bizType = pick(BUSINESS_TYPES);
    const planTier = pick(PLAN_TIERS);
    const limits = PLAN_LIMITS[planTier];
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + rand(-30, 14));

    const tenant = await Tenant.create({
      name: `${pick(ARABIC_NAMES)} ${bizType} ${t + 1}`,
      planTier,
      subscription: {
        status: rand(0, 10) < 7 ? 'active' : pick(['trialing', 'past_due', 'expired']),
        trialEndsAt: trialEnd,
        currentPeriodEnd: new Date(Date.now() + rand(1, 60) * 86400000),
      },
      limits,
      settings: {
        currency: 'DZD',
        timezone: 'Africa/Algiers',
        locale: 'ar-DZ',
        companyName: `${bizType} ${t + 1} SARL`,
        brandColor: pick(BRAND_COLORS),
        businessPhone: phone(),
        businessAddress: `${rand(1, 200)} Rue ${pick(WILAYAS).name}, Algeria`,
      },
      isActive: rand(0, 20) > 0, // 95% active
    });
    tenants.push(tenant);

    // Create roles for this tenant — use actual PERMS strings
    const ALL_PERMS = [
      'overview.read', 'orders.view', 'orders.create', 'orders.edit', 'orders.delete',
      'orders.restore', 'orders.purge', 'orders.bulk', 'orders.export', 'orders.status.change',
      'shipments.view', 'shipments.create', 'shipments.edit', 'shipments.cancel', 'shipments.export',
      'customers.view', 'customers.edit', 'customers.risk.view', 'customers.blacklist',
      'finance.view', 'finance.edit', 'finance.export', 'finance.settle.courier',
      'finance.payroll.view', 'finance.payroll.approve',
      'couriers.view', 'couriers.create', 'couriers.edit', 'couriers.delete', 'couriers.api.connect',
      'inventory.view', 'inventory.adjust', 'inventory.reorder',
      'hr.employees.view', 'hr.employees.edit', 'hr.payroll.view', 'hr.payroll.run', 'hr.payroll.approve',
      'analytics.view', 'analytics.financial.view', 'intelligence.view',
      'callcenter.process_orders', 'callcenter.view_reports', 'callcenter.manage_assignments',
      'callcenter.view_unassigned', 'callcenter.claim_orders', 'callcenter.reassign_orders',
      'callcenter.override_lock', 'callcenter.manage_rules',
      'procurement.read', 'procurement.create_po', 'procurement.update_po', 'procurement.receive_goods',
      'support.view', 'support.edit',
      'saleschannels.view', 'saleschannels.create', 'saleschannels.edit', 'saleschannels.delete',
      'saleschannels.publish', 'saleschannels.analytics',
      'tenant.view', 'tenant.settings', 'tenant.invite', 'tenant.billing', 'tenant.delete',
      'webhooks.view', 'webhooks.manage',
      'system.roles', 'system.settings', 'system.users',
    ];
    const roleData = [
      { name: 'Owner', description: 'Full admin access', isSystemRole: true, permissions: ALL_PERMS, tenant: tenant._id },
      { name: 'Manager', description: 'Manage operations', isSystemRole: true, permissions: ['overview.read', 'orders.view', 'orders.create', 'orders.edit', 'orders.status.change', 'customers.view', 'customers.edit', 'inventory.view', 'hr.employees.view', 'shipments.view', 'couriers.view', 'finance.view', 'support.view', 'analytics.view'], tenant: tenant._id },
      { name: 'Agent', description: 'Call center agent', isSystemRole: true, permissions: ['orders.view', 'orders.edit', 'orders.status.change', 'customers.view', 'callcenter.process_orders', 'callcenter.claim_orders'], tenant: tenant._id },
      { name: 'Viewer', description: 'Read-only access', isSystemRole: true, permissions: ['overview.read', 'orders.view', 'customers.view', 'inventory.view', 'analytics.view'], tenant: tenant._id },
    ];
    const roles = await Role.insertMany(roleData);
    allRoles.push(...roles);
    track('Roles', roles.length);

    // Create owner user
    const ownerUser = await User.create({
      name: `${pick(ARABIC_NAMES)} ${pick(LAST_NAMES)}`,
      email: `owner-t${t + 1}@stresstest.dz`,
      password: 'StressTest2026!',
      phone: phone(),
      jobTitle: 'Owner / Founder',
      tenant: tenant._id,
      role: roles[0]._id,
      isActive: true,
    });
    allUsers.push(ownerUser);
    track('Users');

    // Update tenant owner
    await Tenant.updateOne({ _id: tenant._id }, { owner: ownerUser._id });

    // Create membership for owner
    allMemberships.push({
      user: ownerUser._id,
      tenant: tenant._id,
      role: roles[0]._id,
      status: 'active',
      joinedAt: dateAgo(180),
    });

    // Create additional team users (3-5 per tenant)
    const teamSize = rand(3, 5);
    for (let u = 0; u < teamSize; u++) {
      const roleRef = roles[rand(1, roles.length - 1)];
      try {
        const user = await User.create({
          name: `${pick(ARABIC_NAMES)} ${pick(LAST_NAMES)}`,
          email: `user${u}-t${t + 1}@stresstest.dz`,
          password: 'StressTest2026!',
          phone: phone(),
          jobTitle: pick(['Manager', 'Agent', 'Coordinator', 'Supervisor']),
          tenant: tenant._id,
          role: roleRef._id,
          isActive: rand(0, 10) > 1,
        });
        allUsers.push(user);
        track('Users');

        allMemberships.push({
          user: user._id,
          tenant: tenant._id,
          role: roleRef._id,
          status: pick(['active', 'active', 'active', 'invited']),
          joinedAt: dateAgo(120),
        });
      } catch (e) { /* skip dup email */ }
    }

    if ((t + 1) % 20 === 0) console.log(`   ... ${t + 1}/${NUM_TENANTS} tenants created`);
  }

  await bulkInsert(TenantMembership, allMemberships, 'TenantMemberships');
  console.log(`   ✅ ${tenants.length} tenants, ${counters.Users} users, ${counters.Roles} roles\n`);

  // ══════════════════════════════════════════════════════════════════
  // PHASE 2: Products & Categories (per tenant)
  // ══════════════════════════════════════════════════════════════════
  console.log('📦 Phase 2: Categories, Products, Variants...');

  const tenantData = {}; // { tenantId: { categories, products, variants, customers, employees, couriers, users, salesChannels, landingPages } }

  for (let t = 0; t < NUM_TENANTS; t++) {
    const tenant = tenants[t];
    const td = { categories: [], products: [], variants: [], customers: [], employees: [], couriers: [], users: [], salesChannels: [], landingPages: [] };
    td.users = allUsers.filter(u => u.tenant.toString() === tenant._id.toString());
    tenantData[tenant._id.toString()] = td;

    // Categories (3-6 per tenant)
    const numCats = rand(3, 6);
    const selectedCats = pickN(PRODUCT_CATALOG, numCats);
    const catDocs = selectedCats.map(c => ({
      tenant: tenant._id,
      name: c.cat,
      description: `${c.cat} category for ${tenant.name}`,
      isActive: true,
    }));
    td.categories = await bulkInsert(Category, catDocs, 'Categories');

    // Products (8-15 per tenant)
    const prodDocs = [];
    const varDocs = [];
    for (let ci = 0; ci < td.categories.length; ci++) {
      const catRef = td.categories[ci];
      const catItems = selectedCats[ci].items;
      const numProds = rand(2, 4);
      for (let p = 0; p < numProds; p++) {
        const prodId = new mongoose.Types.ObjectId();
        prodDocs.push({
          _id: prodId,
          tenant: tenant._id,
          name: catItems[p % catItems.length],
          category: catRef._id,
          brand: `Brand ${pick(['DZ', 'Pro', 'Elite', 'Plus', 'Prime'])}`,
          description: `High quality ${catItems[p % catItems.length]} from Algeria`,
          isActive: rand(0, 10) > 1,
        });

        // 2-4 variants per product
        const numVars = rand(2, 4);
        const colors = ['Black', 'White', 'Red', 'Blue', 'Green', 'Grey', 'Brown', 'Pink'];
        const sizes = ['S', 'M', 'L', 'XL'];
        for (let v = 0; v < numVars; v++) {
          const price = rand(500, 15000);
          varDocs.push({
            tenant: tenant._id,
            productId: prodId,
            sku: `T${t + 1}-P${ci}${p}-V${v}`,
            attributes: new Map([
              ['Color', pick(colors)],
              ['Size', pick(sizes)]
            ]),
            price,
            cost: Math.round(price * randFloat(0.3, 0.6)),
            totalStock: rand(10, 500),
            reservedStock: rand(0, 20),
            totalSold: rand(0, 200),
            reorderLevel: rand(5, 50),
            status: pick(['Active', 'Active', 'Active', 'Draft']),
          });
        }
      }
    }
    td.products = await bulkInsert(Product, prodDocs, 'Products');
    td.variants = await bulkInsert(ProductVariant, varDocs, 'Variants');

    if ((t + 1) % 25 === 0) console.log(`   ... ${t + 1}/${NUM_TENANTS} product catalogs done`);
  }
  console.log(`   ✅ ${counters.Categories} categories, ${counters.Products} products, ${counters.Variants} variants\n`);

  // ══════════════════════════════════════════════════════════════════
  // PHASE 3: Customers (per tenant)
  // ══════════════════════════════════════════════════════════════════
  console.log('👥 Phase 3: Customers...');

  for (let t = 0; t < NUM_TENANTS; t++) {
    const tenant = tenants[t];
    const td = tenantData[tenant._id.toString()];
    const numCustomers = rand(30, 80);
    const custDocs = [];

    for (let c = 0; c < numCustomers; c++) {
      const w = pick(WILAYAS);
      const delivered = rand(0, 20);
      const total = delivered + rand(0, 10);
      const refused = rand(0, Math.max(1, Math.floor(total * 0.2)));
      custDocs.push({
        tenant: tenant._id,
        name: `${pick(ARABIC_NAMES)} ${pick(LAST_NAMES)}`,
        phone: phone(),
        email: rand(0, 3) === 0 ? `cust${c}-t${t + 1}@mail.dz` : undefined,
        joinDate: dateAgo(365),
        acquisitionChannel: pick(['Organic Search', 'Direct Traffic', 'Social Media', 'Referral', 'Paid Ads']),
        status: pick(['Active', 'Active', 'Active', 'Inactive', 'Churned', 'At Risk']),
        totalOrders: total,
        deliveredOrders: delivered,
        lifetimeValue: delivered * rand(1500, 8000),
        averageOrderValue: rand(1500, 8000),
        isReturning: delivered > 1,
        cohortMonth: dateStr(dateAgo(365)).slice(0, 7),
        segment: pick(['Whale', 'VIP', 'Repeat Buyer', 'One-Time Buyer', 'Dormant']),
        trustScore: rand(20, 100),
        deliverySuccessRate: total > 0 ? +(delivered / total * 100).toFixed(1) : 0,
        totalRefusals: refused,
        refusalRate: total > 0 ? +(refused / total * 100).toFixed(1) : 0,
        riskLevel: pick(['Low', 'Low', 'Low', 'Medium', 'High']),
      });
    }
    td.customers = await bulkInsert(Customer, custDocs, 'Customers');

    if ((t + 1) % 25 === 0) console.log(`   ... ${t + 1}/${NUM_TENANTS} customer bases done`);
  }
  console.log(`   ✅ ${counters.Customers} customers\n`);

  // ══════════════════════════════════════════════════════════════════
  // PHASE 4: Couriers (per tenant)
  // ══════════════════════════════════════════════════════════════════
  console.log('🚚 Phase 4: Couriers...');

  for (let t = 0; t < NUM_TENANTS; t++) {
    const tenant = tenants[t];
    const td = tenantData[tenant._id.toString()];
    const numCouriers = rand(5, 15);
    const courierDocs = [];

    for (let c = 0; c < numCouriers; c++) {
      courierDocs.push({
        tenant: tenant._id,
        name: `${pick(COURIER_NAMES)} ${c + 1}`,
        phone: phone(),
        status: pick(['Active', 'Active', 'Active', 'Inactive']),
        integrationType: pick(['Manual', 'API']),
        apiProvider: pick(['Ecotrack', 'Yalidin', 'Other']),
        vehicleType: pick(['Motorcycle', 'Van', 'Truck', 'Car']),
        coverageZones: pickN(WILAYAS, rand(3, 15)).map(w => w.name),
        pricingRules: pick(['Flat', 'Distance-Based']),
        cashCollected: rand(50000, 2000000),
        cashSettled: rand(30000, 1500000),
        totalDeliveries: rand(50, 5000),
        successRate: randFloat(60, 98),
        averageDeliveryTimeMinutes: rand(120, 4320),
        reliabilityScore: rand(50, 100),
      });
    }
    td.couriers = await bulkInsert(Courier, courierDocs, 'Couriers');

    if ((t + 1) % 50 === 0) console.log(`   ... ${t + 1}/${NUM_TENANTS}`);
  }
  console.log(`   ✅ ${counters.Couriers} couriers\n`);

  // ══════════════════════════════════════════════════════════════════
  // PHASE 5: Orders + Items + Notes + Status History
  // ══════════════════════════════════════════════════════════════════
  console.log('📝 Phase 5: Orders, Items, Notes, Status History...');

  for (let t = 0; t < NUM_TENANTS; t++) {
    const tenant = tenants[t];
    const td = tenantData[tenant._id.toString()];
    const numOrders = rand(80, 200);

    const orderDocs = [];
    const itemDocs = [];
    const noteDocs = [];
    const historyDocs = [];

    for (let o = 0; o < numOrders; o++) {
      const orderId = new mongoose.Types.ObjectId();
      const customer = pick(td.customers);
      const w = pick(WILAYAS);
      const commune = pick(w.communes);
      const status = pick(ORDER_STATUSES);
      const courier = td.couriers.length > 0 ? pick(td.couriers) : null;
      const agent = td.users.length > 1 ? pick(td.users) : td.users[0];
      const orderDate = dateAgo(90);

      // Order items
      const numItems = rand(1, 4);
      let totalAmount = 0;
      let totalCost = 0;
      for (let i = 0; i < numItems; i++) {
        const variant = td.variants.length > 0 ? pick(td.variants) : null;
        if (!variant) continue;
        const qty = rand(1, 5);
        const unitPrice = variant.price;
        totalAmount += unitPrice * qty;
        totalCost += (variant.cost || Math.round(unitPrice * 0.4)) * qty;
        itemDocs.push({
          orderId,
          tenant: tenant._id,
          productId: variant.productId,
          variantId: variant._id,
          sku: variant.sku,
          name: `Product ${variant.sku}`,
          quantity: qty,
          unitPrice,
          costPrice: variant.cost || Math.round(unitPrice * 0.4),
          lineTotal: unitPrice * qty,
        });
      }

      const courierFee = rand(300, 800);
      const discount = rand(0, 3) === 0 ? rand(100, 1000) : 0;
      const finalTotal = Math.max(0, totalAmount - discount);

      orderDocs.push({
        _id: orderId,
        tenant: tenant._id,
        orderId: `ORD-T${t + 1}-${String(o + 1).padStart(4, '0')}`,
        date: orderDate,
        customer: customer._id,
        products: itemDocs.filter(i => i.orderId.toString() === orderId.toString()).map(i => ({
          variantId: i.variantId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        totalAmount,
        subtotal: totalAmount,
        discount,
        finalTotal,
        amountToCollect: finalTotal + courierFee,
        wilaya: w.name,
        commune,
        assignedAgent: agent._id,
        channel: pick(ORDER_CHANNELS),
        status,
        priority: pick(['Normal', 'Normal', 'Normal', 'High', 'Urgent', 'VIP']),
        courier: courier ? courier._id : undefined,
        paymentStatus: status === 'Delivered' || status === 'Paid' ? 'Paid' : 'Unpaid',
        fulfillmentStatus: status === 'Delivered' || status === 'Paid' ? 'Fulfilled' : 'Unfulfilled',
        financials: {
          cogs: totalCost,
          courierFee,
          codAmount: finalTotal + courierFee,
          netProfit: finalTotal - totalCost - courierFee,
        },
        shipping: {
          recipientName: customer.name,
          phone1: customer.phone || phone(),
          wilayaCode: w.code,
          wilayaName: w.name,
          commune,
          address: `${rand(1, 99)} Rue ${rand(1, 50)}, ${commune}`,
          deliveryType: pick([0, 0, 0, 1]),
        },
        notes: rand(0, 5) === 0 ? 'Customer requested fast delivery' : '',
      });

      // Status history
      historyDocs.push({
        tenant: tenant._id,
        orderId,
        status: 'New',
        previousStatus: null,
        changedAt: orderDate,
      });
      if (ORDER_STATUSES.indexOf(status) > 0) {
        historyDocs.push({
          tenant: tenant._id,
          orderId,
          status,
          previousStatus: 'New',
          changedAt: new Date(orderDate.getTime() + rand(1, 72) * 3600000),
        });
      }

      // Order notes (30% chance)
      if (rand(0, 10) < 3) {
        noteDocs.push({
          orderId,
          tenant: tenant._id,
          type: pick(['Customer', 'Internal', 'Call Center', 'System Note']),
          content: pick([
            'Customer confirmed by phone',
            'Address updated per customer request',
            'Delayed due to weather',
            'VIP customer — prioritize',
            'Second attempt needed',
            'Customer asked for evening delivery',
          ]),
          createdBy: agent._id,
        });
      }
    }

    await bulkInsert(Order, orderDocs, 'Orders');
    await bulkInsert(OrderItem, itemDocs, 'OrderItems');
    await bulkInsert(OrderNote, noteDocs, 'OrderNotes');
    await bulkInsert(OrderStatusHistory, historyDocs, 'StatusHistory');

    if ((t + 1) % 10 === 0) console.log(`   ... ${t + 1}/${NUM_TENANTS} order sets done`);
  }
  console.log(`   ✅ ${counters.Orders} orders, ${counters.OrderItems} items, ${counters.OrderNotes} notes, ${counters.StatusHistory} history entries\n`);

  // ══════════════════════════════════════════════════════════════════
  // PHASE 6: HR — Employees, Attendance, Payroll, Leave
  // ══════════════════════════════════════════════════════════════════
  console.log('👷 Phase 6: HR data (Employees, Attendance, Payroll, Leave)...');

  for (let t = 0; t < NUM_TENANTS; t++) {
    const tenant = tenants[t];
    const td = tenantData[tenant._id.toString()];
    const numEmployees = rand(3, 8);

    const empDocs = [];
    for (let e = 0; e < numEmployees; e++) {
      const dept = pick(DEPARTMENTS);
      empDocs.push({
        tenant: tenant._id,
        name: `${pick(ARABIC_NAMES)} ${pick(LAST_NAMES)}`,
        email: `emp${e}-t${t + 1}@stresstest.dz`,
        phone: phone(),
        role: pick(JOB_ROLES[dept]),
        department: dept,
        salary: rand(25000, 120000),
        performanceScore: rand(40, 100),
        leaveBalance: rand(0, 21),
        joinDate: dateAgo(rand(30, 730)),
        status: pick(['Active', 'Active', 'Active', 'On Leave']),
        contractSettings: {
          monthlySalary: rand(25000, 120000),
          dailyRequiredMinutes: 480,
          schedule: { morningStart: '08:00', morningEnd: '12:00', eveningStart: '13:00', eveningEnd: '17:00' },
          overtimeEnabled: rand(0, 1) === 1,
          overtimeRateMultiplier: 1.5,
          latenessGracePeriodMin: 15,
          workDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'],
        },
      });
    }
    td.employees = await bulkInsert(Employee, empDocs, 'Employees');

    // Attendance (last 30 days for each employee)
    const attDocs = [];
    for (const emp of td.employees) {
      for (let d = 0; d < 30; d++) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 5) continue; // Skip Friday (weekend in Algeria)

        const isPresent = rand(0, 10) > 1; // 90% presence
        const morningIn = new Date(date); morningIn.setHours(8, rand(0, 30), 0);
        const morningOut = new Date(date); morningOut.setHours(12, rand(0, 15), 0);
        const eveningIn = new Date(date); eveningIn.setHours(13, rand(0, 20), 0);
        const eveningOut = new Date(date); eveningOut.setHours(17, rand(0, 30), 0);
        const lateMin = morningIn.getMinutes() > 15 ? morningIn.getMinutes() - 15 : 0;

        attDocs.push({
          tenant: tenant._id,
          employeeId: emp._id,
          date: dateStr(date),
          morningIn: isPresent ? morningIn : undefined,
          morningOut: isPresent ? morningOut : undefined,
          eveningIn: isPresent ? eveningIn : undefined,
          eveningOut: isPresent ? eveningOut : undefined,
          workedMinutes: isPresent ? rand(360, 510) : 0,
          requiredMinutes: 480,
          lateMinutes: isPresent ? lateMin : 0,
          missingMinutes: isPresent ? Math.max(0, 480 - rand(360, 510)) : 480,
          overtimeMinutes: isPresent ? (rand(0, 4) === 0 ? rand(15, 120) : 0) : 0,
          status: isPresent ? (lateMin > 0 ? 'Late' : 'Present') : 'Absent',
        });
      }
    }
    await bulkInsert(Attendance, attDocs, 'Attendance');

    // Payroll (last 3 months)
    const payDocs = [];
    for (const emp of td.employees) {
      for (let m = 0; m < 3; m++) {
        const d = new Date();
        d.setMonth(d.getMonth() - m);
        const period = `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
        const base = emp.salary;
        const overtime = rand(0, 5000);
        const deductions = rand(0, 3000);
        payDocs.push({
          tenant: tenant._id,
          employeeId: emp._id,
          period,
          baseSalary: base,
          overtimeAdditions: overtime,
          missingTimeDeductions: deductions,
          absenceDeductions: rand(0, 2000),
          finalPayableSalary: base + overtime - deductions,
          amountPaid: rand(0, 1) === 1 ? base + overtime - deductions : 0,
          status: pick(['Draft', 'Pending Approval', 'Approved', 'Paid']),
          metricsTotal: {
            totalWorkedMinutes: rand(8000, 12000),
            totalRequiredMinutes: 10080,
            totalLateMinutes: rand(0, 300),
            totalMissingMinutes: rand(0, 500),
            totalOvertimeMinutes: rand(0, 600),
          },
        });
      }
    }
    await bulkInsert(Payroll, payDocs, 'Payroll');

    // Leave Requests
    const leaveDocs = [];
    for (const emp of td.employees) {
      if (rand(0, 3) === 0) {
        const start = dateAgo(60);
        const end = new Date(start); end.setDate(end.getDate() + rand(1, 7));
        leaveDocs.push({
          tenant: tenant._id,
          employeeId: emp._id,
          type: pick(['Vacation', 'Sick Leave', 'Personal', 'Unpaid']),
          startDate: start,
          endDate: end,
          reason: pick(['Family event', 'Medical appointment', 'Personal matters', 'Vacation trip']),
          status: pick(['Pending', 'Approved', 'Rejected']),
        });
      }
    }
    if (leaveDocs.length) await bulkInsert(LeaveRequest, leaveDocs, 'LeaveRequests');

    // Worker Productivity & Rewards
    const prodDocs = [];
    const rewardDocs = [];
    for (const emp of td.employees) {
      if (rand(0, 2) === 0) {
        const wpId = new mongoose.Types.ObjectId();
        prodDocs.push({
          _id: wpId,
          tenant: tenant._id,
          employeeId: emp._id,
          date: dateAgo(14),
          tasksCompleted: rand(5, 50),
          operations: [{
            operationName: pick(['Packing', 'Sorting', 'Quality Check', 'Shipping']),
            quantity: rand(10, 100),
            qualityScore: rand(1, 5),
            timeSpentHours: randFloat(1, 8),
          }],
          dailyScore: rand(30, 100),
        });
        if (rand(0, 2) === 0) {
          rewardDocs.push({
            tenant: tenant._id,
            employeeId: emp._id,
            dateAwarded: dateAgo(30),
            type: pick(['Piece-Rate Bonus', 'Quality Bonus', 'Speed Bonus', 'Overtime Premium']),
            amount: rand(500, 5000),
            reason: 'Outstanding performance',
            relatedProductivityId: wpId,
            isPaid: rand(0, 1) === 1,
          });
        }
      }
    }
    if (prodDocs.length) await bulkInsert(WorkerProductivity, prodDocs, 'WorkerProductivity');
    if (rewardDocs.length) await bulkInsert(WorkerReward, rewardDocs, 'WorkerRewards');

    if ((t + 1) % 20 === 0) console.log(`   ... ${t + 1}/${NUM_TENANTS} HR data done`);
  }
  console.log(`   ✅ ${counters.Employees} employees, ${counters.Attendance} attendance, ${counters.Payroll} payrolls, ${counters.LeaveRequests || 0} leaves\n`);

  // ══════════════════════════════════════════════════════════════════
  // PHASE 7: Shipments
  // ══════════════════════════════════════════════════════════════════
  console.log('📦 Phase 7: Shipments...');

  // We need to fetch the orders we created to link shipments
  for (let t = 0; t < NUM_TENANTS; t++) {
    const tenant = tenants[t];
    const td = tenantData[tenant._id.toString()];

    // Get dispatched/shipped orders
    const dispatchedOrders = await Order.find({
      tenant: tenant._id,
      status: { $in: ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Returned', 'Refused'] }
    }).limit(30).lean();

    const shipDocs = [];
    for (const order of dispatchedOrders) {
      const courier = td.couriers.length > 0 ? pick(td.couriers) : null;
      shipDocs.push({
        tenant: tenant._id,
        internalOrder: order._id,
        internalOrderId: order.orderId,
        courierProvider: pick(['ECOTRACK', 'YALIDIN']),
        externalTrackingId: `TRK-${uuid()}`,
        customerName: order.shipping?.recipientName || 'Customer',
        phone1: order.shipping?.phone1 || phone(),
        address: order.shipping?.address || `${rand(1, 99)} Rue ${rand(1, 50)}`,
        commune: order.commune,
        wilayaCode: order.shipping?.wilayaCode || '16',
        wilayaName: order.wilaya,
        productName: `Order ${order.orderId}`,
        quantity: rand(1, 5),
        weight: randFloat(0.5, 10),
        codAmount: order.amountToCollect || order.totalAmount,
        courierFee: rand(300, 800),
        shipmentStatus: pick(['Created in Courier', 'Validated', 'In Transit', 'Out for Delivery', 'Delivered', 'Returned']),
        paymentStatus: pick(['COD_Expected', 'Collected_Not_Paid', 'Paid_and_Settled']),
        dispatchDate: dateAgo(30),
        deliveryType: pick([0, 1]),
        operationType: 1,
        activityHistory: [
          { status: 'Draft', date: dateAgo(35), remarks: 'Shipment created' },
          { status: 'Created in Courier', date: dateAgo(30), remarks: 'Sent to courier' },
        ],
      });
    }
    if (shipDocs.length) await bulkInsert(Shipment, shipDocs, 'Shipments');

    if ((t + 1) % 25 === 0) console.log(`   ... ${t + 1}/${NUM_TENANTS}`);
  }
  console.log(`   ✅ ${counters.Shipments || 0} shipments\n`);

  // ══════════════════════════════════════════════════════════════════
  // PHASE 8: Call Center — Agent Profiles + Call Notes
  // ══════════════════════════════════════════════════════════════════
  console.log('📞 Phase 8: Agent Profiles, Call Notes...');

  for (let t = 0; t < NUM_TENANTS; t++) {
    const tenant = tenants[t];
    const td = tenantData[tenant._id.toString()];
    const agentUsers = td.users.slice(0, rand(2, Math.min(5, td.users.length)));

    // Agent Profiles
    const agentDocs = [];
    for (const user of agentUsers) {
      agentDocs.push({
        user: user._id,
        tenant: tenant._id,
        compensationModel: pick(['Fixed', 'Commission', 'Hybrid']),
        baseSalary: rand(25000, 60000),
        commissionPerDelivery: rand(50, 300),
        assignmentMode: pick(['Manual', 'Auto_RoundRobin', 'Region']),
        assignedRegions: pickN(WILAYAS, rand(2, 8)).map(w => w.name),
        dailyOrderLimit: rand(20, 100),
        isActive: true,
      });
    }
    await bulkInsert(AgentProfile, agentDocs, 'AgentProfiles');

    // Call Notes (for recent orders)
    const recentOrders = await Order.find({ tenant: tenant._id }).sort({ date: -1 }).limit(50).lean();
    const callDocs = [];
    for (const order of recentOrders) {
      if (rand(0, 2) === 0) continue;
      const agent = pick(agentUsers);
      callDocs.push({
        tenant: tenant._id,
        order: order._id,
        agent: agent._id,
        actionType: pick(['Confirmed', 'Call 1', 'Call 2', 'No Answer', 'Postponed', 'General_Note']),
        note: pick([
          'Customer confirmed the order',
          'No answer, will retry later',
          'Customer wants to change address',
          'Confirmed with updated phone',
          'Customer postponed to next week',
          'Wrong number, customer provided new one',
        ]),
        callDurationSeconds: rand(15, 300),
        statusBefore: 'New',
        statusAfter: pick(['Confirmed', 'Call 1', 'No Answer', 'Postponed']),
        callAttemptNumber: rand(1, 3),
      });
    }
    if (callDocs.length) await bulkInsert(CallNote, callDocs, 'CallNotes');

    if ((t + 1) % 25 === 0) console.log(`   ... ${t + 1}/${NUM_TENANTS}`);
  }
  console.log(`   ✅ ${counters.AgentProfiles || 0} agent profiles, ${counters.CallNotes || 0} call notes\n`);

  // ══════════════════════════════════════════════════════════════════
  // PHASE 9: Sales Channels + Landing Pages + Page Events
  // ══════════════════════════════════════════════════════════════════
  console.log('🛒 Phase 9: Sales Channels, Landing Pages, Page Events...');

  for (let t = 0; t < NUM_TENANTS; t++) {
    const tenant = tenants[t];
    const td = tenantData[tenant._id.toString()];

    // Sales Channels (1-3 per tenant)
    const numChannels = rand(1, 3);
    const channelDocs = [];
    for (let s = 0; s < numChannels; s++) {
      channelDocs.push({
        tenant: tenant._id,
        name: `${pick(['Main', 'VIP', 'Promo', 'Flash', 'Seasonal'])} Store ${s + 1}`,
        slug: `store-t${t + 1}-${s + 1}`,
        description: `Sales channel #${s + 1} for tenant ${t + 1}`,
        status: 'active',
        domain: {
          type: 'subdomain',
          subdomain: `t${t + 1}-s${s + 1}`,
        },
        branding: {
          primaryColor: pick(BRAND_COLORS),
          accentColor: pick(BRAND_COLORS),
          fontFamily: pick(['Inter', 'Cairo', 'Tajawal', 'Poppins']),
        },
        stats: {
          totalPages: rand(1, 5),
          totalOrders: rand(10, 500),
          totalRevenue: rand(50000, 5000000),
        },
      });
    }
    td.salesChannels = await bulkInsert(SalesChannel, channelDocs, 'SalesChannels');

    // Landing Pages (1-4 per channel)
    const pageDocs = [];
    for (const channel of td.salesChannels) {
      const numPages = rand(1, 4);
      for (let p = 0; p < numPages; p++) {
        const product = td.products.length > 0 ? pick(td.products) : null;
        if (!product) continue;
        pageDocs.push({
          tenant: tenant._id,
          salesChannel: channel._id,
          product: product._id,
          title: `${product.name} — ${pick(['Special Offer', 'Best Deal', 'Limited Edition', 'New Arrival', 'Flash Sale'])}`,
          slug: `page-t${t + 1}-c${channel._id.toString().slice(-4)}-${p + 1}`,
          status: pick(['published', 'published', 'draft']),
          publishedAt: rand(0, 2) > 0 ? dateAgo(60) : undefined,
          theme: {
            primaryColor: pick(BRAND_COLORS),
            accentColor: '#F59E0B',
            backgroundColor: '#FFFFFF',
            textColor: '#1F2937',
            buttonStyle: pick(['rounded', 'square', 'pill']),
            layout: pick(['standard', 'minimal', 'bold']),
          },
          formConfig: {
            fields: {
              name: { required: true, visible: true, label: 'الاسم الكامل' },
              phone: { required: true, visible: true, label: 'رقم الهاتف' },
              wilaya: { required: true, visible: true, label: 'الولاية' },
              commune: { required: true, visible: true, label: 'البلدية' },
              address: { required: true, visible: true, label: 'العنوان' },
            },
            maxQuantity: rand(5, 20),
            submitButtonText: 'اطلب الآن',
            successMessage: 'تم تسجيل طلبك بنجاح',
            enableDuplicateDetection: true,
            enableFraudCheck: rand(0, 1) === 1,
          },
          stats: {
            views: rand(100, 50000),
            uniqueVisitors: rand(50, 30000),
            orders: rand(5, 500),
            revenue: rand(10000, 2000000),
            conversionRate: randFloat(0.5, 15),
          },
        });
      }
    }
    td.landingPages = await bulkInsert(LandingPage, pageDocs, 'LandingPages');

    // Page Events
    const eventDocs = [];
    for (const page of td.landingPages) {
      const numEvents = rand(20, 100);
      for (let e = 0; e < numEvents; e++) {
        eventDocs.push({
          tenant: tenant._id,
          landingPage: page._id,
          salesChannel: page.salesChannel,
          event: pick(['page_view', 'page_view', 'page_view', 'product_view', 'form_start', 'form_submit', 'order_created']),
          sessionId: `sess-${uuid()}`,
          visitorId: rand(0, 3) > 0 ? `vis-${rand(1, 500)}` : undefined,
          utm: rand(0, 3) === 0 ? {
            source: pick(['facebook', 'google', 'tiktok', 'instagram', 'direct']),
            medium: pick(['cpc', 'social', 'organic', 'referral']),
            campaign: pick(['summer_sale', 'ramadan_promo', 'new_arrival', 'flash_deal']),
          } : undefined,
          device: {
            type: pick(['mobile', 'mobile', 'mobile', 'desktop', 'tablet']),
            browser: pick(['Chrome', 'Safari', 'Firefox', 'Samsung Internet']),
            os: pick(['Android', 'iOS', 'Windows', 'macOS']),
          },
          createdAt: dateAgo(30),
        });
      }
    }
    if (eventDocs.length) await bulkInsert(PageEvent, eventDocs, 'PageEvents');

    if ((t + 1) % 20 === 0) console.log(`   ... ${t + 1}/${NUM_TENANTS}`);
  }
  console.log(`   ✅ ${counters.SalesChannels || 0} channels, ${counters.LandingPages || 0} pages, ${counters.PageEvents || 0} events\n`);

  // ══════════════════════════════════════════════════════════════════
  // PHASE 10: Support Tickets
  // ══════════════════════════════════════════════════════════════════
  console.log('🎫 Phase 10: Support Tickets...');

  let ticketSeq = 0;
  for (let t = 0; t < NUM_TENANTS; t++) {
    const tenant = tenants[t];
    const td = tenantData[tenant._id.toString()];
    const numTickets = rand(1, 5);

    for (let tk = 0; tk < numTickets; tk++) {
      const cust = td.customers.length > 0 ? pick(td.customers) : null;
      if (!cust) continue;
      const agent = td.users.length > 0 ? pick(td.users) : null;
      ticketSeq++;
      try {
        await SupportTicket.create({
          tenant: tenant._id,
          ticketNumber: `TKT-ST-${String(ticketSeq).padStart(6, '0')}`,
          customerId: cust._id,
          subject: pick([
            'Order not received', 'Wrong product delivered', 'Damaged package',
            'Request refund', 'Change delivery address', 'Product inquiry',
            'Delivery delay', 'Missing item in order',
          ]),
          type: pick(['General Inquiry', 'Shipping Issue', 'Product Defect', 'RMA Request']),
          status: pick(['Open', 'In Progress', 'Waiting on Customer', 'Resolved', 'Closed']),
          priority: pick(['Low', 'Medium', 'High', 'Urgent']),
          assignedTo: agent ? agent._id : undefined,
          messages: [
            {
              sender: 'Customer',
              message: 'I have an issue with my order, please help.',
              senderModel: 'Customer',
              senderId: cust._id,
            },
            {
              sender: 'Agent',
              message: 'We are looking into it. Please allow 24-48 hours.',
              senderModel: 'User',
              senderId: agent ? agent._id : undefined,
            },
          ],
        });
        track('SupportTickets');
      } catch (e) { /* skip */ }
    }
  }
  console.log(`   ✅ ${counters.SupportTickets || 0} support tickets\n`);

  // ══════════════════════════════════════════════════════════════════
  // PHASE 11: Finance — Expenses & Revenue
  // ══════════════════════════════════════════════════════════════════
  console.log('💰 Phase 11: Expenses, Revenue...');

  for (let t = 0; t < NUM_TENANTS; t++) {
    const tenant = tenants[t];
    const numExpenses = rand(20, 40);
    const numRevenues = rand(20, 40);

    const expDocs = [];
    for (let e = 0; e < numExpenses; e++) {
      expDocs.push({
        tenant: tenant._id,
        date: dateAgo(90),
        amount: rand(500, 50000),
        category: pick(['Marketing', 'Operations', 'Human Resources', 'Infrastructure', 'Equipment', 'Utilities', 'Rent', 'Other']),
        description: pick([
          'Facebook ads campaign', 'Google ads', 'Office supplies', 'Courier fees batch',
          'Staff bonuses', 'Internet subscription', 'Packaging materials', 'Warehouse rent',
          'Vehicle maintenance', 'Software subscription', 'Phone bills', 'Electricity',
        ]),
      });
    }
    await bulkInsert(Expense, expDocs, 'Expenses');

    const revDocs = [];
    for (let r = 0; r < numRevenues; r++) {
      revDocs.push({
        tenant: tenant._id,
        date: dateAgo(90),
        amount: rand(2000, 100000),
        source: pick(['Product Sales', 'Service Revenue', 'Subscription Income', 'Other']),
        description: pick([
          'Daily COD collection', 'Bulk order settlement', 'Courier remittance',
          'Marketplace payout', 'Direct sales revenue', 'Wholesale order',
        ]),
      });
    }
    await bulkInsert(Revenue, revDocs, 'Revenues');
  }
  console.log(`   ✅ ${counters.Expenses || 0} expenses, ${counters.Revenues || 0} revenues\n`);

  // ══════════════════════════════════════════════════════════════════
  // PHASE 12: Webhooks + Usage Records + KPIs + Rollups
  // ══════════════════════════════════════════════════════════════════
  console.log('🔗 Phase 12: Webhooks, Usage, KPIs, Rollups...');

  for (let t = 0; t < NUM_TENANTS; t++) {
    const tenant = tenants[t];
    const td = tenantData[tenant._id.toString()];

    // Webhooks (50% of tenants)
    if (rand(0, 1) === 1) {
      const webhook = await Webhook.create({
        tenant: tenant._id,
        url: `https://hooks.example.com/t${t + 1}/webhook`,
        events: pickN(['order.created', 'order.updated', 'order.delivered', 'shipment.created', 'shipment.delivered'], rand(1, 4)),
        secret: `whsec_${uuid()}`,
        isActive: true,
        description: `Webhook for tenant ${t + 1}`,
        stats: {
          totalDeliveries: rand(10, 500),
          successCount: rand(8, 450),
          failureCount: rand(0, 50),
        },
      });
      track('Webhooks');

      // Webhook deliveries
      const delDocs = [];
      for (let d = 0; d < rand(2, 8); d++) {
        delDocs.push({
          webhook: webhook._id,
          tenant: tenant._id,
          event: pick(webhook.events),
          payload: { orderId: `ORD-T${t + 1}-${rand(1, 200)}`, status: pick(ORDER_STATUSES) },
          response: { statusCode: pick([200, 200, 200, 500, 503]), body: 'OK', durationMs: rand(50, 2000) },
          status: pick(['success', 'success', 'success', 'failed']),
          attempt: 1,
        });
      }
      await bulkInsert(WebhookDelivery, delDocs, 'WebhookDeliveries');
    }

    // Usage Record (current month)
    try {
      await UsageRecord.create({
        tenant: tenant._id,
        period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        counters: {
          orders: rand(10, 5000),
          smsSent: rand(0, 500),
          exports: rand(0, 50),
          apiCalls: rand(0, 10000),
          storageBytes: rand(1000000, 500000000),
        },
        planTier: tenant.planTier,
        limits: PLAN_LIMITS[tenant.planTier],
      });
      track('UsageRecords');
    } catch (e) { /* skip dup */ }

    // KPI Snapshot
    try {
      await KPISnapshot.create({
        tenant: tenant._id,
        type: 'operations',
        metrics: {
          newOrdersToday: rand(0, 50),
          pendingConfirmation: rand(0, 30),
          confirmedOrders: rand(5, 100),
          readyForDispatch: rand(0, 20),
          sentToCourier: rand(5, 50),
          shippedToday: rand(2, 30),
          deliveredToday: rand(1, 25),
          shippedEver: rand(100, 10000),
          returnedEver: rand(5, 500),
          returnRate: randFloat(2, 25),
        },
      });
      track('KPISnapshots');
    } catch (e) { /* skip dup */ }

    // Daily Rollups (last 30 days)
    const rollupDocs = [];
    for (let d = 0; d < 30; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      rollupDocs.push({
        tenant: tenant._id,
        date: dateStr(date),
        orders: {
          created: rand(0, 30),
          confirmed: rand(0, 20),
          dispatched: rand(0, 15),
          delivered: rand(0, 12),
          returned: rand(0, 5),
          refused: rand(0, 3),
          cancelled: rand(0, 4),
        },
        revenue: {
          gross: rand(5000, 200000),
          cogs: rand(2000, 80000),
          courierFees: rand(500, 20000),
          gatewayFees: rand(0, 5000),
          netProfit: rand(1000, 100000),
          codCollected: rand(3000, 150000),
        },
        hr: {
          present: rand(3, 10),
          absent: rand(0, 3),
          late: rand(0, 2),
          overtimeMinutes: rand(0, 300),
        },
        stock: {
          lowStockVariants: rand(0, 10),
        },
      });
    }
    await bulkInsert(DailyRollup, rollupDocs, 'DailyRollups');

    // Assignment Rules
    if (td.products.length > 0 && td.users.length > 1) {
      const ruleDocs = [];
      const numRules = rand(1, 3);
      for (let r = 0; r < numRules; r++) {
        ruleDocs.push({
          tenant: tenant._id,
          type: pick(['product', 'store']),
          sourceId: pick(td.products)._id,
          agent: td.users[rand(1, td.users.length - 1)]._id,
          isActive: true,
          createdBy: td.users[0]._id,
        });
      }
      // Use try-catch to skip duplicates from unique index
      try {
        await bulkInsert(AssignmentRule, ruleDocs, 'AssignmentRules');
      } catch (e) { /* skip duplicate key errors */ }
    }
  }
  console.log(`   ✅ ${counters.Webhooks || 0} webhooks, ${counters.WebhookDeliveries || 0} deliveries, ${counters.UsageRecords} usage records`);
  console.log(`   ✅ ${counters.KPISnapshots} KPI snapshots, ${counters.DailyRollups} daily rollups\n`);

  // ══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('═'.repeat(60));
  console.log('  STRESS-TEST SEED COMPLETE');
  console.log('═'.repeat(60));
  console.log(`  Time elapsed: ${elapsed}s\n`);
  console.log('  Document counts:');

  const sortedCounters = Object.entries(counters).sort((a, b) => b[1] - a[1]);
  let totalDocs = 0;
  for (const [name, count] of sortedCounters) {
    console.log(`    ${name.padEnd(25)} ${count.toLocaleString()}`);
    totalDocs += count;
  }
  console.log(`\n  ${'TOTAL DOCUMENTS'.padEnd(25)} ${totalDocs.toLocaleString()}`);
  console.log('═'.repeat(60));

  // Quick platform stats
  const tenantCount = await Tenant.countDocuments();
  const userCount = await User.countDocuments();
  const orderCount = await Order.countDocuments();
  console.log(`\n  Verification: ${tenantCount} tenants, ${userCount} users, ${orderCount} orders in DB`);
  console.log(`\n  Login with any: owner-t{1-100}@stresstest.dz / StressTest2026!\n`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ FATAL:', err);
  process.exit(1);
});
