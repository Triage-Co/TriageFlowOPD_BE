import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';

interface GeomQueryResult {
  geom: string | null;
}

interface PrismaQueryClient {
  $queryRaw<T>(query: TemplateStringsArray, ...values: any[]): Promise<T>;
  $queryRawUnsafe<T>(query: string, ...values: any[]): Promise<T>;
}

@Injectable()
export class GeoService {
  private readonly prismaClient: PrismaQueryClient;

  constructor(private readonly prisma: PrismaService) {
    this.prismaClient = this.prisma;
  }

  /**
   * Update a geometry column using either WKT or GeoJSON string.
   * Pass an optional Prisma transaction client to keep geom writes inside a transaction.
   */
  async updateGeom(
    table: string,
    id: string,
    column: string,
    geomStr: string,
    client?: PrismaQueryClient,
  ): Promise<void> {
    const db = client ?? this.prismaClient;
    const trimmed = geomStr.trim();
    const isGeoJSON = trimmed.startsWith('{') || trimmed.startsWith('[');
    if (isGeoJSON) {
      await db.$queryRawUnsafe(
        `UPDATE "${table}" SET "${column}" = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) WHERE id = $2::uuid`,
        geomStr,
        id,
      );
    } else {
      await db.$queryRawUnsafe(
        `UPDATE "${table}" SET "${column}" = ST_GeomFromText($1, 4326) WHERE id = $2::uuid`,
        geomStr,
        id,
      );
    }
  }

  /**
   * Convert longitude and latitude into Well-Known Text (WKT) representation.
   */
  toWKT(lon: number, lat: number): string {
    return `POINT(${lon} ${lat})`;
  }

  /**
   * Read a geometry column as a GeoJSON object from the database.
   * Pass an optional Prisma transaction client to read within a transaction.
   */
  async readGeom(
    table: string,
    id: string,
    column: string,
    client?: PrismaQueryClient,
  ): Promise<object | null> {
    const db = client ?? this.prismaClient;
    const result = await db.$queryRawUnsafe<GeomQueryResult[]>(
      `SELECT ST_AsGeoJSON("${column}") AS geom FROM "${table}" WHERE id = $1::uuid`,
      id,
    );
    if (
      !result ||
      result.length === 0 ||
      !result[0] ||
      typeof result[0].geom !== 'string'
    ) {
      return null;
    }
    return JSON.parse(result[0].geom) as object;
  }

  /**
   * Query rooms within a radius (meters) of a point using ST_DWithin.
   */
  async stWithin(
    lon: number,
    lat: number,
    radiusMeters: number,
  ): Promise<any[]> {
    return this.prismaClient.$queryRaw<any[]>`
      SELECT id, room_code as "roomCode", room_label as "roomLabel"
      FROM "physical_room"
      WHERE ST_DWithin(
        "centerGeom"::geography,
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    `;
  }

  /**
   * Fetch a geometry column as a GeoJSON Feature array (all rows) for a floor.
   */
  async readAllGeoms(
    table: string,
    floorId: string,
    column: string,
  ): Promise<any[]> {
    const idColumn = table === 'floor' ? 'id' : 'floorId';
    const result = await this.prismaClient.$queryRawUnsafe<any[]>(
      `SELECT *, ST_AsGeoJSON("${column}") AS geom FROM "${table}" WHERE "${idColumn}" = $1::uuid`,
      floorId,
    );
    return result.map((row) => {
      const geom = row.geom ? JSON.parse(row.geom) : null;
      // Remove raw geometry string/object and return as a GeoJSON Feature
      const { [column]: _, geom: __, ...properties } = row;
      return {
        type: 'Feature',
        geometry: geom,
        properties: properties,
      };
    });
  }
}
