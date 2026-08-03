# Chi tiết Bản đồ Tòa nhà & Danh sách Phòng theo Khu vực (OPD4.svg)

Tài liệu này tổng hợp toàn bộ các khu vực (`Area`), phòng vật lý (`PhysicalRoom`), phòng nghiệp vụ (`Room`) và chuyên khoa (`Specialty`) trên sơ đồ Tầng 1 Tòa nhà G2 (Khối Khám Bệnh).

---

## 📌 Thông tin Tổng quan Tòa nhà & Tầng 1

- **Tòa nhà**: Tòa G2 – Khoa Khám Bệnh (`id: 17854b86-79d1-4c60-b776-784742c2597e`)
- **Tầng**: Tầng 1 (`id: 00b03ef8-7702-4b08-a07e-ec887432453c`)
- **File bản đồ**: `OPD4.svg`
- **Tổng số Khu vực (`Area`)**: 6 khu vực chính
- **Tổng số Phòng Vật lý (`PhysicalRoom`)**: 80 phòng
- **Tổng số Phòng Nghiệp vụ (`Room` - Logical Room)**: 75 phòng (đã đồng bộ 100%)

---

## 1. Tổng quan Danh sách các Khu vực (Areas Summary)

| STT | Mã Khu vực (`areaCode`) | Tên Khu vực (`areaLabel`) | Số lượng Phòng | Mô tả chức năng |
| :-: | :--- | :--- | :-: | :--- |
| 1 | `CLS` | Khu Cận lâm sàng | 8 phòng | Các phòng khám/xét nghiệm thuộc Khu Cận lâm sàng |
| 2 | `DERM` | Khu khám Da liễu | 4 phòng | Các phòng khám/xét nghiệm thuộc Khu khám Da liễu |
| 3 | `OPH` | Khu khám mắt | 6 phòng | Các phòng khám/xét nghiệm thuộc Khu khám mắt |
| 4 | `ORTH` | Khu khám Chấn thương Chỉnh hình | 6 phòng | Các phòng khám/xét nghiệm thuộc Khu khám Chấn thương Chỉnh hình |
| 5 | `PED_INT` | Khu khám Nội - Nhi | 31 phòng | Các phòng khám/xét nghiệm thuộc Khu khám Nội - Nhi |
| 6 | `SUR` | Khu khám ngoại | 17 phòng | Các phòng khám/xét nghiệm thuộc Khu khám ngoại |
| 7 | `INDEPENDENT` | Khu vực Độc lập & Tiện ích | 8 phòng | Sảnh tiếp đón, quầy thuốc, thủ thuật, thang máy, WC |

---

## 2. Danh sách Phòng chi tiết theo từng Khu vực

### 2.1 Khu Cận lâm sàng (Mã khu: `CLS` - 8 phòng)

| STT | Mã Physical Room | Tên Physical Room | Tên Logical Room | Loại phòng (`room_type`) | Chuyên khoa | Ghi chú / Chức năng |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `G2.3.1` | Chẩn đoán hình ảnh 1 (X-Quang) | Phòng Chẩn đoán hình ảnh 1 (X-Quang) | `IMAGING_ROOM` | — | Phòng Cận lâm sàng / Thăm dò |
| 2 | `G2.3.2` | Chẩn đoán hình ảnh 2 (Siêu âm) | Phòng Chẩn đoán hình ảnh 2 (Siêu âm) | `IMAGING_ROOM` | — | Phòng Cận lâm sàng / Thăm dò |
| 3 | `G2.3.3` | Chẩn đoán hình ảnh 3 (MRI) | Phòng Chẩn đoán hình ảnh 3 (MRI) | `IMAGING_ROOM` | — | Phòng Cận lâm sàng / Thăm dò |
| 4 | `G2.3.4` | Chẩn đoán hình ảnh 4 (CT-Scanner) | Phòng Chẩn đoán hình ảnh 4 (CT-Scanner) | `IMAGING_ROOM` | — | Phòng Cận lâm sàng / Thăm dò |
| 5 | `G2.3.5` | Thăm dò chức năng 1 (Điện tâm đồ) | Phòng Thăm dò chức năng 1 (Điện tâm đồ) | `FUNCTIONAL_EXPLORATION` | — | Phòng Cận lâm sàng / Thăm dò |
| 6 | `G2.3.6` | Thăm dò chức năng 2 (Chức năng hô hấp) | Phòng Thăm dò chức năng 2 (Chức năng hô hấp) | `FUNCTIONAL_EXPLORATION` | — | Phòng Cận lâm sàng / Thăm dò |
| 7 | `G2.3.7` | Thăm dò chức năng 3 (Holter tim mạch) | Phòng Thăm dò chức năng 3 (Holter tim mạch) | `FUNCTIONAL_EXPLORATION` | — | Phòng Cận lâm sàng / Thăm dò |
| 8 | `G2.3.8` | Xét nghiệm sinh hóa | Phòng Xét nghiệm sinh hóa | `LABORATORY` | — | Phòng Cận lâm sàng / Thăm dò |

