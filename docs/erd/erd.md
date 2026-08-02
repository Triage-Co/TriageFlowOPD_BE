# TriageFlow OPD — Entity Relationship Diagram (ERD)

Tổng hợp từ `prisma/schema.prisma`. PK mặc định là `UUID`. Geometry dùng PostGIS (`geometry(..., 4326)`).

## Tổng quan module

| #   | Module                         | Vai trò                         | Entities chính                                                                                                                               |
| -----| --------------------------------| ---------------------------------| ----------------------------------------------------------------------------------------------------------------------------------------------|
| 1   | **Map**                        | Bản đồ không gian, POI, routing | Building, Floor, PhysicalRoom, Area, Boundary, Door, Node, Edge, Connector, Category, Poi, FeatureTemplate, PlacedFeature, ScheduledBlockage |
| 2   | **Queue & Coordination**       | Luồng khám, hàng đợi, lịch/ca   | Booking, Slot, Shift, Flow, Step, Step_Dependency, Queue, Move_Log, Room, Flow_Template, Flow_Rules_Config                                   |
| 3   | **Triage**                     | Phân loại / gợi ý chuyên khoa   | Patient_Answer, Triage_Information, Triage_Config                                                                                            |
| 4   | **IAM**                        | Định danh & phân quyền          | Account, Patient, Staff, Specialty                                                                                                           |
| 5   | **Payment**                    | Thanh toán & hóa đơn            | Transaction, Invoice, Invoice_Detail                                                                                                         |
| 6   | **Service**                    | Catalog dịch vụ & chỉ định      | Service, Service_Order, Service_Order_Detail                                                                                                 |
| 7*  | **Medical Record** *(đề xuất)* | Hồ sơ khám lâm sàng             | Visit_Session, Clinical_Document                                                                                                             |
| 8*  | **Pharmacy** *(đề xuất)*       | Đơn thuốc & thuốc               | Prescription, Prescription_Detail, Medicine                                                                                                  |
| 9*  | **Notification** *(đề xuất)*   | Thông báo người dùng            | Notification                                                                                                                                 |

> `*` = đã có model trong schema; nên tách module tài liệu/ownership cho rõ ranh giới domain.

---

## Sơ đồ liên kết liên module (high-level)

```mermaid
flowchart TB
  IAM[IAM<br/>Account / Patient / Staff / Specialty]
  MAP[Map<br/>Building … PhysicalRoom / Node]
  QC[Queue & Coordination<br/>Booking / Flow / Step / Queue]
  TRI[Triage]
  SVC[Service]
  PAY[Payment]
  MR[Medical Record]
  PH[Pharmacy]

  IAM --> QC
  IAM --> TRI
  IAM --> MR
  IAM --> PH
  MAP --> QC
  TRI -.->|gợi ý Specialty| QC
  QC --> SVC
  SVC --> PAY
  QC --> MR
  SVC --> PH
  MR --> PH
```

**Bridge quan trọng**

- `Room` (phòng logic lâm sàng) ↔ `PhysicalRoom` (phòng trên bản đồ)
- `Booking` → `Flow` → `Step` → `Queue` (chuỗi điều phối)
- `Service_Order` nối Queue, Payment, Pharmacy

---

## 1. Map Module

Không gian bệnh viện, thư mục POI, đồ thị dẫn đường, tài sản 3D/feature, lịch chặn đường đi.

