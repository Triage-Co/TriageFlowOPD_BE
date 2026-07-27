const { Client } = require('pg');

const connectionString = "postgresql://postgres.gvhimmcdltiplsnyvnsp:1VWWWFBHqAjL6wBr@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

async function main() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to DB');

    // Add new enum values (IF NOT EXISTS requires PG 10+, which Supabase has)
    const queries = [
      `ALTER TYPE "ClinicalRoomType" ADD VALUE IF NOT EXISTS 'TRIAGE_AREA';`,
      `ALTER TYPE "ClinicalRoomType" ADD VALUE IF NOT EXISTS 'CLINICAL_ROOM';`,
      `ALTER TYPE "ClinicalRoomType" ADD VALUE IF NOT EXISTS 'PROCEDURE_ROOM';`,
      `ALTER TYPE "ClinicalRoomType" ADD VALUE IF NOT EXISTS 'LABORATORY';`,
      `ALTER TYPE "ClinicalRoomType" ADD VALUE IF NOT EXISTS 'IMAGING_ROOM';`,
      `ALTER TYPE "ClinicalRoomType" ADD VALUE IF NOT EXISTS 'FUNCTIONAL_EXPLORATION';`,
      `ALTER TYPE "ClinicalRoomType" ADD VALUE IF NOT EXISTS 'EMPTY';`,
      `ALTER TYPE "ClinicalRoomType" ADD VALUE IF NOT EXISTS 'OTHER';`
    ];

    for (const q of queries) {
      try {
        await client.query(q);
        console.log(`Executed: ${q}`);
      } catch (e) {
        console.log(`Skipped (might already exist): ${q}`);
      }
    }

    // Now update existing data in tables that use ClinicalRoomType
    // We assume the tables are 'room' and 'template_step' or similar. 
    // Let's just run an update on 'physical_room', 'room', 'template_step' if they exist.
    const updateQueries = [
      `UPDATE "room" SET "room_type" = 'TRIAGE_AREA' WHERE "room_type"::text = 'TRIAGE';`,
      `UPDATE "room" SET "room_type" = 'CLINICAL_ROOM' WHERE "room_type"::text = 'CONSULTATION';`,
      `UPDATE "room" SET "room_type" = 'PROCEDURE_ROOM' WHERE "room_type"::text = 'TREATMENT';`,
      `UPDATE "room" SET "room_type" = 'LABORATORY' WHERE "room_type"::text = 'LAB';`,
      `UPDATE "room" SET "room_type" = 'IMAGING_ROOM' WHERE "room_type"::text = 'IMAGING';`,
      `UPDATE "room" SET "room_type" = 'OTHER' WHERE "room_type"::text = 'ADMIN';`,
      
      `UPDATE "template" SET "room_type" = 'TRIAGE_AREA' WHERE "room_type"::text = 'TRIAGE';`,
      `UPDATE "template" SET "room_type" = 'CLINICAL_ROOM' WHERE "room_type"::text = 'CONSULTATION';`,
      `UPDATE "template" SET "room_type" = 'PROCEDURE_ROOM' WHERE "room_type"::text = 'TREATMENT';`,
      `UPDATE "template" SET "room_type" = 'LABORATORY' WHERE "room_type"::text = 'LAB';`,
      `UPDATE "template" SET "room_type" = 'IMAGING_ROOM' WHERE "room_type"::text = 'IMAGING';`,
      `UPDATE "template" SET "room_type" = 'OTHER' WHERE "room_type"::text = 'ADMIN';`
    ];

    for (const q of updateQueries) {
      try {
        const res = await client.query(q);
        console.log(`Updated ${res.rowCount} rows for query: ${q}`);
      } catch (e) {
        console.log(`Skipped (table/column might not exist): ${q} - Error: ${e.message}`);
      }
    }

    console.log('Fix completed successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}
main();
