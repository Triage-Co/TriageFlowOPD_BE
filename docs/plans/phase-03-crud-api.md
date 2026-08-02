---
phase: 3
title: "CRUD API — Spatial Layout & Directory"
status: pending
priority: P1
effort: "10h"
dependencies: [2]
---

# Phase 3: CRUD API — Spatial Layout & Directory

## Overview
Implement full CRUD REST APIs for the spatial layout domain (`Building`, `Floor`, `PhysicalRoom`, `RoomBoundary`) and the directory domain (`Category`, `Poi`). Follow the existing project architecture: `PrismaConfig` injected into services, `class-validator` + Swagger on DTOs, `IsAuthGuard` / `IsAdminGuard` on write operations.

## Requirements

### Functional
Full CRUD for each entity:
- **`Building`**: Create, findAll, findOne, update (PATCH), delete
- **`Floor`**: Create, findAll (by buildingId), findOne, update, delete
- **`PhysicalRoom`**: Create, findAll (by floorId), findOne, update, delete
- **`RoomBoundary`**: Create, findAll (by roomId), findOne, update, delete
- **`Category`**: Create, findAll, findOne, update, delete
- **`Poi`**: Create, findAll (by roomId / categoryId), findOne, update, delete

### Geometry Fields
Entities with PostGIS geometry fields (`centerGeom`, `outlineGeom`, `lineGeom`, `positionGeom`) accept **GeoJSON or WKT strings** in the request body. `GeoService` handles raw SQL persistence. Read responses return geometry as GeoJSON via `ST_AsGeoJSON`.

### Authorization
| Operation | Guard |
|---|---|
| GET (findAll, findOne) | `IsAuthGuard` (all authenticated users) |
| POST, PATCH, DELETE | `IsAuthGuard` + `IsAdminGuard` |

### Non-functional
- `@ApiTags`, `@ApiProperty` on all DTOs and controllers (Swagger)
- `class-validator` on all request DTOs
- Response envelope: `{ code, message, status, data }` — consistent with existing pattern

## Architecture

```
src/routes/
  ├── building/
  │   ├── dto/
  │   │   ├── create-building.dto.ts
  │   │   └── update-building.dto.ts
  │   ├── building.controller.ts   ← Full CRUD endpoints
  │   ├── building.service.ts      ← Prisma + GeoService
  │   └── building.module.ts
  ├── floor/         (same pattern)
  ├── physical-room/ (same pattern, GeoService for geometry)
  ├── room-boundary/ (same pattern, GeoService for lineGeom)
  ├── category/      (same pattern, no geometry)
  └── poi/           (same pattern, no geometry)
```

## Implementation Steps

### 1. `Building` module
#### DTO
```typescript
// create-building.dto.ts
export class CreateBuildingDto {
  @IsString() @ApiProperty() name: string;
  @IsString() @ApiProperty() addressLabel: string;
  @IsInt()    @ApiProperty() totalFloors: number;
  @IsUUID()   @ApiProperty() organizationId: string;
}
// update-building.dto.ts — PartialType(CreateBuildingDto)
```
#### Controller endpoints
```
POST   /building               → create      [Admin]
GET    /building               → findAll     [Auth]
GET    /building/:id           → findOne     [Auth]
PATCH  /building/:id           → update      [Admin]
DELETE /building/:id           → delete      [Admin]
```

### 2. `Floor` module
#### Additional DTO fields
```typescript
buildingId: string; // UUID
floorNumber: number;
floorPlanImageUrl?: string;
widthMeters?: number;
heightMeters?: number;
scalePixelsPerMeter?: number;
outlineGeom?: string; // WKT or GeoJSON string — persisted via GeoService
```
#### Controller endpoints
```
POST   /floor                  → create      [Admin]
GET    /floor?buildingId=...   → findAll     [Auth]
GET    /floor/:id              → findOne     [Auth]
PATCH  /floor/:id              → update      [Admin]
DELETE /floor/:id              → delete      [Admin]
```

### 3. `PhysicalRoom` module
#### Additional DTO fields
```typescript
floorId: string;
roomCode: string;
roomLabel: string;
type: RoomType; // enum
heightMeters?: number;
centerGeom?: string;   // WKT Point or GeoJSON
outlineGeom?: string;  // WKT Polygon or GeoJSON
```
#### Controller endpoints
```
POST   /physical-room               → create   [Admin]
GET    /physical-room?floorId=...   → findAll  [Auth]
GET    /physical-room/:id           → findOne  [Auth]
PATCH  /physical-room/:id           → update   [Admin]
DELETE /physical-room/:id           → delete   [Admin]
```

### 4. `RoomBoundary` module
#### Additional DTO fields
```typescript
roomId: string;
seqNo: number;
lineGeom?: string;       // WKT LineString or GeoJSON
boundaryType: BoundaryType;
adjacentRoomId?: string;
hasWall?: boolean;
doorId?: string;
```

### 5. `Category` module (no geometry)
```typescript
// CreateCategoryDto
name: string; nameLocalized?: object; icon?: string; sortOrder?: number;
```

### 6. `Poi` module (no geometry)
```typescript
// CreatePoiDto
roomId: string; categoryId: string; name: string; nameLocalized?: object;
description?: string; keywords?: string[]; logoUrl?: string;
contactInfo?: object; openingHours?: object;
```

## GeoService Integration Pattern
For entities with geometry, the service does two operations:

**Create/Update with geometry:**
```typescript
// 1. Insert scalar fields via prisma
const room = await this.prisma.physicalRoom.create({ data: scalarFields });
// 2. Update geometry via GeoService raw query
if (dto.centerGeom) {
  await this.geoService.updateGeom('physical_room', room.id, 'center_geom', dto.centerGeom);
}
```

**Read with geometry:**
```typescript
// Use raw SQL with ST_AsGeoJSON
const result = await this.geoService.readGeom('physical_room', id, 'center_geom');
```

> **Note**: Add `updateGeom(table, id, column, wkt)` helper to `GeoService`.

## Success Criteria
- [ ] All 6 modules have full CRUD endpoints passing manual Swagger test
- [ ] Geometry fields are persisted and returned as GeoJSON
- [ ] Admin-only routes reject non-admin users with 403
- [ ] `npm run build` passes without errors
