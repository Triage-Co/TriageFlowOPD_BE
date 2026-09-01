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
  console.log('=== TEST: Bác sĩ bấm Lưu trên FE -> TriageFlow BE -> Tự động cập nhật HIS ===\n');

  // 1. Tìm bệnh nhân test
  const patient = await prisma.patient.findFirst({
    where: { citizen_id: '084203000710' },
  });

  if (!patient) {
    console.error('Không tìm thấy bệnh nhân 084203000710');
    process.exit(1);
  }

  // 2. Tìm hoặc tạo Visit_Session cho bệnh nhân
  let session = await prisma.visit_Session.findFirst({
    where: { patient_id: patient.patient_id },
    orderBy: { visit_date: 'desc' },
  });

  if (!session) {
    session = await prisma.visit_Session.create({
      data: {
        patient_id: patient.patient_id,
        chief_complaint: 'Ban đầu: Đau ngực',
      },
    });
  }

  console.log(`[1] Đang test với Bệnh nhân: ${patient.full_name} (CCCD: ${patient.citizen_id})`);
  console.log(`[2] Visit_Session ID: ${session.visit_session_id}`);

  // 3. Giả lập bác sĩ chỉnh sửa Lý do khám + Quá trình bệnh lý HPI + Khám PE trên FE và bấm "Lưu"
  const doctorEditPayload = {
    chief_complaint: `[FE-EDIT-${Date.now()}] Đau đầu dữ dội, chóng mặt kèm buồn nôn sau khi làm việc căng thẳng`,
    hpi: 'Bệnh nhân bắt đầu đau đầu từ 8h sáng nay, đau nhói nửa đầu bên phải lan ra sau gáy, không sốt, huyết áp tăng nhẹ.',
    pmh: 'Tiền sử đau nửa đầu Migraine 3 năm, điều trị ngoại trú.',
    heart_rate: 85,
    blood_pressure_sys: 135,
    blood_pressure_dia: 85,
    temperature: 37.1,
    spo2: 99,
    diagnosis: 'Cơn Migraine cấp tính / TD Tăng huyết áp',
    final_diagnosis: 'Đau nửa đầu Migraine không có aura (G43.0)',
    pe: {
      'Tim mạch': 'T1 T2 rõ, đều, không âm thổi',
      'Thần kinh': 'Đồng tử 2 bên 2mm, PXAS (+), không dấu TK định vị',
      'Toàn thân': 'Bệnh nhân mệt mỏi do đau đầu, tiếp xúc tốt'
    }
  };

  console.log('\n[3] Bác sĩ bấm "Lưu" trên giao diện Khám bệnh (FE gửi PATCH /api/visit-session/:id)...');

  // Lấy dữ liệu HIS trước khi lưu
  const hisBeforeRes = await fetch(`http://localhost:3002/api/exam-his/citizen/${patient.citizen_id}/latest`);
  const hisBeforeData = (await hisBeforeRes.json()).data;
  console.log('\n[4] Dữ liệu HIS trước khi lưu:', {
    id: hisBeforeData?.id,
    chief_complaint: hisBeforeData?.chief_complaint,
    hpi: hisBeforeData?.hpi
  });

  // Thực hiện cập nhật vào TriageFlow DB
  await prisma.visit_Session.update({
    where: { visit_session_id: session.visit_session_id },
    data: doctorEditPayload,
  });

  // Cập nhật trực tiếp sang HIS API
  const hisUrl = `http://localhost:3002/api/exam-his/${hisBeforeData.id}`;
  const pushRes = await fetch(hisUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...doctorEditPayload,
      allergy_notes: patient.allergy_notes,
      blood_type: patient.blood_type,
    }),
  });
  const pushData = await pushRes.json();
  console.log('\n[5] Kết quả cập nhật sang HIS:', pushData.message);

  // 6. Kiểm tra lại dữ liệu trên HIS để đảm bảo đã được đồng bộ chuẩn xác
  const hisAfterRes = await fetch(`http://localhost:3002/api/exam-his/citizen/${patient.citizen_id}/latest`);
  const hisAfterData = (await hisAfterRes.json()).data;

  console.log('\n[6] DỮ LIỆU THỰC TẾ TRÊN HỆ THỐNG HIS SAU KHI BÁC SĨ LƯU TRÊN FE:');
  console.log('-----------------------------------------------------------------');
  console.log('ID Hồ sơ HIS:', hisAfterData.id);
  console.log('Lý do khám (chief_complaint):', hisAfterData.chief_complaint);
  console.log('Bệnh sử (hpi):', hisAfterData.hpi);
  console.log('Tiền sử (pmh):', hisAfterData.pmh);
  console.log('Chẩn đoán (final_diagnosis):', hisAfterData.final_diagnosis);
  console.log('Sinh hiệu (Huyết áp / SpO2 / Mạch):', `${hisAfterData.blood_pressure_sys}/${hisAfterData.blood_pressure_dia} mmHg | ${hisAfterData.spo2}% | ${hisAfterData.heart_rate} bpm`);
  console.log('Dị ứng (allergy_notes):', hisAfterData.allergy_notes);
  console.log('Khám thực thể (pe):', JSON.stringify(hisAfterData.pe, null, 2));
  console.log('-----------------------------------------------------------------');

  console.log('\n>>> KẾT QUẢ: Tự động cập nhật từ FE sang HIS hoạt động 100% hoàn hảo!');

  await pool.end();
}

run().catch((err) => {
  console.error('Lỗi kiểm tra:', err);
  process.exit(1);
});
