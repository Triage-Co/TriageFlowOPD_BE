---
phase: 2
title: "Database-Schema"
status: pending
priority: P1
effort: "8h"
dependencies: [1]
---

# Phase 2: Database Schema

## Overview
Define and implement all Prisma models for TriageFlow OPD Backend. This phase covers the complete relational schema using **PostgreSQL** (with **PostGIS** extension for geometry) and **Prisma ORM**. Models are organized by domain and follow the existing project conventions: singular model names, UUID primary keys, and `@@map` lowercase table names.

> **Stack change from original doc**: MongoDB/Mongoose is replaced by PostgreSQL + Prisma to align with the actual codebase.

## Requirements

### Functional
Implement Prisma models for all domains below. Existing models (`User`, `Doctor`, `Specialty`, `Shift`, `Booking`, `Step`, `Flow`, `Transaction`) are **not touched** — only new models are added.

**Spatial Layout**
- `Building` — linked to organization, building name, address, total floors
- `Floor` — linked to `Building`, floor number, plan image URL, dimensions, scale; `outlineGeom` (Polygon) defines floor boundary — corridors = Floor area minus Room areas
- `PhysicalRoom` — linked to `Floor`, room code, label, type, height; `centerGeom` (Point) + `outlineGeom` (Polygon) for map rendering
- `RoomBoundary` — linked to `PhysicalRoom`, sequence number, `lineGeom` (LineString) for wall/door segments, boundary type, adjacent room, `doorId?` reference
- `Door` — 1 physical door = 1 record; links to `Node` (for routing), `positionGeom` (Point), `roomAId?` + `roomBId?` (both nullable — corridor door has only roomA, roomB = null)

**Directory (POI)**
- `Category` — name, localized name, icon, sort order
- `Poi` — linked to `PhysicalRoom` and `Category`, name, localized name, description, keywords, logo URL, contact info, opening hours, active flag

**Routing Graph**
- `Node` — linked to `Floor`, stores type, coordinates (PostGIS Point), active flag, metadata
- `Edge` — links two `Node` records, stores distance, accessibility flags (accessible, escalator, elevator, stairs), active flag
- `Connector` — linked to `Building`, stores type, name, active flag, served floors

**Spatial Assets**
- `FeatureTemplate` — stores name, category, model URL, icon, default properties
- `PlacedFeature` — linked to `Floor`, `PhysicalRoom`, `FeatureTemplate`, stores geometry, custom properties

**Blockage Scheduling** (independent module)
- `ScheduledBlockage` — references `Node` or `Edge`, stores name, start/end datetime, recurring flag, reason, status

### Non-functional
- Use PostGIS `Geometry` type via Prisma `Unsupported("geometry")` for spatial columns (points, polygons).
- Add composite indexes on foreign keys and commonly searched fields.
- All new models use `String @id @default(uuid()) @db.Uuid` for primary keys.
- Strongly typed, validated DTOs using `class-validator` decorators in each module.

## Architecture

```
[Database – existing models]
  ├── Auth:     User ─── Doctor ─── Specialty
  ├── Schedule: Doctor ─── Shift ─── Booking
  ├── Flow:     Flow ─── Step
  └── Finance:  Transaction

[Database – new models]
  ├── Layout:    Building ─▶ Floor ─▶ PhysicalRoom / RoomBoundary
  │                                           └──▶ Door (roomA?, roomB?, Node)
  ├── Directory: Category ─▶ Poi (maps to PhysicalRoom)
  ├── Graph:     Node ◀─▶ Edge (grouped by Connector)
  │                └── Door (Node = door entrance node)
  ├── Assets:    FeatureTemplate ─▶ PlacedFeature (placed on Floor/PhysicalRoom)
  └── Blockage:  ScheduledBlockage (references Node or Edge)
```

## Prisma Schema Additions

Add the following enums and models to `prisma/schema.prisma`:

