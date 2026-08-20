# Đồng nhất phòng vật lý — phòng logic — khoa phòng (Tầng 1 Tòa G2)

Tài liệu này **thay thế** `[map detail.md](./map%20detail.md)` cho mục đích đối chiếu khoa phòng. Snapshot lấy từ database ngày **14/08/2026** (sau phase 2).

- **Phòng vật lý / phòng logic / Area**: không đổi geometry/tên.
- **Khoa hiện tại**: `Room.specialty` sau phase 2 (đã gán lại theo CSV).
- **Khoa đề xuất**: trùng khoa hiện tại trên các phòng đã remap; `G2.4.34/35` Khám sức khỏe vẫn Đa khoa.

---

## Thông tin tổng quan


|                     |                                                                      |
| ------------------- | -------------------------------------------------------------------- |
| Tòa nhà             | Tòa G2 – Khoa Khám Bệnh (`id: 17854b86-79d1-4c60-b776-784742c2597e`) |
| Tầng                | Tầng 1 (`id: 00b03ef8-7702-4b08-a07e-ec887432453c`)                  |
| Area                | 6                                                                    |
| PhysicalRoom        | 80                                                                   |
| Room (logical)      | 75 (5 physical không tạo logical)                                    |
| Specialty bệnh viện | 30 (đã xóa 5 khoa trống: SP_8/22/23/26/29) |
| AI_Specialty        | 28 mã Infermedica                                                    |
| Mapping AI → khoa   | 38; primary `sp_1`/`sp_2` → Nội TQ, `sp_4` → Ngoại TQ, `sp_21` → Ngoại tim mạch |


**Không đổi so với DB map:** `G2.4.34/35` là Khám sức khỏe; nhiều phòng là `PROCEDURE_ROOM` (thủ thuật); `G2.4.30–32` là thủ thuật Da liễu.

---



## 1. Khu vực (Area)


| STT | `areaCode` | `areaLabel`                     | Số logical room                 |
| --- | ---------- | ------------------------------- | ------------------------------- |
| 1   | `CLS`      | Khu Cận lâm sàng                | 8                               |
| 2   | `DERM`     | Khu khám Da liễu                | 3                               |
| 3   | `OPH`      | Khu khám mắt                    | 5                               |
| 4   | `ORTH`     | Khu khám Chấn thương Chỉnh hình | 6                               |
| 5   | `PED_INT`  | Khu khám Nội - Nhi              | 32 (gồm Nhà thuốc)              |
| 6   | `SUR`      | Khu khám ngoại                  | 17                              |
| —   | *(null)*   | Không gán Area                  | 4 logical + 3 physical tiện ích |


DB **không** có Area `INDEPENDENT` như file cũ.

---



## 2. Phòng chi tiết theo khu vực

Cột **Khoa hiện tại** = DB sau phase 2. Cột **Khoa đề xuất** giữ CSV để đối chiếu.

### 2.1 Khu Cận lâm sàng (`CLS`)


| STT | Physical | Tên physical                           | Logical room                                 | `room_type`              | Khoa hiện tại | Khoa đề xuất | Mã AI |
| --- | -------- | -------------------------------------- | -------------------------------------------- | ------------------------ | ------------- | ------------ | ----- |
| 1   | `G2.3.1` | Chẩn đoán hình ảnh 1 (X-Quang)         | Phòng Chẩn đoán hình ảnh 1 (X-Quang)         | `IMAGING_ROOM`           | —             | —            | —     |
| 2   | `G2.3.2` | Chẩn đoán hình ảnh 2 (Siêu âm)         | Phòng Chẩn đoán hình ảnh 2 (Siêu âm)         | `IMAGING_ROOM`           | —             | —            | —     |
| 3   | `G2.3.3` | Chẩn đoán hình ảnh 3 (MRI)             | Phòng Chẩn đoán hình ảnh 3 (MRI)             | `IMAGING_ROOM`           | —             | —            | —     |
| 4   | `G2.3.4` | Chẩn đoán hình ảnh 4 (CT-Scanner)      | Phòng Chẩn đoán hình ảnh 4 (CT-Scanner)      | `IMAGING_ROOM`           | —             | —            | —     |
| 5   | `G2.3.5` | Thăm dò chức năng 1 (Điện tâm đồ)      | Phòng Thăm dò chức năng 1 (Điện tâm đồ)      | `FUNCTIONAL_EXPLORATION` | —             | —            | —     |
| 6   | `G2.3.6` | Thăm dò chức năng 2 (Chức năng hô hấp) | Phòng Thăm dò chức năng 2 (Chức năng hô hấp) | `FUNCTIONAL_EXPLORATION` | —             | —            | —     |
| 7   | `G2.3.7` | Thăm dò chức năng 3 (Holter tim mạch)  | Phòng Thăm dò chức năng 3 (Holter tim mạch)  | `FUNCTIONAL_EXPLORATION` | —             | —            | —     |
| 8   | `G2.3.8` | Xét nghiệm sinh hóa                    | Phòng Xét nghiệm sinh hóa                    | `LABORATORY`             | —             | —            | —     |




