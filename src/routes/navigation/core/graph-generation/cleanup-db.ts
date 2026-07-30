import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧹 Cleaning up massive edges and nodes in batches...');
  let totalEdges = 0;
  while (true) {
    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM "edge" WHERE id IN (SELECT id FROM "edge" LIMIT 20000);`,
    );
    if (result === 0) break;
    totalEdges += result;
    console.log(`🗑️  Deleted ${totalEdges} edges...`);
  }

  let totalNodes = 0;
  while (true) {
    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM "node" WHERE id IN (SELECT id FROM "node" LIMIT 20000);`,
    );
    if (result === 0) break;
    totalNodes += result;
    console.log(`🗑️  Deleted ${totalNodes} nodes...`);
  }

  console.log('✅ Batch cleanup complete!');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
