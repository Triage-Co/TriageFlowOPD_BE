# Danh mục dịch vụ — Catalog đích (seed)

Ngày: **2026-08-07** (Asia/Ho_Chi_Minh)

> File này là **nguồn sự thật để viết `prisma/service.seed.ts`** (service +
> `room_service`). Đã duyệt xong — không còn câu hỏi mở.
>
> Quy ước giá: **2.000 / 3.000 / 4.000 / 0**.
> `room_type` seed theo loại dịch vụ; `room_service` map theo mã vật lý /
> tên phòng trong `docs/data/shift.md`.

## Tóm tắt thay đổi so với DB hiện tại

| Hành động | Chi tiết |
| --------- | -------- |
| **Bỏ** | `Tư vấn và kê đơn thuốc`; toàn bộ `Đặt khám ban đầu` (`DAT_KHAM`, `DAT_KHAM_BAN_DAU`) — phòng SK dùng `KHAM_SK_01` |
| **Đổi tên** | `Khám mắt toàn diện` → **Khám mắt**; `Khám nội tổng quát` → **Khám nội khoa** |
| **Cập nhật giá + remap phòng** | 5 thủ thuật cũ (xem §3) |
| **Thêm thủ thuật** | 15 `PROCEDURE` mới (xem §4) |
| **Gán / cập nhật phòng khám** | Các `CLINICAL_EXAMINATION` + `Cấp phát thuốc BHYT` (xem §2, §5) |
| **Thêm khám thiếu** | Da liễu, CTCH, Truyền nhiễm, Tâm thần, Khám sức khỏe tổng quát (xem §5) |
| **Gộp phòng** | Tim mạch can thiệp 1–2 → **Khám nội khoa** (không tạo service riêng) |

---

## 1. Snapshot DB hiện tại (tham chiếu)

> Snapshot trước seed — **không** dùng để seed.

| Tên dịch vụ (service_name) | Giá | Loại | Phòng thực hiện (DB) |
| -------------------------- | --: | ---- | -------------------- |
| Đặt khám ban đầu | 2.000 | `CLINICAL_EXAMINATION` | — (chưa gán) |
| Đặt khám ban đầu | 3.000 | `CLINICAL_EXAMINATION` | Phòng Đơn vị tiêm chủng |
| Khám mắt toàn diện | 2.800 | `CLINICAL_EXAMINATION` | — |
| Khám ngoại khoa | 2.500 | `CLINICAL_EXAMINATION` | — |
| Khám nhi khoa | 2.500 | `CLINICAL_EXAMINATION` | — |
| Khám nội tổng quát | 2.500 | `CLINICAL_EXAMINATION` | — |
| Khám Răng Hàm Mặt | 2.500 | `CLINICAL_EXAMINATION` | — |
| Khám sản phụ khoa | 3.000 | `CLINICAL_EXAMINATION` | — |
| Khám Tai Mũi Họng | 3.000 | `CLINICAL_EXAMINATION` | — |
| Chụp MRI sọ não | 4.000 | `DIAGNOSTIC_TEST` | CĐHA (4) |
| Chụp X-quang phổi thẳng | 2.500 | `DIAGNOSTIC_TEST` | CĐHA (4) |
| Đo chức năng hô hấp | 2.500 | `DIAGNOSTIC_TEST` | Thăm dò CN (3) |
| Đo điện tâm đồ (ECG) | 2.000 | `DIAGNOSTIC_TEST` | Thăm dò CN (3) |
| Siêu âm ổ bụng tổng quát | 3.000 | `DIAGNOSTIC_TEST` | CĐHA (4) |
| Xét nghiệm máu cơ bản | 2.200 | `DIAGNOSTIC_TEST` | Xét nghiệm sinh hóa |
| Xét nghiệm nước tiểu | 2.000 | `DIAGNOSTIC_TEST` | Xét nghiệm sinh hóa |
| Xét nghiệm sinh hóa máu | 3.500 | `DIAGNOSTIC_TEST` | Xét nghiệm sinh hóa |
| Cấp phát thuốc BHYT | 0 | `PRESCRIPTION` | — |
| Tư vấn và kê đơn thuốc | 2.000 | `PRESCRIPTION` | — |
| Khâu vết thương phần mềm | 3.500 | `PROCEDURE` | Phòng Thủ thuật |
| Nhổ răng tiểu phẫu | 4.000 | `PROCEDURE` | Phòng Thủ thuật |
| Nội soi dạ dày tá tràng | 3.800 | `PROCEDURE` | Phòng Thủ thuật |
| Thay băng, cắt chỉ | 2.000 | `PROCEDURE` | Phòng Thủ thuật |
| Tiêm bắp/tĩnh mạch | 2.000 | `PROCEDURE` | Phòng Thủ thuật |