### 2.2 Khu khám Da liễu (`DERM`)


| STT | Physical       | Tên physical        | Logical room              | `room_type`      | Khoa hiện tại | Khoa đề xuất | Mã AI  |
| --- | -------------- | ------------------- | ------------------------- | ---------------- | ------------- | ------------ | ------ |
| 1   | `G2.1.EMPTY_2` | Phòng trống 2       | *(không tạo logical)*     | `N/A`            | —             | —            | —      |
| 2   | `G2.4.30`      | Thủ thuật Da liễu 1 | Phòng thủ thuật Da liễu 1 | `PROCEDURE_ROOM` | Da liễu       | Da liễu      | `sp_9` |
| 3   | `G2.4.31`      | Thủ thuật Da liễu 2 | Phòng thủ thuật Da liễu 2 | `PROCEDURE_ROOM` | Da liễu       | Da liễu      | `sp_9` |
| 4   | `G2.4.32`      | Thủ thuật Da liễu 3 | Phòng thủ thuật Da liễu 3 | `PROCEDURE_ROOM` | Da liễu       | Da liễu      | `sp_9` |


File cũ ghi 4.30–4.32 là phòng khám lâm sàng. **DB hiện tại là thủ thuật** — giữ nguyên.

### 2.3 Khu khám mắt (`OPH`)


| STT | Physical       | Tên physical    | Logical room          | `room_type`      | Khoa hiện tại | Khoa đề xuất | Mã AI  |
| --- | -------------- | --------------- | --------------------- | ---------------- | ------------- | ------------ | ------ |
| 1   | `G2.1.EMPTY_1` | Phòng trống 1   | *(không tạo logical)* | `N/A`            | —             | —            | —      |
| 2   | `G2.4.7`       | Thủ thuật Mắt 1 | Phòng thủ thuật Mắt 1 | `PROCEDURE_ROOM` | Mắt           | Mắt          | `sp_7` |
| 3   | `G2.4.8`       | Mắt 1           | Phòng Mắt 1           | `CLINICAL_ROOM`  | Mắt           | Mắt          | `sp_7` |
| 4   | `G2.4.9`       | Thủ thuật Mắt 2 | Phòng thủ thuật Mắt 2 | `PROCEDURE_ROOM` | Mắt           | Mắt          | `sp_7` |
| 5   | `G2.4.10`      | Thủ thuật Mắt 3 | Phòng thủ thuật Mắt 3 | `PROCEDURE_ROOM` | Mắt           | Mắt          | `sp_7` |
| 6   | `G2.4.11`      | Mắt 2           | Phòng Mắt 2           | `CLINICAL_ROOM`  | Mắt           | Mắt          | `sp_7` |




### 2.4 Khu khám Chấn thương Chỉnh hình (`ORTH`)

Da liễu lâm sàng nằm **trong Area ORTH** trên bản đồ (không chuyển Area).


