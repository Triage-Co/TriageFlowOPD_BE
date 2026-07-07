try {
  const { PrismaClient } = require('@prisma/client');
  console.log('Successfully imported PrismaClient:', typeof PrismaClient);
  const client = new PrismaClient();
  console.log('Successfully instantiated PrismaClient!');
} catch (e) {
  console.error('Error importing/instantiating PrismaClient:', e);
}
