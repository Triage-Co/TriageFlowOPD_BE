# Danh sách các phòng mới bổ sung (New Rooms)

## 1. Định dạng danh sách phòng (`Physical Room Code`	`Tên phòng`)
```text
G2.3.1	Chẩn đoán hình ảnh 1 (X-Quang)
G2.3.2	Chẩn đoán hình ảnh 2 (Siêu âm)
G2.3.3	Chẩn đoán hình ảnh 3 (MRI)
G2.3.4	Chẩn đoán hình ảnh 4 (CT-Scanner)
G2.3.5	Thăm dò chức năng 1 (Điện tâm đồ)
G2.3.6	Thăm dò chức năng 2 (Chức năng hô hấp)
G2.3.7	Thăm dò chức năng 3 (Holter tim mạch)
G2.3.8	Xét nghiệm sinh hóa
```

## 2. Bảng chi tiết cấu hình phòng (Mapping Prisma Enum & Service)

| Mã phòng vật lý (`Physical Room Code`) | Tên phòng | Loại phòng Enum (`room_type`) | Mã dịch vụ liên kết (`service_code`) | Chức năng chính |
| :---: | :--- | :--- | :--- | :--- |
| **G2.3.1** | Chẩn đoán hình ảnh 1 (X-Quang) | `IMAGING_ROOM` | `CD_XQUANG_01` | Chụp X-quang tim phổi, khung xương, sọ não cơ bản |
| **G2.3.2** | Chẩn đoán hình ảnh 2 (Siêu âm) | `IMAGING_ROOM` | `CD_SIEUAM_01` | Siêu âm ổ bụng tổng quát, tuyến giáp, mô mềm |
| **G2.3.3** | Chẩn đoán hình ảnh 3 (MRI) | `IMAGING_ROOM` | `CD_MRI_01` | Chụp cộng hưởng từ sọ phát, cột sống, cơ xương khớp |
| **G2.3.4** | Chẩn đoán hình ảnh 4 (CT-Scanner) | `IMAGING_ROOM` | *(Mở rộng)* | Chụp cắt lớp vi tính đa dãy chẩn đoán hình ảnh chuyên sâu |
| **G2.3.5** | Thăm dò chức năng 1 (Điện tâm đồ) | `FUNCTIONAL_EXPLORATION` | `CN_DIENTIM` | Đo điện tâm đồ (ECG) 12 chuyển đạo đánh giá nhịp tim |
| **G2.3.6** | Thăm dò chức năng 2 (Chức năng hô hấp) | `FUNCTIONAL_EXPLORATION` | `CN_HOHAP` | Đo phế dung ký, đánh giá thông khí phổi (hen, COPD) |
| **G2.3.7** | Thăm dò chức năng 3 (Holter tim mạch) | `FUNCTIONAL_EXPLORATION` | *(Mở rộng)* | Theo dõi liên tục biến thiên nhịp tim và huyết áp 24h |
| **G2.3.8** | Xét nghiệm sinh hóa | `LABORATORY` | `XN_SH_MAU` / `XN_MAU_CB` | Phân tích sinh hóa máu, công thức máu cơ bản và nước tiểu |