| STT | Physical | Tên physical                     | Logical room                           | `room_type`      | Khoa hiện tại          | Khoa đề xuất           | Mã AI  |
| --- | -------- | -------------------------------- | -------------------------------------- | ---------------- | ---------------------- | ---------------------- | ------ |
| 1   | `G2.4.1` | Chấn thương chỉnh hình 1         | Phòng Chấn thương chỉnh hình 1         | `CLINICAL_ROOM`  | Chấn thương Chỉnh hình | Chấn thương chỉnh hình | `sp_6` |
| 2   | `G2.4.2` | Chấn thương chỉnh hình 2         | Phòng Chấn thương chỉnh hình 2         | `CLINICAL_ROOM`  | Chấn thương Chỉnh hình | Chấn thương chỉnh hình | `sp_6` |
| 3   | `G2.4.3` | Thủ thuật Chấn thương Chỉnh hình | Phòng thủ thuật Chấn thương Chỉnh hình | `PROCEDURE_ROOM` | Chấn thương Chỉnh hình | Chấn thương chỉnh hình | `sp_6` |
| 4   | `G2.4.4` | Da liễu 1                        | Phòng Da liễu 1                        | `CLINICAL_ROOM`  | Da liễu                | Da liễu                | `sp_9` |
| 5   | `G2.4.5` | Da liễu 2                        | Phòng Da liễu 2                        | `CLINICAL_ROOM`  | Da liễu                | Da liễu                | `sp_9` |
| 6   | `G2.4.6` | Da liễu 3                        | Phòng Da liễu 3                        | `CLINICAL_ROOM`  | Da liễu                | Da liễu                | `sp_9` |




### 2.5 Khu khám Nội - Nhi (`PED_INT`)


