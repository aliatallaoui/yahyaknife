#!/usr/bin/env node
/**
 * Concurrent Load Test
 * Fires parallel requests from 20 tenants simultaneously.
 * Tests how the platform handles concurrent multi-tenant traffic.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const http = require('http');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';
const BASE = 'http://localhost:5000';

// Keep-alive agent for connection reuse
const agent = new http.Agent({ keepAlive: true, maxSockets: 50 });

function apiCall(path, token, method = 'GET', postBody = null) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
      agent,
    };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const ms = Date.now() - start;
        let json;
        try { json = JSON.parse(body); } catch { json = null; }
        resolve({ status: res.statusCode, ms, bodyLength: body.length, path });
      });
    });
    req.on('error', e => resolve({ status: 0, ms: Date.now() - start, bodyLength: 0, path, error: e.message }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ status: 0, ms: 30000, bodyLength: 0, path, error: 'Timeout' }); });
    if (postBody) req.write(JSON.stringify(postBody));
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  await mongoose.connect(MONGO_URI);
  const Tenant = require('../models/Tenant');

  // Find tenants with active subscriptions
  const activeTenants = await Tenant.find({
    'subscription.status': 'active',
    isActive: true,
  }).limit(20).lean();

  console.log(`Found ${activeTenants.length} active tenants`);
  await mongoose.disconnect();

  // Login all tenants
  const tokens = [];
  for (let i = 0; i < activeTenants.length; i++) {
    const t = i + 1;
    // Try a few tenant indexes to find active ones
    const email = `owner-t${t}@stresstest.dz`;
    try {
      const res = await apiCall('/api/auth/login', null, 'POST', { email, password: 'StressTest2026!' });
      if (res.json && res.json.token) {
        // Check if this tenant has active subscription by trying an endpoint
        const check = await apiCall('/api/dashboard/metrics', res.json.token);
        if (check.status === 200) {
          tokens.push({ email, token: res.json.token, tenantId: t });
        }
      }
    } catch (e) { /* skip */ }
    if (tokens.length >= 20) break;
    await sleep(30);
  }

  // If we didn't get 20 active, try more
  if (tokens.length < 20) {
    for (let t = tokens.length + 1; t <= 100 && tokens.length < 20; t++) {
      const email = `owner-t${t}@stresstest.dz`;
      try {
        const res = await apiCall('/api/auth/login', null, 'POST', { email, password: 'StressTest2026!' });
        if (res.json && res.json.token) {
          const check = await apiCall('/api/dashboard/metrics', res.json.token);
          if (check.status === 200) {
            tokens.push({ email, token: res.json.token, tenantId: t });
          }
        }
      } catch (e) { /* skip */ }
      await sleep(30);
    }
  }

  console.log(`\n🔥 Concurrent Load Test — ${tokens.length} active tenants\n`);

  const ENDPOINTS = [
    '/api/sales/orders?page=1&limit=25',
    '/api/customers',
    '/api/inventory/products',
    '/api/dashboard/metrics',
    '/api/hr/employees',
    '/api/couriers',
    '/api/finance/overview',
    '/api/shipments',
    '/api/sales-channels',
    '/api/support',
  ];

  // ═══════════════════════════════════════════
  // TEST 1: Sequential baseline (1 tenant)
  // ═══════════════════════════════════════════
  console.log('📊 Test 1: Sequential baseline (1 tenant, 10 endpoints)');
  const baseline = [];
  const t0 = tokens[0];
  for (const ep of ENDPOINTS) {
    const r = await apiCall(ep, t0.token);
    baseline.push(r);
    await sleep(30);
  }
  const baseAvg = Math.round(baseline.filter(r => r.status === 200).reduce((s, r) => s + r.ms, 0) / baseline.filter(r => r.status === 200).length);
  console.log(`   Avg: ${baseAvg}ms | Max: ${Math.max(...baseline.map(r => r.ms))}ms\n`);

  // ═══════════════════════════════════════════
  // TEST 2: 10 tenants hitting same endpoint simultaneously
  // ═══════════════════════════════════════════
  console.log('📊 Test 2: 10 tenants hitting /api/sales/orders simultaneously');
  const test2Start = Date.now();
  const test2 = await Promise.all(
    tokens.slice(0, 10).map(t => apiCall('/api/sales/orders?page=1&limit=25', t.token))
  );
  const test2Wall = Date.now() - test2Start;
  const test2Ok = test2.filter(r => r.status === 200);
  console.log(`   Wall time: ${test2Wall}ms | Success: ${test2Ok.length}/10`);
  console.log(`   Avg: ${Math.round(test2Ok.reduce((s, r) => s + r.ms, 0) / (test2Ok.length || 1))}ms | Max: ${Math.max(...test2.map(r => r.ms))}ms\n`);

  // ═══════════════════════════════════════════
  // TEST 3: 20 tenants hitting same endpoint simultaneously
  // ═══════════════════════════════════════════
  console.log('📊 Test 3: 20 tenants hitting /api/sales/orders simultaneously');
  const test3Start = Date.now();
  const test3 = await Promise.all(
    tokens.slice(0, 20).map(t => apiCall('/api/sales/orders?page=1&limit=25', t.token))
  );
  const test3Wall = Date.now() - test3Start;
  const test3Ok = test3.filter(r => r.status === 200);
  console.log(`   Wall time: ${test3Wall}ms | Success: ${test3Ok.length}/20`);
  console.log(`   Avg: ${Math.round(test3Ok.reduce((s, r) => s + r.ms, 0) / (test3Ok.length || 1))}ms | Max: ${Math.max(...test3.map(r => r.ms))}ms\n`);

  // ═══════════════════════════════════════════
  // TEST 4: 20 tenants hitting DIFFERENT endpoints simultaneously
  // ═══════════════════════════════════════════
  console.log('📊 Test 4: 20 tenants hitting different endpoints simultaneously');
  const test4Start = Date.now();
  const test4 = await Promise.all(
    tokens.slice(0, 20).map((t, i) => apiCall(ENDPOINTS[i % ENDPOINTS.length], t.token))
  );
  const test4Wall = Date.now() - test4Start;
  const test4Ok = test4.filter(r => r.status === 200);
  console.log(`   Wall time: ${test4Wall}ms | Success: ${test4Ok.length}/20`);
  console.log(`   Avg: ${Math.round(test4Ok.reduce((s, r) => s + r.ms, 0) / (test4Ok.length || 1))}ms | Max: ${Math.max(...test4.map(r => r.ms))}ms\n`);

  // ═══════════════════════════════════════════
  // TEST 5: Burst test — 100 requests (10 tenants x 10 endpoints)
  // ═══════════════════════════════════════════
  console.log('📊 Test 5: Burst — 100 requests (10 tenants x 10 endpoints)');
  const test5Start = Date.now();
  const burst = [];
  for (const t of tokens.slice(0, 10)) {
    for (const ep of ENDPOINTS) {
      burst.push(apiCall(ep, t.token));
    }
  }
  const test5Results = await Promise.all(burst);
  const test5Wall = Date.now() - test5Start;
  const test5Ok = test5Results.filter(r => r.status === 200);
  const test5Err = test5Results.filter(r => r.status !== 200);
  const test5Times = test5Ok.map(r => r.ms).sort((a, b) => a - b);
  console.log(`   Wall time: ${test5Wall}ms | Total: ${test5Results.length} | Success: ${test5Ok.length} | Errors: ${test5Err.length}`);
  if (test5Ok.length > 0) {
    console.log(`   Avg: ${Math.round(test5Ok.reduce((s, r) => s + r.ms, 0) / test5Ok.length)}ms`);
    console.log(`   P50: ${test5Times[Math.floor(test5Times.length * 0.5)]}ms`);
    console.log(`   P95: ${test5Times[Math.floor(test5Times.length * 0.95)]}ms`);
    console.log(`   P99: ${test5Times[Math.floor(test5Times.length * 0.99)]}ms`);
    console.log(`   Max: ${test5Times[test5Times.length - 1]}ms`);
  }
  // Error breakdown
  if (test5Err.length > 0) {
    const errCounts = {};
    test5Err.forEach(r => { errCounts[r.status] = (errCounts[r.status] || 0) + 1; });
    console.log(`   Error breakdown: ${JSON.stringify(errCounts)}`);
  }

  // ═══════════════════════════════════════════
  // TEST 6: Sustained load — 5 waves of 20 requests each
  // ═══════════════════════════════════════════
  console.log('\n📊 Test 6: Sustained load — 5 waves of 20 concurrent requests');
  const allWaveResults = [];
  for (let wave = 1; wave <= 5; wave++) {
    const waveStart = Date.now();
    const waveReqs = tokens.slice(0, 20).map((t, i) =>
      apiCall(ENDPOINTS[i % ENDPOINTS.length], t.token)
    );
    const waveResults = await Promise.all(waveReqs);
    const waveWall = Date.now() - waveStart;
    const waveOk = waveResults.filter(r => r.status === 200);
    allWaveResults.push(...waveResults);
    console.log(`   Wave ${wave}: ${waveWall}ms wall | ${waveOk.length}/20 success | avg ${Math.round(waveOk.reduce((s, r) => s + r.ms, 0) / (waveOk.length || 1))}ms`);
    await sleep(200); // Small gap between waves
  }

  // ═══════════════════════════════════════════
  // TEST 7: Heavy orders endpoint — paginated
  // ═══════════════════════════════════════════
  console.log('\n📊 Test 7: Paginated orders (pages 1-5) across 5 tenants');
  for (const t of tokens.slice(0, 5)) {
    const pages = [];
    for (let p = 1; p <= 5; p++) {
      pages.push(apiCall(`/api/sales/orders?page=${p}&limit=50`, t.token));
    }
    const results = await Promise.all(pages);
    const ok = results.filter(r => r.status === 200);
    const totalData = ok.reduce((s, r) => s + r.bodyLength, 0);
    console.log(`   t${t.tenantId}: ${ok.length}/5 pages | avg ${Math.round(ok.reduce((s, r) => s + r.ms, 0) / (ok.length || 1))}ms | ${(totalData / 1024).toFixed(0)}KB total`);
  }

  // ═══════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════
  const allResults = [...baseline, ...test2, ...test3, ...test4, ...test5Results, ...allWaveResults];
  const allOk = allResults.filter(r => r.status === 200);
  const allTimes = allOk.map(r => r.ms).sort((a, b) => a - b);
  const totalRequests = allResults.length;

  console.log('\n' + '═'.repeat(70));
  console.log('  CONCURRENT LOAD TEST — FINAL SUMMARY');
  console.log('═'.repeat(70));
  console.log(`  Active tenants tested:    ${tokens.length}`);
  console.log(`  Total requests fired:     ${totalRequests}`);
  console.log(`  Successful (200):         ${allOk.length} (${(allOk.length / totalRequests * 100).toFixed(1)}%)`);
  console.log(`  Failed:                   ${totalRequests - allOk.length}`);
  if (allOk.length > 0) {
    console.log(`  Avg latency:              ${Math.round(allOk.reduce((s, r) => s + r.ms, 0) / allOk.length)}ms`);
    console.log(`  P50:                      ${allTimes[Math.floor(allTimes.length * 0.5)]}ms`);
    console.log(`  P95:                      ${allTimes[Math.floor(allTimes.length * 0.95)]}ms`);
    console.log(`  P99:                      ${allTimes[Math.floor(allTimes.length * 0.99)]}ms`);
    console.log(`  Max:                      ${allTimes[allTimes.length - 1]}ms`);
  }
  // Status breakdown
  const statusCounts = {};
  allResults.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });
  console.log(`  Status breakdown:         ${JSON.stringify(statusCounts)}`);
  console.log('═'.repeat(70));

  agent.destroy();
  process.exit(0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
