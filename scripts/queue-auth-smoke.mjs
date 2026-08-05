/**
 * Authenticated smoke of queue serving APIs.
 * Usage: node scripts/queue-auth-smoke.mjs
 * Credentials: .demo.env (DEMO_EMAIL, DEMO_PASSWORD) — never printed.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

function loadDemoEnv() {
  const p = resolve(process.cwd(), '.demo.env');
  if (!existsSync(p)) throw new Error('Missing .demo.env');
  const text = readFileSync(p, 'utf8');
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const demo = loadDemoEnv();
const BASE = `http://localhost:${process.env.PORT || 3000}/api`;
const log = (step, ok, detail) => {
  console.log(`${ok ? 'OK ' : 'FAIL'} | ${step}${detail ? ' — ' + detail : ''}`);
};

async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text?.slice(0, 300) };
  }
  return { status: res.status, json };
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const results = [];

try {
  // 1) Login (Nest may return 200 or 201)
  const login = await api('POST', '/auth/login', {
    body: { email: demo.DEMO_EMAIL, password: demo.DEMO_PASSWORD },
  });
  const token =
    login.json?.data?.token ||
    login.json?.data?.access_token ||
    login.json?.token;
  if (!(login.status === 200 || login.status === 201) || !token) {
    const keys = login.json?.data ? Object.keys(login.json.data) : Object.keys(login.json || {});
    log(
      'login',
      false,
      `status=${login.status} msg=${login.json?.message || ''} dataKeys=${keys.join(',')}`,
    );
    process.exit(1);
  }
  const accountId = login.json.data?.id || login.json.data?.sub;
  log('login', true, `account=${String(accountId || '').slice(0, 8)}…`);
  results.push('login');

  // 2) Pick room with waiting + staff
  const waiting = await prisma.queue.findFirst({
    where: {
      room_id: { not: null },
      status: { in: ['QUEUED', 'PENDING'] },
    },
    orderBy: { created_at: 'asc' },
    select: {
      queue_id: true,
      room_id: true,
      queue_number: true,
      step_id: true,
      status: true,
      step: {
        select: {
          service_order_id: true,
          service_code: true,
          step_type: true,
        },
      },
    },
  });
  if (!waiting) {
    log('pick waiting queue', false, 'no QUEUED/PENDING with room_id');
    process.exit(1);
  }
  const roomId = waiting.room_id;
  log(
    'pick waiting',
    true,
    `room=${roomId.slice(0, 8)}… q=${waiting.queue_number} status=${waiting.status} so=${waiting.step?.service_order_id ? 'yes' : 'no'}`,
  );

  const staff =
    (await prisma.staff.findFirst({
      where: { shifts: { some: { room_id: roomId } } },
      select: { staff_id: true, full_name: true },
    })) ||
    (await prisma.staff.findFirst({ select: { staff_id: true, full_name: true } }));
  if (!staff) {
    log('pick staff', false, 'no staff');
    process.exit(1);
  }
  log('pick staff', true, `${staff.full_name} (${staff.staff_id.slice(0, 8)}…)`);

  // 3) Room view
  const roomView = await api('GET', `/queue/room/${roomId}`, { token });
  const rvOk = roomView.status === 200 && roomView.json?.data;
  log(
    'GET /queue/room/:roomId',
    rvOk,
    rvOk
      ? `waiting=${roomView.json.data.waiting?.length ?? 0} serving=${roomView.json.data.serving ? 'yes' : 'null'} expected_min=${roomView.json.data.expected_service_minutes}`
      : `status=${roomView.status} ${roomView.json?.message || JSON.stringify(roomView.json)?.slice(0, 180)}`,
  );
  if (!rvOk) process.exit(1);
  results.push('room-view');

  // If already serving, complete/refuse first to free room
  if (roomView.json.data.serving?.queue_id) {
    const sid = roomView.json.data.serving.queue_id;
    const clear = await api('POST', `/queue/${sid}/complete`, { token });
    log(
      'pre-clear SERVING via complete',
      clear.status === 200,
      `status=${clear.status} ${clear.json?.message || ''}`,
    );
  }

  // 4) call-next
  const call = await api('POST', '/queue/call-next', {
    token,
    body: { room_id: roomId, staff_id: staff.staff_id },
  });
  const callOk = call.status === 200 && (call.json?.data?.serving || call.json?.data?.current_patient);
  const serving = call.json?.data?.serving;
  log(
    'POST /queue/call-next',
    callOk,
    callOk
      ? `queue=${serving?.queue_id?.slice(0, 8) || 'n/a'}… number=${serving?.queue_number || call.json?.data?.current_patient?.queue_number} so=${serving?.service_order ? 'yes' : 'no'}`
      : `status=${call.status} ${call.json?.message || JSON.stringify(call.json)?.slice(0, 220)}`,
  );
  if (!callOk || !serving?.queue_id) {
    console.log('call-next body keys:', Object.keys(call.json?.data || {}));
    process.exit(1);
  }
  results.push('call-next');

  const queueId = serving.queue_id;
  const so = serving.service_order;

  // 5) SOD / SO if present
  if (so?.details?.length) {
    const active = so.details.find((d) =>
      ['PENDING', 'PAID', 'IN_PROGRESS'].includes(d.status),
    );
    if (active) {
      const sod = await api(
        'POST',
        `/queue/${queueId}/service-order-details/${active.service_order_detail_id}/complete`,
        { token },
      );
      log(
        'POST .../service-order-details/:id/complete',
        sod.status === 200,
        sod.status === 200
          ? `detail status now in response`
          : `status=${sod.status} ${sod.json?.message || ''}`,
      );
      if (sod.status === 200) results.push('sod-complete');
    } else {
      log('SOD complete', true, 'skipped — no active detail');
    }

    // refresh serving — still SERVING?
    const afterSod = await api('GET', `/queue/room/${roomId}`, { token });
    const still =
      afterSod.json?.data?.serving?.queue_id === queueId;
    log('queue still SERVING after SOD', still, still ? 'ok' : 'UNEXPECTED closed');
  } else {
    log('SOD/SO path', true, 'skipped — serving.service_order is null');
  }

  // 6) Step complete (closes queue)
  const complete = await api('POST', `/queue/${queueId}/complete`, { token });
  log(
    'POST /queue/:queueId/complete',
    complete.status === 200,
    complete.status === 200
      ? `serving_after=${complete.json?.data?.serving ? 'still set?' : 'null'}`
      : `status=${complete.status} ${complete.json?.message || JSON.stringify(complete.json)?.slice(0, 220)}`,
  );
  if (complete.status !== 200) process.exit(1);
  results.push('step-complete');

  // 7) call-next again then refuse
  const call2 = await api('POST', '/queue/call-next', {
    token,
    body: { room_id: roomId, staff_id: staff.staff_id },
  });
  const s2 = call2.json?.data?.serving;
  if (call2.status === 200 && s2?.queue_id) {
    log('call-next #2', true, `q=${s2.queue_number}`);
    const refuse = await api('POST', `/queue/${s2.queue_id}/refuse`, {
      token,
      body: { reason: 'smoke test refuse' },
    });
    log(
      'POST /queue/:queueId/refuse',
      refuse.status === 200,
      refuse.status === 200
        ? `ok`
        : `status=${refuse.status} ${refuse.json?.message || ''}`,
    );
    if (refuse.status === 200) results.push('step-refuse');
  } else {
    log(
      'call-next #2 + refuse',
      false,
      `status=${call2.status} ${call2.json?.message || 'no more waiting?'}`,
    );
  }

  // 8) Admin heatmap
  const heat = await api('GET', '/queue/admin/heatmap', { token });
  log(
    'GET /queue/admin/heatmap',
    heat.status === 200,
    heat.status === 200
      ? `keys=${Object.keys(heat.json?.data || heat.json || {}).slice(0, 5).join(',')}`
      : `status=${heat.status}`,
  );
  if (heat.status === 200) results.push('heatmap');

  console.log('\nPASSED steps:', results.join(', '));
} catch (e) {
  console.error('ERR', e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