| STT | Physical        | Tên physical           | Logical room                 | `room_type`      | Khoa hiện tại | Khoa đề xuất                  | Mã AI            |
| --- | --------------- | ---------------------- | ---------------------------- | ---------------- | ------------- | ----------------------------- | ---------------- |
| 1   | `G2.1.PHARMACY` | Nhà Thuốc / Quầy Thuốc | Phòng Nhà Thuốc / Quầy Thuốc | `PHARMACY`       | —             | —                             | —                |
| 2   | `G2.2.5`        | Thủ thuật Nội khoa 1   | Phòng thủ thuật Nội khoa 1   | `PROCEDURE_ROOM` | Nội tổng quát | Nội tổng quát                 | `sp_1`, `sp_2`   |
| 3   | `G2.2.6`        | Nội tim mạch 1         | Phòng Nội tim mạch 1         | `CLINICAL_ROOM`  | Nội tim mạch  | Nội tim mạch                  | `sp_12`          |
| 4   | `G2.2.7`        | Nội tim mạch 2         | Phòng Nội tim mạch 2         | `CLINICAL_ROOM`  | Nội tim mạch  | Nội tim mạch                  | `sp_12`          |
| 5   | `G2.2.8`        | Nội tim mạch 3         | Phòng Nội tim mạch 3         | `CLINICAL_ROOM`  | Nội tim mạch  | Nội tim mạch                  | `sp_12`          |
| 6   | `G2.2.9`        | Nội tim mạch 4         | Phòng Nội tim mạch 4         | `CLINICAL_ROOM`  | Nội tim mạch  | Nội tim mạch                  | `sp_12`          |
| 7   | `G2.2.10`       | Nội tim mạch 5         | Phòng Nội tim mạch 5         | `CLINICAL_ROOM`  | Nội tim mạch  | Nội tim mạch                  | `sp_12`          |
| 8   | `G2.2.11`       | Nội cơ xương khớp      | Phòng Nội cơ xương khớp      | `CLINICAL_ROOM`  | Cơ xương khớp | Nội cơ xương khớp *(giữ CXK)* | `sp_20`          |
| 9   | `G2.2.12`       | Tim mạch can thiệp 1   | Phòng Tim mạch can thiệp 1   | `CLINICAL_ROOM`  | Ngoại tim mạch | Ngoại tim mạch               | `sp_21`          |
| 10  | `G2.2.13`       | Tim mạch can thiệp 2   | Phòng Tim mạch can thiệp 2   | `CLINICAL_ROOM`  | Ngoại tim mạch | Ngoại tim mạch               | `sp_21`          |
| 11  | `G2.2.14`       | Nội tiết 1             | Phòng Nội tiết 1             | `CLINICAL_ROOM`  | Nội tiết      | Nội tiết                      | `sp_10`, `sp_22` |
| 12  | `G2.2.15`       | Nội tiết 2             | Phòng Nội tiết 2             | `CLINICAL_ROOM`  | Nội tiết      | Nội tiết                      | `sp_10`, `sp_22` |
| 13  | `G2.2.16`       | Nội tiết 3             | Phòng Nội tiết 3             | `CLINICAL_ROOM`  | Nội tiết      | Nội tiết                      | `sp_10`, `sp_22` |
| 14  | `G2.2.17`       | Thủ thuật Nội khoa 2   | Phòng thủ thuật Nội khoa 2   | `PROCEDURE_ROOM` | Nội tổng quát | Nội tổng quát                 | `sp_1`, `sp_2`   |
| 15  | `G2.2.18`       | Nội tổng quát 1        | Phòng Nội tổng quát 1        | `CLINICAL_ROOM`  | Nội tổng quát | Nội tổng quát                 | `sp_1`, `sp_2`   |
| 16  | `G2.2.19`       | Nội tổng quát 2        | Phòng Nội tổng quát 2        | `CLINICAL_ROOM`  | Nội tổng quát | Nội tổng quát                 | `sp_1`, `sp_2`   |
| 17  | `G2.2.20`       | Nội tổng quát 3        | Phòng Nội tổng quát 3        | `CLINICAL_ROOM`  | Nội tổng quát | Nội tổng quát                 | `sp_1`, `sp_2`   |
| 18  | `G2.2.21`       | Thủ thuật Nội khoa 3   | Phòng thủ thuật Nội khoa 3   | `PROCEDURE_ROOM` | Nội tổng quát | Nội tổng quát                 | `sp_1`, `sp_2`   |
| 19  | `G2.2.22`       | Nội thần kinh 1        | Phòng Nội thần kinh 1        | `CLINICAL_ROOM`  | Nội TK        | Nội TK                        | `sp_17`          |
| 20  | `G2.2.23`       | Nội thần kinh 2        | Phòng Nội thần kinh 2        | `CLINICAL_ROOM`  | Nội TK        | Nội TK                        | `sp_17`          |
| 21  | `G2.2.24`       | Bệnh truyền nhiễm      | Phòng Bệnh truyền nhiễm      | `CLINICAL_ROOM`  | Truyền nhiễm  | Truyền nhiễm                  | `sp_19`          |
| 22  | `G2.2.25`       | Nội thận               | Phòng Nội thận               | `CLINICAL_ROOM`  | Thận học      | Thận học                      | `sp_24`          |
| 23  | `G2.2.26`       | Nội tiêu hóa 1         | Phòng Nội tiêu hóa 1         | `CLINICAL_ROOM`  | Tiêu hóa      | Tiêu hóa                      | `sp_5`           |
| 24  | `G2.2.27`       | Nội tiêu hóa 2         | Phòng Nội tiêu hóa 2         | `CLINICAL_ROOM`  | Tiêu hóa      | Tiêu hóa                      | `sp_5`           |
| 25  | `G2.2.28`       | Nội hô hấp 1           | Phòng Nội hô hấp 1           | `CLINICAL_ROOM`  | Hô hấp        | Hô hấp                        | `sp_27`          |
| 26  | `G2.2.32`       | Thủ thuật Nội khoa 4   | Phòng thủ thuật Nội khoa 4   | `PROCEDURE_ROOM` | Nội tổng quát | Nội tổng quát                 | `sp_1`, `sp_2`   |
| 27  | `G2.2.33`       | Sức khỏe tâm thần      | Phòng Sức khỏe tâm thần      | `CLINICAL_ROOM`  | Tâm thần      | Tâm thần                      | `sp_16`          |
| 28  | `G2.2.34`       | Nhi 1                  | Phòng Nhi 1                  | `CLINICAL_ROOM`  | Nhi khoa      | Nhi khoa                      | `sp_3`, `sp_26`  |
| 29  | `G2.2.35`       | Nhi 2                  | Phòng Nhi 2                  | `CLINICAL_ROOM`  | Nhi khoa      | Nhi khoa                      | `sp_3`, `sp_26`  |
| 30  | `G2.2.40`       | Huyết học              | Phòng Huyết học              | `CLINICAL_ROOM`  | Huyết học     | Huyết học                     | `sp_25`          |
| 31  | `G2.2.41`       | Thủ thuật Nội khoa 5   | Phòng thủ thuật Nội khoa 5   | `PROCEDURE_ROOM` | Nội tổng quát | Nội tổng quát                 | `sp_1`, `sp_2`   |




