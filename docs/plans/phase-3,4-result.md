# Tổng kết Phase 3 & Phase 4 — Spatial Layout CRUD + Navigation Graph Generation

**Ngày hoàn thành:** 07/07/2026  
**Trạng thái:** ✅ Hoàn thành — Toàn bộ 12/12 E2E test cases PASS

---

## Phase 3: CRUD API — Spatial Layout & Directory

### Mục tiêu
Xây dựng đầy đủ REST API CRUD cho các domain spatial (`Building`, `Floor`, `PhysicalRoom`, `RoomBoundary`) và directory (`Category`, `Poi`) với tích hợp PostGIS cho các trường geometry.

### Các module đã triển khai

| Module | Endpoint Pattern | Geometry Fields | Guard |
|---|---|---|---|
| `Building` | `POST/GET/PATCH/DELETE /building` | — | Admin ghi, Auth đọc |
| `Floor` | `POST/GET/PATCH/DELETE /floor` | `outlineGeom` (Polygon) | Admin ghi, Auth đọc |
| `PhysicalRoom` | `POST/GET/PATCH/DELETE /physical-room` | `centerGeom` (Point), `outlineGeom` (Polygon) | Admin ghi, Auth đọc |
| `RoomBoundary` | `POST/GET/PATCH/DELETE /room-boundary` | `lineGeom` (LineString) | Admin ghi, Auth đọc |
| `Category` | `POST/GET/PATCH/DELETE /category` | — | Admin ghi, Auth đọc |
| `Poi` | `POST/GET/PATCH/DELETE /poi` | — | Admin ghi, Auth đọc |

### Kiến trúc GeoService

`GeoService` là shared service xử lý toàn bộ raw PostGIS SQL. Tất cả geometry được lưu trong DB với SRID 4326 (WGS84).

```
src/shared/geo/geo.service.ts
  ├── updateGeom(table, id, column, geomStr)  // chấp nhận WKT hoặc GeoJSON string
  ├── readGeom(table, id, column)              // trả về GeoJSON object
  ├── readAllGeoms(table, floorId, column)     // trả về GeoJSON Feature[] cho cả tầng
  └── stWithin(lon, lat, radiusMeters)         // tìm phòng trong bán kính (ST_DWithin)
```

**Pattern lưu geometry (Create/Update):**
```typescript
// 1. Tạo bản ghi scalar qua Prisma
const room = await this.prisma.physicalRoom.create({ data: scalarFields });
// 2. Cập nhật geometry qua GeoService raw SQL
await this.geoService.updateGeom('physical_room', room.id, 'centerGeom', dto.centerGeom);
```

**Pattern đọc geometry (Read):**
```typescript
// Lấy GeoJSON từ database
const geom = await this.geoService.readGeom('physical_room', id, 'centerGeom');
// Trả về trong response envelope
return { ...data, centerGeom: geom, outlineGeom: outline };
```

### Lỗi phát hiện và sửa trong quá trình triển khai

1. **Column name casing bug** — Tất cả các service ban đầu dùng snake_case (`outline_geom`, `center_geom`, `line_geom`) nhưng Prisma sinh ra camelCase (`outlineGeom`, `centerGeom`, `lineGeom`). Đã sửa toàn bộ:
   - `FloorService` → `outlineGeom`
   - `PhysicalRoomService` → `centerGeom`, `outlineGeom`
   - `RoomBoundaryService` → `lineGeom`

2. **ST_AsGeoJSON casing bug** — Tên cột trong `GeoService.readGeom` cần phải được bao trong dấu ngoặc kép `"outlineGeom"` để PostgreSQL không tự lowercase thành `outlinegeom` (column không tồn tại).

### Phản hồi API

Tất cả endpoints trả về envelope chuẩn:
```json
{
  "code": 200,
  "status": "success",
  "message": "...",
  "data": {
    "id": "...",
    "outlineGeom": { "type": "Polygon", "coordinates": [...] },
    ...
  }
}
```

---

## Phase 4: Navigation Graph Generation

### Mục tiêu
Xây dựng hệ thống tự động sinh đồ thị điều hướng nội nhà (indoor navigation graph) dựa trên layout phòng, cửa và tầng. Đồ thị được dùng cho thuật toán tìm đường A*.

### Module đã tạo

```
src/routes/graph/
  ├── graph.module.ts       — import SharedModule
  ├── graph.controller.ts   — 3 endpoints
  └── graph.service.ts      — GraphGenerationService (668 dòng logic)
```

### API Endpoints

| Endpoint | Method | Guard | Chức năng |
|---|---|---|---|
| `/graph/:floorId/generate` | POST | Admin | Tự động sinh đồ thị cho một tầng |
| `/graph/:floorId` | GET | Auth | Lấy danh sách node và edge |
| `/graph/connector/:connectorId/link` | POST | Admin | Liên kết node thang máy/thang bộ liên tầng |

### Pipeline sinh đồ thị (4 bước)

