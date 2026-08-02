import { PrismaClient, NodeType } from '@prisma/client';
import {
  readAllGeoms,
  updateGeom,
  createNodesBatch,
  NodeInsertData,
} from './utils';
import { randomUUID } from 'crypto';

export async function generateDoorNodes(prisma: PrismaClient, floorId: string) {
  console.log(`🚪 Resolving doors and creating entrance nodes...`);

  // 1. Fetch all boundaries on the floor to find those representing doors
  const boundaryFeatures = await readAllGeoms(
    prisma,
    'boundary',
    floorId,
    'lineGeom',
  );
  const doorBoundaries = boundaryFeatures.filter(
    (bf) => bf.properties.boundaryType === 'DOOR',
  );

  console.log(`🔍 Found ${doorBoundaries.length} door boundaries`);

  // 2. Resolve missing Door records
  for (const boundaryFeature of doorBoundaries) {
    const properties = boundaryFeature.properties;

    if (!properties.doorId) {
      const geo = boundaryFeature.geometry;
      if (geo && geo.type === 'LineString' && geo.coordinates.length >= 2) {
        const p1 = geo.coordinates[0];
        const p2 = geo.coordinates[1];
        const midpoint: [number, number] = [
          (p1[0] + p2[0]) / 2,
          (p1[1] + p2[1]) / 2,
        ];

        // Create Door record
        const newDoor = await prisma.door.create({
          data: {
            floorId,
            isAccessible: true,
            isEmergency: false,
            active: true,
            roomAId: properties.roomId || null,
            areaId: properties.areaId || null,
          },
        });

        // Update its position geometry
        const wkt = `POINT(${midpoint[0]} ${midpoint[1]})`;
        await updateGeom(prisma, 'door', newDoor.id, 'positionGeom', wkt);

        // Update the boundary record to link to the new Door
        await prisma.boundary.update({
          where: { id: properties.id },
          data: { doorId: newDoor.id },
        });

        console.log(
          `🆕 Created missing Door record for boundary: ${properties.id} (Label: ${properties.label || 'N/A'})`,
        );
      }
    }
  }

  // 3. Load all active Door features from the database (including the newly created ones)
  const doorFeatures = await readAllGeoms(
    prisma,
    'door',
    floorId,
    'positionGeom',
  );
  const activeDoorFeatures = doorFeatures.filter(
    (df) => df.properties.active !== false,
  );

  const doorNodeCoordsMap = new Map<string, [number, number]>(); // nodeId -> coords
  const nodesToCreate: NodeInsertData[] = [];

  // 4. Create Node for each door
  for (const doorFeature of activeDoorFeatures) {
    const geo = doorFeature.geometry;
    let coords: [number, number] | null = null;

    if (geo && geo.type === 'Point') {
      coords = geo.coordinates as [number, number];
    }

    const doorId = doorFeature.properties.id;

    if (!coords) {
      console.warn(
        `⚠️ Door ${doorId} has no coordinate geometry. Skipping node creation for this door.`,
      );
      continue;
    }

    const nodeId = randomUUID();
    nodesToCreate.push({
      id: nodeId,
      floorId,
      type: NodeType.ROOM_ENTRANCE,
      coords,
      metadata: { doorId },
    });

    doorNodeCoordsMap.set(nodeId, coords);
  }

  // Batch insert all door nodes at once
  await createNodesBatch(prisma, nodesToCreate);

  // Link doors to nodes (now that nodes exist in the DB)
  for (const nodeItem of nodesToCreate) {
    const doorId = nodeItem.metadata.doorId;
    await prisma.door.update({
      where: { id: doorId },
      data: { nodeId: nodeItem.id },
    });
  }

  console.log(`✅ Created ${doorNodeCoordsMap.size} door nodes`);
  return { doorNodeCoordsMap };
}