### 2.2 Khu khám Da liễu (Mã khu: `DERM` - 4 phòng)

| STT | Mã Physical Room | Tên Physical Room | Tên Logical Room | Loại phòng (`room_type`) | Chuyên khoa | Ghi chú / Chức năng |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `G2.1.EMPTY_2` | Phòng trống 2 | _(Không tạo Logical Room)_ | `N/A` | — | Phòng trống dự phòng |
| 2 | `G2.4.30` | Phòng 4.30 | Phòng 4.30 | `CLINICAL_ROOM` | Da liễu | Phòng khám lâm sàng |
| 3 | `G2.4.31` | Phòng 4.31 | Phòng 4.31 | `CLINICAL_ROOM` | Da liễu | Phòng khám lâm sàng |
| 4 | `G2.4.32` | Phòng 4.32 | Phòng 4.32 | `CLINICAL_ROOM` | Da liễu | Phòng khám lâm sàng |

### 2.3 Khu khám mắt (Mã khu: `OPH` - 6 phòng)

| STT | Mã Physical Room | Tên Physical Room | Tên Logical Room           | Loại phòng (`room_type`) | Chuyên khoa | Ghi chú / Chức năng  |
| :---:| :-----------------| :------------------| :---------------------------| :-------------------------| :------------| :---------------------|
| 1   | `G2.1.EMPTY_1`   | Phòng trống 1     | _(Không tạo Logical Room)_ | `N/A`                    | —           | Phòng trống dự phòng |
| 2   | `G2.4.10`        | Phòng 4.10        | Phòng 4.10                 | `CLINICAL_ROOM`          | Mắt         | Phòng khám lâm sàng  |
| 3   | `G2.4.11`        | Mắt 2             | Phòng Mắt 2                | `CLINICAL_ROOM`          | Mắt         | Phòng khám lâm sàng  |
| 4   | `G2.4.7`         | Phòng 4.7         | Phòng 4.7                  | `CLINICAL_ROOM`          | Mắt         | Phòng khám lâm sàng  |
| 5   | `G2.4.8`         | Mắt 1             | Phòng Mắt 1                | `CLINICAL_ROOM`          | Mắt         | Phòng khám lâm sàng  |
| 6   | `G2.4.9`         | Phòng 4.9         | Phòng 4.9                  | `CLINICAL_ROOM`          | Mắt         | Phòng khám lâm sàng  |

### 2.4 Khu khám Chấn thương Chỉnh hình (Mã khu: `ORTH` - 6 phòng)

