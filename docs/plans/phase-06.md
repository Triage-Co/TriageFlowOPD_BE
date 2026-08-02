---
phase: 6
title: "Đổi tên Clinic → Area & Refactor toàn bộ code bị ảnh hưởng"
status: pending
priority: P1
effort: "6h"
dependencies: [5]
---

# Phase 6: Rename Clinic → Area

## Overview

Đổi tên entity `Clinic` thành `Area` trên toàn bộ hệ thống — từ Prisma schema, database table, API endpoints, NestJS modules, DTOs, service, controller, cho đến navigation service và 3D template. 

**Lý do:** Tên `Clinic` quá hẹp, chỉ mô tả phòng khám y tế. Trong thực tế, entity này đại diện cho một **khu vực (Area)** bất kỳ trên mặt bằng tầng — có thể là khu khám mắt, khu hành chính, khu chờ, khu kỹ thuật... Đổi tên thành `Area` phản ánh đúng bản chất tổng quát hơn.

> **Lưu ý quan trọng:** `Clinical_Document` và `ClinicalDocumentTypeEnum` là khái niệm y tế (clinical = lâm sàng), **KHÔNG** liên quan đến entity `Clinic` (khu vực bản đồ). Các file trong `src/routes/clinical-document/` sẽ **KHÔNG** bị ảnh hưởng bởi phase này.

## Scope of Rename

### Quy tắc đổi tên

| Ngữ cảnh | Cũ | Mới |
|-----------|-----|------|
| Prisma Model | `Clinic` | `Area` |
| Database Table | `clinic` | `area` |
| Prisma Field Names | `clinicId`, `clinicCode`, `clinicLabel` | `areaId`, `areaCode`, `areaLabel` |
| NestJS Module/Service/Controller | `ClinicModule`, `ClinicService`, `ClinicController` | `AreaModule`, `AreaService`, `AreaController` |
| DTO Classes | `CreateClinicDto`, `UpdateClinicDto` | `CreateAreaDto`, `UpdateAreaDto` |
| API Route | `/clinic` | `/area` |
| Swagger Tag | `@ApiTags('Clinic')` | `@ApiTags('Area')` |
| Folder Name | `src/routes/clinic/` | `src/routes/area/` |
| File Names | `clinic.*.ts` | `area.*.ts` |

### Các file/field KHÔNG đổi tên

| Item | Lý do |
|------|-------|
| `Clinical_Document`, `ClinicalDocumentTypeEnum` | Khái niệm y tế (clinical ≠ clinic) |
| `ClinicalRoomType` | Enum phân loại chức năng phòng, không liên quan |
| `src/routes/clinical-document/` | Module riêng biệt, không liên quan |

## Database Schema Changes

### Prisma Model: `Clinic` → `Area`

```prisma
model Area {
  id          String                                  @id @default(uuid()) @db.Uuid
  floorId     String                                  @db.Uuid
  areaCode    String                                         // clinicCode → areaCode
  areaLabel   String                                         // clinicLabel → areaLabel
  description String?
  centerGeom  Unsupported("geometry(Point, 4326)")?
  outlineGeom Unsupported("geometry(Polygon, 4326)")?
  createdAt   DateTime                                @default(now()) @db.Timestamptz()
  updatedAt   DateTime                                @default(now()) @updatedAt @db.Timestamptz()

  floor          Floor          @relation(fields: [floorId], references: [id], onDelete: Cascade)
  boundaries     Boundary[]                                  // Từ Phase 5
  physicalRooms  PhysicalRoom[]
  placedFeatures PlacedFeature[]
  doors          Door[]

  @@unique([floorId, areaCode])
  @@index([floorId])
  @@map("area")                                              // clinic → area
}
```

### Cập nhật FK trong model liên quan

| Model | Field cũ | Field mới |
|-------|----------|-----------|
| `PhysicalRoom` | `clinicId` → `Clinic?` | `areaId` → `Area?` |
| `Door` | `clinicId` → `Clinic?` | `areaId` → `Area?` |
| `PlacedFeature` | `clinicId` → `Clinic?` | `areaId` → `Area?` |
| `Boundary` (từ Phase 5) | `clinicId` → `Clinic?` | `areaId` → `Area?` |
| `Floor` | `clinics Clinic[]` | `areas Area[]` |

