# Danh sách ca trực

Ngày: **2026-08-07** (Asia/Ho_Chi_Minh) — 75 phòng, nhóm theo **khu vực (area)**.

Mật khẩu các bác sĩ seed (đổi tên từ `BS …`): **`TriageFlowOpd`**

Cột **Chuyên khoa** = `specialty_name` của nhân sự đang trực (bác sĩ). Nurse / lễ tân / dược / KTV không có specialty → `—`.

Cột **Mã vật lý** = `physical_room.roomCode`, **Nhãn** = `physical_room.roomLabel`, **Tên** = `room.room_name`.

Đã đổi tên phòng mã số → thủ thuật / khám sức khỏe qua `npx tsx prisma/rename-procedure-rooms.seed.ts` (17 phòng `PROCEDURE_ROOM` + `G2.4.34`/`G2.4.35`).

---

## Khu Cận lâm sàng (`CLS` · tầng 1)

| Mã vật lý | Nhãn | Tên | Tên BS | Chuyên khoa | Email |
| --- | --- | --- | --- | --- | --- |
| `G2.3.1` | Chẩn đoán hình ảnh 1 (X-Quang) | Phòng Chẩn đoán hình ảnh 1 (X-Quang) | Phạm Thị Ngọc Anh | — | phamthingochanh.dieuduong@triageflow.me |
| `G2.3.2` | Chẩn đoán hình ảnh 2 (Siêu âm) | Phòng Chẩn đoán hình ảnh 2 (Siêu âm) | Nguyễn Thị Bảo | — | nguyenthibao.dieuduong@triageflow.me |
| `G2.3.3` | Chẩn đoán hình ảnh 3 (MRI) | Phòng Chẩn đoán hình ảnh 3 (MRI) | Võ Thành Nghĩa | — | vothanhnghia.dieuduong@triageflow.me |
| `G2.3.4` | Chẩn đoán hình ảnh 4 (CT-Scanner) | Phòng Chẩn đoán hình ảnh 4 (CT-Scanner) | Đỗ Thị Mỹ Duyên | — | dothimyduyen.dieuduong@triageflow.me |
| `G2.3.5` | Thăm dò chức năng 1 (Điện tâm đồ) | Phòng Thăm dò chức năng 1 (Điện tâm đồ) | Trương Quốc Việt | — | truongquocviet.dieuduong@triageflow.me |
| `G2.3.6` | Thăm dò chức năng 2 (Chức năng hô hấp) | Phòng Thăm dò chức năng 2 (Chức năng hô hấp) | Đỗ Thị Tuyến | — | dothituyen.xetnghiem@triageflow.me |
| `G2.3.7` | Thăm dò chức năng 3 (Holter tim mạch) | Phòng Thăm dò chức năng 3 (Holter tim mạch) | Hoàng Văn Phúc | — | hoangvanphuc.xetnghiem@triageflow.me |
| `G2.3.8` | Xét nghiệm sinh hóa | Phòng Xét nghiệm sinh hóa | Nguyễn Minh Khoa | — | nguyenminhkhoa.xetnghiem@triageflow.me |

---

## Khu khám Da liễu (`DERM` · tầng 1)

| Mã vật lý | Nhãn | Tên | Tên BS | Chuyên khoa | Email |
| --- | --- | --- | --- | --- | --- |
| `G2.4.30` | Thủ thuật Da liễu 1 | Phòng thủ thuật Da liễu 1 | Vũ Tuấn Anh | Da liễu | vutuananh.dalieu@gmail.com |
| `G2.4.31` | Thủ thuật Da liễu 2 | Phòng thủ thuật Da liễu 2 | Nguyễn Thị Hương | Da liễu | nguyenthihuong.dalieu@gmail.com |
| `G2.4.32` | Thủ thuật Da liễu 3 | Phòng thủ thuật Da liễu 3 | Trần Văn Phong | Da liễu | tranvanphong.dalieu@gmail.com |

---

## Khu khám mắt (`OPH` · tầng 1)

| Mã vật lý | Nhãn | Tên | Tên BS | Chuyên khoa | Email |
| --- | --- | --- | --- | --- | --- |
| `G2.4.10` | Thủ thuật Mắt 3 | Phòng thủ thuật Mắt 3 | Phạm Thị Yến | Mắt | phamthiyen.mat@gmail.com |
| `G2.4.7` | Thủ thuật Mắt 1 | Phòng thủ thuật Mắt 1 | Nguyễn Minh Châu | Mắt | nguyenminhchau.mat@gmail.com |
| `G2.4.9` | Thủ thuật Mắt 2 | Phòng thủ thuật Mắt 2 | Trần Thanh Tùng | Mắt | tranthanhtung.mat@gmail.com |
| `G2.4.8` | Mắt 1 | Phòng Mắt 1 | Lê Thị Kim | Mắt | lethikim.mat@gmail.com |
| `G2.4.11` | Mắt 2 | Phòng Mắt 2 | Võ Hoàng Yến | Mắt | vohoangyen.mat@gmail.com |