---

## 2. Catalog đích — Khám lâm sàng & đơn thuốc

| service_code (đề xuất) | Tên dịch vụ | Giá | Loại | `room_type` | Phòng (`room_service`) |
| ---------------------- | ----------- | --: | ---- | ----------- | ---------------------- |
| `KHAM_MAT_01` | Khám mắt | 3.000 | `CLINICAL_EXAMINATION` | `CLINICAL_ROOM` | Mắt 1–2 (`G2.4.8`, `G2.4.11`) |
| `KHAM_NGOAI_01` | Khám ngoại khoa | 3.000 | `CLINICAL_EXAMINATION` | `CLINICAL_ROOM` | Ngoại khám (6) — §2.2 |
| `KHAM_NHI_01` | Khám nhi khoa | 3.000 | `CLINICAL_EXAMINATION` | `CLINICAL_ROOM` | Nhi 1–2 (`G2.2.34`, `G2.2.35`) |
| `KHAM_NOI_01` | Khám nội khoa | 3.000 | `CLINICAL_EXAMINATION` | `CLINICAL_ROOM` | Nội * + Huyết học + Tim mạch can thiệp — §2.1 |
| `KHAM_RHM_01` | Khám Răng Hàm Mặt | 3.000 | `CLINICAL_EXAMINATION` | `CLINICAL_ROOM` | RHM 1–2 (`G2.4.28`, `G2.4.29`) |
| `KHAM_SAN_01` | Khám sản phụ khoa | 3.000 | `CLINICAL_EXAMINATION` | `CLINICAL_ROOM` | Phụ khoa (`G2.4.21`) + Khám thai 1 (`G2.4.23`) |
| `KHAM_TMH_01` | Khám Tai Mũi Họng | 3.000 | `CLINICAL_EXAMINATION` | `CLINICAL_ROOM` | TMH 1–2 (`G2.4.24`, `G2.4.25`) |
| `KHAM_DALIEU_01` | Khám da liễu | 3.000 | `CLINICAL_EXAMINATION` | `CLINICAL_ROOM` | Da liễu 1–3 (`G2.4.4`–`6`) |
| `KHAM_CTCH_01` | Khám chấn thương chỉnh hình | 3.000 | `CLINICAL_EXAMINATION` | `CLINICAL_ROOM` | CTCH 1–2 (`G2.4.1`, `G2.4.2`) |
| `KHAM_TRUYENNHIEM_01` | Khám truyền nhiễm | 3.000 | `CLINICAL_EXAMINATION` | `CLINICAL_ROOM` | Bệnh truyền nhiễm (`G2.2.24`) |
| `KHAM_TAMTHAN_01` | Khám tâm thần | 3.000 | `CLINICAL_EXAMINATION` | `CLINICAL_ROOM` | Sức khỏe tâm thần (`G2.2.33`) |
| `KHAM_SK_01` | Khám sức khỏe tổng quát | 3.000 | `CLINICAL_EXAMINATION` | `CLINICAL_ROOM` | Khám sức khỏe 1–2 (`G2.4.34`, `G2.4.35`) |
| `CAP_THUOC_BH` | Cấp phát thuốc BHYT | 0 | `PRESCRIPTION` | `PHARMACY` | Nhà Thuốc / Quầy Thuốc (`G2.1.PHARMACY`) |

### 2.1 Phòng — Khám nội khoa

| Mã vật lý | Tên phòng |
| --------- | --------- |
| `G2.2.18` | Nội tổng quát 1 |
| `G2.2.19` | Nội tổng quát 2 |
| `G2.2.20` | Nội tổng quát 3 |
| `G2.2.11` | Nội cơ xương khớp |
| `G2.2.28` | Nội hô hấp 1 |
| `G2.2.25` | Nội thận |
| `G2.2.22` | Nội thần kinh 1 |
| `G2.2.23` | Nội thần kinh 2 |
| `G2.2.14` | Nội tiết 1 |
| `G2.2.15` | Nội tiết 2 |
| `G2.2.16` | Nội tiết 3 |
| `G2.2.26` | Nội tiêu hóa 1 |
| `G2.2.27` | Nội tiêu hóa 2 |
| `G2.2.6` | Nội tim mạch 1 |
| `G2.2.7` | Nội tim mạch 2 |
| `G2.2.8` | Nội tim mạch 3 |
| `G2.2.9` | Nội tim mạch 4 |
| `G2.2.10` | Nội tim mạch 5 |
| `G2.2.40` | Huyết học |
| `G2.2.12` | Tim mạch can thiệp 1 |
| `G2.2.13` | Tim mạch can thiệp 2 |

