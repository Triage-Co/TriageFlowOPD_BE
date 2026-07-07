import { Injectable } from '@nestjs/common';
import { PrismaConfig } from '../config/prisma.config';

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

  constructor(private readonly prisma: PrismaConfig) {
    this.prismaClient = this.prisma;
  }

  /**
   * Update a geometry column using either WKT or GeoJSON string.
   */
  async updateGeom(
    table: string,
    id: string,
    column: string,
    geomStr: string,
  ): Promise<void> {
    const trimmed = geomStr.trim();
    const isGeoJSON = trimmed.startsWith('{') || trimmed.startsWith('[');
    if (isGeoJSON) {
      await this.prismaClient.$queryRawUnsafe(
        `UPDATE "${table}" SET "${column}" = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) WHERE id = $2::uuid`,
        geomStr,
        id,
      );
    } else {
      await this.prismaClient.$queryRawUnsafe(
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
   */
  async readGeom(
    table: string,
    id: string,
    column: string,
  ): Promise<object | null> {
    const result = await this.prismaClient.$queryRawUnsafe<GeomQueryResult[]>(
      `SELECT ST_AsGeoJSON(${column}) AS geom FROM "${table}" WHERE id = $1::uuid`,
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
        center_geom::geography,
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    `;
  }
}
