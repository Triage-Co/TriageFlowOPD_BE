import { PrismaClient as TriageFlowPrisma } from '@prisma/client';
import { PrismaPg as TriageFlowPrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const tfPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const tfAdapter = new TriageFlowPrismaPg(tfPool);
const tfPrisma = new TriageFlowPrisma({ adapter: tfAdapter });

// HIS pool
const hisEnv = dotenv.config({ path: path.join(__dirname, '..', '..', 'his', '.env') }).parsed || {};
const hisPool = new pg.Pool({
  connectionString: hisEnv.DATABASE_URL || "postgresql://postgres.beytjttsxqmuhpprhfpa:uuO8i0p2LhLtjsxd@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
});

async function run() {
  console.log('--- 1. Kiểm tra danh sách bệnh nhân trong TriageFlow ---');
  const patients = await tfPrisma.patient.findMany({ take: 2 });
  console.log(`Tìm thấy ${patients.length} bệnh nhân:`, patients.map(p => ({ id: p.patient_id, name: p.full_name, citizen_id: p.citizen_id })));

  if (patients.length === 0) {
    console.log('Chưa có bệnh nhân nào trong TriageFlow');
    process.exit(0);
  }

  const testPatient = patients[0];
  console.log(`\n--- 2. Tạo hồ sơ bệnh án mẫu trong HIS cho bệnh nhân: ${testPatient.full_name} (CCCD: ${testPatient.citizen_id}) ---`);

  // Insert vào HIS DB
  const insertQuery = `
    INSERT INTO exam_his (id, citizen_id, visit_date, chief_complaint, heart_rate, blood_pressure_sys, blood_pressure_dia, temperature, spo2, diagnosis, final_diagnosis, hpi, pmh, pe)
    VALUES (
      gen_random_uuid(),
      $1,
      NOW(),
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12::jsonb
    )
    RETURNING *;
  `;

  const examData = [
    testPatient.citizen_id,
    'Đau đầu dữ dội, chóng mặt từng cơn',
    82,
    135,
    85,
    37.2,
    98,
    'Hội chứng tiền đình / Theo dõi Tăng huyết áp',
    'Rối loạn tiền đình ngoại biên (H81.0) - Tăng huyết áp độ 1',
    'Bệnh nhân khởi phát chóng mặt kèm hoa mắt từ sáng nay khi thức dậy, cảm giác nhà cửa quay cuồng, buồn nôn nhưng không nôn.',
    'Tiền sử viêm xoang mạn tính 3 năm, không có tiền sử dị ứng thuốc.',
    JSON.stringify({
      'Toàn thân': 'Bệnh nhân tỉnh táo, tiếp xúc tốt, niêm mạc hồng',
      'Thần kinh': 'Nystagmus ngang hướng phải (+), Romberg (+)',
      'Tim mạch': 'T1, T2 đều, rõ, tần số 82ck/ph',
      'Hô hấp': 'Phổi thông khí đều 2 bên, không rale'
    })
  ];

  const hisRes = await hisPool.query(insertQuery, examData);
  console.log('Đã tạo thành công bệnh án trong HIS:');
  console.log(hisRes.rows[0]);

  console.log('\n--- 3. Kiểm tra query Visit_Session trên TriageFlow DB trước khi sync ---');
  const beforeSession = await tfPrisma.visit_Session.findFirst({
    where: { patient_id: testPatient.patient_id },
    orderBy: { visit_date: 'desc' }
  });
  console.log('Session hiện tại trong TriageFlow:', beforeSession ? { id: beforeSession.visit_session_id, chief_complaint: beforeSession.chief_complaint } : 'Chưa có');

  await tfPool.end();
  await hisPool.end();
  console.log('\n>>> Kiểm tra dữ liệu thành công!');
}

run().catch(err => {
  console.error('Lỗi kiểm tra:', err);
  process.exit(1);
});