**Không gồm:** Thủ thuật Nội khoa 1–5, Bệnh truyền nhiễm, Sức khỏe tâm thần.

### 2.2 Phòng — Khám ngoại khoa

| Mã vật lý | Tên phòng |
| --------- | --------- |
| `G2.4.12` | Ngoại tổng quát 1 |
| `G2.4.15` | Ngoại lồng ngực |
| `G2.4.16` | Ngoại thần kinh 1 |
| `G2.4.17` | Ngoại thần kinh 2 |
| `G2.4.14` | Ngoại tiết niệu |
| `G2.4.18` | Ngoại ung bướu |

**Không gồm:** Thủ thuật Ngoại khoa 1–5, Phụ khoa, Khám thai, RHM, TMH.

---

## 3. Catalog đích — Thủ thuật cũ (cập nhật)

| service_code | Tên dịch vụ | Giá cũ → mới | `room_type` | Phòng (`room_service`) |
| ------------ | ----------- | ------------ | ----------- | ---------------------- |
| `TT_KHAU_VT` | Khâu vết thương phần mềm | 3.500 → **3.000** | `PROCEDURE_ROOM` | Thủ thuật Ngoại khoa 1–5 (`G2.4.13`, `.19`, `.20`, `.22`, `.26`) |
| `TT_THAY_BANG` | Thay băng, cắt chỉ | 2.000 → **2.000** | `PROCEDURE_ROOM` | Thủ thuật Ngoại khoa 1–5 |
| `TT_TIEM_BAP` | Tiêm bắp/tĩnh mạch | 2.000 → **2.000** | `PROCEDURE_ROOM` | Thủ thuật Nội khoa 1–5 (`G2.2.5`, `.17`, `.21`, `.32`, `.41`) |
| `TT_NOISOI_DD` | Nội soi dạ dày tá tràng | 3.800 → **4.000** | `PROCEDURE_ROOM` | Thủ thuật Nội khoa 1–5 |
| `TT_NHO_RANG` | Nhổ răng tiểu phẫu | 4.000 → **4.000** | `PROCEDURE_ROOM` | Phòng Thủ thuật (`G2.4.40`) — chưa có nhóm RHM |

> Khi seed: **xóa** `room_service` cũ gắn “Phòng Thủ thuật” (trừ `TT_NHO_RANG`),
> rồi tạo link mới theo bảng trên.

---

## 4. Catalog đích — Thủ thuật mới

| service_code (đề xuất) | Tên dịch vụ | Giá | Phòng (`room_service`) |
| ---------------------- | ----------- | --: | ---------------------- |
| `TT_DL_SINHTHIET` | Sinh thiết / cắt bỏ tổn thương da | 3.000 | Thủ thuật Da liễu 1–3 (`G2.4.30`–`32`) |
| `TT_DL_LASER` | Laser / đốt điện trị liệu da | 4.000 | Thủ thuật Da liễu 1–3 |
| `TT_DL_PEEL` | Peel / tiêm điều trị da | 2.000 | Thủ thuật Da liễu 1–3 |
| `TT_MAT_THILUC` | Đo thị lực chuyên sâu / khám tiền phẫu | 2.000 | Thủ thuật Mắt 1–3 (`G2.4.7`, `.9`, `.10`) |
| `TT_MAT_TIEUPHAU` | Tiểu phẫu mắt / cấy kết mạc | 3.000 | Thủ thuật Mắt 1–3 |
| `TT_MAT_PHACO` | Phaco / laser điều trị mắt | 4.000 | Thủ thuật Mắt 1–3 |
| `TT_CTCH_BOBOT` | Bó bột / nắn khớp | 3.000 | Thủ thuật CTCH (`G2.4.3`) |
| `TT_NOI_TRUYENDICH` | Truyền dịch / truyền thuốc tĩnh mạch | 2.000 | Thủ thuật Nội khoa 1–5 |
| `TT_NOI_CHOCHUT` | Chọc hút / dẫn lưu ổ áp xe nông | 3.000 | Thủ thuật Nội khoa 1–5 |
| `TT_NOI_SONDE` | Đặt sonde / thông tiết niệu | 2.000 | Thủ thuật Nội khoa 1–5 |
| `TT_NOI_HUTDICH` | Hút dịch màng phổi / dẫn lưu lồng ngực | 4.000 | Thủ thuật Nội khoa 1–5 |
| `TT_NOI_NEBULIZER` | Thở oxy / nebulizer | 2.000 | Thủ thuật Nội khoa 1–5 |
| `TT_NGOAI_DANLUU` | Dẫn lưu / thay băng vết mổ | 2.000 | Thủ thuật Ngoại khoa 1–5 |
| `TT_NGOAI_TIEUPHAU` | Tiểu phẫu da / u mỡ / cắt mụn cóc | 3.000 | Thủ thuật Ngoại khoa 1–5 |
| `TT_NGOAI_PARACEN` | Chọc dẫn lưu ổ bụng (paracentesis) | 4.000 | Thủ thuật Ngoại khoa 1–5 |

