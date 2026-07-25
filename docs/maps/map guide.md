# Hướng dẫn Quản lý Bản đồ & Đồ thị Dẫn đường (Map & Navigation Guide)

Tài liệu này hướng dẫn cách dọn dẹp dữ liệu, chạy seed bản đồ, sinh đồ thị dẫn đường (Nodes/Edges) và quản lý bộ nhớ đệm (Cache) cho hệ thống chỉ đường 3D của TriageFlowOPD.

---

## 📌 Các ID Cố định (Fixed IDs)

Để đồng bộ giữa Backend, Database và Frontend, các thực thể chính luôn sử dụng ID cố định:
*   **Building ID**: `17854b86-79d1-4c60-b776-784742c2597e` (Tòa G2 – Khoa Khám Bệnh)
*   **Floor ID (Tầng 1)**: `00b03ef8-7702-4b08-a07e-ec887432453c`

---

## 1. Dọn dẹp Database & Chạy Seed Bản đồ (Map Seeding)

Khi bạn muốn làm sạch toàn bộ dữ liệu bản đồ cũ để cập nhật từ file SVG mới (`OPD2.svg`):

### Thực hiện qua dòng lệnh:
Chạy lệnh sau từ thư mục gốc của project:
```bash
npx ts-node -r tsconfig-paths/register prisma/Map-3.0.seed.ts
```

### Cách hoạt động:
Script seed sẽ tự động thực hiện các thao tác:
1.  **Dọn sạch dữ liệu cũ**: Tự động gỡ bỏ các ràng buộc khóa ngoại tạm thời ở các bảng liên quan như `Shift`, `Step` và tiến hành xóa theo tầng từ dưới lên: `Edge` ➔ `Node` ➔ `Poi` ➔ `PlacedFeature` ➔ `Boundary` ➔ `Door` ➔ `PhysicalRoom` ➔ `Area` ➔ `Floor` ➔ `Building`.
2.  **Tạo mới với ID cố định**: Tạo lại Tòa nhà G2 và Tầng 1 với đúng các ID ở phần 📌.
3.  **Import SVG**: Phân tích file SVG để tạo phòng clinic, các cửa (doors) và các đường bao tường.

---

## 2. Tự động Sinh Đồ thị Dẫn đường (Graph Generation)

Sau khi chạy seed, database chỉ mới lưu cấu trúc hình học vật lý của bản đồ (Tường, Phòng, Cửa) chứ **chưa có các nút dẫn đường**. Bạn cần chạy thuật toán sinh đồ thị (MPRSSEM v3) để tạo ra các Node hành lang và các Edge kết nối.

Có 2 cách thực hiện:

### Cách 1: Gọi API qua HTTP (Khuyên dùng)
Gửi yêu cầu HTTP POST bằng Postman hoặc curl (yêu cầu quyền Admin):
*   **Method**: `POST`
*   **URL**: `http://localhost:3000/api/navigation/graph/00b03ef8-7702-4b08-a07e-ec887432453c/generate`
*   **Headers**: 
    - `Authorization: Bearer <ADMIN_JWT_TOKEN>`

### Cách 2: Chạy script CLI tạm thời
Tạo file `src/run-graph-gen.ts` với nội dung khởi tạo NestJS context, sau đó thực thi qua command line:
```bash
npx ts-node -r tsconfig-paths/register src/run-graph-gen.ts
```
*(Hệ thống sẽ sinh ra **222 nodes** và **422 edges** kết nối an toàn cách tường $\ge 0.55m$)*.

---

## 3. Quản lý Bộ nhớ đệm (Cache Invalidation)

Hệ thống lưu cấu trúc bản đồ (Building Map Layout) vào bộ nhớ đệm Redis để tối ưu tốc độ tải. 

*   **Tự động**: Mỗi khi bạn gọi API sinh đồ thị (ở mục 2), hệ thống sẽ **tự động xóa cache** của tòa nhà đó.
*   **Thủ công**: Nếu bạn muốn xóa cache thủ công qua Redis CLI:
    ```redis
    DEL building_map:17854b86-79d1-4c60-b776-784742c2597e
    ```

---

## 4. Kiểm tra Trực quan trên Bản đồ 3D (3D Map Verification)

Sau khi hoàn thành các bước trên, bạn hãy truy cập trực tiếp bằng trình duyệt để kiểm tra mô hình 3D, mạng lưới các nút đi lại và các cạnh tím phát sáng:

👉 **Đường dẫn kiểm tra**:  
[http://localhost:3000/api/navigation/building/00b03ef8-7702-4b08-a07e-ec887432453c/3d](http://localhost:3000/api/navigation/building/00b03ef8-7702-4b08-a07e-ec887432453c/3d)