## Affected Files — Full Inventory

### Xóa (folder cũ)

| Path | Lý do |
|------|-------|
| `src/routes/clinic/` (toàn bộ) | Thay thế bởi `src/routes/area/` |

### Tạo mới (folder mới)

| Path | Mô tả |
|------|-------|
| `src/routes/area/area.module.ts` | Module mới |
| `src/routes/area/area.controller.ts` | Controller: `@Controller('area')` |
| `src/routes/area/area.service.ts` | Service: logic giống ClinicService, đổi tên |
| `src/routes/area/dto/create-area.dto.ts` | DTO với fields `areaCode`, `areaLabel` |
| `src/routes/area/dto/update-area.dto.ts` | PartialType(CreateAreaDto) |

### Sửa đổi

| File | Thay đổi |
|------|---------|
| `prisma/schema.prisma` | Đổi model `Clinic` → `Area`, đổi tên fields, đổi `@@map`, cập nhật FK trong `PhysicalRoom`, `Door`, `PlacedFeature`, `Floor`, `Boundary` |
| `src/app.module.ts` | Xóa `ClinicModule`, thêm `AreaModule` |
| `src/routes/navigation/navigation.service.ts` | Đổi `prisma.clinic.*` → `prisma.area.*`, đổi GeoService table name `'clinic'` → `'area'`, đổi response key `clinics` → `areas` |
| `src/routes/navigation/dto/navigation-response.dto.ts` | Đổi các DTO chứa `clinicId` → `areaId`, đổi `clinics` → `areas` trong `MapFloorDto` |
| `src/routes/navigation/navigation-3d.template.ts` | Đổi `clinic` → `area` trong JS template (variable names, `CLINIC_COLORS` → `AREA_COLORS`, `clinicCode` → `areaCode`...) |
| `src/routes/boundary/boundary.service.ts` | Đổi `clinicId` → `areaId` (từ Phase 5) |
| `src/routes/boundary/dto/create-boundary.dto.ts` | Đổi field `clinicId` → `areaId` |
| `prisma/OPD-map-1.seed.ts` | Đổi `prisma.clinic.*` → `prisma.area.*`, `clinicCode` → `areaCode`, `clinicLabel` → `areaLabel`, GeoService table name |

## API Changes

### Endpoints

| Cũ | Mới |
|----|------|
| `POST /clinic` | `POST /area` |
| `GET /clinic` | `GET /area` |
| `GET /clinic/:id` | `GET /area/:id` |
| `PATCH /clinic/:id` | `PATCH /area/:id` |
| `DELETE /clinic/:id` | `DELETE /area/:id` |

### Request/Response Body

```typescript
// Cũ
{ clinicCode: "OPH", clinicLabel: "Khu khám mắt" }

// Mới
{ areaCode: "OPH", areaLabel: "Khu khám mắt" }
```

### Navigation Response

```typescript
// Cũ
{ floors: [{ clinics: [...] }] }

// Mới
{ floors: [{ areas: [...] }] }
```

## Migration Strategy

Tạo Prisma migration script:
1. `ALTER TABLE "clinic" RENAME TO "area"`
2. `ALTER TABLE "area" RENAME COLUMN "clinicCode" TO "areaCode"`
3. `ALTER TABLE "area" RENAME COLUMN "clinicLabel" TO "areaLabel"`
4. Đổi tên FK columns: `clinicId` → `areaId` trong các bảng `physical_room`, `door`, `placed_feature`, `boundary`
5. Đổi tên unique constraint / index tương ứng

## Success Criteria

- [ ] `npx prisma generate` thành công
- [ ] `pnpm run build` không lỗi
- [ ] API `POST /area` tạo khu vực mới thành công
- [ ] API `GET /area` trả về danh sách khu vực
- [ ] API cũ `/clinic` không còn tồn tại (trả 404)
- [ ] Navigation map response chứa key `areas` thay vì `clinics`
- [ ] 3D map render khu vực đúng với tên mới
- [ ] Seed file chạy thành công
- [ ] `Clinical_Document` module vẫn hoạt động bình thường, không bị ảnh hưởng