```mermaid
erDiagram
  Building ||--o{ Floor : "có tầng"
  Building ||--o{ Connector : "thang máy/cầu thang"
  Floor ||--o{ PhysicalRoom : "phòng vật lý"
  Floor ||--o{ Area : "khu vực"
  Floor ||--o{ Boundary : "đường biên"
  Floor ||--o{ Door : "cửa"
  Floor ||--o{ Node : "đỉnh graph"
  Floor ||--o{ PlacedFeature : "feature đặt sẵn"

  PhysicalRoom ||--o{ Boundary : "biên phòng"
  PhysicalRoom ||--o{ Poi : "điểm POI"
  PhysicalRoom ||--o{ PlacedFeature : "feature trong phòng"
  PhysicalRoom ||--o{ Door : "DoorRoomA"
  PhysicalRoom ||--o{ Door : "DoorRoomB"
  Area ||--o{ PhysicalRoom : "gồm phòng"
  Area ||--o{ Boundary : "biên khu"
  Area ||--o{ Door : "cửa khu"
  Area ||--o{ PlacedFeature : "feature khu"

  Category ||--o{ Poi : "phân loại"
  FeatureTemplate ||--o{ PlacedFeature : "template"

  Node ||--o{ Edge : "EdgeFromNode"
  Node ||--o{ Edge : "EdgeToNode"
  Node ||--o{ Door : "node tại cửa"
  Node ||--o{ ScheduledBlockage : "chặn node"
  Edge ||--o{ ScheduledBlockage : "chặn edge"

  Building {
    UUID id PK
    String name
    String addressLabel
    Int totalFloors
    UUID organizationId
  }

  Floor {
    UUID id PK
    UUID buildingId FK
    Int floorNumber
    String floorPlanImageUrl
    Float widthMeters
    Float heightMeters
    Float scalePixelsPerMeter
    geometry outlineGeom "Polygon 4326"
  }

  PhysicalRoom {
    UUID id PK
    UUID floorId FK
    UUID areaId FK
    String roomCode
    String roomLabel
    Float heightMeters
    geometry centerGeom "Point"
    geometry outlineGeom "Polygon"
  }

  Area {
    UUID id PK
    UUID floorId FK
    String areaCode
    String areaLabel
    String description
    geometry centerGeom
    geometry outlineGeom
  }

  Boundary {
    UUID id PK
    UUID floorId FK
    UUID roomId FK
    UUID areaId FK
    Int seqNo
    geometry lineGeom "LineString"
    BoundaryType boundaryType
    UUID adjacentRoomId FK
    Boolean hasWall
    UUID doorId FK
    String label
  }

  Door {
    UUID id PK
    UUID floorId FK
    UUID nodeId FK
    UUID roomAId FK
    UUID roomBId FK
    UUID areaId FK
    geometry positionGeom
    Boolean isAccessible
    Boolean isEmergency
    Boolean active
  }

  Category {
    UUID id PK
    String name UK
    Json nameLocalized
    String icon
    Int sortOrder
  }

  Poi {
    UUID id PK
    UUID roomId FK
    UUID categoryId FK
    String name
    Json nameLocalized
    String description
    String_array keywords
    Boolean active
  }

  Node {
    UUID id PK
    UUID floorId FK
    NodeType type
    geometry coordsGeom
    Boolean active
    Json metadata
  }

  Edge {
    UUID id PK
    UUID fromNodeId FK
    UUID toNodeId FK
    Float distance
    Boolean accessible
    Boolean isEscalator
    Boolean isElevator
    Boolean isStairs
    Boolean active
  }

  Connector {
    UUID id PK
    UUID buildingId FK
    ConnectorType type
    String name
    Boolean active
    Int_array servedFloors
  }

  FeatureTemplate {
    UUID id PK
    String name UK
    String category
    String modelUrl
    String icon
    Json defaultProperties
  }

  PlacedFeature {
    UUID id PK
    UUID floorId FK
    UUID roomId FK
    UUID templateId FK
    UUID areaId FK
    geometry geometryGeom
    Json customProperties
  }

  ScheduledBlockage {
    UUID id PK
    String name
    UUID nodeId FK
    UUID edgeId FK
    DateTime startAt
    DateTime endAt
    Boolean recurring
    String reason
    BlockageStatus status
  }
```

### Enums (Map)

| Enum | Values |
|------|--------|
| `BoundaryType` | WALL, DOOR, WINDOW, OPEN |
| `NodeType` | ROOM_ENTRANCE, CORRIDOR, ELEVATOR, STAIRS, ESCALATOR, EXIT, JUNCTION |
| `ConnectorType` | ELEVATOR, STAIRS, ESCALATOR, RAMP |
| `BlockageStatus` | ACTIVE, SCHEDULED, CANCELLED, EXPIRED |

### Ghi chú

- Corridor = `Floor.outlineGeom` trừ các `PhysicalRoom.outlineGeom`.
- `Door.roomBId` nullable: cửa ra hành lang chỉ có `roomA`.
- `ScheduledBlockage` độc lập nhưng phụ thuộc Node/Edge (cascade).

---

## 2. Queue & Coordination Module