```prisma
// ─── Enums ───────────────────────────────────────────────────────────────────

enum RoomType {
  CONSULTATION
  EXAMINATION
  WAITING
  PHARMACY
  LAB
  IMAGING
  ADMIN
  OTHER
}

enum BoundaryType {
  WALL
  DOOR
  WINDOW
  OPEN
}

enum NodeType {
  ROOM_ENTRANCE
  CORRIDOR
  ELEVATOR
  STAIRS
  ESCALATOR
  EXIT
  JUNCTION
}

enum ConnectorType {
  ELEVATOR
  STAIRS
  ESCALATOR
  RAMP
}

enum BlockageStatus {
  ACTIVE
  SCHEDULED
  CANCELLED
  EXPIRED
}

// ─── Spatial Layout ───────────────────────────────────────────────────────────

model Building {
  id             String   @id @default(uuid()) @db.Uuid
  name           String
  addressLabel   String
  totalFloors    Int
  organizationId String   @db.Uuid
  createdAt      DateTime @default(now()) @db.Timestamptz()
  updatedAt      DateTime @default(now()) @updatedAt @db.Timestamptz()

  floors     Floor[]
  connectors Connector[]

  @@index([organizationId])
  @@map("building")
}

model Floor {
  id                  String   @id @default(uuid()) @db.Uuid
  buildingId          String   @db.Uuid
  floorNumber         Int
  floorPlanImageUrl   String?
  widthMeters         Float?
  heightMeters        Float?
  scalePixelsPerMeter Float?
  // PostGIS Polygon: defines the floor outline; corridors = Floor outline minus Room outlines
  outlineGeom         Unsupported("geometry(Polygon, 4326)")?
  createdAt           DateTime @default(now()) @db.Timestamptz()
  updatedAt           DateTime @default(now()) @updatedAt @db.Timestamptz()

  building       Building        @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  rooms          PhysicalRoom[]
  nodes          Node[]
  doors          Door[]
  placedFeatures PlacedFeature[]

  @@unique([buildingId, floorNumber])
  @@index([buildingId])
  @@map("floor")
}

model PhysicalRoom {
  id           String   @id @default(uuid()) @db.Uuid
  floorId      String   @db.Uuid
  roomCode     String
  roomLabel    String
  type         RoomType
  heightMeters Float?
  // PostGIS geometry: Point for centroid, Polygon for room outline
  centerGeom   Unsupported("geometry(Point, 4326)")?
  outlineGeom  Unsupported("geometry(Polygon, 4326)")?
  createdAt    DateTime @default(now()) @db.Timestamptz()
  updatedAt    DateTime @default(now()) @updatedAt @db.Timestamptz()

  floor          Floor          @relation(fields: [floorId], references: [id], onDelete: Cascade)
  boundaries     RoomBoundary[]
  pois           Poi[]
  placedFeatures PlacedFeature[]
  doorsAsRoomA   Door[]         @relation("DoorRoomA")
  doorsAsRoomB   Door[]         @relation("DoorRoomB")

  @@unique([floorId, roomCode])
  @@index([floorId])
  @@map("physical_room")
}

model RoomBoundary {
  id             String       @id @default(uuid()) @db.Uuid
  roomId         String       @db.Uuid
  seqNo          Int
  // LineString replaces start/end points — supports curved walls and arcs
  lineGeom       Unsupported("geometry(LineString, 4326)")?
  boundaryType   BoundaryType
  adjacentRoomId String?      @db.Uuid
  hasWall        Boolean      @default(true)
  // If this boundary segment is a door, reference the Door record
  doorId         String?      @db.Uuid

  room         PhysicalRoom  @relation(fields: [roomId], references: [id], onDelete: Cascade)
  adjacentRoom PhysicalRoom? @relation("AdjacentRoom", fields: [adjacentRoomId], references: [id])
  // SetNull: boundary persists with doorId=null if the Door record is removed
  door         Door?         @relation(fields: [doorId], references: [id], onDelete: SetNull)

  @@unique([roomId, seqNo])
  @@index([roomId])
  @@map("room_boundary")
}

model Door {
  id           String   @id @default(uuid()) @db.Uuid
  floorId      String   @db.Uuid
  nodeId       String?  @db.Uuid  // routing graph node at this door
  // Both room links are nullable: corridor door → roomA set, roomB = null
  roomAId      String?  @db.Uuid
  roomBId      String?  @db.Uuid
  positionGeom Unsupported("geometry(Point, 4326)")?
  isAccessible Boolean  @default(true)
  isEmergency  Boolean  @default(false)
  active       Boolean  @default(true)
  createdAt    DateTime @default(now()) @db.Timestamptz()

  floor      Floor          @relation(fields: [floorId], references: [id], onDelete: Cascade)
  // SetNull: door persists with nodeId=null if the routing Node is removed
  node       Node?          @relation(fields: [nodeId], references: [id], onDelete: SetNull)
  roomA      PhysicalRoom?  @relation("DoorRoomA", fields: [roomAId], references: [id])
  roomB      PhysicalRoom?  @relation("DoorRoomB", fields: [roomBId], references: [id])
  boundaries RoomBoundary[]

  @@index([floorId, active])
  @@index([nodeId])
  @@map("door")
}

// ─── Directory (POI) ──────────────────────────────────────────────────────────

model Category {
  id            String  @id @default(uuid()) @db.Uuid
  name          String  @unique
  nameLocalized Json?
  icon          String?
  sortOrder     Int     @default(0)

  pois Poi[]

  @@index([sortOrder])
  @@map("category")
}

model Poi {
  id           String   @id @default(uuid()) @db.Uuid
  roomId       String   @db.Uuid
  categoryId   String   @db.Uuid
  name         String
  nameLocalized Json?
  description  String?
  keywords     String[]
  logoUrl      String?
  contactInfo  Json?
  openingHours Json?
  active       Boolean  @default(true)
  createdAt    DateTime @default(now()) @db.Timestamptz()
  updatedAt    DateTime @default(now()) @updatedAt @db.Timestamptz()

  room     PhysicalRoom @relation(fields: [roomId], references: [id], onDelete: Cascade)
  category Category     @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  @@index([roomId, categoryId])
  @@index([active])
  @@map("poi")
}

// ─── Routing Graph ────────────────────────────────────────────────────────────

model Node {
  id         String   @id @default(uuid()) @db.Uuid
  floorId    String   @db.Uuid
  type       NodeType
  coordsGeom Unsupported("geometry(Point, 4326)")?
  active     Boolean  @default(true)
  metadata   Json?
  createdAt  DateTime @default(now()) @db.Timestamptz()

  floor     Floor               @relation(fields: [floorId], references: [id], onDelete: Cascade)
  edgesFrom Edge[]              @relation("EdgeFromNode")
  edgesTo   Edge[]              @relation("EdgeToNode")
  blockages ScheduledBlockage[]
  doors     Door[]

  @@index([floorId, active])
  @@map("node")
}

model Edge {
  id           String   @id @default(uuid()) @db.Uuid
  fromNodeId   String   @db.Uuid
  toNodeId     String   @db.Uuid
  distance     Float
  accessible   Boolean  @default(true)
  isEscalator  Boolean  @default(false)
  isElevator   Boolean  @default(false)
  isStairs     Boolean  @default(false)
  active       Boolean  @default(true)

  fromNode  Node                @relation("EdgeFromNode", fields: [fromNodeId], references: [id], onDelete: Cascade)
  toNode    Node                @relation("EdgeToNode", fields: [toNodeId], references: [id], onDelete: Cascade)
  blockages ScheduledBlockage[]

  @@unique([fromNodeId, toNodeId])
  @@index([fromNodeId, toNodeId, active])
  @@map("edge")
}

model Connector {
  id          String        @id @default(uuid()) @db.Uuid
  buildingId  String        @db.Uuid
  type        ConnectorType
  name        String
  active      Boolean       @default(true)
  servedFloors Int[]

  building Building @relation(fields: [buildingId], references: [id], onDelete: Cascade)

  @@index([buildingId, active])
  @@map("connector")
}

// ─── Spatial Assets ───────────────────────────────────────────────────────────

model FeatureTemplate {
  id                String  @id @default(uuid()) @db.Uuid
  name              String  @unique
  category          String
  modelUrl          String?
  icon              String?
  defaultProperties Json?

  placedFeatures PlacedFeature[]

  @@index([category])
  @@map("feature_template")
}

model PlacedFeature {
  id               String  @id @default(uuid()) @db.Uuid
  floorId          String  @db.Uuid
  roomId           String? @db.Uuid
  templateId       String  @db.Uuid
  geometryGeom     Unsupported("geometry")?
  customProperties Json?

  floor    Floor           @relation(fields: [floorId], references: [id], onDelete: Cascade)
  room     PhysicalRoom?   @relation(fields: [roomId], references: [id])
  template FeatureTemplate @relation(fields: [templateId], references: [id], onDelete: Restrict)

  @@index([floorId, templateId])
  @@map("placed_feature")
}

// ─── Blockage (independent module) ───────────────────────────────────────────

model ScheduledBlockage {
  id        String         @id @default(uuid()) @db.Uuid
  name      String
  nodeId    String?        @db.Uuid
  edgeId    String?        @db.Uuid
  startAt   DateTime       @db.Timestamptz()
  endAt     DateTime       @db.Timestamptz()
  recurring Boolean        @default(false)
  reason    String?
  status    BlockageStatus @default(SCHEDULED)
  createdAt DateTime       @default(now()) @db.Timestamptz()

  // Cascade: blockage has no meaning if its target Node/Edge no longer exists
  node Node? @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  edge Edge? @relation(fields: [edgeId], references: [id], onDelete: Cascade)

  @@index([nodeId, edgeId, status])
  @@index([startAt, endAt])
  @@map("scheduled_blockage")
}
```