| STT | Mã Physical Room | Tên Physical Room | Tên Logical Room | Loại phòng (`room_type`) | Chuyên khoa | Ghi chú / Chức năng |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `G2.4.1` | Chấn thương chỉnh hình 1 | Phòng Chấn thương chỉnh hình 1 | `CLINICAL_ROOM` | Chấn thương Chỉnh hình | Phòng khám lâm sàng |
| 2 | `G2.4.2` | Chấn thương chỉnh hình 2 | Phòng Chấn thương chỉnh hình 2 | `CLINICAL_ROOM` | Chấn thương Chỉnh hình | Phòng khám lâm sàng |
| 3 | `G2.4.3` | Phòng 4.3 | Phòng 4.3 | `CLINICAL_ROOM` | Chấn thương Chỉnh hình | Phòng khám lâm sàng |
| 4 | `G2.4.4` | Da liễu 1 | Phòng Da liễu 1 | `CLINICAL_ROOM` | Da liễu | Phòng khám lâm sàng |
| 5 | `G2.4.5` | Da liễu 2 | Phòng Da liễu 2 | `CLINICAL_ROOM` | Da liễu | Phòng khám lâm sàng |
| 6 | `G2.4.6` | Da liễu 3 | Phòng Da liễu 3 | `CLINICAL_ROOM` | Da liễu | Phòng khám lâm sàng |

### 2.5 Khu khám Nội - Nhi (Mã khu: `PED_INT` - 31 phòng)

| STT | Mã Physical Room | Tên Physical Room | Tên Logical Room | Loại phòng (`room_type`) | Chuyên khoa | Ghi chú / Chức năng |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `G2.1.PHARMACY` | Nhà Thuốc / Quầy Thuốc | Phòng Nhà Thuốc / Quầy Thuốc | `PHARMACY` | — | Phòng khám lâm sàng |
| 2 | `G2.2.10` | Nội tim mạch 5 | Phòng Nội tim mạch 5 | `CLINICAL_ROOM` | Tim mạch | Phòng khám lâm sàng |
| 3 | `G2.2.11` | Nội cơ xương khớp | Phòng Nội cơ xương khớp | `CLINICAL_ROOM` | Cơ xương khớp | Phòng khám lâm sàng |
| 4 | `G2.2.12` | Tim mạch can thiệp 1 | Phòng Tim mạch can thiệp 1 | `CLINICAL_ROOM` | Tim mạch | Phòng khám lâm sàng |
| 5 | `G2.2.13` | Tim mạch can thiệp 2 | Phòng Tim mạch can thiệp 2 | `CLINICAL_ROOM` | Tim mạch | Phòng khám lâm sàng |
| 6 | `G2.2.14` | Nội tiết 1 | Phòng Nội tiết 1 | `CLINICAL_ROOM` | Nội tiết | Phòng khám lâm sàng |
| 7 | `G2.2.15` | Nội tiết 2 | Phòng Nội tiết 2 | `CLINICAL_ROOM` | Nội tiết | Phòng khám lâm sàng |
| 8 | `G2.2.16` | Nội tiết 3 | Phòng Nội tiết 3 | `CLINICAL_ROOM` | Nội tiết | Phòng khám lâm sàng |
| 9 | `G2.2.17` | Phòng 2.17 | Phòng 2.17 | `CLINICAL_ROOM` | Nội khoa | Phòng khám lâm sàng |
| 10 | `G2.2.18` | Nội tổng quát 1 | Phòng Nội tổng quát 1 | `CLINICAL_ROOM` | Nội khoa | Phòng khám lâm sàng |
| 11 | `G2.2.19` | Nội tổng quát 2 | Phòng Nội tổng quát 2 | `CLINICAL_ROOM` | Nội khoa | Phòng khám lâm sàng |
| 12 | `G2.2.20` | Nội tổng quát 3 | Phòng Nội tổng quát 3 | `CLINICAL_ROOM` | Nội khoa | Phòng khám lâm sàng |
| 13 | `G2.2.21` | Phòng 2.21 | Phòng 2.21 | `CLINICAL_ROOM` | Nội khoa | Phòng khám lâm sàng |
| 14 | `G2.2.22` | Nội thần kinh 1 | Phòng Nội thần kinh 1 | `CLINICAL_ROOM` | Thần kinh | Phòng khám lâm sàng |
| 15 | `G2.2.23` | Nội thần kinh 2 | Phòng Nội thần kinh 2 | `CLINICAL_ROOM` | Thần kinh | Phòng khám lâm sàng |
| 16 | `G2.2.24` | Bệnh truyền nhiễm | Phòng Bệnh truyền nhiễm | `CLINICAL_ROOM` | Truyền nhiễm | Phòng khám lâm sàng |
| 17 | `G2.2.25` | Nội thận | Phòng Nội thận | `CLINICAL_ROOM` | Thận học | Phòng khám lâm sàng |
| 18 | `G2.2.26` | Nội tiêu hóa 1 | Phòng Nội tiêu hóa 1 | `CLINICAL_ROOM` | Tiêu hóa | Phòng khám lâm sàng |
| 19 | `G2.2.27` | Nội tiêu hóa 2 | Phòng Nội tiêu hóa 2 | `CLINICAL_ROOM` | Tiêu hóa | Phòng khám lâm sàng |
| 20 | `G2.2.28` | Nội hô hấp 1 | Phòng Nội hô hấp 1 | `CLINICAL_ROOM` | Hô hấp | Phòng khám lâm sàng |
| 21 | `G2.2.32` | Phòng 2.32 | Phòng 2.32 | `CLINICAL_ROOM` | Nội khoa | Phòng khám lâm sàng |
| 22 | `G2.2.33` | Sức khỏe tâm thần | Phòng Sức khỏe tâm thần | `CLINICAL_ROOM` | Tâm thần | Phòng khám lâm sàng |
| 23 | `G2.2.34` | Nhi 1 | Phòng Nhi 1 | `CLINICAL_ROOM` | Nhi khoa | Phòng khám lâm sàng |
| 24 | `G2.2.35` | Nhi 2 | Phòng Nhi 2 | `CLINICAL_ROOM` | Nhi khoa | Phòng khám lâm sàng |
| 25 | `G2.2.40` | Huyết học | Phòng Huyết học | `CLINICAL_ROOM` | Huyết học | Phòng khám lâm sàng |
| 26 | `G2.2.41` | Phòng 2.41 | Phòng 2.41 | `CLINICAL_ROOM` | Nội khoa | Phòng khám lâm sàng |
| 27 | `G2.2.5` | Phòng 2.5 | Phòng 2.5 | `CLINICAL_ROOM` | Nội khoa | Phòng khám lâm sàng |
| 28 | `G2.2.6` | Nội tim mạch 1 | Phòng Nội tim mạch 1 | `CLINICAL_ROOM` | Tim mạch | Phòng khám lâm sàng |
| 29 | `G2.2.7` | Nội tim mạch 2 | Phòng Nội tim mạch 2 | `CLINICAL_ROOM` | Tim mạch | Phòng khám lâm sàng |
| 30 | `G2.2.8` | Nội tim mạch 3 | Phòng Nội tim mạch 3 | `CLINICAL_ROOM` | Tim mạch | Phòng khám lâm sàng |
| 31 | `G2.2.9` | Nội tim mạch 4 | Phòng Nội tim mạch 4 | `CLINICAL_ROOM` | Tim mạch | Phòng khám lâm sàng |

