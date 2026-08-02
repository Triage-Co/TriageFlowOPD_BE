import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const floors = await prisma.floor.findMany({ include: { building: true } });
  console.log(`Total floors in database: ${floors.length}`);
  floors.forEach((f) => {
    console.log(
      `Floor ID: ${f.id}, Number: ${f.floorNumber}, Building: ${f.building.name}`,
    );
  });
  await prisma.$disconnect();
  await pool.end();
}
main();
