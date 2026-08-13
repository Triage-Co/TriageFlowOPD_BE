import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const AI_CATALOG: Array<{
  ai_code: string;
  ai_name: string;
  ai_name_vi: string;
}> = [
  { ai_code: 'sp_1', ai_name: 'General Practitioner', ai_name_vi: 'Bác sĩ đa khoa' },
  { ai_code: 'sp_2', ai_name: 'Internal Medicine Specialist', ai_name_vi: 'Bác sĩ nội khoa' },
  { ai_code: 'sp_3', ai_name: 'Pediatrician', ai_name_vi: 'Bác sĩ nhi khoa' },
  { ai_code: 'sp_4', ai_name: 'Surgeon', ai_name_vi: 'Bác sĩ ngoại khoa' },
  { ai_code: 'sp_5', ai_name: 'Gastroenterologist', ai_name_vi: 'Bác sĩ tiêu hóa' },
  { ai_code: 'sp_6', ai_name: 'Orthopedist', ai_name_vi: 'Bác sĩ chấn thương chỉnh hình' },
  { ai_code: 'sp_7', ai_name: 'Ophthalmologist', ai_name_vi: 'Bác sĩ mắt' },
  { ai_code: 'sp_8', ai_name: 'Toxicologist', ai_name_vi: 'Bác sĩ chống độc' },
  { ai_code: 'sp_9', ai_name: 'Dermatologist', ai_name_vi: 'Bác sĩ da liễu' },
  { ai_code: 'sp_10', ai_name: 'Endocrinologist', ai_name_vi: 'Bác sĩ nội tiết' },
  { ai_code: 'sp_11', ai_name: 'Urologist', ai_name_vi: 'Bác sĩ tiết niệu' },
  { ai_code: 'sp_12', ai_name: 'Cardiologist', ai_name_vi: 'Bác sĩ tim mạch' },
  { ai_code: 'sp_13', ai_name: 'Oncologist', ai_name_vi: 'Bác sĩ ung bướu' },
  { ai_code: 'sp_14', ai_name: 'ENT doctor', ai_name_vi: 'Bác sĩ tai mũi họng' },
  { ai_code: 'sp_15', ai_name: 'Gynecologist', ai_name_vi: 'Bác sĩ phụ khoa' },
  { ai_code: 'sp_16', ai_name: 'Psychiatrist', ai_name_vi: 'Bác sĩ tâm thần' },
  { ai_code: 'sp_17', ai_name: 'Neurologist', ai_name_vi: 'Bác sĩ thần kinh' },
  { ai_code: 'sp_18', ai_name: 'Dentist', ai_name_vi: 'Bác sĩ răng hàm mặt' },
  { ai_code: 'sp_19', ai_name: 'Infectologist', ai_name_vi: 'Bác sĩ truyền nhiễm' },
  { ai_code: 'sp_20', ai_name: 'Rheumatologist', ai_name_vi: 'Bác sĩ cơ xương khớp' },
  { ai_code: 'sp_21', ai_name: 'Angiologist', ai_name_vi: 'Bác sĩ mạch máu' },
  { ai_code: 'sp_22', ai_name: 'Diabetologist', ai_name_vi: 'Bác sĩ đái tháo đường' },
  { ai_code: 'sp_23', ai_name: 'Allergist', ai_name_vi: 'Bác sĩ dị ứng' },
  { ai_code: 'sp_24', ai_name: 'Nephrologist', ai_name_vi: 'Bác sĩ thận học' },
  { ai_code: 'sp_25', ai_name: 'Hematologist', ai_name_vi: 'Bác sĩ huyết học' },
  { ai_code: 'sp_26', ai_name: 'Neonatologist', ai_name_vi: 'Bác sĩ sơ sinh' },
  { ai_code: 'sp_27', ai_name: 'Pulmonologist', ai_name_vi: 'Bác sĩ hô hấp' },
  { ai_code: 'sp_29', ai_name: 'Maxillofacial surgeon', ai_name_vi: 'Bác sĩ phẫu thuật hàm mặt' },
];

const NEW_HOSPITAL_SPECIALTIES: Array<{
  specialty_code: string;
  specialty_name: string;
  description: string;
}> = [
  {
    specialty_code: 'NGOAI_THAN_KINH',
    specialty_name: 'Ngoại TK',
    description: 'Ngoại thần kinh — chưa gán Room (phase 2)',
  },
  {
    specialty_code: 'NGOAI_LONG_NGUC',
    specialty_name: 'Ngoại lồng ngực',
    description: 'Chưa gán Room (phase 2)',
  },
  {
    specialty_code: 'NGOAI_TONG_QUAT',
    specialty_name: 'Ngoại tổng quát',
    description: 'Chưa gán Room (phase 2)',
  },
  {
    specialty_code: 'NGOAI_TIM_MACH',
    specialty_name: 'Ngoại tim mạch',
    description: 'Tim mạch can thiệp — chưa gán Room (phase 2)',
  },
  {
    specialty_code: 'NOI_TONG_QUAT',
    specialty_name: 'Nội tổng quát',
    description: 'Chưa gán Room (phase 2)',
  },
  {
    specialty_code: 'VLTL_PHCN',
    specialty_name: 'Vật lý trị liệu - PHCN',
    description: 'Chưa có phòng trên tầng 1',
  },
  {
    specialty_code: 'YHCT',
    specialty_name: 'Y học cổ truyền',
    description: 'Chưa có phòng trên tầng 1',
  },
];