### 2.6 Khu khám ngoại (`SUR`)


| STT | Physical  | Tên physical           | Logical room                 | `room_type`      | Khoa hiện tại     | Khoa đề xuất    | Mã AI            |
| --- | --------- | ---------------------- | ---------------------------- | ---------------- | ----------------- | --------------- | ---------------- |
| 1   | `G2.4.12` | Ngoại tổng quát 1      | Phòng Ngoại tổng quát 1      | `CLINICAL_ROOM`  | Ngoại tổng quát   | Ngoại tổng quát | `sp_4`           |
| 2   | `G2.4.13` | Thủ thuật Ngoại khoa 1 | Phòng thủ thuật Ngoại khoa 1 | `PROCEDURE_ROOM` | Ngoại tổng quát   | Ngoại tổng quát | `sp_4`           |
| 3   | `G2.4.14` | Ngoại tiết niệu        | Phòng Ngoại tiết niệu        | `CLINICAL_ROOM`  | Tiết niệu         | Tiết niệu       | `sp_11`          |
| 4   | `G2.4.15` | Ngoại lồng ngực        | Phòng Ngoại lồng ngực        | `CLINICAL_ROOM`  | Ngoại lồng ngực   | Ngoại lồng ngực | `sp_4`           |
| 5   | `G2.4.16` | Ngoại thần kinh 1      | Phòng Ngoại thần kinh 1      | `CLINICAL_ROOM`  | Ngoại TK          | Ngoại TK        | `sp_4`           |
| 6   | `G2.4.17` | Ngoại thần kinh 2      | Phòng Ngoại thần kinh 2      | `CLINICAL_ROOM`  | Ngoại TK          | Ngoại TK        | `sp_4`           |
| 7   | `G2.4.18` | Ngoại ung bướu         | Phòng Ngoại ung bướu         | `CLINICAL_ROOM`  | Ung bướu          | Ung bướu        | `sp_13`          |
| 8   | `G2.4.19` | Thủ thuật Ngoại khoa 2 | Phòng thủ thuật Ngoại khoa 2 | `PROCEDURE_ROOM` | Ngoại tổng quát   | Ngoại tổng quát | `sp_4`           |
| 9   | `G2.4.20` | Thủ thuật Ngoại khoa 3 | Phòng thủ thuật Ngoại khoa 3 | `PROCEDURE_ROOM` | Ngoại tổng quát   | Ngoại tổng quát | `sp_4`           |
| 10  | `G2.4.21` | Phụ khoa               | Phòng Phụ khoa               | `CLINICAL_ROOM`  | Sản phụ khoa      | Sản phụ khoa    | `sp_15`          |
| 11  | `G2.4.22` | Thủ thuật Ngoại khoa 4 | Phòng thủ thuật Ngoại khoa 4 | `PROCEDURE_ROOM` | Ngoại tổng quát   | Ngoại tổng quát | `sp_4`           |
| 12  | `G2.4.23` | Khám thai 1            | Phòng Khám thai 1            | `CLINICAL_ROOM`  | Sản phụ khoa      | Sản phụ khoa    | `sp_15`          |
| 13  | `G2.4.24` | Tai mũi họng 1         | Phòng Tai mũi họng 1         | `CLINICAL_ROOM`  | Tai Mũi Họng      | Tai mũi họng    | `sp_14`          |
| 14  | `G2.4.25` | Tai mũi họng 2         | Phòng Tai mũi họng 2         | `CLINICAL_ROOM`  | Tai Mũi Họng      | Tai mũi họng    | `sp_14`          |
| 15  | `G2.4.26` | Thủ thuật Ngoại khoa 5 | Phòng thủ thuật Ngoại khoa 5 | `PROCEDURE_ROOM` | Ngoại tổng quát   | Ngoại tổng quát | `sp_4`           |
| 16  | `G2.4.28` | Răng hàm mặt 1         | Phòng Răng hàm mặt 1         | `CLINICAL_ROOM`  | Răng Hàm Mặt      | Răng hàm mặt    | `sp_18`, `sp_29` |
| 17  | `G2.4.29` | Răng hàm mặt 2         | Phòng Răng hàm mặt 2         | `CLINICAL_ROOM`  | Răng Hàm Mặt      | Răng hàm mặt    | `sp_18`, `sp_29` |