#### Bước 1 — Room Node Extraction
- Lấy `outlineGeom` (Polygon) của mỗi `PhysicalRoom` qua `GeoService`.
- Tính centroid bằng `turf.centroid()`.
- Fallback: nếu centroid nằm ngoài polygon (phòng lõm) → dùng `turf.pointOnFeature()`.
- Lưu `Node` với `type = ROOM_ENTRANCE`, `metadata = { roomId }`.

#### Bước 2 — Door Node Extraction
- Lấy `positionGeom` (Point) của mỗi `Door` có `active = true`.
- Fallback: nếu không có positionGeom → tính midpoint giữa `roomA.centerGeom` và `roomB.centerGeom`.
- Lưu `Node` với `type = ROOM_ENTRANCE`, `metadata = { doorId }`.
- Cập nhật ngược `Door.nodeId` để liên kết.

#### Bước 3 — Corridor Node Generation (Voronoi Approach)
- **Walkable area**: `turf.difference(floorOutline, union(allRooms))` → vùng không phải phòng.
- **Voronoi skeleton**: Lấy mẫu điểm trên biên walkable area → `turf.voronoi()` → lọc cạnh centerline.
- **Junction nodes**: Phát hiện điểm giao ≥3 cạnh → `Node` với `type = JUNCTION`.
- **Corridor waypoints**: Nội suy điểm mỗi 3m dọc segment → `Node` với `type = CORRIDOR`.

#### Bước 4 — Edge Generation (Batched)

| Loại Edge | Từ → Đến | Cost |
|---|---|---|
| Room → Door | Centroid node → Door node | `turf.distance()` meters |
| Door → Room | Door node → Adjacent room node | `turf.distance()` meters |
| Door → Corridor | Door node → Node hành lang gần nhất | `turf.distance()` meters |
| Corridor → Corridor | Node hành lang kề nhau | `turf.distance()` meters |
| Elevator (liên tầng) | Node tầng N → Node tầng N±1 | distance + **60s** penalty |
| Stairs (liên tầng) | Node tầng N → Node tầng N±1 | distance + **30s** penalty |

Tất cả edge được tích lũy vào một mảng và lưu bằng **một lần gọi duy nhất**:
```typescript
await this.prisma.edge.createMany({
  data: edgesToCreate,
  skipDuplicates: true,
});
```

### Response `generate`

```json
{
  "code": 200,
  "status": "success",
  "data": {
    "nodesCreated": 35,
    "edgesCreated": 72,
    "durationMs": 13839
  }
}
```

### Tính năng idempotent

Pipeline **xóa sạch toàn bộ** Node (cascade sang Edge và ScheduledBlockage) trước khi sinh lại, đảm bảo chạy nhiều lần cho cùng một floorId cho kết quả nhất quán.

### Lỗi phát hiện và sửa trong quá trình triển khai

1. **Prisma Transaction Rollback Error (P2028)** — Các lần gọi `edge.createMany()` riêng lẻ trong vòng lặp gây xung đột transaction trên Supabase PgBouncer connection pool (port 6543). **Giải pháp:** Gộp tất cả edge vào một lần `createMany()` duy nhất.

2. **Foreign Key Violation (P2003) trên Node** — Khi test tạo `Node` với `floorId` chưa commit vào DB (do NestJS test context). **Giải pháp:** Đảm bảo floor và room được tạo đầy đủ trong `beforeAll()` trước khi chạy Phase 4 test.

3. **HTTP Code mismatch** — `POST` endpoints trả về `201 Created` (mặc định NestJS) nhưng generate và link cần trả về `200 OK`. **Giải pháp:** Thêm `@HttpCode(HttpStatus.OK)` vào hai endpoint này.

---

## Testing — E2E Integration Test Suite

### File test