## Folder Structure (New Modules)

Following the existing pattern `src/routes/<module>/`:

```
src/routes/
  ├── auth/              # existing
  ├── booking/           # existing
  ├── doctor/            # existing
  ├── flow/              # existing
  ├── infermedica/       # existing
  ├── payment/           # existing
  ├── shift/             # existing
  ├── specialty/         # existing
  ├── step/              # existing
  │
  ├── building/          # NEW
  │   ├── building.module.ts
  │   ├── building.controller.ts
  │   ├── building.service.ts
  │   └── dto/
  ├── floor/             # NEW
  ├── physical-room/     # NEW
  ├── room-boundary/     # NEW
  ├── door/              # NEW (Door — shared boundary between rooms)
  ├── category/          # NEW
  ├── poi/               # NEW
  ├── node/              # NEW
  ├── edge/              # NEW
  ├── connector/         # NEW
  ├── feature-template/  # NEW
  ├── placed-feature/    # NEW
  └── blockage/          # NEW (ScheduledBlockage, independent module)
```

## Implementation Steps

1. **Enable PostGIS** on the PostgreSQL database:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

2. **Append new Prisma models** from the schema block above to `prisma/schema.prisma`.

3. **Run migration**:
   ```bash
   npx prisma migrate dev --name add-inmap-schema
   ```