Lịch khám → booking → flow các bước → hàng đợi / điều phối phòng & nhân sự.

```mermaid
erDiagram
  Staff ||--o{ Shift : "làm ca"
  Room ||--o{ Shift : "ca tại phòng logic"
  PhysicalRoom ||--o{ Shift : "ca tại phòng vật lý"
  Shift ||--o{ Slot : "khung giờ"
  Patient ||--o{ Booking : "đặt lịch"
  Slot ||--o{ Booking : "slot"
  Booking ||--o| Flow : "1:1"
  Booking ||--o| Visit_Session : "1:0..1"
  Flow ||--o{ Step : "các bước"
  Flow ||--o{ Prescription : "đơn thuốc"
  Room ||--o{ Step : "thực hiện tại"
  Staff ||--o{ Step : "phụ trách"
  PhysicalRoom ||--o{ Step : "vị trí map"
  Service_Order ||--o{ Step : "gắn chỉ định"
  Step ||--o{ Step : "parent / sub_step"
  Step ||--o{ Step_Dependency : "StepNeedsToWait"
  Step ||--o{ Step_Dependency : "StepIsDependedOn"
  Step ||--o{ Queue : "hàng đợi"
  Queue ||--o{ Move_Log : "log di chuyển"
  Specialty ||--o{ Room : "phòng theo chuyên khoa"
  PhysicalRoom ||--o{ Room : "map ↔ logic"

  Booking {
    UUID booking_id PK
    UUID patient_id FK
    UUID slot_id FK
    BookingStatusEnum status
  }

  Slot {
    UUID slot_id PK
    UUID shift_id FK
    Int slot_index
    String start_time
    String end_time
    Int capacity
    Int max_capacity
    SlotStatusEnum status
  }

  Shift {
    UUID shift_id PK
    UUID staff_id FK
    UUID room_id FK
    UUID physicalRoomId FK
    DateTime date
    String start_time
    String end_time
  }

  Flow {
    UUID flow_id PK
    UUID booking_id FK_UK
    FlowStatusEnum status
  }

  Step {
    UUID step_id PK
    String step_name
    UUID flow_id FK
    UUID room_id FK
    UUID staff_id FK
    UUID service_order_id FK
    UUID parent_step_id FK
    UUID physicalRoomId FK
    StepStatusEnum step_status
    String service_code
    StepTypeEnum step_type
  }

  Step_Dependency {
    UUID id PK
    UUID step_id FK
    UUID depends_on_step_id FK
  }

  Queue {
    UUID queue_id PK
    UUID step_id FK
    String queue_number
    QueueStatusEnum status
  }

  Move_Log {
    UUID log_id PK
    UUID queue_id FK
    String action_type
  }

  Room {
    UUID room_id PK
    String room_name
    ClinicalRoomType room_type
    UUID physical_room_id FK
    UUID specialty_id FK
  }

  Flow_Template {
    UUID template_id PK
    String template_name
    Json_array steps
  }

  Flow_Rules_Config {
    UUID flow_rules_config_id PK
    Json conditions
    Json actions_to_generate
  }
```

### Enums (Queue & Coordination)

| Enum | Values |
|------|--------|
| `SlotStatusEnum` | AVAILABLE, FULL, CLOSED |
| `BookingStatusEnum` | AVAILABLE, CANCELLED |
| `FlowStatusEnum` | PENDING, IN_PROGRESS, COMPLETED, ABANDONED, CANCELLED |
| `QueueStatusEnum` | PENDING, QUEUED, CALLED, SERVING, FINISHED, MISSING, CANCELLED |
| `StepStatusEnum` | PENDING, IN_PROGRESS, COMPLETED, DECLINED, CANCELLED |
| `StepTypeEnum` | REGISTRATION, TRIAGE, CLINICAL, PROCEDURE, LAB_TEST, IMAGING, FUNCTIONAL_EXPLORATION, PAYMENT, DISPENSING, OTHER |
| `ClinicalRoomType` | RECEPTION, TRIAGE_AREA, CLINICAL_ROOM, PROCEDURE_ROOM, LABORATORY, IMAGING_ROOM, FUNCTIONAL_EXPLORATION, PHARMACY, CASHIER, EMPTY, OTHER |

### Ghi chú