- [`test/spatial-graph.e2e-spec.ts`](file:///e:/E/Learning/Sem9/Capstone/TriageFlowOPD_BE/test/spatial-graph.e2e-spec.ts) — 12 test cases cho Phase 3 & 4
- [`test/app.e2e-spec.ts`](file:///e:/E/Learning/Sem9/Capstone/TriageFlowOPD_BE/test/app.e2e-spec.ts) — 1 test case kiểm tra unauthenticated access

### Chiến lược test

**Mock Authentication Guards** — Tránh phụ thuộc vào live Supabase Auth server:
```typescript
// Mock auth qua Custom Header
const mockAdminHeaders = {
  'x-mock-user-id': '00000000-0000-0000-0000-000000000000',
  'x-mock-role': 'ADMIN',
};

class MockAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (!req.headers['x-mock-user-id']) throw new UnauthorizedException();
    req['user'] = { id: req.headers['x-mock-user-id'], role: req.headers['x-mock-role'] };
    return true;
  }
}
```

**Kết nối DB thật** — Dùng database thực (PostgreSQL + PostGIS) vì raw SQL không thể mock. Cleanup tự động trong `afterAll()`.

### Danh sách test cases và kết quả

#### Phase 3 — Spatial & Directory CRUD (8 cases)

| # | Test Case | Kết quả |
|---|---|---|
| 1 | `GET /building` không có token → 401 Unauthorized | ✅ PASS |
| 2 | `POST /poi` với role USER → 403 Forbidden | ✅ PASS |
| 3 | `POST /category` không có token → 401 Unauthorized | ✅ PASS |
| 4 | `POST /category` với Admin → 201, trả đúng data | ✅ PASS |
| 5 | `POST /building` với Admin → 201, lưu thành công | ✅ PASS |
| 6 | `POST /floor` với Admin + outlineGeom (WKT) → response có `outlineGeom.type = "Polygon"` | ✅ PASS |
| 7 | `POST /physical-room` với Admin + centerGeom + outlineGeom → response có geometry đúng type | ✅ PASS |
| 8 | `POST /room-boundary` với Admin + lineGeom (WKT) → response có `lineGeom.type = "LineString"` | ✅ PASS |

*(Ghi chú: 1 test bổ sung từ `app.e2e-spec.ts` — test unauthenticated GET /building)*

#### Phase 4 — Navigation Graph Generation (4 cases)

| # | Test Case | Kết quả |
|---|---|---|
| 9 | `POST /graph/:floorId/generate` → sinh **35 nodes**, **72 edges** | ✅ PASS |
| 10 | `GET /graph/:floorId` → node của Room1 và Room2 tồn tại với type `ROOM_ENTRANCE` và đúng `metadata.roomId` | ✅ PASS |
| 11 | `GET /graph/:floorId` → Edge từ Room node → Door node → Corridor node tồn tại và có distance > 0 | ✅ PASS |
| 12 | `POST /graph/connector/:id/link` → sinh 2 bidirectional elevator edges, `isElevator = true` | ✅ PASS |

### Kết quả chạy cuối cùng

```bash
npx jest --config ./test/jest-e2e.json --forceExit
```

```
PASS test/app.e2e-spec.ts        (8.22 s)
PASS test/spatial-graph.e2e-spec.ts  (33.772 s)

Test Suites: 2 passed, 2 total
Tests:       12 passed, 12 total
Snapshots:   0 total
Time:        35.635 s
```

---

## Danh sách files đã tạo/sửa đổi

### Phase 3

| File | Trạng thái | Ghi chú |
|---|---|---|
| [`src/shared/geo/geo.service.ts`](file:///e:/E/Learning/Sem9/Capstone/TriageFlowOPD_BE/src/shared/geo/geo.service.ts) | Sửa + Mở rộng | Thêm `readAllGeoms()`, sửa quote cột, sửa `stWithin` |
| [`src/routes/floor/floor.service.ts`](file:///e:/E/Learning/Sem9/Capstone/TriageFlowOPD_BE/src/routes/floor/floor.service.ts) | Sửa | Đổi `outline_geom` → `outlineGeom` |
| [`src/routes/physical-room/physical-room.service.ts`](file:///e:/E/Learning/Sem9/Capstone/TriageFlowOPD_BE/src/routes/physical-room/physical-room.service.ts) | Sửa | Đổi snake_case → camelCase cho cả 2 geometry columns |
| [`src/routes/room-boundary/room-boundary.service.ts`](file:///e:/E/Learning/Sem9/Capstone/TriageFlowOPD_BE/src/routes/room-boundary/room-boundary.service.ts) | Sửa | Đổi `line_geom` → `lineGeom` (6 chỗ) |

### Phase 4

| File | Trạng thái | Ghi chú |
|---|---|---|
| [`src/routes/graph/graph.module.ts`](file:///e:/E/Learning/Sem9/Capstone/TriageFlowOPD_BE/src/routes/graph/graph.module.ts) | Tạo mới | Import SharedModule |
| [`src/routes/graph/graph.controller.ts`](file:///e:/E/Learning/Sem9/Capstone/TriageFlowOPD_BE/src/routes/graph/graph.controller.ts) | Tạo mới | 3 endpoints, `@HttpCode(200)` |
| [`src/routes/graph/graph.service.ts`](file:///e:/E/Learning/Sem9/Capstone/TriageFlowOPD_BE/src/routes/graph/graph.service.ts) | Tạo mới | 668 dòng — 4-step pipeline + linkConnector + getGraph |
| [`src/app.module.ts`](file:///e:/E/Learning/Sem9/Capstone/TriageFlowOPD_BE/src/app.module.ts) | Sửa | Đăng ký `GraphModule` |

### Testing

| File | Trạng thái | Ghi chú |
|---|---|---|
| [`test/spatial-graph.e2e-spec.ts`](file:///e:/E/Learning/Sem9/Capstone/TriageFlowOPD_BE/test/spatial-graph.e2e-spec.ts) | Tạo mới | 447 dòng — Mock Guards + 12 test cases |
| [`test/app.e2e-spec.ts`](file:///e:/E/Learning/Sem9/Capstone/TriageFlowOPD_BE/test/app.e2e-spec.ts) | Sửa | Sửa test route từ `/` (404) thành `/building` (401) |

---

## Lệnh chạy lại test

```bash
# Chạy toàn bộ E2E suite
npx jest --config ./test/jest-e2e.json --forceExit

# Chỉ chạy spatial-graph spec
npx jest --config ./test/jest-e2e.json --forceExit --testPathPattern="spatial-graph"
```

---

*Dependencies: `@turf/turf` đã được cài sẵn. PostGIS extension đã được bật trên Supabase.*
