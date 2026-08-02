# OPD4.svg Feature Mapping Specification

Bảng ánh xạ các đối tượng đồ họa trong `OPD4.svg` tới các thực thể trong Cơ sở dữ liệu (Prisma Schema).

---

## 1. Thông số Kỹ thuật Bản đồ & Lối vào chính Tầng 1 (Floor Metadata & Floor Main Entrance)

| Thuộc tính SVG | Giá trị trong SVG | Ánh xạ CSDL (`Floor` / `Door` / `Boundary`) | Ghi chú |
| :--- | :--- | :--- | :--- |
| `viewBox` | `0 0 8054.23 10452.28` | | Kích thước khung nhìn SVG |
| `rect#area-Floor` | `x=112.59, y=126.57` <br> `w=7829.06, h=10043.83` | `widthMeters = 78.29` <br> `heightMeters = 100.44` | Ranh giới tầng (Floor 1) |
| Tỉ lệ quy đổi | `100 units = 1 meter` | `scalePixelsPerMeter = 100` | Gốc tọa độ Cartesian: <br> `SVG_X_OFFSET = 112.59` <br> `SVG_Y_OFFSET = 10170.40` |
| Tòa nhà / Tầng | Floor 1 | `floorNumber = 1` | Thuộc `Tòa G2 – Khoa Khám Bệnh` |
| **`rect#floor-entrance`** | `x=6657.43, y=10078.49` <br> `w=1284.21, h=91.91` | **`Door` (Tọa độ Point tại trung điểm $X=71.87m, Y=0.46m$)** <br> + **`Boundary` kiểu `DOOR`/`OPEN` (Đoạn thẳng rộng 12.84m: $X_1=65.45m \rightarrow X_2=78.29m$)** | **Lối vào chính Tầng 1 (Floor Main Entrance)** với **chiều rộng lớn 12.84 mét** thực tế theo SVG, nằm tại khoảng mở phía Đông Nam của `wall-surround`. |
| **`polyline#wall-surround`** | `6657.43 10170.4 ... 7941.65 10170.4` | **`Boundary` (`boundaryType = WALL`)** | Tường bao ngoài tòa nhà Tầng 1 |

---

## 2. Ánh xạ Khu vực Clinics & Tường bao Khu (`Area` & Area Walls)

| Tên nhóm trong SVG (`id`) | Tên hiển thị (`data-name`) | `areaCode` | `areaLabel` | Tường bao khu vực (SVG Wall Element) |
| :--- | :--- | :--- | :--- | :--- |
| `Khu_khám_mắt` | Khu khám mắt | `OPH` | Khu khám mắt | `polygon#Clinic_wall` |
| `Khu_khám_ngoại` | Khu khám ngoại | `SUR` | Khu khám ngoại | `rect#Clinic_wall-2` |
| `Khu_khám_CTCH` | Khu khám CTCH | `ORTH` | Khu khám Chấn thương Chỉnh hình | `polygon#Clinic_wall-3` |
| `Khu_khám_da_liễu` | Khu khám da liễu | `DERM` | Khu khám Da liễu | `polygon#wall-surround-2` |
| `Khu_khám_Nội-Nhi` | Khu khám Nội-Nhi | `PED_INT` | Khu khám Nội - Nhi | `polygon#wall-2` <br> + **`line#wall-separate`** |
| `Khu_cận_lâm_sàng` | Khu cận lâm sàng | `CLS` | Khu Cận lâm sàng | `rect#Wall` |

---

## 3. Danh sách Cửa lẻ / Cửa Khu vực không thuộc Phòng (`Area Non-Room Doors`)

Danh sách các cửa khu vực/liên khu (không thuộc bất kỳ phòng khám riêng lẻ nào), được lưu vết thành `Door` và tạo ranh giới `Boundary` loại `DOOR` của `Area` tương ứng:

| STT | Mã Cửa trong SVG (`id`) | `data-name` trong SVG | Khu vực (`Area`) | Kích thước / Vị trí trong SVG | Mô tả chức năng |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | `door2` | (rỗng) | `OPH` (Khu khám mắt) | `x=4664.29, y=6147.15, w=180, h=20` (rộng 1.8m) | Cửa ngõ lối vào Khu khám Mắt (Bắc) |
| 2 | `door2_-_nối_khu_khám_ngoại_và_khu_khám_mắt` | door2 - nối khu khám ngoại và khu khám mắt | `SUR` / `OPH` | `x=4135.29, y=6262.16, w=20, h=180` (rộng 1.8m) | Cửa liên khu nối Khu Ngoại và Khu Mắt |
| 3 | `door2-2` | door2 | `SUR` (Khu khám ngoại) | `x=1850.23, y=6147.15, w=180, h=20` (rộng 1.8m) | Cửa lối vào 1 Khu khám Ngoại (Tây) |
| 4 | `door2-3` | door2 | `SUR` (Khu khám ngoại) | `x=3320.87, y=6147.15, w=180, h=20` (rộng 1.8m) | Cửa lối vào 2 Khu khám Ngoại (Đông) |
| 5 | `door2-4` | door2 | `ORTH` (Khu khám CTCH) | `x=6673.29, y=8239.61, w=20, h=180` (rộng 1.8m) | Cửa lối vào Khu khám CTCH |
| 6 | `door2-5` | door2 | `CLS` (Khu Cận lâm sàng) | `x=4390.29, y=2820.00, w=20, h=180` (rộng 1.8m) | Cửa lối vào Khu Cận lâm sàng 1 |
| 7 | `door2-6` | door2 | `CLS` (Khu Cận lâm sàng) | `x=4390.29, y=3480.00, w=20, h=180` (rộng 1.8m) | Cửa lối vào Khu Cận lâm sàng 2 |
| 8 | `door2.4` | (rỗng) | `PED_INT` (Nhà thuốc Nội-Nhi) | `x=2584.31, y=2255.51, w=20, h=180` (rộng 1.8m) | Cửa quầy / Lối vào Nhà thuốc trong Khu Nội-Nhi |
| 9 | `door2.3` | (rỗng) | `PED_INT` (Khu Nội-Nhi) | `x=4871.31, y=3741.57, w=180, h=20` (rộng 1.8m) | Cửa lối vào phía Nam Khu Nội-Nhi |
| 10 | `door2.2` | (rỗng) | `PED_INT` (Khu Nội-Nhi) | `x=3294.31, y=1829.57, w=180, h=20` (rộng 1.8m) | Cửa vách ngăn phía Bắc 2 Khu Nội-Nhi |
| 11 | `door2.1` | (rỗng) | `PED_INT` (Khu Nội-Nhi) | `x=4871.31, y=1829.57, w=180, h=20` (rộng 1.8m) | Cửa vách ngăn phía Bắc 1 Khu Nội-Nhi |
| 12 | `door1.2` | (rỗng) | `PED_INT` (Khu Nội-Nhi) | `x=7308.31, y=244.07, w=20, h=100` (rộng 1.0m) | Cửa phụ góc Đông-Bắc Khu Nội-Nhi |
| 13 | `door1.1` | (rỗng) | `PED_INT` (Khu Nội-Nhi) | `x=1029.31, y=1608.07, w=20, h=100` (rộng 1.0m) | Cửa phụ góc Tây-Nam Khu Nội-Nhi |