- `Step_Dependency`: step A phụ thuộc step B → B xong mới làm A.
- `Flow_Template` / `Flow_Rules_Config`: cấu hình sinh flow (JSON), không FK runtime.
- `Move_Log`: audit hành động di chuyển theo queue (hỗ trợ Map navigation).

---

## 3. Triage Module

Thu thập câu trả lời phỏng vấn → gợi ý chuyên khoa / độ ưu tiên.

```mermaid
erDiagram
  Patient ||--o{ Patient_Answer : "trả lời"
  Patient_Answer ||--o{ Triage_Information : "kết quả triage"
  Specialty ||--o{ Triage_Information : "gợi ý chuyên khoa"

  Patient_Answer {
    UUID patient_answer_id PK
    UUID patient_id FK
    String citizen_id
    Json questionnaire_data
    String interview_token UK
  }

  Triage_Information {
    UUID triage_information_id PK
    UUID answer_id FK
    UUID specialty_id FK
    String interview_token UK
    Int suggested_priority
  }

  Triage_Config {
    UUID triage_config PK
    String rule_key
    Json rule_value
  }
```

### Ghi chú

- `Patient_Answer` cho phép `patient_id` null (guest / pre-registration theo `citizen_id` / `interview_token`).
- `Triage_Config`: rule engine dạng key–value JSON (không FK).
- Kết quả triage thường dẫn tới chọn `Specialty` → booking / room phù hợp (liên module Queue).

---

## 4. IAM (Identity & Access Management)

Tài khoản, bệnh nhân, nhân sự, chuyên khoa.

```mermaid
erDiagram
  Account ||--o{ Patient : "sở hữu hồ sơ BN"
  Account ||--o| Staff : "1:0..1 hồ sơ NV"
  Specialty ||--o{ Staff : "chuyên khoa"
  Specialty ||--o{ Room : "phòng logic"
  Specialty ||--o{ Triage_Information : "gợi ý"

  Account {
    UUID account_id PK
    String avatar
    String user_name
    String email UK
    RoleTypeEnum role
    GenderTypeEnum gender
    String phone UK
    Boolean is_banned
  }

  Patient {
    UUID patient_id PK
    UUID account_id FK
    String medical_coverage_id UK
    String full_name
    DateTime dob
    GenderTypeEnum gender
    String citizen_id UK
    String blood_type
    String allergy_notes
  }

  Staff {
    UUID staff_id PK_FK " = account_id"
    String full_name
    String license_number
    Int experience_years
    UUID specialty_id FK
  }

  Specialty {
    UUID specialty_id PK
    String specialty_code UK
    String specialty_name
    String description
  }
```

### Enums (IAM)

| Enum | Values |
|------|--------|
| `RoleTypeEnum` | USER, DOCTOR, RECEPTIONIST, NURSE, LAB_TECHNICIAN, PHARMACIST, ADMIN |
| `GenderTypeEnum` | MALE, FEMALE |

### Ghi chú

- `Staff.staff_id` = `Account.account_id` (shared PK / 1:1).
- `Patient.blood_type`, `allergy_notes`: thuộc tính hồ sơ lâu dài (xem thêm Medical Record).

---

## 5. Payment Module

Giao dịch thanh toán / hoàn tiền và hóa đơn theo service order.

```mermaid
erDiagram
  Service_Order ||--o{ Transaction : "các giao dịch"
  Service_Order ||--o{ Invoice : "hóa đơn"
  Invoice ||--o{ Invoice_Detail : "dòng hóa đơn"

  Transaction {
    UUID id PK
    Int amount
    DateTime transDate
    TransTypeEnum transType
    Int docNo UK
    UUID buyerId
    TransStatusEnum status
    UUID service_order_id FK
  }

  Invoice {
    UUID invoice_id PK
    UUID service_order_id FK
    Int total_amount
    InvoiceStatusEnum status
    String payment_method
    DateTime payment_date
  }

  Invoice_Detail {
    UUID invoice_detail_id PK
    UUID invoice_id FK
    String item_name
    Int quantity
    Int unit_price
    Int sub_total
  }
```

### Enums (Payment)

