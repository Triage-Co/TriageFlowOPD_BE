/**
 * Auth smoke for SOD/SO complete while queue stays SERVING.
 * Mutates one waiting step's service_order_id temporarily (restored after).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

function loadDemoEnv() {
  const p = resolve(process.cwd(), '.demo.env');
  const text = readFileSync(p, 'utf8');
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const demo = loadDemoEnv();
const BASE = `http://localhost:${process.env.PORT || 3000}/api`;
const log = (s, ok, d) => console.log(`${ok ? 'OK ' : 'FAIL'} | ${s}${d ? ' — ' + d : ''}`);

async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text?.slice(0, 200) };
  }
  return { status: res.status, json };
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let restore = null;

try {
  const login = await api('POST', '/auth/login', {
    body: { email: demo.DEMO_EMAIL, password: demo.DEMO_PASSWORD },
  });
  const token = login.json?.data?.token;
  if (!token) throw new Error('login failed');
  log('login', true, '');

  const so = await prisma.service_Order.findFirst({
    where: {
      serviceOrderDetails: {
        some: { status: { in: ['PENDING', 'PAID', 'IN_PROGRESS'] } },
      },
    },
    include: {
      serviceOrderDetails: {
        where: { status: { in: ['PENDING', 'PAID', 'IN_PROGRESS'] } },
        take: 2,
      },
    },
  });
  if (!so?.serviceOrderDetails?.length) {
    log('find SO with active details', false, 'none in DB');
    process.exit(1);
  }

  const waiting = await prisma.queue.findFirst({
    where: { room_id: { not: null }, status: { in: ['QUEUED', 'PENDING'] } },
    include: { step: true },
  });
  if (!waiting) throw new Error('no waiting');

  restore = {
    stepId: waiting.step_id,
    prevSo: waiting.step.service_order_id,
  };
  await prisma.step.update({
    where: { step_id: waiting.step_id },
    data: { service_order_id: so.service_order_id },
  });
  log('attach SO to waiting step', true, `details=${so.serviceOrderDetails.length}`);

  const staff =
    (await prisma.staff.findFirst({
      where: { shifts: { some: { room_id: waiting.room_id } } },
    })) || (await prisma.staff.findFirst());

  // clear serving if any
  const view0 = await api('GET', `/queue/room/${waiting.room_id}`, { token });
  if (view0.json?.data?.serving?.queue_id) {
    await api('POST', `/queue/${view0.json.data.serving.queue_id}/complete`, { token });
  }

  const call = await api('POST', '/queue/call-next', {
    token,
    body: {
      room_id: waiting.room_id,
      staff_id: staff.staff_id,
      step_id: waiting.step_id,
    },
  });
  const serving = call.json?.data?.serving;
  log(
    'call-next targeted',
    call.status === 200 && !!serving?.service_order,
    serving?.service_order
      ? `details=${serving.service_order.details?.length}`
      : `status=${call.status} ${call.json?.message || ''}`,
  );
  if (!serving?.queue_id || !serving.service_order) process.exit(1);

  const detail = serving.service_order.details.find((d) =>
    ['PENDING', 'PAID', 'IN_PROGRESS'].includes(d.status),
  );
  const sod = await api(
    'POST',
    `/queue/${serving.queue_id}/service-order-details/${detail.service_order_detail_id}/complete`,
    { token },
  );
  log('SOD complete', sod.status === 200, sod.json?.message || `status=${sod.status}`);

  const view1 = await api('GET', `/queue/room/${waiting.room_id}`, { token });
  const still = view1.json?.data?.serving?.queue_id === serving.queue_id;
  log('still SERVING after SOD', still, '');

  const soComplete = await api(
    'POST',
    `/queue/${serving.queue_id}/service-orders/${serving.service_order.service_order_id}/complete`,
    { token },
  );
  log(
    'SO complete',
    soComplete.status === 200,
    soComplete.json?.message || `status=${soComplete.status}`,
  );

  const view2 = await api('GET', `/queue/room/${waiting.room_id}`, { token });
  log(
    'still SERVING after SO',
    view2.json?.data?.serving?.queue_id === serving.queue_id,
    '',
  );

  const done = await api('POST', `/queue/${serving.queue_id}/complete`, { token });
  log('Step complete', done.status === 200, done.json?.message || '');
  log(
    'serving cleared',
    !done.json?.data?.serving,
    '',
  );
} catch (e) {
  console.error('ERR', e.message);
  process.exitCode = 1;
} finally {
  if (restore) {
    await prisma.step.update({
      where: { step_id: restore.stepId },
      data: { service_order_id: restore.prevSo },
    });
    log('restore step.service_order_id', true, '');
  }
  await prisma.$disconnect();
  await pool.end();
}
