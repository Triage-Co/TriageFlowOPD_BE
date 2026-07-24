---
phase: 5
title: "Hợp nhất Boundary thành một Entity duy nhất, hỗ trợ Boundary lẻ (Standalone)"
status: pending
priority: P1
effort: "8h"
dependencies: [4]
---

# Phase 5: Hợp nhất Boundary — Unified Boundary Entity

## Overview

Gộp hai model `RoomBoundary` và `ClinicBoundary` thành **một model `Boundary` duy nhất**, đồng thời hỗ trợ **boundary lẻ (standalone)** — các cấu trúc vật lý trên bản đồ không thuộc phòng hay khu vực nào (tường ngăn lẻ giữa 2 không gian, lan can tầng lầu, rào chắn hành lang...). 

Lưu ý: Để chuẩn bị cho Phase 6 (đổi tên `Clinic` thành `Area`), trường tham chiếu tới khu vực trong `Boundary` sẽ sử dụng ngay **`areaId`** thay vì `clinicId`.

### Vấn đề hiện tại

1. **Không hỗ trợ boundary lẻ** — `RoomBoundary` bắt buộc `roomId`, `ClinicBoundary` bắt buộc `areaId` (trước đây là `clinicId`). Không có chỗ lưu boundary không thuộc entity nào.
2. **Trùng lặp code** — Hai service/controller/DTO/module gần như giống hệt nhau, chỉ khác tên bảng và FK.
3. **Khó mở rộng** — Nếu thêm entity mới (Zone, Wing), lại phải tạo thêm module boundary tương ứng.

## Architecture

```
TRƯỚC (2 module riêng):
  src/routes/room-boundary/     → RoomBoundary (bắt buộc roomId)
  src/routes/clinic-boundary/   → ClinicBoundary (bắt buộc clinicId)

SAU (1 module hợp nhất):
  src/routes/boundary/
    ├── boundary.module.ts
    ├── boundary.controller.ts   ← POST/GET/PATCH/DELETE /boundary
    ├── boundary.service.ts
    └── dto/
        ├── create-boundary.dto.ts
        └── update-boundary.dto.ts
```

## Database Schema Changes

### Xóa 2 model cũ

- `RoomBoundary` (bảng `room_boundary`) — Xóa
- `ClinicBoundary` (bảng `clinic_boundary`) — Xóa

### Thêm model mới: `Boundary`

```prisma
model Boundary {
  id             String                                     @id @default(uuid()) @db.Uuid
  floorId        String                                     @db.Uuid        // Bắt buộc
  roomId         String?                                    @db.Uuid        // Optional → boundary thuộc phòng
  areaId         String?                                    @db.Uuid        // Optional → boundary thuộc khu vực (area)
  seqNo          Int
  lineGeom       Unsupported("geometry(LineString, 4326)")?
  boundaryType   BoundaryType
  adjacentRoomId String?                                    @db.Uuid
  hasWall        Boolean                                    @default(true)
  doorId         String?                                    @db.Uuid
  label          String?                                                    // Ghi chú cho boundary lẻ

  floor        Floor         @relation(fields: [floorId], references: [id], onDelete: Cascade)
  room         PhysicalRoom? @relation(fields: [roomId], references: [id], onDelete: Cascade)
  clinic       Clinic?       @relation(fields: [areaId], references: [id], onDelete: Cascade)
  adjacentRoom PhysicalRoom? @relation("AdjacentRoom", fields: [adjacentRoomId], references: [id])
  door         Door?         @relation(fields: [doorId], references: [id], onDelete: SetNull)

  @@unique([roomId, seqNo])
  @@unique([areaId, seqNo])
  @@index([floorId])
  @@index([roomId])
  @@index([areaId])
  @@map("boundary")
}
```

**Logic phân loại boundary:**

| `roomId` | `areaId` | Ý nghĩa |
|----------|-----------|---------|
| `có`     | `null`    | Boundary thuộc phòng (Room Boundary) |
| `null`   | `có`      | Boundary thuộc khu vực (Area Boundary) |
| `null`   | `null`    | Boundary lẻ — standalone (tường ngăn, lan can...) |

> **Lưu ý:** PostgreSQL coi `NULL != NULL` nên unique constraint `@@unique([roomId, seqNo])` và `@@unique([areaId, seqNo])` không bị vi phạm khi `roomId` hoặc `areaId` bị `null`.

### Cập nhật relations trong model liên quan

| Model | Thay đổi |
|-------|---------|
| `PhysicalRoom` | `boundaries RoomBoundary[]` → `boundaries Boundary[]` ; `adjacentBoundaries RoomBoundary[]` → `adjacentBoundaries Boundary[]` |
| `Clinic` | `boundaries ClinicBoundary[]` → `boundaries Boundary[]` |
| `Floor` | Thêm `boundaries Boundary[]` |
| `Door` | `boundaries RoomBoundary[]` → `boundaries Boundary[]` |

## API Endpoints

### `POST /boundary` — Tạo boundary

