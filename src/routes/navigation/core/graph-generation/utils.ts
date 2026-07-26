import { PrismaClient, NodeType } from '@prisma/client';

export async function updateGeom(prisma: PrismaClient, table: string, id: string, column: string, wkt: string) {
  await (prisma as any).$queryRawUnsafe(
    `UPDATE "${table}" SET "${column}" = ST_GeomFromText($1, 4326) WHERE id = $2::uuid`,
    wkt,
    id,
  );
}

export async function readGeom(prisma: PrismaClient, table: string, id: string, column: string): Promise<any | null> {
  const result = (await (prisma as any).$queryRawUnsafe(
    `SELECT ST_AsGeoJSON("${column}") AS geom FROM "${table}" WHERE id = $1::uuid`,
    id,
  )) as any[];
  if (!result || result.length === 0 || !result[0] || typeof result[0].geom !== 'string') {
    return null;
  }
  return JSON.parse(result[0].geom);
}

export async function readAllGeoms(prisma: PrismaClient, table: string, floorId: string, column: string): Promise<any[]> {
  const idColumn = table === 'floor' ? 'id' : 'floorId';
  const result = (await (prisma as any).$queryRawUnsafe(
    `SELECT *, ST_AsGeoJSON("${column}") AS geom FROM "${table}" WHERE "${idColumn}" = $1::uuid`,
    floorId,
  )) as any[];
  return result.map((row: any) => {
    const geom = row.geom ? JSON.parse(row.geom) : null;
    const { [column]: _, geom: __, ...properties } = row;
    return { type: 'Feature', geometry: geom, properties };
  });
}

export async function createNode(
  prisma: PrismaClient,
  floorId: string,
  type: NodeType,
  coords: [number, number],
  metadata?: object,
) {
  const node = await prisma.node.create({
    data: { floorId, type, metadata },
  });
  const wkt = `POINT(${coords[0]} ${coords[1]})`;
  await updateGeom(prisma, 'node', node.id, 'coordsGeom', wkt);
  return node;
}

export interface NodeInsertData {
  id: string;
  floorId: string;
  type: NodeType;
  coords: [number, number];
  metadata?: any;
}

export async function createNodesBatch(prisma: PrismaClient, nodes: NodeInsertData[]) {
  if (nodes.length === 0) return;

  const valuesSql: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  for (const node of nodes) {
    const idParam = `$${paramIdx++}`;
    const floorIdParam = `$${paramIdx++}`;
    const typeParam = `$${paramIdx++}`;
    const metadataParam = `$${paramIdx++}`;
    const lonParam = `$${paramIdx++}`;
    const latParam = `$${paramIdx++}`;

    params.push(
      node.id,
      node.floorId,
      node.type,
      node.metadata ? JSON.stringify(node.metadata) : null,
      node.coords[0],
      node.coords[1]
    );

    valuesSql.push(
      `(${idParam}::uuid, ${floorIdParam}::uuid, ${typeParam}::text::"NodeType", ${metadataParam}::jsonb, ST_SetSRID(ST_Point(${lonParam}::float8, ${latParam}::float8), 4326))`
    );
  }

  const query = `
    INSERT INTO "node" ("id", "floorId", "type", "metadata", "coordsGeom")
    VALUES ${valuesSql.join(',\n')}
  `;

  await (prisma as any).$executeRawUnsafe(query, ...params);
}
