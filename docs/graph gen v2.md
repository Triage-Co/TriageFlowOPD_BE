# Quy trình Sinh Đồ thị Điều hướng InMap (Node & Edge Generation Pipeline)

Tài liệu này đặc tả quy trình thuật toán tự động (deterministic pipeline) của hệ
thống InMap nhằm chuyển đổi các dạng hình học không gian 2D tĩnh
(`floor_feature`) thành một mạng lưới đồ thị điều hướng động (Navigation Graph)
bao gồm các điểm nút (`nav_node`) và các cạnh chỉ đường (`nav_edge`).

---

## 1. Ánh xạ Thực thể (Entity Mappings)

Hệ thống duy trì sự tách biệt tuyệt đối giữa **Lớp hiển thị đồ họa**
(Visualization/3D) và **Lớp logic đồ thị** (Pathfinding Graph). Các yếu tố vật
lý sẽ được ánh xạ thành các Node và Edge cụ thể:

| Thực thể vật lý (`floor_feature`) | Điểm nút sinh ra (`nav_node`)   | Cạnh kết nối (`nav_edge`) |
| :-------------------------------- | :------------------------------ | :------------------------ |
| `door` (Cửa ra vào)               | `node_type = door` (Trung điểm) | `edge_type = walk`        |
| `connector` (Thang liên tầng)     | `node_type = stair              | elevator`                 | `edge_type = stair              | elevator` |
| _Không gian hành lang_ (Corridor) | `node_type = corridor_point     | junction`                 | `edge_type = walk` (Trục chính) |

_(Lưu ý: Các đa giác (Polygon) đại diện cho phòng ốc `room` được cố ý loại bỏ
khỏi đồ thị để giảm tải bộ nhớ và ngăn chặn triệt để lỗi đường đi đâm xuyên
tường. Mọi chỉ dẫn đều kết thúc tại Cửa)._

---

## 2. Chi tiết Thuật toán Sinh Đồ Thị (Algorithmic Pipeline)

### Bước 1: Trích xuất Điểm nút cứng (Discrete Node Extraction)

Trích xuất các tọa độ toán học tĩnh từ các cấu trúc ranh giới vật lý.

1. **Tính toán Nút Cửa (Door Midpoint Resolution):** Với mỗi đối tượng `door`
   giao cắt với ranh giới không gian:
   - Tính toán trung điểm hình học $(X_m, Y_m)$ của đoạn thẳng đại diện cho cửa.
   - Lưu tọa độ này thành một `nav_node` với thuộc tính `node_type = door`.
2. **Đồng bộ Nút Liên tầng (Vertical Connector Synchronization):** Với mỗi cụm
   kết nối đa tầng (Thang bộ, Thang máy):
   - Khởi tạo Nút neo (Anchor nodes) tại tọa độ không gian cục bộ $(x, y, z)$.
   - Gán loại nút: `node_type = stair_entry`, `stair_exit`, hoặc
     `elevator_point`.

---

### Bước 2: Hình học hóa Hành lang (Corridor Skeletonization)

Hành lang không có đa giác cố định mà là phần "không gian âm" còn lại của tòa
nhà. Hệ thống sử dụng phương pháp **Sơ đồ Voronoi (Medial Axis Transform)** để
giải quyết.

1. **Trích xuất Vùng có thể đi lại (Walkable Area):** Áp dụng phép trừ Boolean
   (CSG) trên không gian 2D:
   $$\text{Walkable\_Zone} = \text{Floor\_Bounding\_Box} \setminus \bigcup (\text{All\_Static\_Space\_Polygons})$$
2. **Sinh trục xương sống (Voronoi Skeletonization):** Chạy thuật toán **Voronoi
   Diagram** lên các đỉnh của $\text{Walkable\_Zone}$. Lọc bỏ các nhánh thừa đâm
   vào tường, chỉ giữ lại các đường nằm chính giữa và cách đều các bức tường hai
   bên (Centerlines).