### 2.6 Khu khám ngoại (Mã khu: `SUR` - 17 phòng)

| STT | Mã Physical Room | Tên Physical Room | Tên Logical Room | Loại phòng (`room_type`) | Chuyên khoa | Ghi chú / Chức năng |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `G2.4.12` | Ngoại tổng quát 1 | Phòng Ngoại tổng quát 1 | `CLINICAL_ROOM` | Ngoại khoa | Phòng khám lâm sàng |
| 2 | `G2.4.13` | Phòng 4.13 | Phòng 4.13 | `CLINICAL_ROOM` | Ngoại khoa | Phòng khám lâm sàng |
| 3 | `G2.4.14` | Ngoại tiết niệu | Phòng Ngoại tiết niệu | `CLINICAL_ROOM` | Tiết niệu | Phòng khám lâm sàng |
| 4 | `G2.4.15` | Ngoại lồng ngực | Phòng Ngoại lồng ngực | `CLINICAL_ROOM` | Ngoại khoa | Phòng khám lâm sàng |
| 5 | `G2.4.16` | Ngoại thần kinh 1 | Phòng Ngoại thần kinh 1 | `CLINICAL_ROOM` | Thần kinh | Phòng khám lâm sàng |
| 6 | `G2.4.17` | Ngoại thần kinh 2 | Phòng Ngoại thần kinh 2 | `CLINICAL_ROOM` | Thần kinh | Phòng khám lâm sàng |
| 7 | `G2.4.18` | Ngoại ung bướu | Phòng Ngoại ung bướu | `CLINICAL_ROOM` | Ung bướu | Phòng khám lâm sàng |
| 8 | `G2.4.19` | Phòng 4.19 | Phòng 4.19 | `CLINICAL_ROOM` | Ngoại khoa | Phòng khám lâm sàng |
| 9 | `G2.4.20` | Phòng 4.20 | Phòng 4.20 | `CLINICAL_ROOM` | Ngoại khoa | Phòng khám lâm sàng |
| 10 | `G2.4.21` | Phụ khoa | Phòng Phụ khoa | `CLINICAL_ROOM` | Phụ khoa | Phòng khám lâm sàng |
| 11 | `G2.4.22` | Phòng 4.22 | Phòng 4.22 | `CLINICAL_ROOM` | Ngoại khoa | Phòng khám lâm sàng |
| 12 | `G2.4.23` | Khám thai 1 | Phòng Khám thai 1 | `CLINICAL_ROOM` | Phụ khoa | Phòng khám lâm sàng |
| 13 | `G2.4.24` | Tai mũi họng 1 | Phòng Tai mũi họng 1 | `CLINICAL_ROOM` | Tai Mũi Họng | Phòng khám lâm sàng |
| 14 | `G2.4.25` | Tai mũi họng 2 | Phòng Tai mũi họng 2 | `CLINICAL_ROOM` | Tai Mũi Họng | Phòng khám lâm sàng |
| 15 | `G2.4.26` | Phòng 4.26 | Phòng 4.26 | `CLINICAL_ROOM` | Ngoại khoa | Phòng khám lâm sàng |
| 16 | `G2.4.28` | Răng hàm mặt 1 | Phòng Răng hàm mặt 1 | `CLINICAL_ROOM` | Răng Hàm Mặt | Phòng khám lâm sàng |
| 17 | `G2.4.29` | Răng hàm mặt 2 | Phòng Răng hàm mặt 2 | `CLINICAL_ROOM` | Răng Hàm Mặt | Phòng khám lâm sàng |

