import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'closedRing', async: false })
class ClosedRingConstraint implements ValidatorConstraintInterface {
  validate(coordinates: number[][][]) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return false;
    const ring = coordinates[0];
    if (!Array.isArray(ring) || ring.length < 4) return false;
    for (const pt of ring) {
      if (
        !Array.isArray(pt) ||
        pt.length < 2 ||
        typeof pt[0] !== 'number' ||
        typeof pt[1] !== 'number' ||
        pt[0] < -180 ||
        pt[0] > 180 ||
        pt[1] < -90 ||
        pt[1] > 90
      ) {
        return false;
      }
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    return first[0] === last[0] && first[1] === last[1];
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a closed polygon ring (>=4 points, first=last, valid lng/lat)`;
  }
}

@ValidatorConstraint({ name: 'lineStringCoords', async: false })
class LineStringCoordsConstraint implements ValidatorConstraintInterface {
  validate(coordinates: number[][]) {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;
    for (const pt of coordinates) {
      if (
        !Array.isArray(pt) ||
        pt.length < 2 ||
        typeof pt[0] !== 'number' ||
        typeof pt[1] !== 'number' ||
        pt[0] < -180 ||
        pt[0] > 180 ||
        pt[1] < -90 ||
        pt[1] > 90
      ) {
        return false;
      }
    }
    return true;
  }

  defaultMessage() {
    return 'lineGeom.coordinates must be exactly 2 [lng, lat] points';
  }
}

@ValidatorConstraint({ name: 'pointCoords', async: false })
class PointCoordsConstraint implements ValidatorConstraintInterface {
  validate(coordinates: number[]) {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;
    const [lng, lat] = coordinates;
    return (
      typeof lng === 'number' &&
      typeof lat === 'number' &&
      lng >= -180 &&
      lng <= 180 &&
      lat >= -90 &&
      lat <= 90
    );
  }

  defaultMessage() {
    return 'coordinates must be [lng, lat] with valid ranges';
  }
}

export class PointGeomDto {
  @Equals('Point')
  @ApiProperty({ example: 'Point' })
  type: 'Point';

  @IsArray()
  @Validate(PointCoordsConstraint)
  @ApiProperty({ example: [105.8049, 21.0285], type: [Number] })
  coordinates: [number, number];
}

export class LineStringGeomDto {
  @Equals('LineString')
  @ApiProperty({ example: 'LineString' })
  type: 'LineString';

  @IsArray()
  @Validate(LineStringCoordsConstraint)
  @ApiProperty({
    example: [
      [105.8049, 21.0285],
      [105.805, 21.0286],
    ],
  })
  coordinates: [[number, number], [number, number]];
}

export class PolygonGeomDto {
  @Equals('Polygon')
  @ApiProperty({ example: 'Polygon' })
  type: 'Polygon';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1)
  @Validate(ClosedRingConstraint)
  @ApiProperty({
    example: [
      [
        [105.8049, 21.0285],
        [105.8051, 21.0285],
        [105.8051, 21.0287],
        [105.8049, 21.0287],
        [105.8049, 21.0285],
      ],
    ],
  })
  coordinates: number[][][];
}

export function toGeoJsonString(geom: object): string {
  return JSON.stringify(geom);
}

export function lineMidpoint(
  coordinates: [[number, number], [number, number]],
): [number, number] {
  return [
    (coordinates[0][0] + coordinates[1][0]) / 2,
    (coordinates[0][1] + coordinates[1][1]) / 2,
  ];
}