4. **Generate Prisma client**:
   ```bash
   npx prisma generate
   ```

5. **Create NestJS modules** for each new route:
   - Use `nest g module routes/<module>` for each new module.
   - Define `<Module>Service` injecting `PrismaService` from `SharedModule`.
   - Define `<Module>Controller` with appropriate REST endpoints.

6. **Add indexes** (handled automatically by Prisma `@@index` declarations in schema).

7. **Register new modules** in `AppModule`.

## Success Criteria

- [ ] `npx prisma migrate dev` runs without errors after enabling PostGIS.
- [ ] `npx prisma generate` compiles all new models without type errors.
- [ ] Each new module has its service and controller scaffold in `src/routes/`.
- [ ] Existing routes and modules remain unaffected.
- [ ] Unit tests for key services (e.g. `BuildingService`, `NodeService`) pass.

## Risk Assessment

### R1 — PostGIS Setup
**Risk**: Requires PostGIS extension on PostgreSQL. Without it, all `Unsupported("geometry")` columns will fail migration.  
**Resolution**: If using **Supabase** (detected from `@supabase/supabase-js` in `package.json`), PostGIS is pre-installed — just enable it:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```
Add this as the first SQL statement in the initial migration file before any table creation.

---

### R2 — Prisma `Unsupported("geometry")` Cannot Be Read/Written Directly
**Risk**: Prisma client treats geometry columns as opaque — no automatic serialization/deserialization to GeoJSON or WKT.  
**Resolution**: Create a shared `GeoService` in `src/shared/` with helpers wrapping `prisma.$queryRaw`:

```typescript
// src/shared/geo/geo.service.ts
@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  // Convert GeoJSON Point → WKT for INSERT
  toWKT(lon: number, lat: number): string {
    return `POINT(${lon} ${lat})`;
  }

  // Read a single geometry column as GeoJSON using ST_AsGeoJSON
  async readGeom(table: string, id: string, column: string): Promise<object> {
    const result = await this.prisma.$queryRaw<{ geom: string }[]>`
      SELECT ST_AsGeoJSON(${Prisma.raw(column)}) AS geom
      FROM ${Prisma.raw(table)}
      WHERE id = ${id}::uuid
    `;
    return JSON.parse(result[0].geom);
  }

  // Spatial query: find rooms within a radius (meters) of a point
  async stWithin(lon: number, lat: number, radiusMeters: number) {
    return this.prisma.$queryRaw`
      SELECT id, room_code FROM physical_room
      WHERE ST_DWithin(
        center_geom::geography,
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    `;
  }
}
```

Register `GeoService` in `SharedModule` and export it. Any route service (e.g. `PhysicalRoomService`, `NodeService`) can inject it for spatial operations.

---

### R3 — Self-referential `RoomBoundary.adjacentRoomId` and `Door` Dual FK
**Risk**: Multiple FK fields pointing to the same model confuse Prisma's relation inference.  
**Resolution** ✅ Already handled in schema:
- `RoomBoundary.adjacentRoomId` uses named relation `"AdjacentRoom"` on `PhysicalRoom`.
- `Door.roomAId` / `Door.roomBId` use named relations `"DoorRoomA"` / `"DoorRoomB"` on both `Door` and `PhysicalRoom`.

No further action needed — Prisma resolves these correctly at codegen time.

---

### R4 — `onDelete` Behaviors (All Confirmed)

| Relation | Strategy | Rationale |
|---|---|---|
| `Door.nodeId → Node` | `SetNull` | Door persists with `nodeId=null` if routing node is removed |
| `RoomBoundary.doorId → Door` | `SetNull` | Boundary persists with `doorId=null` if door is removed; `boundaryType=DOOR` retained as hint |
| `ScheduledBlockage.nodeId → Node` | `Cascade` | Blockage has no meaning without its target node |
| `ScheduledBlockage.edgeId → Edge` | `Cascade` | Blockage has no meaning without its target edge |
| `PhysicalRoom → Floor` | `Cascade` | Room belongs entirely to its floor |
| `RoomBoundary → PhysicalRoom` | `Cascade` | Boundary belongs entirely to its room |
| `Door → Floor` | `Cascade` | Door belongs entirely to its floor |
| `Node → Floor` | `Cascade` | Node belongs entirely to its floor |
| `Edge → Node (from/to)` | `Cascade` | Edge cannot exist without both endpoint nodes |
