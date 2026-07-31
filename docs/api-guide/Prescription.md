# Hướng Dẫn Sử Dụng API Module Prescription & Medicine

Tài liệu này cung cấp chi tiết quy trình nghiệp vụ, sơ đồ chuyển trạng thái và tài liệu tham khảo API cho 2 module **Prescription** (Đơn thuốc) và **Medicine** (Danh mục thuốc) thuộc hệ thống **TriageFlowOPD_BE**.

---

## 1. Tổng Quan Nghiệp Vụ & Sơ Đồ Chuyển Trạng Thái

### Kiến trúc liên kết dữ liệu
- **`Prescription`** kết nối **1-1** với **`Service_Order`** qua `service_order_id`.
- **`Prescription`** kết nối **1-1 / 0-1** với **`Visit_Session`** qua `visit_session_id`.
- **`Prescription`** chứa nhiều chi tiết **`Prescription_Detail`**, liên kết tới **`Medicine`**.

### Vòng đời trạng thái đơn thuốc (`PrescriptionStatusEnum`)

```
[ PENDING ] ──(Thanh toán Online / Offline)──> [ PROCESSING ]
     │                                               │
     ├──(Quá 24h không thanh toán)                   ├──(Nhà thuốc soạn xong)
     ▼                                               ▼
[ EXPIRED ]                                    [ PREPARED ]
                                                     │
                                                     ├──(Giao thuốc cho bệnh nhân)
                                                     ▼
                                                [ DISPENSED ]
```

1. **`PENDING`**: Bác sĩ vừa kê đơn xong. Bệnh nhân chưa thanh toán.
2. **`PROCESSING`**: Đã thanh toán (Online qua PayOS hoặc Offline tiền mặt tại quầy). Nhà thuốc bắt đầu soạn thuốc.
3. **`PREPARED`**: Nhà thuốc soạn thuốc xong. Tự động gửi **Notification** cho Bệnh nhân tới quầy nhận thuốc.
4. **`DISPENSED`**: Dược sĩ giao thuốc thành công. Cập nhật `Service_Order.status = COMPLETED` và gửi **Notification** hoàn thành cho Bệnh nhân.
5. **`EXPIRED`**: Quá 24h bệnh nhân không thanh toán/đến lấy thuốc (được quét tự động bởi Cron Service).
6. **`CANCELLED`**: Đơn thuốc bị hủy bởi Bác sĩ/Admin.

---

## 2. Quy Trình Thanh Toán

### A. Thanh toán Offline (Tiền mặt tại nhà thuốc)
1. Bệnh nhân tới quầy nhà thuốc và trình mã QR đơn thuốc trên ứng dụng.
2. Dược sĩ / Thu ngân gọi `GET /prescription/scan/:code` để xem danh sách thuốc & tổng số tiền.
3. Thu ngân thu tiền mặt và gọi `PATCH /prescription/:id/pay`.
4. Hệ thống chuyển `Prescription.status = PROCESSING`, `Service_Order.payment_status = SUCCESSED` và tự động sinh bản ghi `Transaction` offline.

### B. Thanh toán Online (Chuyển khoản / PayOS)
1. Bệnh nhân bấm thanh toán đơn thuốc trên ứng dụng Bệnh nhân.
2. App gọi `POST /transaction` truyền `service_order_id` của đơn thuốc và `transType: ORDER_PAYMENT`.
3. Bệnh nhân thực hiện chuyển khoản theo link/mã QR PayOS.
4. Khi thanh toán thành công, PayOS bắn Webhook về `POST /transaction/webhook` -> Hệ thống tự động chuyển `Service_Order.payment_status = SUCCESSED` và `Prescription.status = PROCESSING`.

---

## 3. Danh Sách API Details

### A. Danh Mục Thuốc (`/medicine`)

#### 1. Tạo loại thuốc mới
- **Method**: `POST`
- **Path**: `/medicine`
- **Roles**: `PHARMACIST`, `ADMIN`, `DOCTOR`
- **Request Body**:
```json
{
  "medicine_code": "MED-PAR-500",
  "medicine_name": "Paracetamol 500mg",
  "active_ingredient": "Paracetamol",
  "unit": "Viên",
  "usage_route": "Uống",
  "unit_price": 5000,
  "manufacturer": "Dược Hậu Giang",
  "description": "Giảm đau, hạ sốt nhẹ đến vừa"
}
```
- **Response (201 Created)**:
```json
{
  "medicine_id": "f6a7b8c9-d0e1-2345-fabc-6789012345fa",
  "medicine_code": "MED-PAR-500",
  "medicine_name": "Paracetamol 500mg",
  "active_ingredient": "Paracetamol",
  "unit": "Viên",
  "usage_route": "Uống",
  "unit_price": 5000,
  "manufacturer": "Dược Hậu Giang",
  "description": "Giảm đau, hạ sốt nhẹ đến vừa",
  "is_active": true,
  "created_at": "2026-07-30T13:00:00.000Z",
  "updated_at": "2026-07-30T13:00:00.000Z"
}
```

