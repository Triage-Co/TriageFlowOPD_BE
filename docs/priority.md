# Danh Mục Ưu Tiên & Trọng Số Phân Luồng Khám Bệnh (OPD Priority Queue)

Tài liệu này gợi ý danh sách các đối tượng ưu tiên, đặc điểm lâm sàng và trọng số (priority weight) tương ứng trong hệ thống phân luồng và xếp hàng tự động **TriageFlowOPD**.

---

## 1. Danh Sách Ưu Tiên Ban Đầu (Core Priority Categories)

| STT | Đối tượng | Đặc điểm lâm sàng (Stability Check) | Trọng số |
| :---: | :--- | :--- | :---: |
| 1 | **Nhi khoa cấp tính** | Sốt cao > 39°C, nôn trớ nhiều, tiêu chảy cấp nhưng mạch/huyết áp/tri giác vẫn ổn định. | **10** |
| 2 | **Lão khoa** | Bệnh mãn tính (tiểu đường/tăng huyết áp) đang có đợt cấp, nhưng không nguy hiểm tính mạng ngay. | **9** |
| 3 | **Sản phụ khoa** | Thai phụ > 32 tuần có đau bụng nhẹ, thai máy ít, hoặc có tiền sử bệnh lý cần giám sát. | **8** |
| 4 | **Người khuyết tật / Di động kém** | Bệnh nhân không thể đứng chờ lâu, cần sử dụng xe lăn/nằm trên băng ca hoặc có sự trợ giúp đặc biệt. | **7** |
| 5 | **Bệnh nhân có lịch hẹn** | Đã đặt lịch qua App, đến đúng giờ, tình trạng ổn định (không cần can thiệp khẩn). | **6** |

---

## 2. Danh Mục Các Trường Hợp Chen Hàng Khác

Đây là các trường hợp có thể xảy ra trong thực tế, các logic chèn số chỉ là gợi ý, có thể thay đổi tùy theo thuật toán.

| STT | Use Case (Trường hợp)                     | Mô tả chi tiết                                                                                    | Logic chèn số (Algorithm Logic)                                                                        |
| :---:| :------------------------------------------| :--------------------------------------------------------------------------------------------------| :-------------------------------------------------------------------------------------------------------|
| 1   | **Bệnh nhân sau xét nghiệm (Returning)**  | Bệnh nhân đã khám lần 1, đi làm CLS (máu, X-quang...) và quay lại trả kết quả.                    | Xen kẽ 1-1: Cứ 1 số mới thì đến 1 số trả kết quả để bác sĩ kết luận.                                   |
| 2   | **Manual Override (Ưu tiên thủ công)**    | Nhân viên điều phối phát hiện ca bệnh có dấu hiệu chuyển biến xấu hoặc đối tượng đặc biệt.        | Chèn ngay lập tức (Top of Queue): Đẩy lên vị trí kế tiếp (Next-in-line).                               |
| 3   | **Bệnh nhân lỡ lượt (Missed Turn)**       | Bệnh nhân không có mặt khi được gọi, quay lại sau đó 15-30 phút.                                  | Lùi n vị trí: Chèn vào sau 3 hoặc 5 bệnh nhân đang chờ hiện tại (không cho lên đầu ngay để công bằng). |
| 4   | **Chuyển phòng khám (Internal Transfer)** | Bác sĩ phòng A chỉ định bệnh nhân sang phòng B để hội chẩn chuyên khoa ngay.                      | Ưu tiên cao hơn bệnh nhân mới nhưng thấp hơn bệnh nhân đang cấp cứu.                                   |
| 5   | **Thủ thuật nhanh (Quick Task)**          | Bệnh nhân chỉ vào để bác sĩ ký giấy xác nhận, đóng dấu hoặc các công việc nhanh khác.             | Xen kẽ 1-1.                                                                                            |
| 6   | **Tái khám trong ngày (Follow-up)**       | Bệnh nhân sau khi mua thuốc, có thắc mắc về liều lượng hoặc phản ứng phụ nhẹ quay lại hỏi bác sĩ. | Pop-up: Thường được giải quyết ngay tại cửa phòng khám mà không cần lấy số mới (nếu bác sĩ đồng ý).    |