---

## 4. Ánh xạ Phòng chức năng & Lâm sàng (`PhysicalRoom`)

### 4.1 Phòng khám theo mã phòng (Dựa trên `room-list.md` & `new room.md`)

| Nhóm SVG (`id`) | Mã phòng CSDL (`roomCode`) | Tên phòng (`roomLabel`) | Khu vực (`Area`) | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `_2.5` - `_2.41` | `G2.2.xx` (vd: `G2.2.35`) | Nhi 2, Sức khỏe tâm thần, Nội tim mạch,... | `PED_INT` | Khám Nội - Nhi |
| `_3.1` - `_3.8` | `G2.3.1` - `G2.3.8` | X-Quang, Siêu âm, MRI, CT-Scanner, ECG, Phế dung ký, Holter, Xét nghiệm | `CLS` | Khu Cận lâm sàng mới |
| `_4.1` - `_4.6` | `G2.4.1` - `G2.4.6` | CTCH 1, CTCH 2, Da liễu 1-3 | `ORTH` / `DERM` | Chấn thương Chỉnh hình / Da liễu |
| `_4.7` - `_4.11` | `G2.4.7` - `G2.4.11` | Mắt 1, Mắt 2,... | `OPH` | Khu Khám mắt |
| `_4.12` - `_4.29` | `G2.4.12` - `G2.4.29` | Ngoại tổng quát, Ngoại thần kinh, RHM,... | `SUR` | Khu Khám ngoại |
| `_4.30` - `_4.32` | `G2.4.30` - `G2.4.32` | Phòng khám Da liễu / Da | `DERM` | Khu Khám Da liễu |
| `_4.34`, `_4.35` | `G2.4.34`, `G2.4.35` | Đơn vị tiêm chủng / Khám dịch vụ | Độc lập | |
| `Proceduce_room` | `G2.4.40` | Thủ thuật | Độc lập | Phòng thủ thuật |

### 4.2 Tiện ích và Phòng đặc thù (Utility Rooms)

| Element SVG (`id`) | `roomCode` | `roomLabel` | Ghi chú |
| :--- | :--- | :--- | :--- |
| `rect#Pharmacy-2` | `G2.1.PHARMACY` | Nhà Thuốc / Quầy Thuốc | Nằm trong Khu Nội-Nhi |
| `g#Reception_A` | `G2.1.RECEPTION_A` | Sảnh Tiếp Đón A | Sảnh tiếp đón A (Bắc) |
| `g#Reception_B` | `G2.1.RECEPTION_B` | Sảnh Tiếp Đón B | Sảnh tiếp đón B (Nam) |
| `rect#WC` | `G2.1.WC` | Nhà Vệ Sinh | Khu WC Tầng 1 |
| `rect#Stairs` | `G2.1.STAIRS` | Cầu Thang Bộ | Kết nối Tầng 1 - Tầng 2 |
| `rect#Elevators` | `G2.1.ELEVATORS` | Khu Thang Máy | Thang máy Tòa G2 |
| `rect#empty_room` | `G2.1.EMPTY_1` | Phòng trống 1 | Thuộc Khu khám mắt |
| `rect#empty_room-2` | `G2.1.EMPTY_2` | Phòng trống 2 | Thuộc Khu khám da liễu |

---

## 5. Quy trình Chuyển đổi Tọa độ (Cartesian Transformation)

Thuật toán chuyển đổi từ hệ tọa độ màn hình SVG $(X_{svg}, Y_{svg})$ sang Hệ tọa độ phẳng Cartesian $(X_m, Y_m)$ tính bằng Mét:

$$X_m = \frac{X_{svg} - 112.59}{100}$$

$$Y_m = \frac{10170.40 - Y_{svg}}{100}$$

Sau đó ánh xạ sang PostGIS WKT `Point`, `LineString`, `Polygon` (EPSG:4326) theo chuẩn Lon/Lat quy định sẵn.
