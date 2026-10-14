import { test } from 'node:test';
import assert from 'node:assert/strict';

// Runs against a live server on a freshly seeded database:
//   php artisan migrate:fresh --seed && php artisan serve   (in another terminal)
//   npm run test:api            (set BASE_URL to change the target)
const base = (process.env.BASE_URL || 'http://127.0.0.1:8000') + '/api';

async function client(email, password = 'password') {
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, body: ct.includes('json') ? await res.json() : await res.text() };
  };
  if (email) { const r = await call('POST', '/auth/login', { email, password }); assert.equal(r.status, 200, `login ${email}`); }
  return call.bind(null) && Object.assign(call, { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b ?? {}), put: (p, b) => call('PUT', p, b), patch: (p, b) => call('PATCH', p, b), del: (p) => call('DELETE', p) });
}
const E = (r) => `${r}@walangbrownout.test`;

test('auth: login, wrong password, disabled & pending accounts, session', async () => {
  const anon = await client();
  assert.equal((await anon.get('/dashboard')).status, 401);
  assert.equal((await anon.post('/auth/login', { email: E('admin'), password: 'nope' })).status, 401);
  assert.equal((await anon.post('/auth/login', { email: 'intern@walangbrownout.test', password: 'password' })).status, 403);
  assert.equal((await anon.post('/auth/login', { email: 'paolo@example.com', password: 'password' })).status, 403);
  const a = await client(E('admin'));
  const me = await a.get('/auth/me');
  assert.equal(me.body.user.role, 'admin');
  assert.ok(!JSON.stringify(me.body).includes('password'));
  await a.post('/auth/logout');
  assert.equal((await a.get('/dashboard')).status, 401);
});

test('lockout after repeated failures', async () => {
  const anon = await client();
  for (let i = 0; i < 5; i++) await anon.post('/auth/login', { email: E('sales'), password: 'bad' + i });
  const r = await anon.post('/auth/login', { email: E('sales'), password: 'password' });
  assert.equal(r.status, 429);
  const a = await client(E('admin'));
  const users = (await a.get('/admin/users')).body;
  const s = users.find((u) => u.email === E('sales'));
  assert.equal((await a.patch(`/admin/users/${s.id}`, { status: 'active' })).status, 200); // admin unlock
  assert.equal((await anon.post('/auth/login', { email: E('sales'), password: 'password' })).status, 200);
});

test('permissions follow the access matrix', async () => {
  const [a, i, p, w, s] = await Promise.all(['admin', 'inventory', 'purchasing', 'warehouse', 'sales'].map((r) => client(E(r))));
  // user management: admin only
  assert.equal((await a.get('/admin/users')).status, 200);
  for (const c of [i, p, w, s]) assert.equal((await c.get('/admin/users')).status, 403);
  // products: add/edit/delete admin + inventory
  const prod = { sku: 'tst-1', name: 'Test', category: 'X', avg_daily_usage: 1, lead_time: 3, safety_stock: 1, max_stock: 50 };
  for (const c of [p, w, s]) assert.equal((await c.post('/products', prod)).status, 403);
  assert.equal((await i.post('/products', prod)).status, 201);
  assert.equal((await i.post('/products', prod)).status, 409);
  // batches hidden from sales
  assert.equal((await s.get('/batches')).status, 403);
  for (const c of [a, i, p, w]) assert.equal((await c.get('/batches')).status, 200);
  // purchasing does NOT receive shipments, admin is view-only
  const inc = (await p.get('/incoming')).body;
  assert.ok(inc.length > 0);
  const pending = inc.find((x) => x.status === 'expected');
  const rec = { items: pending.items.map((x) => ({ product_id: x.product_id, received_qty: x.expected })) };
  assert.equal((await p.post(`/incoming/${pending.id}/receive`, rec)).status, 403);
  assert.equal((await a.post(`/incoming/${pending.id}/receive`, rec)).status, 403);
  assert.equal((await s.post(`/incoming/${pending.id}/receive`, rec)).status, 403);
  // PO creation: purchasing only
  for (const c of [a, i, w, s]) assert.equal((await c.post('/purchase-orders', {})).status, 403);
  // suppliers manage: purchasing only
  assert.equal((await i.post('/suppliers', { name: 'X' })).status, 403);
  // sales sees limited product data
  const av = (await s.get('/products')).body;
  assert.ok(av.length && !('unit_cost' in av[0]) && !('reorder_point' in av[0]) && 'available' in av[0]);
  assert.equal((await s.get('/products/THM-2200')).status, 403);
  // warehouse never sees cost
  const wp = (await w.get('/products')).body;
  assert.ok(!('unit_cost' in wp[0]));
  // reports
  assert.equal((await i.get('/reports/inventory/summary')).status, 200);
  assert.equal((await i.get('/reports/purchasing/summary')).status, 403);
  assert.equal((await p.get('/reports/purchasing/replenishment')).status, 200);
  assert.equal((await w.get('/reports/inventory/summary')).status, 403);
});