Tất cả: `service_type = PROCEDURE`, `room_type = PROCEDURE_ROOM`, `is_active = true`.

**Không thêm:** thủ thuật trùng `Khâu vết thương / cắt chỉ`; `Thủ thuật ngoại trú tổng hợp` (phòng Ngoại 5 — dự phòng).

---

## 5. Catalog đích — Cận lâm sàng (giữ + làm tròn giá)

> Phòng đã gán trên DB — seed **giữ mapping**, chỉ cập nhật giá lẻ →
> 2.000 / 3.000 / 4.000.

| service_code | Tên dịch vụ | Giá cũ → mới | Phòng (`room_service`) |
| ------------ | ----------- | ------------ | ---------------------- |
| `CD_MRI_01` | Chụp MRI sọ não | 4.000 → **4.000** | CĐHA 1–4 (`G2.3.1`–`4`) |
| `CD_XQUANG_01` | Chụp X-quang phổi thẳng | 2.500 → **3.000** | CĐHA 1–4 |
| `CD_SIEUAM_01` | Siêu âm ổ bụng tổng quát | 3.000 → **3.000** | CĐHA 1–4 |
| `CN_HOHAP` | Đo chức năng hô hấp | 2.500 → **3.000** | Thăm dò CN 1–3 (`G2.3.5`–`7`) |
| `CN_DIENTIM` | Đo điện tâm đồ (ECG) | 2.000 → **2.000** | Thăm dò CN 1–3 |
| `XN_MAU_CB` | Xét nghiệm máu cơ bản | 2.200 → **2.000** | Xét nghiệm sinh hóa (`G2.3.8`) |
| `XN_NUOC_TIEU` | Xét nghiệm nước tiểu | 2.000 → **2.000** | Xét nghiệm sinh hóa |
| `XN_SH_MAU` | Xét nghiệm sinh hóa máu | 3.500 → **4.000** | Xét nghiệm sinh hóa |

`room_type`: CĐHA → `IMAGING_ROOM`; thăm dò → `FUNCTIONAL_EXPLORATION`; XN → `LABORATORY`.

---

## 6. Bỏ / không seed

| Tên / mã | Hành động seed |
| -------- | -------------- |
| `KEDON_01` — Tư vấn và kê đơn thuốc | `is_active = false`; gỡ `room_service` |
| `DAT_KHAM` / `DAT_KHAM_BAN_DAU` — Đặt khám ban đầu | `is_active = false`; gỡ `room_service` (phòng SK → `KHAM_SK_01`) |
| Sảnh Tiếp Đón A/B | Không gán service khám |

---

## 7. Checklist seed

1. Upsert toàn bộ service §2–§5 theo `service_code` (đổi tên / giá / `service_type` / `room_type`).
2. Tạo 15 thủ thuật mới §4.
3. Soft-disable / bỏ `KEDON_01` và Đặt khám ban đầu (2.000).
4. Rebuild `room_service`:
   - Match phòng theo `physical_room.roomCode` (ưu tiên) hoặc `room.room_name`.
   - Remap thủ thuật cũ §3; gán khám/đơn thuốc §2; giữ/đồng bộ CLS §5.
5. Không tạo `room_service` cho sảnh tiếp đón.
6. Sau seed: đối chiếu lại với `docs/data/shift.md` — mọi phòng khám / CLS / thủ thuật / nhà thuốc (trừ sảnh) đều có ≥1 service.