---

## Khu khám Chấn thương Chỉnh hình (`ORTH` · tầng 1)

| Mã vật lý | Nhãn | Tên | Tên BS | Chuyên khoa | Email |
| --- | --- | --- | --- | --- | --- |
| `G2.4.3` | Thủ thuật Chấn thương Chỉnh hình | Phòng thủ thuật Chấn thương Chỉnh hình | Nguyễn Hữu Tài | Chấn thương Chỉnh hình | nguyenhutai.ctch@gmail.com |
| `G2.4.1` | Chấn thương chỉnh hình 1 | Phòng Chấn thương chỉnh hình 1 | Mai Văn Hoàng | Chấn thương Chỉnh hình | maivanhoang.ctch@gmail.com |
| `G2.4.2` | Chấn thương chỉnh hình 2 | Phòng Chấn thương chỉnh hình 2 | Trần Quốc Bảo | Chấn thương Chỉnh hình | tranquocbao.ctch@gmail.com |
| `G2.4.4` | Da liễu 1 | Phòng Da liễu 1 | Lê Thu Trang | Da liễu | lethutrang.dalieu@gmail.com |
| `G2.4.5` | Da liễu 2 | Phòng Da liễu 2 | Phạm Quốc Hùng | Da liễu | phamquochung.dalieu@gmail.com |
| `G2.4.6` | Da liễu 3 | Phòng Da liễu 3 | Đỗ Thị Nga | Da liễu | dothinga.dalieu@gmail.com |

---

## Khu khám Nội - Nhi (`PED_INT` · tầng 1)