#### 2. Tra cứu danh sách thuốc
- **Method**: `GET`
- **Path**: `/medicine?search=paracetamol&is_active=true&page=1&limit=20`
- **Roles**: All Authenticated Users

---

### B. Quản Lý Đơn Thuốc (`/prescription`)

#### 1. Kê đơn thuốc cho phiên khám (Bác sĩ)
- **Method**: `POST`
- **Path**: `/prescription`
- **Roles**: `DOCTOR`, `ADMIN`
- **Request Body**:
```json
{
  "visit_session_id": "c3d4e5f6-a7b8-9012-cdef-3456789012cd",
  "diagnosis_note": "Uống thuốc đúng giờ, tái khám sau 7 ngày",
  "details": [
    {
      "medicine_id": "f6a7b8c9-d0e1-2345-fabc-6789012345fa",
      "quantity": 10,
      "dosage_instruction": "Sáng 1 viên, tối 1 viên sau ăn",
      "note": "Uống khi đau hoặc sốt trên 38.5 độ"
    }
  ]
}
```
> **Lưu ý hỗ trợ FE Test độc lập**: Trường `visit_session_id` là **tùy chọn (Optional)**. FE có thể bỏ qua trường này khi test nhanh quy trình kê đơn & thanh toán mà không cần khởi tạo luồng đặt khám/phiên khám trước.
- **Response (201 Created)**:
```json
{
  "prescription_id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
  "prescription_code": "RX-20260730-8842",
  "qr_code": "{\"code\":\"RX-20260730-8842\",\"visit_session_id\":\"c3d4e5f6-a7b8-9012-cdef-3456789012cd\",\"service_order_id\":\"b2c3d4e5-f6a7-8901-bcde-2345678901bc\",\"total_amount\":50000}",
  "service_order_id": "b2c3d4e5-f6a7-8901-bcde-2345678901bc",
  "visit_session_id": "c3d4e5f6-a7b8-9012-cdef-3456789012cd",
  "prescribed_by": "d4e5f6a7-b8c9-0123-defa-4567890123de",
  "diagnosis_note": "Uống thuốc đúng giờ, tái khám sau 7 ngày",
  "total_amount": 50000,
  "status": "PENDING",
  "created_at": "2026-07-30T13:00:00.000Z",
  "updated_at": "2026-07-30T13:00:00.000Z",
  "prescriptionDetails": [
    {
      "prescription_detail_id": "e5f6a7b8-c9d0-1234-efab-5678901234ef",
      "medicine_id": "f6a7b8c9-d0e1-2345-fabc-6789012345fa",
      "quantity": 10,
      "dosage_instruction": "Sáng 1 viên, tối 1 viên sau ăn",
      "unit_price": 5000,
      "sub_total": 50000,
      "medicine": {
        "medicine_code": "MED-PAR-500",
        "medicine_name": "Paracetamol 500mg",
        "unit": "Viên"
      }
    }
  ]
}
```

#### 2. Quét QR code / Tra cứu mã đơn thuốc (Nhà thuốc)
- **Method**: `GET`
- **Path**: `/prescription/scan/RX-20260730-8842`
- **Roles**: All Authenticated Users

#### 3. Xác nhận thanh toán offline tại quầy (Nhà thuốc / Thu ngân)
- **Method**: `PATCH`
- **Path**: `/prescription/:id/pay`
- **Roles**: `PHARMACIST`, `RECEPTIONIST`, `ADMIN`
- **Response (200 OK)**: Chuyển status sang `PROCESSING`, tự động tạo `Transaction` offline.

#### 4. Xác nhận soạn xong thuốc (Dược sĩ)
- **Method**: `PATCH`
- **Path**: `/prescription/:id/prepare`
- **Roles**: `PHARMACIST`, `ADMIN`
- **Response (200 OK)**: Chuyển status sang `PREPARED`, phát `Notification` cho Bệnh nhân.

#### 5. Xác nhận đã giao thuốc cho Bệnh nhân (Dược sĩ)
- **Method**: `PATCH`
- **Path**: `/prescription/:id/dispense`
- **Roles**: `PHARMACIST`, `ADMIN`
- **Response (200 OK)**: Chuyển status sang `DISPENSED`, hoàn thành `Service_Order`.