CSV map Ngoại thần kinh → `sp_4` (Surgeon), không phải `sp_17`.

### 2.7 Không thuộc Area


| STT | Physical           | Tên physical    | Logical room          | `room_type`      | Khoa hiện tại | Khoa đề xuất    | Mã AI  |
| --- | ------------------ | --------------- | --------------------- | ---------------- | ------------- | --------------- | ------ |
| 1   | `G2.1.ELEVATORS`   | Khu Thang Máy   | *(không tạo logical)* | `N/A`            | —             | —               | —      |
| 2   | `G2.1.STAIRS`      | Cầu Thang Bộ    | *(không tạo logical)* | `N/A`            | —             | —               | —      |
| 3   | `G2.1.WC`          | Nhà Vệ Sinh     | *(không tạo logical)* | `N/A`            | —             | —               | —      |
| 4   | `G2.1.RECEPTION_A` | Sảnh Tiếp Đón A | Phòng Sảnh Tiếp Đón A | `RECEPTION`      | —             | —               | —      |
| 5   | `G2.1.RECEPTION_B` | Sảnh Tiếp Đón B | Phòng Sảnh Tiếp Đón B | `RECEPTION`      | —             | —               | —      |
| 6   | `G2.4.34`          | Khám sức khỏe 1 | Phòng Khám sức khỏe 1 | `CLINICAL_ROOM`  | Đa khoa       | **Giữ Đa khoa** | `sp_1` |
| 7   | `G2.4.35`          | Khám sức khỏe 2 | Phòng Khám sức khỏe 2 | `CLINICAL_ROOM`  | Đa khoa       | **Giữ Đa khoa** | `sp_1` |
| 8   | `G2.4.40`          | Thủ thuật       | Phòng Thủ thuật       | `PROCEDURE_ROOM` | —             | —               | —      |


CSV ghi `G2.4.34` là Đơn vị tiêm chủng. **DB là Khám sức khỏe — không đổi.** `sp_1` primary trỏ Nội tổng quát; hai phòng này vẫn Đa khoa (mapping phụ).

---



## 3. Khoa CSV chưa có phòng trên tầng 1


| Khoa                   | `specialty_code` | Ghi chú                              |
| ---------------------- | ---------------- | ------------------------------------ |
| Vật lý trị liệu - PHCN | `VLTL_PHCN`      | CSV: `G2.6.1`, `sp_20` (mapping phụ) |
| Y học cổ truyền        | `YHCT`           | CSV: `G2.7.1`, chưa có mã AI         |


---



## 4. Catalog AI_Specialty và mapping

Primary = khoa auto-booking dùng sau phase 2. Mapping phụ vẫn giữ để admin đổi.

Cột **Phòng khám** = các `CLINICAL_ROOM` đang gắn khoa **primary** trên DB (không gồm phòng thủ thuật).