| Mã vật lý | Nhãn | Tên | Tên BS | Chuyên khoa | Email |
| --- | --- | --- | --- | --- | --- |
| `G2.2.17` | Thủ thuật Nội khoa 2 | Phòng thủ thuật Nội khoa 2 | Đinh Thị Hoa | Nội khoa | dinhthihoa.noikhoa@gmail.com |
| `G2.2.21` | Thủ thuật Nội khoa 3 | Phòng thủ thuật Nội khoa 3 | Nguyễn Văn Khoa | Nội khoa | nguyenvankhoa.noikhoa@gmail.com |
| `G2.2.32` | Thủ thuật Nội khoa 4 | Phòng thủ thuật Nội khoa 4 | Trần Thị Mai | Nội khoa | tranthimai.noikhoa@gmail.com |
| `G2.2.41` | Thủ thuật Nội khoa 5 | Phòng thủ thuật Nội khoa 5 | Lê Hoàng Nam | Nội khoa | lehoangnam.noikhoa@gmail.com |
| `G2.2.5` | Thủ thuật Nội khoa 1 | Phòng thủ thuật Nội khoa 1 | Phạm Thu Hà | Nội khoa | phamthuha.noikhoa@gmail.com |
| `G2.2.24` | Bệnh truyền nhiễm | Phòng Bệnh truyền nhiễm | Trương Thanh Tùng | Truyền nhiễm | truongthanhtung.truyennhiem@gmail.com |
| `G2.2.40` | Huyết học | Phòng Huyết học | Phùng Văn Tiến | Huyết học | phungvantien.huyethoc@gmail.com |
| `G2.1.PHARMACY` | Nhà Thuốc / Quầy Thuốc | Phòng Nhà Thuốc / Quầy Thuốc | Lý Thị Kim Chi | — | lythikimchi.duocsi@triageflow.me |
| `G2.2.34` | Nhi 1 | Phòng Nhi 1 | Đào Thị Hồng | Nhi khoa | daothihong.nhikhoa@gmail.com |
| `G2.2.35` | Nhi 2 | Phòng Nhi 2 | Lê Thị Thanh | Nhi khoa | lethithanh.nhikhoa@gmail.com |
| `G2.2.11` | Nội cơ xương khớp | Phòng Nội cơ xương khớp | Võ Văn Kiệt | Cơ xương khớp | vovankiet.coxuongkhop@gmail.com |
| `G2.2.28` | Nội hô hấp 1 | Phòng Nội hô hấp 1 | Chung Thị Bích | Hô hấp | chungthibich.hohap@gmail.com |
| `G2.2.25` | Nội thận | Phòng Nội thận | Vương Đình Kiên | Thận học | vuongdinhkien.thanhoc@gmail.com |
| `G2.2.22` | Nội thần kinh 1 | Phòng Nội thần kinh 1 | Quách Thị Tuyết | Thần kinh | quachthituyet.thankinh@gmail.com |
| `G2.2.23` | Nội thần kinh 2 | Phòng Nội thần kinh 2 | Phạm Hồng Nhung | Thần kinh | phamhongnhung.thankinh@gmail.com |
| `G2.2.14` | Nội tiết 1 | Phòng Nội tiết 1 | Đặng Văn Minh | Nội tiết | dangvanminh.noitiet@gmail.com |
| `G2.2.15` | Nội tiết 2 | Phòng Nội tiết 2 | Nguyễn Thị Oanh | Nội tiết | nguyenthioanh.noitiet@gmail.com |
| `G2.2.16` | Nội tiết 3 | Phòng Nội tiết 3 | Trần Đức Mạnh | Nội tiết | tranducmanh.noitiet@gmail.com |
| `G2.2.26` | Nội tiêu hóa 1 | Phòng Nội tiêu hóa 1 | Đoàn Hữu Tài | Tiêu hóa | doanhuutai.tieuhoa@gmail.com |
| `G2.2.27` | Nội tiêu hóa 2 | Phòng Nội tiêu hóa 2 | Phạm Văn Khoa | Tiêu hóa | phamvankhoa.tieuhoa@gmail.com |
| `G2.2.6` | Nội tim mạch 1 | Phòng Nội tim mạch 1 | Nguyễn Thanh Sơn | Tim mạch | nguyenthanhson.timmach@gmail.com |
| `G2.2.7` | Nội tim mạch 2 | Phòng Nội tim mạch 2 | Trần Mỹ Dung | Tim mạch | tranmydung.timmach@gmail.com |
| `G2.2.8` | Nội tim mạch 3 | Phòng Nội tim mạch 3 | Lê Văn Cường | Tim mạch | levancuong.timmach@gmail.com |
| `G2.2.9` | Nội tim mạch 4 | Phòng Nội tim mạch 4 | Phạm Ngọc Anh | Tim mạch | phamngocanh.timmach@gmail.com |
| `G2.2.10` | Nội tim mạch 5 | Phòng Nội tim mạch 5 | Phạm Quốc Bảo | Tim mạch | phamquocbao.timmach@gmail.com |
| `G2.2.18` | Nội tổng quát 1 | Phòng Nội tổng quát 1 | Võ Minh Tuấn | Nội khoa | vominhtuan.noikhoa@gmail.com |
| `G2.2.19` | Nội tổng quát 2 | Phòng Nội tổng quát 2 | Hoàng Thị Lan | Nội khoa | hoangthilan.noikhoa@gmail.com |
| `G2.2.20` | Nội tổng quát 3 | Phòng Nội tổng quát 3 | Đỗ Quang Huy | Nội khoa | doquanghuy.noikhoa@gmail.com |
| `G2.2.33` | Sức khỏe tâm thần | Phòng Sức khỏe tâm thần | Phùng Gia Bảo | Tâm thần | phunggiabao.tamthan@gmail.com |
| `G2.2.12` | Tim mạch can thiệp 1 | Phòng Tim mạch can thiệp 1 | Vũ Thị Hạnh | Tim mạch | vuthihanh.timmach@gmail.com |
| `G2.2.13` | Tim mạch can thiệp 2 | Phòng Tim mạch can thiệp 2 | Hoàng Đức Anh | Tim mạch | hoangducanh.timmach@gmail.com |

---

## Khu khám ngoại (`SUR` · tầng 1)

