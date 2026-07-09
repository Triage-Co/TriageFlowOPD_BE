const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function main() {
  const connectionString = "postgresql://postgres.otgoblqgiodpermgolua:TriageFlowOPD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  await prisma.$connect();
  
  try {
    const floors = await prisma.floor.findMany({ take: 5 });
    console.log("Floors:", floors);
  } catch (e) {
    console.error("Error fetching floors:", e.message);
  }

  try {
    const rooms = await prisma.physicalRoom.findMany({ take: 5 });
    console.log("PhysicalRooms:", rooms);
  } catch (e) {
    console.error("Error fetching physical rooms:", e.message);
  }
  
  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
