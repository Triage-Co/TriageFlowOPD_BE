# Hạng Mục Cần Sửa Đổi Ở Frontend (triageflow_fe) Cho Hàng Chờ Phòng Lab / Procedure

Tài liệu này ghi nhận các công việc còn lại ở Frontend (`triageflow_fe`) liên quan đến hàng chờ phòng Lab/Thủ thuật và hiển thị TV.

---

## 1. Tích hợp Realtime Socket cho Giao diện KTV Lab (`useLab.ts`)
- **Vấn đề:** Giao diện KTV Lab hiện tại chỉ lấy dữ liệu khi load trang hoặc khi bấm "Làm mới hàng chờ" thủ công.
- **Hạng mục cần làm:**
  - Tích hợp `useRoomDisplaySocket` (hoặc kết nối Socket.IO `onQueueUpdate`) trong `modules/lab/hooks/useLab.ts`.
  - Khi có sự kiện `onQueueUpdate` từ Backend (bệnh nhân mới được điều phối vào, chuyển trạng thái, v.v.), tự động cập nhật danh sách `queueData` mà không cần F5.

---

## 2. Thêm Nút "Bắt đầu làm xét nghiệm" & Phân định Trạng thái tại `LabWorklistView.tsx`
- **Vấn đề:** Giao diện KTV Lab hiện chỉ có nút "Gọi xét nghiệm" (chuyển sang `CALLED`) và nút "Hoàn thành", thiếu bước chuyển `CALLED` -> `SERVING`.
- **Hạng mục cần làm:**
  - Bổ sung nút **"Bắt đầu làm xét nghiệm"** (hoặc nút Quét vé/Đón bệnh nhân) đối với lượt chờ đang ở trạng thái `CALLED` (gọi API `POST /api/queue/scan`).
  - Phân định rõ badge hiển thị trong danh sách:
    - Trạng thái `CALLED`: Badge màu vàng/cam `"Đang gọi vào phòng"`.
    - Trạng thái `SERVING`: Badge màu xanh dương `"Đang xét nghiệm"`.
  - Nút **"Hoàn thành"** chỉ sáng/kích hoạt khi bệnh nhân đã chuyển sang `SERVING` (hoặc tự động gọi hàm bắt đầu phục vụ trước).

---

## 3. Cập nhật Nhãn Hiển Thị trên Màn hình TV (`RoomWaitingScreen.tsx`)
- **Vấn đề:** Màn hình TV room display cần hiển thị nhãn thống nhất khi bệnh nhân đang được phục vụ.
- **Hạng mục cần làm:**
  - Cập nhật nhãn hiển thị khi `status === 'IN_PROGRESS'` (`SERVING`): Hiển thị nhãn chung **"ĐANG PHỤC VỤ"** cho tất cả các loại phòng (bao gồm cả phòng khám bác sĩ và phòng xét nghiệm).