const RENAME_SPECIALTIES: Array<{
  specialty_code: string;
  specialty_name: string;
}> = [
  { specialty_code: 'SP_12', specialty_name: 'Nội tim mạch' },
  { specialty_code: 'SP_15', specialty_name: 'Sản phụ khoa' },
  { specialty_code: 'SP_17', specialty_name: 'Nội TK' },
];

/** Extra (non-primary) mappings: AI code → hospital specialty_code */
const EXTRA_MAPPINGS: Array<{ ai_code: string; specialty_code: string; sort_order: number }> =
  [
    { ai_code: 'sp_1', specialty_code: 'NOI_TONG_QUAT', sort_order: 10 },
    { ai_code: 'sp_2', specialty_code: 'NOI_TONG_QUAT', sort_order: 10 },
    { ai_code: 'sp_4', specialty_code: 'NGOAI_TONG_QUAT', sort_order: 10 },
    { ai_code: 'sp_4', specialty_code: 'NGOAI_THAN_KINH', sort_order: 20 },
    { ai_code: 'sp_4', specialty_code: 'NGOAI_LONG_NGUC', sort_order: 30 },
    { ai_code: 'sp_20', specialty_code: 'VLTL_PHCN', sort_order: 10 },
    { ai_code: 'sp_21', specialty_code: 'NGOAI_TIM_MACH', sort_order: 10 },
    { ai_code: 'sp_22', specialty_code: 'SP_10', sort_order: 10 },
    { ai_code: 'sp_26', specialty_code: 'SP_3', sort_order: 10 },
    { ai_code: 'sp_29', specialty_code: 'SP_18', sort_order: 10 },
  ];

async function upsertMapping(
  prisma: PrismaClient,
  aiSpecialtyId: string,
  specialtyId: string,
  opts: { is_primary: boolean; sort_order: number },
) {
  const existing = await prisma.aiSpecialtyMapping.findUnique({
    where: {
      ai_specialty_id_specialty_id: {
        ai_specialty_id: aiSpecialtyId,
        specialty_id: specialtyId,
      },
    },
  });
  if (existing) {
    return existing;
  }
  return prisma.aiSpecialtyMapping.create({
    data: {
      ai_specialty_id: aiSpecialtyId,
      specialty_id: specialtyId,
      is_primary: opts.is_primary,
      sort_order: opts.sort_order,
    },
  });
}

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    for (const row of RENAME_SPECIALTIES) {
      const updated = await prisma.specialty.updateMany({
        where: { specialty_code: row.specialty_code },
        data: { specialty_name: row.specialty_name },
      });
      console.log(
        `Rename ${row.specialty_code} → ${row.specialty_name} (${updated.count})`,
      );
    }

    for (const row of NEW_HOSPITAL_SPECIALTIES) {
      await prisma.specialty.upsert({
        where: { specialty_code: row.specialty_code },
        create: row,
        update: {
          specialty_name: row.specialty_name,
          description: row.description,
        },
      });
      console.log(`Upsert hospital specialty ${row.specialty_code}`);
    }

    for (const row of AI_CATALOG) {
      await prisma.aiSpecialty.upsert({
        where: { ai_code: row.ai_code },
        create: row,
        update: {
          ai_name: row.ai_name,
          ai_name_vi: row.ai_name_vi,
        },
      });
    }
    console.log(`Upserted ${AI_CATALOG.length} AI specialties`);

    const aiByCode = new Map(
      (await prisma.aiSpecialty.findMany()).map((s) => [s.ai_code, s]),
    );
    const hospitalByCode = new Map(
      (await prisma.specialty.findMany()).map((s) => [
        s.specialty_code.toUpperCase(),
        s,
      ]),
    );

    for (const row of AI_CATALOG) {
      const ai = aiByCode.get(row.ai_code);
      const hospital = hospitalByCode.get(row.ai_code.toUpperCase());
      if (!ai || !hospital) {
        console.warn(
          `Skip identity mapping ${row.ai_code}: ai=${!!ai} hospital=${!!hospital}`,
        );
        continue;
      }
      await upsertMapping(prisma, ai.ai_specialty_id, hospital.specialty_id, {
        is_primary: true,
        sort_order: 0,
      });
    }
    console.log('Identity primary mappings done');

    for (const row of EXTRA_MAPPINGS) {
      const ai = aiByCode.get(row.ai_code);
      const hospital = hospitalByCode.get(row.specialty_code.toUpperCase());
      if (!ai || !hospital) {
        console.warn(
          `Skip extra mapping ${row.ai_code} → ${row.specialty_code}`,
        );
        continue;
      }
      await upsertMapping(prisma, ai.ai_specialty_id, hospital.specialty_id, {
        is_primary: false,
        sort_order: row.sort_order,
      });
    }
    console.log('Extra mappings done');

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS ai_specialty_mapping_one_primary
      ON ai_specialty_mapping (ai_specialty_id)
      WHERE is_primary = true AND is_active = true
    `);
    console.log('Partial unique index ensured');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