| Mã vật lý | Nhãn | Tên | Tên BS | Chuyên khoa | Email |
| --- | --- | --- | --- | --- | --- |
| `G2.4.13` | Thủ thuật Ngoại khoa 1 | Phòng thủ thuật Ngoại khoa 1 | Nguyễn Đức Thành | Ngoại khoa | nguyenducthanh.ngoaikhoa@gmail.com |
| `G2.4.19` | Thủ thuật Ngoại khoa 2 | Phòng thủ thuật Ngoại khoa 2 | Trần Quốc Việt | Ngoại khoa | tranquocviet.ngoaikhoa@gmail.com |
| `G2.4.20` | Thủ thuật Ngoại khoa 3 | Phòng thủ thuật Ngoại khoa 3 | Lê Thị Hồng | Ngoại khoa | lethihong.ngoaikhoa@gmail.com |
| `G2.4.22` | Thủ thuật Ngoại khoa 4 | Phòng thủ thuật Ngoại khoa 4 | Phạm Văn Long | Ngoại khoa | phamvanlong.ngoaikhoa@gmail.com |
| `G2.4.26` | Thủ thuật Ngoại khoa 5 | Phòng thủ thuật Ngoại khoa 5 | Bùi Minh Đức | Ngoại khoa | buiminhduc.ngoaikhoa@gmail.com |
| `G2.4.23` | Khám thai 1 | Phòng Khám thai 1 | Nguyễn Thị Xuân | Phụ khoa | nguyenthixuan.phukhoa@gmail.com |
| `G2.4.15` | Ngoại lồng ngực | Phòng Ngoại lồng ngực | Đặng Hữu Phước | Ngoại khoa | danghuuphuoc.ngoaikhoa@gmail.com |
| `G2.4.16` | Ngoại thần kinh 1 | Phòng Ngoại thần kinh 1 | Nguyễn Thị Bích | Thần kinh | nguyenthibich.thankinh@gmail.com |
| `G2.4.17` | Ngoại thần kinh 2 | Phòng Ngoại thần kinh 2 | Lê Văn Sơn | Thần kinh | levanson.thankinh@gmail.com |
| `G2.4.14` | Ngoại tiết niệu | Phòng Ngoại tiết niệu | Trần Quang Đại | Tiết niệu | tranquangdai.tietnieu@gmail.com |
| `G2.4.12` | Ngoại tổng quát 1 | Phòng Ngoại tổng quát 1 | Huỳnh Tấn Phát | Ngoại khoa | huynhtanphat.ngoaikhoa@gmail.com |
| `G2.4.18` | Ngoại ung bướu | Phòng Ngoại ung bướu | Trần Văn Hùng | Ung bướu | tranvanhung.ungbuou@gmail.com |
| `G2.4.21` | Phụ khoa | Phòng Phụ khoa | Lý Thu Thủy | Phụ khoa | lythuthuy.phukhoa@gmail.com |
| `G2.4.28` | Răng hàm mặt 1 | Phòng Răng hàm mặt 1 | Nguyễn Thị Mai | Răng Hàm Mặt | nguyenthimai.rhm@gmail.com |
| `G2.4.29` | Răng hàm mặt 2 | Phòng Răng hàm mặt 2 | Trần Minh Trí | Răng Hàm Mặt | tranminhtri.rhm@gmail.com |
| `G2.4.24` | Tai mũi họng 1 | Phòng Tai mũi họng 1 | Bùi Thị Thu | Tai Mũi Họng | buithithu.tmh@gmail.com |
| `G2.4.25` | Tai mũi họng 2 | Phòng Tai mũi họng 2 | Hoàng Thị Thu | Tai Mũi Họng | hoangthithu.tmh@gmail.com |

---

## Chưa gán khu vực (tầng 1)

| Mã vật lý | Nhãn | Tên | Tên BS | Chuyên khoa | Email |
| --- | --- | --- | --- | --- | --- |
| `G2.4.34` | Khám sức khỏe 1 | Phòng Khám sức khỏe 1 | Ngô Thị Lan | Đa khoa | ngothilan.dakhoa@gmail.com |
| `G2.4.35` | Khám sức khỏe 2 | Phòng Khám sức khỏe 2 | Lâm Minh Minh | Đa khoa | Lamminh.tongquat@gmail.com |
| `G2.1.RECEPTION_A` | Sảnh Tiếp Đón A | Phòng Sảnh Tiếp Đón A | Nguyễn Thế Hiển | — | nthehien338@gmail.com |
| `G2.1.RECEPTION_B` | Sảnh Tiếp Đón B | Phòng Sảnh Tiếp Đón B | Nguyễn Thị Hương | — | nguyenthihuong.letan@triageflow.me |
| `G2.4.40` | Thủ thuật | Phòng Thủ thuật | Đức Trung | Mạch máu | trungndse184267@fpt.edu.vn |

---

## Đã áp dụng đổi tên phòng

Script: `npx tsx prisma/rename-procedure-rooms.seed.ts`

| Mã vật lý | Nhãn mới | Tên mới | `room_type` |
| --- | --- | --- | --- |
| `G2.4.30`–`32` | Thủ thuật Da liễu 1–3 | Phòng thủ thuật Da liễu 1–3 | `PROCEDURE_ROOM` |
| `G2.4.7`, `G2.4.9`, `G2.4.10` | Thủ thuật Mắt 1–3 | Phòng thủ thuật Mắt 1–3 | `PROCEDURE_ROOM` |
| `G2.4.3` | Thủ thuật Chấn thương Chỉnh hình | Phòng thủ thuật Chấn thương Chỉnh hình | `PROCEDURE_ROOM` |
| `G2.2.5`, `.17`, `.21`, `.32`, `.41` | Thủ thuật Nội khoa 1–5 | Phòng thủ thuật Nội khoa 1–5 | `PROCEDURE_ROOM` |
| `G2.4.13`, `.19`, `.20`, `.22`, `.26` | Thủ thuật Ngoại khoa 1–5 | Phòng thủ thuật Ngoại khoa 1–5 | `PROCEDURE_ROOM` |
| `G2.4.34` | Khám sức khỏe 1 | Phòng Khám sức khỏe 1 | (giữ `CLINICAL_ROOM`) |
| `G2.4.35` | Khám sức khỏe 2 | Phòng Khám sức khỏe 2 | (giữ `CLINICAL_ROOM`) |