```typescript
// Body: CreateBoundaryDto
{
  floorId: string;         // Bắt buộc
  roomId?: string;          // Optional
  areaId?: string;          // Optional
  seqNo: number;
  lineGeom?: string;        // WKT LineString
  boundaryType: BoundaryType;
  adjacentRoomId?: string;
  hasWall?: boolean;
  doorId?: string;
  label?: string;           // Ghi chú cho boundary lẻ
}
```

### `GET /boundary` — Lấy danh sách (có filter)

| Query Param | Mô tả |
|-------------|-------|
| `floorId`   | Lọc theo tầng |
| `roomId`    | Lọc boundary thuộc phòng |
| `areaId`    | Lọc boundary thuộc khu vực (area) |
| `standalone=true` | Chỉ lấy boundary lẻ (roomId = null AND areaId = null) |

### `GET /boundary/:id` — Chi tiết

### `PATCH /boundary/:id` — Cập nhật

### `DELETE /boundary/:id` — Xóa

## Affected Files

### Tạo mới

| File | Mô tả |
|------|-------|
| `src/routes/boundary/boundary.module.ts` | Module mới |
| `src/routes/boundary/boundary.controller.ts` | Controller hợp nhất |
| `src/routes/boundary/boundary.service.ts` | Service hợp nhất (gộp logic 2 service cũ) |
| `src/routes/boundary/dto/create-boundary.dto.ts` | DTO tạo mới |
| `src/routes/boundary/dto/update-boundary.dto.ts` | DTO cập nhật (PartialType) |

### Xóa

| File/Folder | Lý do |
|-------------|-------|
| `src/routes/room-boundary/` (toàn bộ) | Đã gộp vào `boundary` |
| `src/routes/clinic-boundary/` (toàn bộ) | Đã gộp vào `boundary` |

### Sửa đổi

| File | Thay đổi |
|------|---------|
| `prisma/schema.prisma` | Xóa `RoomBoundary` + `ClinicBoundary`, thêm `Boundary`, cập nhật relations |
| `src/app.module.ts` | Xóa `RoomBoundaryModule` + `ClinicBoundaryModule`, thêm `BoundaryModule` |
| `src/routes/navigation/navigation.service.ts` | Đổi query từ `roomBoundary` / `clinicBoundary` → `boundary`. Thêm query standalone boundaries. Đổi table name trong GeoService calls |
| `src/routes/navigation/dto/navigation-response.dto.ts` | Gộp `MapRoomBoundaryDto` thành `MapBoundaryDto`, thêm `standaloneBoundaries` vào `MapFloorDto` |
| `src/routes/navigation/navigation-3d.template.ts` | Đổi `clinic.boundaries` → dùng unified boundary với `areaId`, thêm render standalone boundaries |
| `prisma/OPD-map-1.seed.ts` | Đổi `prisma.roomBoundary.create` / `prisma.clinicBoundary.create` → `prisma.boundary.create` với `areaId` + `floorId` |

## Service Logic Changes

### `BoundaryService`

```typescript
// Cache invalidation đơn giản hơn — chỉ cần floorId (luôn có sẵn)
private async clearBuildingCacheByFloorId(floorId: string) {
  const floor = await this.prisma.floor.findUnique({
    where: { id: floorId },
    select: { buildingId: true },
  });
  if (floor) {
    await this.cacheManager.del(`building_map:${floor.buildingId}`);
  }
}
```

### `NavigationService.getBuildingMap()`

```typescript
// Room boundaries: lấy theo roomId
const roomBoundaries = await this.prisma.boundary.findMany({
  where: { roomId: room.id },
  orderBy: { seqNo: 'asc' },
});

// Area boundaries: lấy theo areaId (liên kết với Clinic/Area)
const areaBoundaries = await this.prisma.boundary.findMany({
  where: { areaId: clinic.id },
  orderBy: { seqNo: 'asc' },
});

// Standalone boundaries: lấy theo floorId, không thuộc room/area nào
const standaloneBoundaries = await this.prisma.boundary.findMany({
  where: { floorId: floor.id, roomId: null, areaId: null },
  orderBy: { seqNo: 'asc' },
});
```

GeoService table name: đổi từ `'room_boundary'` / `'clinic_boundary'` → `'boundary'`.

## Migration Strategy

Tạo Prisma migration script:
1. Tạo bảng `boundary` mới (chứa các cột `floorId`, `roomId`, `areaId`, ...)
2. Copy dữ liệu từ `room_boundary` → `boundary` (thêm `floorId` từ join `physical_room`)
3. Copy dữ liệu từ `clinic_boundary` → `boundary` (map `clinicId` thành `areaId`, thêm `floorId` từ join `clinic`)
4. Xóa bảng `room_boundary` và `clinic_boundary`

## Success Criteria

- [ ] `npx prisma generate` thành công
- [ ] `pnpm run build` không lỗi
- [ ] API `POST /boundary` tạo được cả 3 loại: room, area, standalone
- [ ] API `GET /boundary?standalone=true` chỉ trả về boundary lẻ
- [ ] API `GET /navigation/building/:id/map` trả về response chứa `standaloneBoundaries` trên mỗi floor
- [ ] Boundary lẻ render được trên 3D map
- [ ] Seed file chạy thành công với bảng `boundary` mới