test('role permission edits take effect; admin locked grants stay', async () => {
  const a = await client(E('admin')); const i = await client(E('inventory'));
  const roles = (await a.get('/admin/roles')).body;
  const inv = roles.roles.find((r) => r.key === 'inventory');
  assert.equal((await i.post('/purchase-orders', {})).status, 403);
  await a.put('/admin/roles/inventory/permissions', { permissions: [...inv.permissions, 'po.create'] });
  assert.equal((await i.post('/purchase-orders', {})).status, 400); // now allowed → validation error
  await a.put('/admin/roles/inventory/permissions', { permissions: inv.permissions });
  assert.equal((await i.post('/purchase-orders', {})).status, 403);
  const admOrig = roles.roles.find((r) => r.key === 'admin').permissions;
  const adm = (await a.put('/admin/roles/admin/permissions', { permissions: [] })).body;
  assert.ok(adm.permissions.includes('users.manage'));
  await a.put('/admin/roles/admin/permissions', { permissions: admOrig });
  const me = (await a.get('/auth/me')).body.user;
  assert.equal((await a.patch(`/admin/users/${me.id}`, { role: 'sales' })).status, 409);
});

test('Mystery Shrinkage: availability is capped by physical count; cannot oversell', async () => {
  const s = await client(E('sales')); const i = await client(E('inventory'));
  const prods = (await s.get('/availability')).body;
  const th = prods.find((p) => p.sku === 'THM-2200');
  assert.equal(th.available, 12); // system says 45, count found 12
  const r = await s.post('/sales-orders', { customer: 'Greedy Inc', items: [{ product_id: th.id, qty: 24 }] });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /Insufficient stock: only 12 units/);
  const ok = await s.post('/sales-orders', { customer: 'Fair Inc', items: [{ product_id: th.id, qty: 12 }] });
  assert.equal(ok.status, 201);
  assert.equal((await s.get('/availability')).body.find((p) => p.sku === 'THM-2200').available, 0);
  // resolving with stock adjustment aligns system to physical
  const alerts = (await i.get('/alerts')).body;
  const d = alerts.find((a) => a.type === 'discrepancy');
  assert.equal(d.priority, 'CRITICAL'); assert.equal(d.diff, -33);
  assert.equal((await i.post('/alerts/state', { key: d.key, state: 'resolved' })).status, 409);
  assert.equal((await i.post(`/counts/${d.count_id}/resolve`, { action: 'adjust' })).status, 400); // note required
  assert.equal((await i.post(`/counts/${d.count_id}/investigate`, {})).status, 200);
  assert.equal((await i.post(`/counts/${d.count_id}/resolve`, { action: 'adjust', note: 'Shrinkage confirmed' })).status, 200);
  const prod = (await i.get('/products/THM-2200')).body;
  assert.equal(prod.on_hand, 12);
  assert.equal(prod.discrepancy, null);
  assert.ok(!(await i.get('/alerts')).body.some((a) => a.type === 'discrepancy'));
});