| `ai_code` | Tên AI | Tên AI (VI) | Primary (khoa BV) | Mapping phụ | Phòng khám |
| --------- | ------ | ----------- | ----------------- | ----------- | ---------- |
| `sp_1` | General Practitioner | Bác sĩ đa khoa | **Nội tổng quát** (`NOI_TONG_QUAT`) | Đa khoa (`SP_1`) | `G2.2.18` Nội tổng quát 1; `G2.2.19` Nội tổng quát 2; `G2.2.20` Nội tổng quát 3 |
| `sp_2` | Internal Medicine Specialist | Bác sĩ nội khoa | **Nội tổng quát** (`NOI_TONG_QUAT`) | Nội khoa (`SP_2`) | `G2.2.18` Nội tổng quát 1; `G2.2.19` Nội tổng quát 2; `G2.2.20` Nội tổng quát 3 |
| `sp_3` | Pediatrician | Bác sĩ nhi khoa | Nhi khoa (`SP_3`) | — | `G2.2.34` Nhi 1; `G2.2.35` Nhi 2 |
| `sp_4` | Surgeon | Bác sĩ ngoại khoa | **Ngoại tổng quát** (`NGOAI_TONG_QUAT`) | Ngoại khoa, Ngoại TK, Ngoại lồng ngực | `G2.4.12` Ngoại tổng quát 1 |
| `sp_5` | Gastroenterologist | Bác sĩ tiêu hóa | Tiêu hóa (`SP_5`) | — | `G2.2.26` Nội tiêu hóa 1; `G2.2.27` Nội tiêu hóa 2 |
| `sp_6` | Orthopedist | Bác sĩ CTCH | Chấn thương Chỉnh hình (`SP_6`) | — | `G2.4.1` CTCH 1; `G2.4.2` CTCH 2 |
| `sp_7` | Ophthalmologist | Bác sĩ mắt | Mắt (`SP_7`) | — | `G2.4.8` Mắt 1; `G2.4.11` Mắt 2 |
| `sp_8` | Toxicologist | Bác sĩ chống độc | **Nội tổng quát** (`NOI_TONG_QUAT`) | — | `G2.2.18` Nội tổng quát 1; `G2.2.19` Nội tổng quát 2; `G2.2.20` Nội tổng quát 3 |
| `sp_9` | Dermatologist | Bác sĩ da liễu | Da liễu (`SP_9`) | — | `G2.4.4` Da liễu 1; `G2.4.5` Da liễu 2; `G2.4.6` Da liễu 3 |
| `sp_10` | Endocrinologist | Bác sĩ nội tiết | Nội tiết (`SP_10`) | — | `G2.2.14` Nội tiết 1; `G2.2.15` Nội tiết 2; `G2.2.16` Nội tiết 3 |
| `sp_11` | Urologist | Bác sĩ tiết niệu | Tiết niệu (`SP_11`) | — | `G2.4.14` Ngoại tiết niệu |
| `sp_12` | Cardiologist | Bác sĩ tim mạch | Nội tim mạch (`SP_12`) | — | `G2.2.6`–`G2.2.10` Nội tim mạch 1–5 |
| `sp_13` | Oncologist | Bác sĩ ung bướu | Ung bướu (`SP_13`) | — | `G2.4.18` Ngoại ung bướu |
| `sp_14` | ENT doctor | Bác sĩ tai mũi họng | Tai Mũi Họng (`SP_14`) | — | `G2.4.24` Tai mũi họng 1; `G2.4.25` Tai mũi họng 2 |
| `sp_15` | Gynecologist | Bác sĩ phụ khoa | Sản phụ khoa (`SP_15`) | — | `G2.4.21` Phụ khoa; `G2.4.23` Khám thai 1 |
| `sp_16` | Psychiatrist | Bác sĩ tâm thần | Tâm thần (`SP_16`) | — | `G2.2.33` Sức khỏe tâm thần |
| `sp_17` | Neurologist | Bác sĩ thần kinh | Nội TK (`SP_17`) | — | `G2.2.22` Nội thần kinh 1; `G2.2.23` Nội thần kinh 2 |
| `sp_18` | Dentist | Bác sĩ răng hàm mặt | Răng Hàm Mặt (`SP_18`) | — | `G2.4.28` Răng hàm mặt 1; `G2.4.29` Răng hàm mặt 2 |
| `sp_19` | Infectologist | Bác sĩ truyền nhiễm | Truyền nhiễm (`SP_19`) | — | `G2.2.24` Bệnh truyền nhiễm |
| `sp_20` | Rheumatologist | Bác sĩ cơ xương khớp | Cơ xương khớp (`SP_20`) | VLTL-PHCN | `G2.2.11` Nội cơ xương khớp |
| `sp_21` | Angiologist | Bác sĩ mạch máu | **Ngoại tim mạch** (`NGOAI_TIM_MACH`) | Mạch máu (`SP_21`) | `G2.2.12` Tim mạch can thiệp 1; `G2.2.13` Tim mạch can thiệp 2 |
| `sp_22` | Diabetologist | Bác sĩ đái tháo đường | **Nội tiết** (`SP_10`) | — | `G2.2.14` Nội tiết 1; `G2.2.15` Nội tiết 2; `G2.2.16` Nội tiết 3 |
| `sp_23` | Allergist | Bác sĩ dị ứng | **Da liễu** (`SP_9`) | — | `G2.4.4` Da liễu 1; `G2.4.5` Da liễu 2; `G2.4.6` Da liễu 3 |
| `sp_24` | Nephrologist | Bác sĩ thận học | Thận học (`SP_24`) | — | `G2.2.25` Nội thận |
| `sp_25` | Hematologist | Bác sĩ huyết học | Huyết học (`SP_25`) | — | `G2.2.40` Huyết học |
| `sp_26` | Neonatologist | Bác sĩ sơ sinh | **Nhi khoa** (`SP_3`) | — | `G2.2.34` Nhi 1; `G2.2.35` Nhi 2 |
| `sp_27` | Pulmonologist | Bác sĩ hô hấp | Hô hấp (`SP_27`) | — | `G2.2.28` Nội hô hấp 1 |
| `sp_29` | Maxillofacial surgeon | Bác sĩ phẫu thuật hàm mặt | **Răng Hàm Mặt** (`SP_18`) | — | `G2.4.28` Răng hàm mặt 1; `G2.4.29` Răng hàm mặt 2 |


