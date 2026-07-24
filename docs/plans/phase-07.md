---
phase: 7
title: "Tái tổ chức Module — MapModule & NavigationModule"
status: pending
priority: P2
effort: "4h"
dependencies: [5, 6]
---

# Phase 7: Tái tổ chức Module — MapModule & NavigationModule

## Overview

Gom nhóm các module phẳng (flat) hiện tại trong `src/routes/` thành **2 module cha có tổ chức** theo domain:

- **`MapModule`** — Quản lý dữ liệu không gian bản đồ (building, floor, room, area, boundary, door, POI, category, feature...)
- **`NavigationModule`** — Quản lý đồ thị điều hướng và tìm đường (node, edge, connector, blockage, graph, navigation)

Mục đích: giảm số lượng module ngang hàng trong `app.module.ts`, tạo ranh giới rõ ràng giữa 2 domain, và dễ dàng mở rộng trong tương lai.

## Current Structure (Before)

```
src/routes/
├── building/          ← Map
├── floor/             ← Map
├── physical-room/     ← Map
├── area/              ← Map  (từ Phase 6, trước đó là clinic/)
├── boundary/          ← Map  (từ Phase 5, trước đó là room-boundary/ + clinic-boundary/)
├── door/              ← Map
├── category/          ← Map
├── poi/               ← Map
├── feature-template/  ← Map
├── placed-feature/    ← Map
├── node/              ← Navigation
├── edge/              ← Navigation
├── connector/         ← Navigation
├── blockage/          ← Navigation
├── graph/             ← Navigation
├── navigation/        ← Navigation
├── ... (các module khác: auth, booking, flow, step, etc.)
```

**Vấn đề:** 38 thư mục con ngang hàng trong `src/routes/`, khó tìm kiếm và thiếu tổ chức domain.

## Target Structure (After)

```
src/routes/
├── map/                              ← MapModule (module cha)
│   ├── map.module.ts                 ← Đăng ký tất cả sub-module bên dưới
│   ├── building/
│   │   ├── building.module.ts
│   │   ├── building.controller.ts
│   │   ├── building.service.ts
│   │   └── dto/
│   ├── floor/
│   │   ├── floor.module.ts
│   │   ├── floor.controller.ts
│   │   ├── floor.service.ts
│   │   └── dto/
│   ├── physical-room/
│   │   ├── physical-room.module.ts
│   │   ├── physical-room.controller.ts
│   │   ├── physical-room.service.ts
│   │   └── dto/
│   ├── area/                         ← (từ Phase 6)
│   │   ├── area.module.ts
│   │   ├── area.controller.ts
│   │   ├── area.service.ts
│   │   └── dto/
│   ├── boundary/                     ← (từ Phase 5)
│   │   ├── boundary.module.ts
│   │   ├── boundary.controller.ts
│   │   ├── boundary.service.ts
│   │   └── dto/
│   ├── door/
│   │   ├── door.module.ts
│   │   ├── door.controller.ts
│   │   ├── door.service.ts
│   │   └── dto/
│   ├── category/
│   │   ├── category.module.ts
│   │   ├── category.controller.ts
│   │   ├── category.service.ts
│   │   └── dto/
│   ├── poi/
│   │   ├── poi.module.ts
│   │   ├── poi.controller.ts
│   │   ├── poi.service.ts
│   │   └── dto/
│   ├── feature-template/
│   │   ├── feature-template.module.ts
│   │   ├── feature-template.controller.ts
│   │   ├── feature-template.service.ts
│   │   └── dto/
│   └── placed-feature/
│       ├── placed-feature.module.ts
│       ├── placed-feature.controller.ts
│       ├── placed-feature.service.ts
│       └── dto/
│
├── navigation/                       ← NavigationModule (module cha)
│   ├── navigation.module.ts          ← Đăng ký tất cả sub-module bên dưới
│   ├── core/                         ← Service tìm đường + 3D map (cũ: navigation/)
│   │   ├── navigation-core.module.ts
│   │   ├── navigation.controller.ts
│   │   ├── navigation.service.ts
│   │   ├── navigation-3d.template.ts
│   │   └── dto/
│   ├── node/
│   │   ├── node.module.ts
│   │   ├── node.controller.ts
│   │   └── node.service.ts
│   ├── edge/
│   │   ├── edge.module.ts
│   │   ├── edge.controller.ts
│   │   └── edge.service.ts
│   ├── connector/
│   │   ├── connector.module.ts
│   │   ├── connector.controller.ts
│   │   └── connector.service.ts
│   ├── blockage/
│   │   ├── blockage.module.ts
│   │   ├── blockage.controller.ts
│   │   └── blockage.service.ts
│   └── graph/
│       ├── graph.module.ts
│       ├── graph.controller.ts
│       └── graph.service.ts
│
├── auth/             ← Không di chuyển
├── booking/          ← Không di chuyển
├── flow/             ← Không di chuyển
├── step/             ← Không di chuyển
├── ... (các module khác giữ nguyên)
```

