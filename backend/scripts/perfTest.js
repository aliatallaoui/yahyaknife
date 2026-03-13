#!/usr/bin/env node
/**
 * Performance test — measures response times for key API endpoints
 * across multiple tenants with 162K+ documents in the database.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const http = require('http');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';
const BASE = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET;

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
    };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const ms = Date.now() - start;
        let json;
        try { json = JSON.parse(body); } catch { json = null; }
        resolve({ status: res.statusCode, ms, bodyLength: body.length, path, json });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (postBody) req.write(JSON.stringify(postBody));
    req.end();
  });
}

async function run() {
  await mongoose.connect(MONGO_URI);

  const User = require('../models/User');

  // Login via API to get proper tokens (includes role population etc.)
  const testEmails = ['owner-t1@stresstest.dz', 'owner-t25@stresstest.dz', 'owner-t50@stresstest.dz', 'owner-t75@stresstest.dz', 'owner-t100@stresstest.dz'];
  const tokens = [];

  await mongoose.disconnect();

  // Login each user via the API
  for (const email of testEmails) {
    try {
      const res = await apiCall('/api/auth/login', null, 'POST', { email, password: 'StressTest2026!' });
      if (res.json && res.json.token) {
        tokens.push({ email, token: res.json.token, tenant: email });
        console.log(`  ✅ Logged in ${email} (${res.ms}ms)`);
      } else {
        console.log(`  ❌ Login failed for ${email}: ${res.status} ${JSON.stringify(res.json)}`);
      }
    } catch (e) {
      console.log(`  ❌ Login error for ${email}: ${e.message}`);
    }
  }

  if (tokens.length === 0) { console.log('No users found'); process.exit(1); }

  console.log(`\n🏎️  Performance Test — ${tokens.length} tenants\n`);
  console.log('Endpoint'.padEnd(45) + 'Status'.padEnd(8) + 'Time'.padEnd(10) + 'Size'.padEnd(10) + 'Tenant');
  console.log('─'.repeat(95));

  const endpoints = [
    '/api/sales/orders?page=1&limit=25',
    '/api/sales/orders?page=1&limit=25&status=Delivered',
    '/api/sales/orders?page=1&limit=25&status=New',
    '/api/sales/orders?page=1&limit=25&status=Confirmed',
    '/api/customers',
    '/api/customers/metrics',
    '/api/inventory/products',
    '/api/inventory/metrics',
    '/api/inventory/categories',
    '/api/dashboard/metrics',
    '/api/hr/employees',
    '/api/hr/attendance?date=' + new Date().toISOString().split('T')[0],
    '/api/hr/payroll',
    '/api/hr/metrics',
    '/api/analytics/daily',
    '/api/analytics/weekly',
    '/api/couriers',
    '/api/couriers/analytics/kpis',
    '/api/finance/overview',
    '/api/finance/expenses',
    '/api/finance/revenue',
    '/api/shipments',
    '/api/support',
    '/api/sales-channels',
    '/api/call-center/orders',
    '/api/procurement/suppliers',
    '/api/webhooks',
  ];

  const results = [];

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  for (const { email, token, tenant } of tokens) {
    const tenantLabel = email.replace('@stresstest.dz', '');
    for (const ep of endpoints) {
      try {
        const r = await apiCall(ep, token);
        const status = r.status === 200 ? '✅ 200' : r.status === 403 ? '🔒 403' : r.status === 402 ? '💳 402' : `⚠️  ${r.status}`;
        const timeColor = r.ms < 100 ? '⚡' : r.ms < 500 ? '✓' : r.ms < 1000 ? '⚠️' : '🐌';
        console.log(`${ep.padEnd(50)} ${status.padEnd(8)} ${timeColor} ${String(r.ms + 'ms').padEnd(8)} ${String(r.bodyLength + 'B').padEnd(10)} ${tenantLabel}`);
        results.push({ ...r, tenant: tenantLabel });
      } catch (e) {
        console.log(`${ep.padEnd(50)} ❌ ERR  ${(e.message || '').slice(0, 20).padEnd(20)} ${tenantLabel}`);
        results.push({ status: 0, ms: 0, bodyLength: 0, path: ep });
      }
      await sleep(50); // avoid rate limiter
    }
    console.log('');
  }

  // Summary
  const successful = results.filter(r => r.status === 200);
  const slow = results.filter(r => r.ms > 500);
  const avgMs = successful.length > 0 ? Math.round(successful.reduce((s, r) => s + r.ms, 0) / successful.length) : 0;
  const maxMs = results.length > 0 ? Math.max(...results.map(r => r.ms)) : 0;
  const p95 = successful.length > 0 ? successful.sort((a, b) => a.ms - b.ms)[Math.floor(successful.length * 0.95)]?.ms : 0;

  console.log('═'.repeat(95));
  console.log('  PERFORMANCE SUMMARY');
  console.log('═'.repeat(95));
  console.log(`  Total requests:     ${results.length}`);
  console.log(`  Successful (200):   ${successful.length}`);
  console.log(`  Average latency:    ${avgMs}ms`);
  console.log(`  P95 latency:        ${p95}ms`);
  console.log(`  Max latency:        ${maxMs}ms`);
  console.log(`  Slow (>500ms):      ${slow.length}`);
  console.log('═'.repeat(95));
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
