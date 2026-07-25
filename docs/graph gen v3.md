Quy trình Sinh Đồ thị Điều hướng InMap 2.0 (Dựa trên MPRSSEM)

Tài liệu này đặc tả quy trình thuật toán tự động nhằm chuyển đổi hình học không gian 2D tĩnh của một mặt bằng tầng đơn lẻ (Single Floor) thành mạng lưới đồ thị điều hướng động (Navigation Graph).

Quy trình này đã được nâng cấp dựa trên phương pháp MPRSSEM (Middle-Point Relation Structure Segment Entrance Modification) để khắc phục triệt để hiện tượng đường đi gấp khúc (zigzag) và lỗi đâm xuyên góc tường.

1. Nguyên tắc Ánh xạ (Entity Mappings & Constraints)

Phạm vi không gian: Chỉ xử lý trên một mặt phẳng 2D duy nhất (Z = hằng số). Bỏ qua các cấu trúc liên tầng (cầu thang, thang máy).

Điểm kết thúc (Endpoint): Mọi tuyến đường dẫn vào phòng đều kết thúc tại Cửa phòng (Door). Không sinh Node tại trọng tâm (centroid) của phòng để tối ưu bộ nhớ và tránh lỗi đâm xuyên tường.

Không gian đi lại (Walkable Space): Là phần diện tích hành lang, sảnh chung sau khi đã trừ đi (Boolean Subtract) toàn bộ các đa giác phòng ốc và vách tường ranh giới.

Thực thể vật lý (floor_feature)

Điểm nút sinh ra (nav_node)

Chức năng trong Đồ thị

door (Cửa ra vào)

node_type = door

Nút kết thúc / bắt đầu lộ trình.

corridor (Hành lang/Sảnh)

node_type = corridor

Điểm neo chuyển hướng trung gian.

2. Chi tiết Thuật toán (Algorithmic Pipeline)

Bước 1: Trích xuất Điểm Cửa (Door Node Resolution)

Với mỗi đối tượng hình học đại diện cho cửa (door) trên mặt bằng:

Tính toán tọa độ trung điểm hình học $(X_m, Y_m)$ của đoạn thẳng/khối bao (bounding box) đại diện cho cửa.

Khởi tạo nav_node tại vị trí này với thuộc tính node_type = door.

Bước 2: Hình học hóa Hành lang (MPRSS - Phân mảnh Hình học)

Thay vì dùng trục Voronoi trực tiếp dễ gây nhiễu, thuật toán xử lý vùng không gian đi lại (Walkable Space) như sau:

Rải điểm biên (Boundary Point Generation): Lấy tập hợp các đỉnh (vertices) của tất cả các vách tường, góc phòng tiếp giáp với không gian hành lang làm tập điểm cơ sở $\{P_b\}$.

Tạo lưới tam giác (CDT): Chạy thuật toán Constrained Delaunay Triangulation (CDT) trên tập $\{P_b\}$ để chia nhỏ không gian hành lang thành một lưới các tam giác (TIN).

Lọc cạnh nội khu: Trích xuất các cạnh của tam giác nằm hoàn toàn bên trong không gian hành lang (gọi là tập $\{E_{zigzag}\}$). Bỏ qua các cạnh nằm sát trùng với tường.

Sinh Nút Trung Điểm (Midpoint Node Creation): Tính toán trung điểm $\{P_{Mid}\}$ của tất cả các cạnh thuộc tập $\{E_{zigzag}\}$.
-> Các điểm $\{P_{Mid}\}$ này chính thức trở thành các Nút Hành Lang (corridor_point).

Bước 3: Kiến tạo Đồ thị Lân cận (MPRSSE - Topological Interconnection)

Kết nối các Cửa và Nút hành lang dựa trên quan hệ không gian, loại bỏ hoàn toàn cơ chế bắn tia (Raycasting) cơ học:

Phân vùng Không gian (Voronoi Cells): Chạy thuật toán Voronoi Diagram với hạt nhân (seeds) chính là tập các nút trung điểm $\{P_{Mid}\}$ vừa sinh ra. Hành lang sẽ được chia thành các ô đa giác liền kề (Cells - ký hiệu là $\{SS\}$).

Nối Hành lang với Hành lang (Segment-Segment): Nối các điểm $\{P_{Mid}\}$ của các ô Voronoi $\{SS\}$ nằm liền kề nhau bằng các cạnh (nav_edge). Lưới này tạo thành trục đường xương sống mượt mà nằm chính giữa hành lang.

Nối Cửa với Hành lang (Door-Segment): - Duyệt qua từng Nút Cửa (door).

Xác định Nút Cửa đó đang nằm trên ranh giới hoặc nằm gọn bên trong ô đa giác Voronoi $\{SS_i\}$ nào.

Trực tiếp tạo một cạnh (nav_edge) nối Nút Cửa đó với Nút trung điểm $\{P_{Mid}\}$ đại diện cho ô $\{SS_i\}$.

Bước 4: Cắt tỉa và Làm mượt (MPRSSEM - Edge Pruning Filter)

Để đảm bảo đường đi phản ánh tự nhiên hành vi của con người và tuân thủ các tiêu chuẩn không gian:

Quét va chạm vách tường: Kiểm tra khoảng cách hình học từ mọi cạnh nối (nav_edge) đến ranh giới chướng ngại vật (tường) gần nhất.

Loại bỏ cạnh nguy hiểm: Nếu một cạnh nối cắt quá sát góc lồi của tường hành lang (khoảng cách an toàn $< 0.55\text{m}$), hệ thống sẽ tự động xóa cạnh đó. Thuật toán tìm đường sau này sẽ buộc phải đi vòng qua các nút $\{P_{Mid}\}$ khác an toàn hơn.

Bổ sung độ phân giải (Tùy chọn): Tại các khu vực sảnh lớn hoặc ngã rẽ phức tạp, thuật toán CDT ở Bước 2 có thể tự động thêm các điểm neo phụ (Steiner points) để sinh thêm $\{P_{Mid}\}$, giúp đường đi uốn cong mềm mại hơn thay vì bẻ góc gắt.

3. Cấu trúc Dữ liệu Đầu ra (Output Graph)

Kết thúc quy trình, hệ thống lưu trữ vào In-Memory / Database cấu trúc Đồ thị (Graph) hoàn chỉnh cho tầng hiện tại:

Vertices (Nodes): Tập hợp các Nút Cửa và Nút Trung Điểm hành lang. Kèm theo tọa độ $(X, Y)$ và ID tham chiếu.

Edges (Cạnh): Các đoạn thẳng nối giữa Cửa - Hành lang, hoặc Hành lang - Hành lang. Mỗi cạnh đi kèm trọng số (weight) chính là khoảng cách chiều dài thực tế (Distance) để chuẩn bị cho thuật toán tìm đường (Dijkstra / A*).