## Implementation Details

### 1. Tạo `MapModule` (module cha)

```typescript
// src/routes/map/map.module.ts
import { Module } from '@nestjs/common';
import { BuildingModule } from './building/building.module';
import { FloorModule } from './floor/floor.module';
import { PhysicalRoomModule } from './physical-room/physical-room.module';
import { AreaModule } from './area/area.module';
import { BoundaryModule } from './boundary/boundary.module';
import { DoorModule } from './door/door.module';
import { CategoryModule } from './category/category.module';
import { PoiModule } from './poi/poi.module';
import { FeatureTemplateModule } from './feature-template/feature-template.module';
import { PlacedFeatureModule } from './placed-feature/placed-feature.module';

@Module({
  imports: [
    BuildingModule,
    FloorModule,
    PhysicalRoomModule,
    AreaModule,
    BoundaryModule,
    DoorModule,
    CategoryModule,
    PoiModule,
    FeatureTemplateModule,
    PlacedFeatureModule,
  ],
})
export class MapModule {}
```

### 2. Tạo `NavigationModule` (module cha)

```typescript
// src/routes/navigation/navigation.module.ts
import { Module } from '@nestjs/common';
import { NavigationCoreModule } from './core/navigation-core.module';
import { NodeModule } from './node/node.module';
import { EdgeModule } from './edge/edge.module';
import { ConnectorModule } from './connector/connector.module';
import { BlockageModule } from './blockage/blockage.module';
import { GraphModule } from './graph/graph.module';

@Module({
  imports: [
    NavigationCoreModule,
    NodeModule,
    EdgeModule,
    ConnectorModule,
    BlockageModule,
    GraphModule,
  ],
})
export class NavigationModule {}
```

### 3. Cập nhật `AppModule`

```typescript
// src/app.module.ts — TRƯỚC
imports: [
  BuildingModule,
  FloorModule,
  PhysicalRoomModule,
  AreaModule,           // Phase 6
  BoundaryModule,       // Phase 5
  DoorModule,
  CategoryModule,
  PoiModule,
  NodeModule,
  EdgeModule,
  ConnectorModule,
  GraphModule,
  FeatureTemplateModule,
  PlacedFeatureModule,
  BlockageModule,
  NavigationModule,
  // ... 20+ modules khác
]

// src/app.module.ts — SAU
imports: [
  MapModule,            // Gom 10 module map
  NavigationModule,     // Gom 6 module navigation
  // ... 20+ modules khác (giữ nguyên)
]
```

**Kết quả:** Giảm từ ~36 import xuống còn ~22 import trong `app.module.ts`.

### 4. Cập nhật Import Paths

Khi di chuyển thư mục, tất cả **relative import paths** bên trong các sub-module đều cần cập nhật:

| Module | Import cũ | Import mới |
|--------|-----------|------------|
| `BuildingService` | `../../shared/config/prisma.service` | `../../../shared/config/prisma.service` |
| `NavigationService` | `../../shared/geo/geo.service` | `../../../shared/geo/geo.service` |
| Các module khác | Tương tự, thêm 1 level `../` | |

> **Lưu ý:** Nếu dự án sử dụng **tsconfig path aliases** (ví dụ `@shared/`, `@routes/`), import paths sẽ không cần thay đổi. Kiểm tra `tsconfig.json` trước khi bắt đầu.