test('FEFO: expired never picked, nearest expiry first', async () => {
  const [s, w] = await Promise.all([client(E('sales')), client(E('warehouse'))]);
  const f = (await s.get('/availability')).body.find((p) => p.sku === 'FLT-F023');
  assert.ok(f.available > 0);
  const o = await s.post('/sales-orders', { customer: 'Filter Fan', items: [{ product_id: f.id, qty: 40 }] });
  assert.equal(o.status, 201);
  const plan = (await w.get('/pick-orders')).body.find((x) => x.id === o.body.id).items[0].plan;
  assert.equal(plan[0].batch, 'B-2207'); assert.equal(plan[0].qty, 30); assert.equal(plan[1].batch, 'B-2311'); assert.equal(plan[1].qty, 10);
  assert.ok(!plan.some((x) => x.batch === 'B-2105'));
  assert.equal((await w.post(`/pick-orders/${o.body.id}/complete`)).status, 409); // must start first
  assert.equal((await w.post(`/pick-orders/${o.body.id}/start`)).status, 200);
  const done = await w.post(`/pick-orders/${o.body.id}/complete`);
  assert.equal(done.status, 200); assert.equal(done.body.status, 'ready');
  const b = (await w.get('/batches')).body;
  assert.equal(b.find((x) => x.code === 'B-2207'), undefined); // fully drawn down
  assert.equal(b.find((x) => x.code === 'B-2311').qty, 80);
  assert.equal((await w.post(`/outgoing/${o.body.id}/ship`)).status, 200);
  assert.equal((await w.post(`/outgoing/${o.body.id}/ship`)).status, 409);
  assert.equal((await s.post(`/sales-orders/${o.body.id}/cancel`)).status, 409);
  assert.equal((await s.post(`/pick-orders/${o.body.id}/start`)).status, 403);
});

test('receiving: variance flagged, creates batch with expiry, blocks double receive', async () => {
  const [w, i] = await Promise.all([client(E('warehouse')), client(E('inventory'))]);
  const sh = (await w.get('/incoming')).body.find((x) => x.code === 'SHP-0002');
  assert.equal((await w.post(`/incoming/${sh.id}/receive`, { items: [] })).status, 400);
  const r = await w.post(`/incoming/${sh.id}/receive`, { items: [{ product_id: sh.items[0].product_id, received_qty: 90 }] });
  assert.equal(r.status, 200); assert.equal(r.body.status, 'variance');
  assert.equal((await w.post(`/incoming/${sh.id}/receive`, { items: [{ product_id: sh.items[0].product_id, received_qty: 90 }] })).status, 409);
  const batches = (await w.get('/batches')).body.filter((b) => b.sku === 'FLT-F023' && b.po_id);
  assert.ok(batches.length && batches[0].expiry && batches[0].qty === 90);
  const al = (await i.get('/alerts?group=discrepancy')).body.filter((a) => a.type === 'variance');
  assert.ok(al.length >= 2);
});

test('purchasing: over-order blocked, PO lifecycle, supplier validation', async () => {
  const p = await client(E('purchasing'));
  const prods = (await p.get('/reorder')).body; assert.ok(prods.length);
  const ac = prods.find((x) => x.sku === 'ACU-1000');
  const supplier = (await p.get('/suppliers')).body[0];
  const big = await p.post('/purchase-orders', { supplier_id: supplier.id, items: [{ product_id: ac.id, qty: 9000 }] });
  assert.equal(big.status, 409); assert.match(big.body.error, /above the maximum/);
  assert.equal((await p.post('/purchase-orders', { supplier_id: supplier.id, items: [] })).status, 400);
  const ok = await p.post('/purchase-orders', { supplier_id: supplier.id, items: [{ product_id: ac.id, qty: ac.suggested_qty || 10 }], send: true });
  assert.equal(ok.status, 201); assert.equal(ok.body.status, 'sent'); assert.ok(ok.body.shipment);
  assert.equal((await p.post(`/purchase-orders/${ok.body.id}/send`)).status, 409);
  assert.equal((await p.post(`/purchase-orders/${ok.body.id}/cancel`)).status, 200);
  assert.equal((await p.post('/suppliers', { name: 'New Co', email: 'bad' })).status, 400);
  assert.equal((await p.post('/suppliers', { name: 'New Co', email: 'a@b.co', lead_time_days: 3 })).status, 201);
  assert.equal((await p.post('/suppliers', { name: 'new co' })).status, 409);
});