| Enum | Values |
|------|--------|
| `TransStatusEnum` | SUCCESSED, CANCELLED, PENDING |
| `TransTypeEnum` | APPOINTMENT_PAYMENT, APPOINTMENT_REFUND, BOOKING_PAYMENT_1, BOOKING_PAYMENT_2, BOOKING_REFUND, ORDER_PAYMENT, ORDER_REFUND, WALLET_TOP_UP, WALLET_WITHDRAW |
| `PaymentStatusEnum` | PENDING, PROCESSING, SUCCESSED, EXPIRED, CANCELLED *(dùng trên Service_Order)* |
| `InvoiceStatusEnum` | PENDING, PAID, CANCELLED |

### Ghi chú

- `Transaction.buyerId` tham chiếu người mua (Account/Patient) — hiện chưa khai báo FK Prisma tường minh.
- Mã loại giao dịch theo convention số: 11/19 appointment, 21/22/29 booking, 31/39 order, 41/42 wallet.

---

## 6. Service Module

Catalog dịch vụ và phiếu chỉ định (service order).

```mermaid
erDiagram
  Service ||--o{ Service_Order_Detail : "chi tiết"
  Service_Order ||--o{ Service_Order_Detail : "gồm"
  Booking ||--o{ Service_Order : "theo booking"
  Staff ||--o{ Service_Order : "assign_by"
  Service_Order ||--o| Prescription : "1:0..1"
  Service_Order ||--o{ Step : "tạo step"
  Service_Order ||--o{ Invoice : "xuất HĐ"
  Service_Order ||--o{ Transaction : "thanh toán"

  Service {
    UUID service_id PK
    String service_code
    String service_name
    Int price
    ClinicalRoomType room_type
    Boolean is_active
  }

  Service_Order {
    UUID service_order_id PK
    UUID booking_id FK
    String name
    UUID assign_by_staff_id FK
    ServiceOrderStatusEnum status
    String qr_code
    PaymentStatusEnum payment_status
  }

  Service_Order_Detail {
    UUID service_order_detail_id PK
    String name
    UUID service_order_id FK
    UUID service_id FK
    Int price_at_order
    Int quantity
    ServiceOrderDetailStatusEnum status
  }
```

### Enums (Service)

| Enum | Values |
|------|--------|
| `ServiceOrderStatusEnum` | PENDING, IN_PROGRESS, COMPLETED, CANCELLED, PAID |
| `ServiceOrderDetailStatusEnum` | PENDING, PAID, IN_PROGRESS, COMPLETED, CANCELLED |

### Ghi chú

- `Service.room_type` gợi ý loại phòng logic cần thiết khi sinh step.
- `price_at_order` snapshot giá tại thời điểm chỉ định.

---

## 7. Medical Record Module *(đề xuất tách)*

Hồ sơ theo phiên khám — đã có trong schema; chi tiết cũ: [`medical_record.md`](./medical_record.md).

```mermaid
erDiagram
  Patient ||--o{ Visit_Session : "nhiều phiên"
  Booking ||--o| Visit_Session : "1:0..1"
  Visit_Session ||--o{ Clinical_Document : "tài liệu lâm sàng"
  Visit_Session ||--o| Prescription : "1:0..1"

  Visit_Session {
    UUID visit_session_id PK
    UUID patient_id FK
    UUID booking_id FK_UK
    DateTime visit_date
    String chief_complaint
    Int heart_rate
    Int blood_pressure_sys
    Int blood_pressure_dia
    Float temperature
    Int spo2
    String diagnosis
    String final_diagnosis
    String hpi
    String pmh
    Json pe
  }

  Clinical_Document {
    UUID clinical_document_id PK
    UUID visit_session_id FK
    ClinicalDocumentTypeEnum document_type
    Json payload_data
    String his_reference_id
  }
```

| Enum | Values |
|------|--------|
| `ClinicalDocumentTypeEnum` | PRESCRIPTION, LAB_TEST, IMAGING_TEST, PROCEDURE, OTHER |

**Lý do tách module:** khác Queue (điều phối vận hành) — đây là dữ liệu lâm sàng / EMR, có thể đồng bộ HIS qua `his_reference_id`.

---

## 8. Pharmacy Module *(đề xuất tách)*