### 5. API Routes — Không đổi

Tất cả API routes giữ nguyên path hiện tại. Chỉ tổ chức lại code, KHÔNG thay đổi API endpoint.

| API | Vẫn giữ nguyên |
|-----|----------------|
| `POST /building` | ✅ |
| `GET /floor` | ✅ |
| `POST /boundary` | ✅ |
| `GET /area` | ✅ |
| `POST /graph/:floorId/generate` | ✅ |
| `GET /navigation/building/:id/map` | ✅ |

## Affected Files — Summary

### Tạo mới

| File | Mô tả |
|------|-------|
| `src/routes/map/map.module.ts` | Module cha cho Map |
| `src/routes/navigation/navigation.module.ts` | Module cha cho Navigation (ghi đè file cũ) |
| `src/routes/navigation/core/navigation-core.module.ts` | Module con cho navigation service chính |

### Di chuyển (Move)

| Cũ | Mới |
|----|------|
| `src/routes/building/` | `src/routes/map/building/` |
| `src/routes/floor/` | `src/routes/map/floor/` |
| `src/routes/physical-room/` | `src/routes/map/physical-room/` |
| `src/routes/area/` | `src/routes/map/area/` |
| `src/routes/boundary/` | `src/routes/map/boundary/` |
| `src/routes/door/` | `src/routes/map/door/` |
| `src/routes/category/` | `src/routes/map/category/` |
| `src/routes/poi/` | `src/routes/map/poi/` |
| `src/routes/feature-template/` | `src/routes/map/feature-template/` |
| `src/routes/placed-feature/` | `src/routes/map/placed-feature/` |
| `src/routes/node/` | `src/routes/navigation/node/` |
| `src/routes/edge/` | `src/routes/navigation/edge/` |
| `src/routes/connector/` | `src/routes/navigation/connector/` |
| `src/routes/blockage/` | `src/routes/navigation/blockage/` |
| `src/routes/graph/` | `src/routes/navigation/graph/` |
| `src/routes/navigation/*.ts` (navigation service files) | `src/routes/navigation/core/` |

### Sửa đổi

| File | Thay đổi |
|------|---------|
| `src/app.module.ts` | Xóa 16 import riêng lẻ, thêm 2 import: `MapModule` + `NavigationModule` |
| Tất cả `*.service.ts` trong 16 module | Cập nhật relative import paths cho `shared/` |
| Tất cả `*.module.ts` trong 16 module | Cập nhật relative import paths nếu cần |

## Execution Order

1. Di chuyển 10 thư mục map vào `src/routes/map/`
2. Tạo `src/routes/map/map.module.ts`
3. Di chuyển navigation service files vào `src/routes/navigation/core/`
4. Di chuyển 5 thư mục navigation vào `src/routes/navigation/`
5. Tạo `src/routes/navigation/core/navigation-core.module.ts`
6. Cập nhật `src/routes/navigation/navigation.module.ts` (ghi đè)
7. Cập nhật tất cả relative import paths
8. Cập nhật `src/app.module.ts`
9. Build & verify

## Risks & Mitigations

| Rủi ro | Giải pháp |
|--------|-----------|
| Import path sai sau khi di chuyển | Chạy `pnpm run build` sau mỗi bước di chuyển để phát hiện lỗi sớm |
| Circular dependency giữa MapModule ↔ NavigationModule | NavigationService import PrismaService (global), không import trực tiếp MapModule services → không circular |
| Seed file bị broken | Seed file nằm trong `prisma/`, không import từ `src/routes/`, nên không bị ảnh hưởng |

## Success Criteria

- [ ] `pnpm run build` thành công — không có lỗi import
- [ ] Tất cả API endpoints giữ nguyên path, hoạt động bình thường
- [ ] `src/app.module.ts` chỉ import `MapModule` + `NavigationModule` thay vì 16 module riêng lẻ
- [ ] Không có thư mục map/navigation module nào còn nằm trực tiếp trong `src/routes/` (ngoại trừ trong `map/` hoặc `navigation/`)
- [ ] Navigation 3D map vẫn render đúng
- [ ] Pathfinding API vẫn trả kết quả đúng