test('stock adjustments: warehouse requests, inventory approves', async () => {
  const [w, i] = await Promise.all([client(E('warehouse')), client(E('inventory'))]);
  const id = (await i.get('/products')).body.find((x) => x.sku === 'ACC-REM').id;
  const req = await w.post('/adjustments', { product_id: id, delta: -5, reason: 'Damaged' });
  assert.equal(req.status, 201); assert.equal(req.body.status, 'pending');
  assert.equal((await w.post(`/adjustments/${req.body.id}/approve`)).status, 403);
  const before = (await i.get('/products/ACC-REM')).body.on_hand;
  assert.equal((await i.post(`/adjustments/${req.body.id}/approve`)).status, 200);
  assert.equal((await i.get('/products/ACC-REM')).body.on_hand, before - 5);
  assert.equal((await i.post(`/adjustments/${req.body.id}/approve`)).status, 409);
  assert.equal((await i.post('/adjustments', { product_id: id, delta: -99999, reason: 'x' })).status, 400);
});

test('dashboards exist for every role with the guide sections', async () => {
  const want = { admin: ['kpis', 'user_activity', 'system_status', 'recent_activity'], inventory: ['kpis', 'health', 'low_stock', 'expiry', 'discrepancies'], purchasing: ['kpis', 'reorder', 'pending_pos', 'incoming', 'history'], warehouse: ['kpis', 'to_receive', 'to_pick', 'to_ship', 'inventory_tasks', 'alerts'], sales: ['kpis', 'availability', 'recent_orders', 'status', 'low_stock'] };
  for (const [role, keys] of Object.entries(want)) {
    const c = await client(E(role)); const d = await c.get('/dashboard');
    assert.equal(d.status, 200, role);
    for (const k of keys) assert.ok(k in d.body, `${role}.${k}`);
  }
});

test('validation & hardening', async () => {
  const a = await client(E('admin'));
  assert.equal((await a.post('/admin/users', { name: 'X', email: 'x@y.co', role: 'god', password: 'longenough' })).status, 400);
  assert.equal((await a.post('/admin/users', { name: 'X', email: 'x@y.co', role: 'sales', password: 'short' })).status, 400);
  assert.equal((await a.post('/admin/users', { name: 'X', email: 'new@y.co', role: 'sales', password: 'longenough' })).status, 201);
  assert.equal((await a.put('/admin/settings', { expiry_warning_days: 'abc' })).status, 400);
  assert.equal((await a.put('/admin/settings', { expiry_warning_days: 45 })).status, 200);
  const raw = await fetch(base + '/admin/users', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' });
  assert.ok([401, 415].includes(raw.status));
  assert.equal((await a.get('/nope')).status, 404);
  const csv = await a.get('/reports/inventory/expiry?format=csv'); assert.equal(csv.status, 200); assert.match(csv.body, /Batch/);
  const logs = (await a.get('/admin/logs')).body; assert.ok(logs.length > 5);
  const reg = await (await client()).post('/auth/register', { name: 'Zed', email: 'zed@example.com', password: 'longenough' });
  assert.equal(reg.status, 201);
  assert.equal((await (await client()).post('/auth/login', { email: 'zed@example.com', password: 'longenough' })).status, 403);
});

test('reorder point = usage x lead time + safety stock (+ seasonal multiplier inside the window)', async () => {
  const a = await client(E('inventory'));
  const list = (await a.get('/products')).body;
  const rows = list.products || list.items || list;
  const p = rows.find((x) => x.sku === 'ACU-1000');
  assert.ok(p, 'ACU-1000 exists');
  const m = new Date().getMonth() + 1; // season is April-July; window opens one lead time (14 days) early
  const d = new Date(); const early = new Date(d.getFullYear(), 3, 1); early.setDate(early.getDate() - 14);
  const start = new Date(d.getFullYear(), 3, 1), end = new Date(d.getFullYear(), 7, 0);
  const inWindow = d >= early && d <= end;
  const expected = inWindow ? 3 * 14 * 4 + 12 : 3 * 14 + 12;
  assert.equal(p.reorder_point ?? p.reorder?.reorder_point, expected);
});
