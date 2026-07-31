# Hướng Dẫn Sử Dụng API Module Medicine (Quản Lý Danh Mục Thuốc)

Lệnh chạy CLI độc lập: `npx ts-node prisma/medicine.seed.ts`

Tài liệu này hướng dẫn chi tiết các API quản lý thuốc, seed dữ liệu mẫu và lấy thông tin phục vụ bộ lọc FE.

---

## 1. Danh Sách API Details

### A. Khởi Tạo & Seed Dữ Liệu

#### 1. Seed danh mục 20 loại thuốc OPD phổ biến
- **Method**: `POST`
- **Path**: `/medicine/seed`
- **Roles**: `ADMIN`, `PHARMACIST`
- **Mô tả**: Tự động chèn/cập nhật 20 loại thuốc phổ biến tại Việt Nam (Paracetamol, Amoxicillin, Augmentin, Ibuprofen, Omeprazole, Smecta, Berberin, Panadol...) vào DB.
- **Response (201 Created)**:
```json
{
  "message": "Đã seed thành công 20 loại thuốc cơ bản vào cơ sở dữ liệu.",
  "count": 20,
  "data": [ ... ]
}
```

#### 2. Tạo hàng loạt nhiều loại thuốc (Bulk Import)
- **Method**: `POST`
- **Path**: `/medicine/bulk`
- **Roles**: `PHARMACIST`, `ADMIN`
- **Request Body**:
```json
{
  "medicines": [
    {
      "medicine_code": "MED-TEST-01",
      "medicine_name": "Thuốc Test 01",
      "active_ingredient": "Test",
      "unit": "Viên",
      "usage_route": "Uống",
      "unit_price": 10000,
      "manufacturer": "Công ty Test"
    }
  ]
}
```

---

### B. Dropdown Metadata Cho FE

#### 1. Lấy danh sách các đường dùng thuốc
- **Method**: `GET`
- **Path**: `/medicine/routes`
- **Roles**: All Authenticated Users
- **Response (200 OK)**:
```json
{
  "data": [
    "Uống",
    "Tiêm",
    "Bôi",
    "Ngậm dưới lưỡi",
    "Xịt họng"
  ]
}
```

#### 2. Lấy danh sách các hoạt chất thuốc
- **Method**: `GET`
- **Path**: `/medicine/active-ingredients`
- **Roles**: All Authenticated Users
- **Response (200 OK)**:
```json
{
  "data": [
    "Paracetamol",
    "Amoxicillin",
    "Ibuprofen",
    "Omeprazole",
    "Loratadine"
  ]
}
```

---

### C. Quản Lý Thuốc (CRUD & Status)

#### 1. Tra cứu danh sách thuốc
- **Method**: `GET`
- **Path**: `/medicine?search=paracetamol&is_active=true&page=1&limit=20`
- **Roles**: All Authenticated Users

#### 2. Xem chi tiết 1 loại thuốc
- **Method**: `GET`
- **Path**: `/medicine/:id`
- **Roles**: All Authenticated Users

#### 3. Tạo 1 loại thuốc mới
- **Method**: `POST`
- **Path**: `/medicine`
- **Roles**: `PHARMACIST`, `ADMIN`, `DOCTOR`

#### 4. Cập nhật loại thuốc
- **Method**: `PATCH`
- **Path**: `/medicine/:id`
- **Roles**: `PHARMACIST`, `ADMIN`

#### 5. Vô hiệu hóa (Soft delete) thuốc
- **Method**: `DELETE`
- **Path**: `/medicine/:id`
- **Roles**: `PHARMACIST`, `ADMIN`

#### 6. Khôi phục loại thuốc
- **Method**: `PATCH`
- **Path**: `/medicine/:id/restore`
- **Roles**: `PHARMACIST`, `ADMIN`
