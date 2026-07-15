import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const building = await prisma.building.findFirst({
    where: { name: 'Tòa G2 – Khoa Khám Bệnh' },
  });
  console.log('Building:', building);
  if (!building) return;

  const floors = await prisma.floor.findMany({
    where: { buildingId: building.id },
  });
  console.log('Floors count:', floors.length);
  for (const floor of floors) {
    const rooms = await prisma.physicalRoom.findMany({
      where: { floorId: floor.id },
    });
    console.log(`Floor ${floor.floorNumber} rooms count:`, rooms.length);
    if (rooms.length > 0) {
      console.log('First room:', rooms[0]);
      // Check geometry using raw query
      const centerGeom = await (prisma as any).$queryRawUnsafe(
        `SELECT ST_AsGeoJSON("centerGeom") AS geom, ST_AsGeoJSON("outlineGeom") AS outline FROM "physical_room" WHERE id = $1::uuid`,
        rooms[0].id
      );
      console.log('Geom raw results:', centerGeom);
    }
  }
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