3. **Lấy mẫu đồ thị (Graph Sampling):**
   - **Ngã rẽ (Intersections):** Tạo Nút `junction` tại các tọa độ giao nhau của
     3 cạnh Voronoi trở lên.
   - **Điểm neo (Linear Sampling):** Rải các điểm `corridor_point` dọc theo trục
     Centerlines theo một khoảng cách cố định $\Delta d$ (ví dụ: cứ 3.0 mét sinh
     1 node).

---

### Bước 3: Thuật toán Nối cạnh và Ràng buộc (Topology Interconnection)

Kiến tạo các mối quan hệ cấu trúc giữa các Nút vừa sinh.

1. **Bám sát trục hành lang (Orthogonal Raycasting):**
   - Từ mỗi Nút Cửa (`door`), hệ thống bắn một tia vuông góc 90 độ (Raycast)
     thẳng ra vùng hành lang.
   - Bắt lấy điểm giao cắt giữa tia này và "Trục xương sống Voronoi" hoặc
     `corridor_point` gần nhất.
   - Sinh ra một cạnh `nav_edge` nối liền Cửa và Trục hành lang. (Thuật toán này
     đảm bảo rẽ vào phòng luôn là góc vuông, không đâm chéo qua góc tường).
2. **Khâu vá đồ thị liên tầng (Vertical Graph Stitching):**
   - Dựa vào mã nhóm ID của cụm kết nối (Connector Group).
   - Nối `elevator_point` tại $\text{Tầng}_n$ với `elevator_point` tại
     $\text{Tầng}_{n+1}$ bằng các đoạn thẳng đứng mang thuộc tính
     `edge_type = elevator`.

---

### Bước 4: Tối ưu Trọng số & Hàm Chi phí (Cost & Weight Calculation)

Mỗi cạnh (Edge) phải được tính toán chi phí (Cost) trước khi nạp vào cache để
thuật toán $A^*$ tìm đường tối ưu nhất.

1. **Tính khoảng cách không gian (Euclidean Distance):** Khoảng cách theo pixel
   giữa Nút Start ($N_s$) và Nút End ($N_e$):
   $$Distance_{\text{pixel}} = \sqrt{(x_e - x_s)^2 + (y_e - y_s)^2}$$
2. **Quy đổi chuẩn SI (Metric Standardization):** Chuyển đổi kích thước ảo sang
   đơn vị mét (m) thực tế dựa trên hệ số của bản vẽ ($scaleFactor$):
   $$Distance_{\text{real}} = Distance_{\text{pixel}} \times scaleFactor$$
3. **Phân bổ Trọng số Phạt (Heuristic Penalty):** Tổng chi phí di chuyển
   ($\text{Cost}$) được cộng thêm trọng số độ khó bề mặt ($\omega$):
   $$\text{Cost} = Distance_{\text{real}} + \omega_{\text{modifier}}$$
   - Đường đi bằng phẳng (`edge_type = walk`): $\omega_{\text{modifier}} = 0$
   - Thang bộ (`edge_type = stair`):
     $\omega_{\text{modifier}} = \text{Penalty}_{\text{stair}}$ (Phạt điểm vì
     gây mất sức).
   - Thang máy (`edge_type = elevator`):
     $\omega_{\text{modifier}} = \text{Penalty}_{\text{wait\_time}}$ (Phạt điểm
     vì phải chờ đợi cơ học).
4. **Lưu trữ CSDL (Database Mapping):** Ghi các giá trị `distance` và `cost` vừa
   tính trực tiếp vào Database.

---

## 3. Quá trình Biên dịch Bộ nhớ (Runtime Compilation)

Mỗi khi Quản trị viên (Admin) lưu bản đồ (Trigger thao tác `SAVE`):

1. Backend NestJS đọc toàn bộ tập dữ liệu quan hệ `nav_node` và `nav_edge` mới
   nhất.
2. Hệ thống biên dịch chúng thành **Danh sách Kề (In-Memory Adjacency List)** và
   nạp trực tiếp lên RAM.
3. Trạng thái đồ thị "Sống" này sẽ luôn sẵn sàng tiếp nhận các truy vấn tìm
   đường $A^*$ của người dùng với độ trễ chỉ tính bằng micro-giây
   (Microsecond-latency).