### 2.7 Khu vực Độc lập & Tiện ích Tầng 1 (`INDEPENDENT` - 8 phòng)

| STT | Mã Physical Room | Tên Physical Room | Tên Logical Room | Loại phòng (`room_type`) | Chuyên khoa | Ghi chú / Chức năng |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `G2.1.ELEVATORS` | Khu Thang Máy | _(Không tạo Logical Room)_ | `N/A` | — | Khu vực tiện ích / kỹ thuật |
| 2 | `G2.1.RECEPTION_A` | Sảnh Tiếp Đón A | Phòng Sảnh Tiếp Đón A | `RECEPTION` | — | Sảnh tiếp đón bệnh nhân |
| 3 | `G2.1.RECEPTION_B` | Sảnh Tiếp Đón B | Phòng Sảnh Tiếp Đón B | `RECEPTION` | — | Sảnh tiếp đón bệnh nhân |
| 4 | `G2.1.STAIRS` | Cầu Thang Bộ | _(Không tạo Logical Room)_ | `N/A` | — | Khu vực tiện ích / kỹ thuật |
| 5 | `G2.1.WC` | Nhà Vệ Sinh | _(Không tạo Logical Room)_ | `N/A` | — | Khu vực tiện ích / kỹ thuật |
| 6 | `G2.4.34` | Đơn vị tiêm chủng | Phòng Đơn vị tiêm chủng | `CLINICAL_ROOM` | Đa khoa | Đơn vị tiêm chủng / khám DV |
| 7 | `G2.4.35` | Phòng 4.35 | Phòng 4.35 | `CLINICAL_ROOM` | Đa khoa | Đơn vị tiêm chủng / khám DV |
| 8 | `G2.4.40` | Thủ thuật | Phòng Thủ thuật | `PROCEDURE_ROOM` | — | Phòng làm thủ thuật |
