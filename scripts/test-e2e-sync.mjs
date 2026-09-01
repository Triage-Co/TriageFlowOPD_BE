import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const patient = await prisma.patient.findFirst({
    where: { citizen_id: '084203000710' },
  });

  if (!patient) {
    console.error('Không tìm thấy bệnh nhân 084203000710');
    process.exit(1);
  }

  console.log(`\n=== 1. Test gọi HIS REST API (:3002) ===`);
  const hisUrl = `http://localhost:3002/api/exam-his/citizen/${patient.citizen_id}/latest`;
  console.log(`Calling: GET ${hisUrl}`);

  const hisRes = await fetch(hisUrl);
  const hisData = await hisRes.json();
  console.log('Kết quả từ HIS API:', JSON.stringify(hisData, null, 2));

  console.log(`\n=== 2. Test tạo bệnh án mới trên HIS qua POST /api/exam-his (kèm allergy_notes) ===`);
  const newExamPayload = {
    citizen_id: patient.citizen_id,
    chief_complaint: 'Đau tức ngực trái khi gắng sức, hồi hộp',
    heart_rate: 88,
    blood_pressure_sys: 140,
    blood_pressure_dia: 90,
    temperature: 36.9,
    spo2: 97,
    diagnosis: 'Cơn đau thắt ngực ổn định / Tăng huyết áp độ 2',
    final_diagnosis: 'Bệnh tim thiếu máu cục bộ mạn tính (I25.9)',
    hpi: 'Bệnh nhân đau ngực trái sau xương ức khi đi bộ nhanh khoảng 100m, nghỉ ngơi 5 phút đỡ đau, kèm khó thở nhẹ.',
    pmh: 'Tăng huyết áp 5 năm điều trị bằng Amlodipine 5mg, rối loạn lipid máu.',
    pe: {
      'Tim mạch': 'T1 T2 đều rõ, không tiếng thổi, mạch quay 2 bên bắt rõ',
      'Hô hấp': 'Phổi 2 bên thông khí tốt, không rale',
      'Toàn thân': 'Thể trạng trung bình, BMI 23.5, không phù'
    },
    allergy_notes: 'Dị ứng Penicillin, Aspirin, tôm cua ghẹ',
    blood_type: 'O+',
  };

  const createRes = await fetch('http://localhost:3002/api/exam-his', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newExamPayload),
  });
  const createData = await createRes.json();
  console.log('Tạo bệnh án HIS thành công:', JSON.stringify(createData, null, 2));

  console.log(`\n=== 3. Giả lập TriageFlow BE sync từ HIS vào Patient DB & Visit_Session ===`);
  // Lấy dữ liệu mới nhất vừa tạo từ HIS
  const latestExamRes = await fetch(hisUrl);
  const latestExamData = (await latestExamRes.json()).data;

  // 1. Cập nhật allergy_notes và blood_type vào bảng Patient
  const patientUpdate = {};
  if (latestExamData.allergy_notes) patientUpdate.allergy_notes = latestExamData.allergy_notes;
  if (latestExamData.blood_type) patientUpdate.blood_type = latestExamData.blood_type;

  if (Object.keys(patientUpdate).length > 0) {
    await prisma.patient.update({
      where: { patient_id: patient.patient_id },
      data: patientUpdate,
    });
  }

  // 2. Cập nhật hoặc tạo Visit_Session trong TriageFlow DB
  let session = await prisma.visit_Session.findFirst({
    where: { patient_id: patient.patient_id },
    orderBy: { visit_date: 'desc' },
  });

  const sessionUpdateData = {
    chief_complaint: latestExamData.chief_complaint,
    heart_rate: latestExamData.heart_rate,
    blood_pressure_sys: latestExamData.blood_pressure_sys,
    blood_pressure_dia: latestExamData.blood_pressure_dia,
    temperature: latestExamData.temperature,
    spo2: latestExamData.spo2,
    diagnosis: latestExamData.diagnosis,
    final_diagnosis: latestExamData.final_diagnosis,
    hpi: latestExamData.hpi,
    pmh: latestExamData.pmh,
    pe: latestExamData.pe,
  };

  if (session) {
    session = await prisma.visit_Session.update({
      where: { visit_session_id: session.visit_session_id },
      data: sessionUpdateData,
    });
  } else {
    session = await prisma.visit_Session.create({
      data: {
        patient_id: patient.patient_id,
        ...sessionUpdateData,
      },
    });
  }

  const updatedPatient = await prisma.patient.findUnique({
    where: { patient_id: patient.patient_id },
  });

  console.log('=== 4. Kết quả Patient & Visit_Session trong TriageFlow sau khi đồng bộ: ===');
  console.log('Patient allergy_notes:', updatedPatient.allergy_notes);
  console.log('Patient blood_type:', updatedPatient.blood_type);
  console.log({
    visit_session_id: session.visit_session_id,
    patient_id: session.patient_id,
    chief_complaint: session.chief_complaint,
    heart_rate: session.heart_rate,
    blood_pressure: `${session.blood_pressure_sys}/${session.blood_pressure_dia}`,
    temperature: session.temperature,
    spo2: session.spo2,
    diagnosis: session.diagnosis,
    final_diagnosis: session.final_diagnosis,
    hpi: session.hpi,
    pmh: session.pmh,
    pe: session.pe,
  });

  await pool.end();
  console.log('\n>>> E2E Test Hoàn Thành Xuất Sắc!');
}

run().catch(err => {
  console.error('Lỗi E2E:', err);
  process.exit(1);
});