```mermaid
erDiagram
  Medicine ||--o{ Prescription_Detail : "thành phần"
  Prescription ||--o{ Prescription_Detail : "chi tiết"
  Staff ||--o{ Prescription : "prescribed_by"
  Booking ||--o{ Prescription : "theo booking"
  Flow ||--o{ Prescription : "theo flow"
  Visit_Session ||--o| Prescription : "1:0..1"
  Service_Order ||--o| Prescription : "1:0..1"

  Prescription {
    UUID prescription_id PK
    String prescription_code UK
    String qr_code
    UUID service_order_id FK_UK
    UUID visit_session_id FK_UK
    UUID booking_id FK
    UUID flow_id FK
    UUID prescribed_by FK
    String diagnosis_note
    Int total_amount
    PrescriptionStatusEnum status
  }

  Prescription_Detail {
    UUID prescription_detail_id PK
    UUID prescription_id FK
    UUID medicine_id FK
    Int quantity
    String dosage_instruction
    Int unit_price
    Int sub_total
    String note
  }

  Medicine {
    UUID medicine_id PK
    String medicine_code UK
    String medicine_name
    String active_ingredient
    String unit
    String usage_route
    Int unit_price
    String manufacturer
    String description
    Boolean is_active
  }
```

| Enum | Values |
|------|--------|
| `PrescriptionStatusEnum` | PENDING, PROCESSING, PREPARED, DISPENSED, CANCELLED, EXPIRED |

**Lý do tách module:** kho thuốc + phát thuốc (DISPENSING step) là domain riêng so với Service catalog chung.

---

## 9. Notification Module *(đề xuất tách)*

```mermaid
erDiagram
  Notification {
    UUID id PK
    UUID account_id "tham chiếu Account — chưa FK Prisma"
    String message
    DateTime created_at
    DateTime updated_at
  }
```

**Lý do tách / cải thiện:** hiện thiếu quan hệ Prisma tới `Account`; nên bổ sung FK + trạng thái đọc (`is_read`) nếu module thông báo mở rộng.

---

## Ma trận quan hệ xuyên module (tóm tắt)

| Từ | Đến | Quan hệ | Ý nghĩa |
|----|-----|---------|---------|
| Account | Patient / Staff | 1:N / 1:1 | IAM |
| Patient | Booking | 1:N | Đặt lịch |
| Booking | Flow | 1:1 | Bắt đầu điều phối |
| Flow | Step | 1:N | Các bước trong ngày khám |
| Step | Queue | 1:N | Số thứ tự tại điểm phục vụ |
| Step | Room / PhysicalRoom | N:1 | Phòng logic / vị trí map |
| Room | PhysicalRoom | N:1 | Bridge Map ↔ Queue |
| Patient_Answer | Triage_Information | 1:N | Kết quả triage |
| Triage_Information | Specialty | N:1 | Gợi ý chuyên khoa |
| Booking | Service_Order | 1:N | Chỉ định DV |
| Service_Order | Invoice / Transaction | 1:N | Thanh toán |
| Service_Order | Step | 1:N | Sinh bước thực hiện |
| Patient | Visit_Session | 1:N | Hồ sơ phiên khám |
| Visit_Session / Service_Order | Prescription | 1:0..1 | Đơn thuốc |

---

## Đề xuất module bổ sung (ngoài 6 module gốc)

| Module đề xuất | Entities | Ưu tiên | Ghi chú |
|----------------|----------|---------|---------|
| **Medical Record** | Visit_Session, Clinical_Document | Cao | Đã có schema; tách khỏi Queue |
| **Pharmacy** | Medicine, Prescription, Prescription_Detail | Cao | Đã có API guide riêng |
| **Notification** | Notification | Trung bình | Bổ sung FK Account, read-state |
| **Scheduling** *(tuỳ chọn)* | Shift, Slot, Booking | Thấp | Có thể tách khỏi Queue nếu team lớn; hiện gộp trong Queue & Coordination là hợp lý |
| **Organization / Multi-tenant** *(tương lai)* | Organization (chưa có model) | Thấp | `Building.organizationId` đã có nhưng chưa có bảng Organization |

---

## Nguồn chân lý

- Schema: [`prisma/schema.prisma`](../../prisma/schema.prisma)
- Medical Record (chi tiết cũ): [`docs/erd/medical_record.md`](./medical_record.md)
- Map schema plan: [`docs/plans/phase-02-database-schema.md`](../plans/phase-02-database-schema.md)