Không có `sp_28` trên DB.

Admin CRUD: `GET/POST /ai-specialty`, `PATCH/DELETE /ai-specialty/:id`, `GET/POST /ai-specialty/:id/mappings`, `PATCH/DELETE /ai-specialty/:id/mappings/:mappingId`. Xóa mapping đang primary → tự chọn mapping active còn lại (sort_order, createdAt).

---



## 5. Khoa chỉ có trên DB (CSV không liệt kê)

Giữ trong `Specialty`: Đa khoa (2 phòng Khám sức khỏe), Mạch máu, Nội khoa (`SP_2`: 0 room), Ngoại khoa (`SP_4`: 0 room). Không soft-disable ô dùm.

Đã xóa (gộp vào khoa có phòng): Đái tháo đường → Nội tiết, Chống độc → Nội tổng quát, Dị ứng → Da liễu, Sơ sinh → Nhi khoa, Phẫu thuật Hàm Mặt → Răng Hàm Mặt. Catalog AI (`sp_8`/`sp_22`/`sp_23`/`sp_26`/`sp_29`) vẫn giữ, chỉ đổi primary.

---

## 6. Phase 2 — đã làm (14/08/2026)

Script: `npx tsx prisma/seed-phase2-remap.seed.ts` (idempotent).

- 19 Room đổi `specialty_id` theo bảng remap (không sửa map).
- 19 Staff (DOCTOR có ca) đổi theo khoa phòng sau remap. 2 bác sĩ có ca lệch khoa: majority wins (Phạm Quốc Bảo giữ Nội tim mạch; Hoàng Đức Anh → Ngoại tim mạch).
- Primary: `sp_1`/`sp_2` → Nội tổng quát, `sp_4` → Ngoại tổng quát, `sp_21` → Ngoại tim mạch.
- `G2.4.34/35` Khám sức khỏe **không** chuyển.

## 7. Gộp khoa trống (14/08/2026)

Script: `npx tsx prisma/seed-merge-empty-specialties.seed.ts`.

| Khoa xóa | Primary AI mới |
| :--- | :--- |
| Đái tháo đường `SP_22` | `sp_22` → Nội tiết |
| Chống độc `SP_8` | `sp_8` → Nội tổng quát |
| Dị ứng `SP_23` | `sp_23` → Da liễu |
| Sơ sinh `SP_26` | `sp_26` → Nhi khoa |
| Phẫu thuật Hàm Mặt `SP_29` | `sp_29` → Răng Hàm Mặt |

Staff gắn khoa cũ đã chuyển sang khoa đích trước khi xóa (tránh cascade xóa Staff).

---

