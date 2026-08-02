/**
 * generate-graph.ts
 *
 * Standalone script to auto-generate the navigation graph for Floor 1
 * of the OPD building.
 *
 * Usage:
 *   npx ts-node src/routes/navigation/core/graph-generation/generate-graph.ts
 *
 * Note: Run AFTER Map-3.0.seed.ts has populated the floor/rooms/doors/boundaries.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { readGeom } from './utils';
import { generateDoorNodes } from './doors';
import { generateCorridorNodes } from './corridors';
import { generateGraphEdges } from './edges';

// ─── DB Connection ─────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Constants matching the seed ──────────────────────────────────────────────
const BUILDING_NAME = 'Tòa G2 – Khoa Khám Bệnh';

// ─── Main: Generate Graph ─────────────────────────────────────────────────────
export async function generateGraph(floorId: string) {
  const startTime = Date.now();
  console.log(`\n🔧 Generating navigation graph for Floor ID: ${floorId}...`);

  // Load floor outline
  const floorOutlineGeoJSON = await readGeom(
    prisma,
    'floor',
    floorId,
    'outlineGeom',
  );
  if (!floorOutlineGeoJSON) {
    throw new Error('Floor has no outline geometry defined');
  }

  // Clear previous nodes (cascade deletes edges)
  await prisma.$executeRawUnsafe(`
    SET statement_timeout = 120000;
    DELETE FROM "node" WHERE "floorId" = '${floorId}';
  `);
  console.log(`🗑️  Cleared previous nodes`);

  // ── Step 1: Create nodes at doors (both room doors & standalone doors) ────
  const { doorNodeCoordsMap } = await generateDoorNodes(prisma, floorId);

  // ── Step 2: Divide walkable areas and create corridor nodes ───────────────
  const corridorData = await generateCorridorNodes(
    prisma,
    floorId,
    floorOutlineGeoJSON,
  );

  // ── Step 3: Create corridor connections and connect doors ─────────────────
  await generateGraphEdges(prisma, floorId, doorNodeCoordsMap, corridorData);

  const totalNodes = await prisma.node.count({ where: { floorId } });
  const totalEdges = await prisma.edge.count({
    where: { fromNode: { floorId } },
  });
  const durationMs = Date.now() - startTime;

  console.log('\n============================================================');
  console.log(`✅  Graph generation complete in ${durationMs}ms`);
  console.log(`   Nodes: ${totalNodes}`);
  console.log(`   Edges: ${totalEdges}`);
  console.log('============================================================\n');

  return { totalNodes, totalEdges, durationMs };
}

// ─── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  // Find the building and floor created by the seed
  const building = await prisma.building.findFirst({
    where: { name: BUILDING_NAME },
  });
  if (!building) {
    throw new Error(
      `Building "${BUILDING_NAME}" not found. Please run the seed first.`,
    );
  }

  const floor = await prisma.floor.findUnique({
    where: {
      buildingId_floorNumber: { buildingId: building.id, floorNumber: 1 },
    },
  });
  if (!floor) {
    throw new Error(
      `Floor 1 of building "${BUILDING_NAME}" not found. Please run the seed first.`,
    );
  }

  console.log(`🏢 Building: ${building.name} (${building.id})`);
  console.log(`📐 Floor 1: ${floor.id}`);

  await generateGraph(floor.id);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Graph generation failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
