---
phase: 4
title: "Navigation Graph Generation — Node, Edge & Connector"
status: pending
priority: P2
effort: "15h"
dependencies: [3]
---

# Phase 4: Navigation Graph Generation

## Overview
Implement an automated indoor navigation graph generator. Given a floor with `PhysicalRoom`, `RoomBoundary`, and `Door` records, the system auto-generates `Node` and `Edge` records to form a weighted graph for A* pathfinding.

**Trigger:** Admin calls `POST /graph/:floorId/generate` after completing the floor layout in Phase 3. Operation is **idempotent** — all existing nodes/edges for the floor are deleted before regeneration.

## Architecture

```
src/routes/graph/
  ├── graph.module.ts
  ├── graph.controller.ts   ← POST /graph/:floorId/generate
  │                            GET  /graph/:floorId
  └── graph.service.ts      ← GraphGenerationService (core logic)

src/shared/
  └── geo/
      └── geo.service.ts    ← Extended with PostGIS helpers
```

**External dependency:** `@turf/turf` for in-memory geometry computation (centroid, midpoint, boolean operations, Voronoi skeleton).

## Generation Pipeline (4 Steps)

### Step 1: Room Node Extraction
For every `PhysicalRoom` on the floor:
1. Fetch `outlineGeom` (Polygon) via `GeoService`.
2. Compute centroid using `turf.centroid()`.
3. If centroid falls outside the polygon (non-convex room), use `turf.pointOnFeature()` as fallback.
4. Persist as `Node` with `type = ROOM_ENTRANCE`, linked back to the room via `metadata.roomId`.

### Step 2: Door Node Extraction
For every `Door` on the floor with `active = true`:
1. Fetch `positionGeom` (Point) from the door record.
2. If `positionGeom` is null, compute midpoint between `roomA.centerGeom` and `roomB.centerGeom` as fallback.
3. Persist as `Node` with `type = ROOM_ENTRANCE` (doors are room entry points). Update `Door.nodeId` with the new node's id (`onDelete: SetNull` already in schema).

### Step 3: Corridor Node Generation (Voronoi Approach)
1. **Walkable area extraction:**  
   `walkable = turf.difference(floorOutlinePolygon, union(allRoomPolygons))`
2. **Voronoi skeleton:**  
   Sample points along the walkable area's boundary, run `turf.voronoi()` over them, then filter edges to retain only the approximate corridor centerline.
3. **Junction nodes:**  
   Detect intersections (≥3 Voronoi edges meeting) → persist as `Node` with `type = JUNCTION`.
4. **Corridor waypoints:**  
   Sample points at intervals of `scalePixelsPerMeter × 3.0 m` along centerline segments → persist as `Node` with `type = CORRIDOR`.

### Step 4: Edge Generation
Connect nodes based on spatial topology:

| Edge | From | To | Type | Cost |
|---|---|---|---|---|
| Room → Door | Room centroid node | Door midpoint node | walk | `turf.distance` × `scaleFactor` |
| Door → Room | Door node | Adjacent room node | walk | same |
| Door → Corridor | Door node | Nearest corridor node (raycasting) | walk | distance |
| Corridor → Corridor | Adjacent corridor/junction nodes | walk | distance |
| Connector (Elevator) | Floor N node | Floor N+1 node | elevator | distance + wait penalty |
| Connector (Stairs) | Floor N node | Floor N+1 node | stairs | distance + stairs penalty |

**Cost weights:**
- `edge_type = walk`: `ω = 0`
- `edge_type = stairs`: `ω = +30` (penalty seconds)
- `edge_type = elevator`: `ω = +60` (wait time seconds)

Final `distance` field on `Edge` = real-world meters.

## API Endpoints

### Graph Generation
```
POST /graph/:floorId/generate
```
- **Guard**: `IsAuthGuard` + `IsAdminGuard`
- **Behavior**:
  1. Delete all existing `Node` (cascade deletes `Edge` and `ScheduledBlockage`) for `floorId`.
  2. Run 4-step pipeline.
  3. Return stats: `{ nodesCreated, edgesCreated, durationMs }`.

### Graph Query
```
GET /graph/:floorId
```
- **Guard**: `IsAuthGuard`
- Returns all nodes and edges for a floor:
```json
{
  "nodes": [{ "id", "type", "coords", "metadata" }],
  "edges": [{ "id", "fromNodeId", "toNodeId", "distance", "accessible" }]
}
```

### Inter-floor Connector Linking
```
POST /graph/connector/:connectorId/link
```
- **Guard**: Admin
- Manually link two connector nodes across floors (elevators, stairs).

## GeoService Extensions Required

Add to `GeoService`:

```typescript
// Update a geometry column with a WKT string
async updateGeom(table: string, id: string, column: string, wkt: string): Promise<void>

// Fetch a geometry column as a GeoJSON FeatureCollection (all rows)
async readAllGeoms(table: string, floorId: string, column: string): Promise<GeoJSON.Feature[]>
```

## turf.js Usage Pattern

```typescript
import * as turf from '@turf/turf';

// Step 1: Room centroid
const polygon = turf.polygon(roomOutlineGeoJSON.coordinates);
const centroid = turf.centroid(polygon);
// → { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] } }

// Step 2: Door midpoint fallback
const midpoint = turf.midpoint(pointA, pointB);

// Step 3: Corridor walkable area
const floorPolygon = turf.polygon(floorOutlineGeoJSON.coordinates);
const roomUnion = rooms.reduce((acc, r) => turf.union(acc, turf.polygon(r.coords)), rooms[0]);
const corridor = turf.difference(floorPolygon, roomUnion);

// Step 3: Voronoi
const sampledPoints = turf.explode(corridor); // boundary vertices
const voronoiPolygons = turf.voronoi(sampledPoints, { bbox: turf.bbox(floorPolygon) });

// Step 4: Distance for edge cost
const distanceMeters = turf.distance(nodeA.coords, nodeB.coords, { units: 'meters' });
```

## Module Dependencies

`GraphModule` imports:
- `SharedModule` (for `PrismaConfig` and `GeoService`, which are `@Global()`)

No circular imports since `GraphModule` reads from but does not modify Phase 3 entities.

## npm Dependency

```bash
npm install @turf/turf
npm install --save-dev @types/turf
```

## Connector / Inter-floor Graph

`Connector` records store `servedFloors: Int[]`. After per-floor graph generation, the admin calls `POST /graph/connector/:connectorId/link` to:
1. Find the closest `Node` on each served floor to the connector's physical position.
2. Create `Edge` records between these nodes with appropriate type (`elevator`/`stairs`) and cost penalties.

## Success Criteria
- [ ] `POST /graph/:floorId/generate` generates correct node count (1 per room + 1 per door + corridor nodes)
- [ ] All room nodes connected to at least 1 door node
- [ ] All door nodes connected to corridor graph
- [ ] Edge `distance` values are in real-world meters
- [ ] Regenerating twice produces identical graph (idempotent)
- [ ] `npm run build` passes without errors
