const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE data_type = 'USER-DEFINED' AND udt_name = 'ClinicalRoomType';
  `;
  console.log('Columns using ClinicalRoomType:', result);
  await prisma.$disconnect();
}
main();
