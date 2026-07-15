/**
 * Seed script for OPD (Outpatient Department) Building Map
 *
 * Creates: Building → Floor → PhysicalRoom → RoomBoundary → Door → FeatureTemplate → PlacedFeature
 *
 * Usage:
 *   npx ts-node prisma/seed-opd-map.ts
 *
 * Re-runnable: deletes existing "Tòa G2 – Khoa Khám Bệnh" building first.
 */

import { PrismaClient, RoomType, BoundaryType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


// ─── Coordinate helpers ──────────────────────────────────────────────────────
// Fake base at (0,0). Convert meters → lon/lat for PostGIS SRID 4326.
const BASE_LON = 0;
const BASE_LAT = 0;
const LON_PER_METER = 1 / 111320;
const LAT_PER_METER = 1 / 110540;

function toCoords(xM: number, yM: number): [number, number] {
  return [BASE_LON + xM * LON_PER_METER, BASE_LAT + yM * LAT_PER_METER];
}

function toPointWKT(xM: number, yM: number): string {
  const [lon, lat] = toCoords(xM, yM);
  return `POINT(${lon} ${lat})`;
}

function toPolygonWKT(corners: [number, number][]): string {
  const wkt = corners.map(([x, y]) => {
    const [lon, lat] = toCoords(x, y);
    return `${lon} ${lat}`;
  });
  return `POLYGON((${wkt.join(', ')}))`;
}

function toLineWKT(pts: [number, number][]): string {
  const wkt = pts.map(([x, y]) => {
    const [lon, lat] = toCoords(x, y);
    return `${lon} ${lat}`;
  });
  return `LINESTRING(${wkt.join(', ')})`;
}

async function updateGeom(table: string, id: string, column: string, wkt: string) {
  await (prisma as any).$queryRawUnsafe(
    `UPDATE "${table}" SET "${column}" = ST_GeomFromText($1, 4326) WHERE id = $2::uuid`,
    wkt,
    id,
  );
}

// ─── Room data ───────────────────────────────────────────────────────────────

interface RoomDef {
  code: string;
  label: string;
}

interface ZoneDef {
  name: string;
  rooms: RoomDef[];
}

const ZONES: ZoneDef[] = [
  {
    name: 'Khu A – Nội Khoa Tổng Hợp',
    rooms: [
      { code: 'G2.2.6', label: 'Nội tim mạch 1' },
      { code: 'G2.2.7', label: 'Nội tim mạch 2' },
      { code: 'G2.2.8', label: 'Nội tim mạch 3' },
      { code: 'G2.2.9', label: 'Nội tim mạch 4' },
      { code: 'G2.2.10', label: 'Nội tim mạch 5' },
      { code: 'G2.2.12', label: 'Tim mạch can thiệp 1' },
      { code: 'G2.2.13', label: 'Tim mạch can thiệp 2' },
      { code: 'G2.2.11', label: 'Nội cơ xương khớp' },
      { code: 'G2.2.14', label: 'Nội tiết 1' },
      { code: 'G2.2.15', label: 'Nội tiết 2' },
      { code: 'G2.2.16', label: 'Nội tiết 3' },
      { code: 'G2.2.25', label: 'Nội thận' },
      { code: 'G2.2.26', label: 'Nội tiêu hóa 1' },
      { code: 'G2.2.27', label: 'Nội tiêu hóa 2' },
      { code: 'G2.2.22', label: 'Nội thần kinh 1' },
      { code: 'G2.2.23', label: 'Nội thần kinh 2' },
      { code: 'G2.2.28', label: 'Nội hô hấp 1' },
      { code: 'G2.2.18', label: 'Nội tổng quát 1' },
      { code: 'G2.2.19', label: 'Nội tổng quát 2' },
      { code: 'G2.2.20', label: 'Nội tổng quát 3' },
      { code: 'G2.2.40', label: 'Huyết học' },
      { code: 'G2.2.24', label: 'Bệnh truyền nhiễm' },
    ],
  },
  {
    name: 'Khu B – Nhi Khoa & Tâm Thần',
    rooms: [
      { code: 'G2.2.34', label: 'Nhi 1' },
      { code: 'G2.2.35', label: 'Nhi 2' },
      { code: 'G2.2.33', label: 'Sức khỏe tâm thần' },
    ],
  },
  {
    name: 'Khu C – Ngoại Khoa Tổng Hợp',
    rooms: [
      { code: 'G2.4.12', label: 'Ngoại tổng quát 1' },
      { code: 'G2.4.14', label: 'Ngoại tiết niệu' },
      { code: 'G2.4.15', label: 'Ngoại lồng ngực' },
      { code: 'G2.4.16', label: 'Ngoại thần kinh 1' },
      { code: 'G2.4.17', label: 'Ngoại thần kinh 2' },
      { code: 'G2.4.18', label: 'Ngoại ung bướu' },
      { code: 'G2.4.1', label: 'Chấn thương chỉnh hình 1' },
      { code: 'G2.4.2', label: 'Chấn thương chỉnh hình 2' },
    ],
  },
  {
    name: 'Khu D – Chuyên Khoa Đặc Biệt',
    rooms: [
      { code: 'G2.4.8', label: 'Mắt 1' },
      { code: 'G2.4.11', label: 'Mắt 2' },
      { code: 'G2.4.24', label: 'Tai mũi họng 1' },
      { code: 'G2.4.25', label: 'Tai mũi họng 2' },
      { code: 'G2.4.28', label: 'Răng hàm mặt 1' },
      { code: 'G2.4.29', label: 'Răng hàm mặt 2' },
      { code: 'G2.4.4', label: 'Da liễu 1' },
      { code: 'G2.4.5', label: 'Da liễu 2' },
      { code: 'G2.4.6', label: 'Da liễu 3' },
    ],
  },
  {
    name: 'Khu E – Sản & Phụ Khoa',
    rooms: [
      { code: 'G2.4.23', label: 'Khám thai 1' },
      { code: 'G2.4.21', label: 'Phụ khoa' },
      { code: 'G2.4.34', label: 'Đơn vị tiêm chủng' },
    ],
  },
  {
    name: 'Khu F – Phục Hồi CN & Y Học Cổ Truyền',
    rooms: [
      { code: 'G2.6.1', label: 'Vật lý trị liệu – PHCN' },
      { code: 'G2.7.1', label: 'Y học cổ truyền' },
    ],
  },
];

// ─── Layout constants ────────────────────────────────────────────────────────
const FLOOR_W = 120; // meters
const FLOOR_H = 80;
const ROOM_W = 4;  // room width (along x)
const ROOM_D = 5;  // room depth (along y)
const ROOM_GAP = 0.5; // gap between rooms
const ZONE_GAP = 5; // gap between zones
const HALLWAY_CENTER_Y = 40; // hallway center y
const HALLWAY_HALF_W = 2; // hallway half-width

const BUILDING_NAME = 'Tòa G2 – Khoa Khám Bệnh';
const ORG_ID = '00000000-0000-0000-0000-000000000001';

// ─── Layout computation ──────────────────────────────────────────────────────

interface RoomPlacement {
  code: string;
  label: string;
  zone: string;
  x: number;   // bottom-left x
  y: number;   // bottom-left y
  w: number;
  h: number;
  doorSide: 'bottom' | 'top'; // which side faces the hallway
}

interface FeaturePlacement {
  zone: string;
  x: number;
  y: number;
}

function computeLayout(): { rooms: RoomPlacement[]; features: FeaturePlacement[] } {
  const rooms: RoomPlacement[] = [];
  const features: FeaturePlacement[] = [];

  // TOP side (y > hallway): Khu A (22 rooms), Khu B (3 rooms)
  // Rooms face hallway on bottom side → doorSide = 'bottom'
  const topZones = [ZONES[0], ZONES[1]]; // A, B
  let topX = 2; // start x for top zones

  for (const zone of topZones) {
    // Place reception desk at start of zone, on the hallway edge
    features.push({
      zone: zone.name,
      x: topX + 1,
      y: HALLWAY_CENTER_Y + HALLWAY_HALF_W - 0.5,
    });

    // Layout rooms in 2 rows (for zone A with 22 rooms) or 1 row (for smaller zones)
    const cols = zone.rooms.length > 11 ? 11 : zone.rooms.length;
    const roomsPerRow = cols;

    for (let i = 0; i < zone.rooms.length; i++) {
      const col = i % roomsPerRow;
      const row = Math.floor(i / roomsPerRow);

      const rx = topX + col * (ROOM_W + ROOM_GAP);
      // First row starts just above hallway
      const ry = HALLWAY_CENTER_Y + HALLWAY_HALF_W + 1 + row * (ROOM_D + ROOM_GAP);

      rooms.push({
        code: zone.rooms[i].code,
        label: zone.rooms[i].label,
        zone: zone.name,
        x: rx,
        y: ry,
        w: ROOM_W,
        h: ROOM_D,
        doorSide: row === 0 ? 'bottom' : 'top', // first row faces hallway (bottom), second row faces corridor between rows
      });
    }

    topX += cols * (ROOM_W + ROOM_GAP) + ZONE_GAP;
  }

  // BOTTOM side (y < hallway): Khu C (8), Khu D (9), Khu E (3), Khu F (2)
  // Rooms face hallway on top side → doorSide = 'top'
  const bottomZones = [ZONES[2], ZONES[3], ZONES[4], ZONES[5]]; // C, D, E, F
  let bottomX = 2;

  for (const zone of bottomZones) {
    // Place reception desk
    features.push({
      zone: zone.name,
      x: bottomX + 1,
      y: HALLWAY_CENTER_Y - HALLWAY_HALF_W + 0.5,
    });

    for (let i = 0; i < zone.rooms.length; i++) {
      const rx = bottomX + i * (ROOM_W + ROOM_GAP);
      // Room sits below hallway
      const ry = HALLWAY_CENTER_Y - HALLWAY_HALF_W - 1 - ROOM_D;

      rooms.push({
        code: zone.rooms[i].code,
        label: zone.rooms[i].label,
        zone: zone.name,
        x: rx,
        y: ry,
        w: ROOM_W,
        h: ROOM_D,
        doorSide: 'top',
      });
    }

    bottomX += zone.rooms.length * (ROOM_W + ROOM_GAP) + ZONE_GAP;
  }

  return { rooms, features };
}

// ─── Main seed function ──────────────────────────────────────────────────────

async function main() {
  console.log('🏥 Seeding OPD Building Map...\n');

  // 1. Cleanup
  console.log('🧹 Cleaning up old data...');
  const existing = await prisma.building.findFirst({
    where: { name: BUILDING_NAME },
  });
  if (existing) {
    // Cascade delete: Building → Floor → PhysicalRoom → RoomBoundary, Door, PlacedFeature, etc.
    await prisma.building.delete({ where: { id: existing.id } });
    console.log(`   Deleted existing building: ${existing.id}`);
  }

  // Also clean up orphaned FeatureTemplate
  await prisma.featureTemplate.deleteMany({
    where: { name: 'reception-desk' },
  });

  // 2. Create Building
  console.log('🏗️  Creating Building...');
  const building = await prisma.building.create({
    data: {
      name: BUILDING_NAME,
      addressLabel: 'Khoa Khám Bệnh – Tầng 2 Khối G2',
      totalFloors: 1,
      organizationId: ORG_ID,
    },
  });
  console.log(`   Building: ${building.id}`);

  // 3. Create Floor
  console.log('📐 Creating Floor 1...');
  const floor = await prisma.floor.create({
    data: {
      buildingId: building.id,
      floorNumber: 1,
      widthMeters: FLOOR_W,
      heightMeters: FLOOR_H,
      scalePixelsPerMeter: 10,
    },
  });
  const floorOutline = toPolygonWKT([
    [0, 0], [0, FLOOR_H], [FLOOR_W, FLOOR_H], [FLOOR_W, 0], [0, 0],
  ]);
  await updateGeom('floor', floor.id, 'outlineGeom', floorOutline);
  console.log(`   Floor: ${floor.id}`);

  // 4. Compute layout
  const { rooms: roomPlacements, features: featurePlacements } = computeLayout();
  console.log(`\n📦 Layout computed: ${roomPlacements.length} rooms, ${featurePlacements.length} reception desks\n`);

  // 5. Create PhysicalRooms + Boundaries + Doors
  console.log('🚪 Creating PhysicalRooms, Doors & Boundaries...');
  let roomCount = 0;
  let boundaryCount = 0;
  let doorCount = 0;

  for (const rp of roomPlacements) {
    // Create PhysicalRoom
    const room = await prisma.physicalRoom.create({
      data: {
        floorId: floor.id,
        roomCode: rp.code,
        roomLabel: rp.label,
        type: RoomType.CONSULTATION,
        heightMeters: 3.0,
      },
    });

    // Set geometry
    const cx = rp.x + rp.w / 2;
    const cy = rp.y + rp.h / 2;
    await updateGeom('physical_room', room.id, 'centerGeom', toPointWKT(cx, cy));
    await updateGeom('physical_room', room.id, 'outlineGeom', toPolygonWKT([
      [rp.x, rp.y],
      [rp.x, rp.y + rp.h],
      [rp.x + rp.w, rp.y + rp.h],
      [rp.x + rp.w, rp.y],
      [rp.x, rp.y],
    ]));

    // Create Door (at the hallway-facing side, centered)
    let doorX: number, doorY: number;
    if (rp.doorSide === 'bottom') {
      doorX = cx;
      doorY = rp.y;
    } else {
      doorX = cx;
      doorY = rp.y + rp.h;
    }

    const door = await prisma.door.create({
      data: {
        floorId: floor.id,
        roomAId: room.id,
        isAccessible: true,
        active: true,
      },
    });
    await updateGeom('door', door.id, 'positionGeom', toPointWKT(doorX, doorY));
    doorCount++;

    // Create 4 Wall boundaries + update the door-facing one

    // Boundary corners:
    // seqNo 1: Left wall   (x,y) → (x, y+h)
    // seqNo 2: Top wall    (x, y+h) → (x+w, y+h)
    // seqNo 3: Right wall  (x+w, y+h) → (x+w, y)
    // seqNo 4: Bottom wall (x+w, y) → (x, y)

    const sides: Array<{
      seqNo: number;
      pts: [number, number][];
      isDoor: boolean;
    }> = [
      { seqNo: 1, pts: [[rp.x, rp.y], [rp.x, rp.y + rp.h]], isDoor: rp.doorSide === 'bottom' ? false : false },
      { seqNo: 2, pts: [[rp.x, rp.y + rp.h], [rp.x + rp.w, rp.y + rp.h]], isDoor: rp.doorSide === 'top' },
      { seqNo: 3, pts: [[rp.x + rp.w, rp.y + rp.h], [rp.x + rp.w, rp.y]], isDoor: false },
      { seqNo: 4, pts: [[rp.x + rp.w, rp.y], [rp.x, rp.y]], isDoor: rp.doorSide === 'bottom' },
    ];

    for (const side of sides) {
      const boundary = await prisma.roomBoundary.create({
        data: {
          roomId: room.id,
          seqNo: side.seqNo,
          boundaryType: side.isDoor ? BoundaryType.DOOR : BoundaryType.WALL,
          hasWall: true,
          doorId: side.isDoor ? door.id : null,
        },
      });
      await updateGeom('room_boundary', boundary.id, 'lineGeom', toLineWKT(side.pts));
      boundaryCount++;
    }

    roomCount++;
    if (roomCount % 10 === 0) {
      console.log(`   ... ${roomCount}/${roomPlacements.length} rooms`);
    }
  }

  console.log(`   ✅ ${roomCount} rooms, ${doorCount} doors, ${boundaryCount} boundaries created\n`);

  // 6. Create FeatureTemplate + PlacedFeatures
  console.log('🩺 Creating FeatureTemplate & PlacedFeatures (reception desks)...');
  const template = await prisma.featureTemplate.create({
    data: {
      name: 'reception-desk',
      category: 'RECEPTION_DESK',
      icon: '🩺',
      defaultProperties: {
        description: 'Bàn tiếp nhận bệnh tại đầu mỗi khu khám',
      },
    },
  });
  console.log(`   Template: ${template.id}`);

  for (const fp of featurePlacements) {
    const pf = await prisma.placedFeature.create({
      data: {
        floorId: floor.id,
        roomId: null,
        templateId: template.id,
        customProperties: { zone: fp.zone },
      },
    });
    await updateGeom('placed_feature', pf.id, 'geometryGeom', toPointWKT(fp.x, fp.y));
    console.log(`   PlacedFeature for "${fp.zone}": ${pf.id}`);
  }

  // 7. Summary
  console.log('\n' + '═'.repeat(60));
  console.log('✅ OPD Map seeded successfully!');
  console.log('═'.repeat(60));
  console.log(`   Building ID : ${building.id}`);
  console.log(`   Floor ID    : ${floor.id}`);
  console.log(`   Rooms       : ${roomCount}`);
  console.log(`   Doors       : ${doorCount}`);
  console.log(`   Boundaries  : ${boundaryCount}`);
  console.log(`   Features    : ${featurePlacements.length} reception desks`);
  console.log(`   Template    : ${template.id}`);
  console.log('═'.repeat(60));
  console.log(`\n💡 Test with: GET /navigation/building/${building.id}/map\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
