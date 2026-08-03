# Phase 1 — Prisma Schema & Seed Rules

> Đọc `docs/queue/00-overview.md` trước. Phase này KHÔNG phụ thuộc phase nào.
> Kết quả: schema mới đã push vào DB, Prisma Client generate lại thành công, seed rules mặc định chạy được.

## Mục tiêu

Bổ sung toàn bộ cấu trúc dữ liệu cho queue management nâng cao vào `prisma/schema.prisma`, không phá vỡ dữ liệu/model hiện có.

## 1. Enums mới

Thêm vào `prisma/schema.prisma` (khu vực enums đầu file, cạnh `QueueStatusEnum`):

```prisma
enum QueueTypeEnum {
  NEW          // walk-in / bệnh nhân mới thường
  APPOINTMENT  // có lịch hẹn đặt trước qua app
  RETURNING    // đã khám lần 1, quay lại trả kết quả CLS
  TRANSFER     // được bác sĩ phòng khác chuyển sang hội chẩn
  QUICK_TASK   // việc nhanh: ký giấy, đóng dấu
  FOLLOW_UP    // tái khám trong ngày (hỏi thuốc...)
}

enum QueueRuleTypeEnum {
  PATIENT_CATEGORY // ưu tiên theo đối tượng: nhi, lão khoa, thai phụ, khuyết tật
  APPOINTMENT      // có lịch hẹn đúng giờ
  WALK_IN          // khách vãng lai (baseline)
  RETURNING        // trả kết quả CLS -> interleave
  MISSED_TURN      // lỡ lượt -> lùi n vị trí
  TRANSFER         // chuyển phòng hội chẩn
  QUICK_TASK       // thủ thuật nhanh -> interleave
  AGING            // tốc độ cộng điểm theo phút chờ
  REBALANCE        // config cho load balancing (phase 6): ngưỡng ETA, TTL suggestion
}

enum RebalanceSuggestionStatusEnum {
  PENDING
  CONFIRMED
  REJECTED
  EXPIRED
}
```

## 2. Mở rộng model `Queue` (hiện ở dòng ~427)

Model hiện tại chỉ có `queue_id, step_id, queue_number, status, created_at, updated_at, step, moveLogs`. Thay bằng:

```prisma
model Queue {
  queue_id     String          @id @default(uuid()) @db.Uuid
  step_id      String          @db.Uuid
  queue_number String
  status       QueueStatusEnum @default(PENDING)

  // ── Queue management nâng cao ──
  room_id       String?       @db.Uuid // denormalize từ step.room_id để query theo phòng
  queue_type    QueueTypeEnum @default(NEW)
  base_priority Int           @default(0) // tổng weight các rule khớp lúc enqueue
  applied_rules Json?         @db.JsonB   // snapshot [{rule_code, weight}] phục vụ audit/hiển thị lý do

  // Override cấu trúc
  is_pinned      Boolean   @default(false) // manual override lên đầu hàng
  pinned_at      DateTime? @db.Timestamptz()
  hold_positions Int?      // missed-turn: phải đứng sau ít nhất n người tại thời điểm recall

  // Lifecycle timestamps (nguồn dữ liệu cho ETA + heatmap)
  enqueued_at        DateTime  @default(now()) @db.Timestamptz() // mốc bắt đầu chờ (aging tính từ đây)
  called_at          DateTime? @db.Timestamptz()
  serving_started_at DateTime? @db.Timestamptz()
  finished_at        DateTime? @db.Timestamptz()
  missed_at          DateTime? @db.Timestamptz()
  missed_count       Int       @default(0)

  created_at DateTime @default(now()) @db.Timestamptz()
  updated_at DateTime @default(now()) @updatedAt @db.Timestamptz()

  step                 Step                         @relation(fields: [step_id], references: [step_id])
  room                 Room?                        @relation(fields: [room_id], references: [room_id])
  moveLogs             Move_Log[]
  rebalanceSuggestions Queue_Rebalance_Suggestion[]

  @@index([room_id, status])
  @@index([room_id, enqueued_at])
  @@map("queue")
}
```

Lưu ý: thêm `queues Queue[]` vào model `Room` (relation ngược).

## 3. Model mới `Queue_Priority_Rule`

```prisma
model Queue_Priority_Rule {
  rule_id     String            @id @default(uuid()) @db.Uuid
  rule_code   String            @unique // ví dụ: PEDIATRIC_ACUTE, GERIATRIC, PREGNANCY...
  name        String
  description String?           @db.Text
  rule_type   QueueRuleTypeEnum
  conditions  Json?             @db.JsonB // xem spec conditions bên dưới
  weight      Int               @default(0) // điểm cộng vào base_priority khi khớp
  aging_rate  Float             @default(0) // điểm/phút chờ (thường chỉ dùng cho rule AGING)
  params      Json?             @db.JsonB // tham số riêng theo rule_type, xem bên dưới
  room_type   ClinicalRoomType? // null = global; có giá trị = chỉ áp cho phòng loại này
  specialty_id String?          @db.Uuid  // null = global; có giá trị = chỉ áp cho chuyên khoa này
  is_active   Boolean           @default(true)
  created_at  DateTime          @default(now()) @db.Timestamptz()
  updated_at  DateTime          @default(now()) @updatedAt @db.Timestamptz()

  specialty Specialty? @relation(fields: [specialty_id], references: [specialty_id])

  @@index([rule_type, is_active])
  @@map("queue_priority_rule")
}
```

(Thêm `queuePriorityRules Queue_Priority_Rule[]` vào model `Specialty`.)

### Spec `conditions` JSON (engine phase 2 sẽ đọc format này)

Object phẳng, mỗi key là 1 field, value là object operator. TẤT CẢ điều kiện phải khớp (AND):

```json
{
  "age":                { "lte": 6 },
  "gender":             { "eq": "FEMALE" },
  "queue_type":         { "in": ["RETURNING", "QUICK_TASK"] },
  "temperature":        { "gte": 39 },
  "suggested_priority": { "gte": 8 },
  "appointment_on_time": { "eq": true }
}
```

Operators hỗ trợ: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`.
Fields hỗ trợ (engine resolve ở phase 2): `age` (từ `Patient.dob`), `gender`, `queue_type`, `suggested_priority` (từ `Triage_Information`), `temperature`, `heart_rate`, `spo2`, `blood_pressure_sys` (từ `Visit_Session`), `appointment_on_time` (booking có slot và check-in trong khung giờ slot), `missed_count`.

### Spec `params` JSON theo `rule_type`

- `MISSED_TURN`: `{ "hold_positions": 3 }` — lùi sau n người khi recall.
- `RETURNING` / `QUICK_TASK`: `{ "interleave_ratio": 1 }` — 1 số thường : 1 số nhóm này.
- `AGING`: không cần params, dùng cột `aging_rate`.
- `REBALANCE` (dùng ở phase 6): `{ "eta_gap_minutes": 15, "enabled": true, "suggestion_ttl_minutes": 10 }`.

## 4. Model mới `Room_Service_Stat` (dữ liệu ETA — phase 5 dùng)

```prisma
model Room_Service_Stat {
  id                   String       @id @default(uuid()) @db.Uuid
  room_id              String       @db.Uuid
  step_type            StepTypeEnum
  ema_duration_sec     Float?       // EMA thời gian phục vụ thực tế; null khi chưa có mẫu
  sample_count         Int          @default(0)
  default_duration_sec Int          @default(900) // fallback 15 phút, admin chỉnh được
  updated_at           DateTime     @default(now()) @updatedAt @db.Timestamptz()

  room Room @relation(fields: [room_id], references: [room_id], onDelete: Cascade)

  @@unique([room_id, step_type])
  @@map("room_service_stat")
}
```

## 5. Model mới `Room_Service` (mapping năng lực phòng — phase 6 dùng)

```prisma
model Room_Service {
  id         String   @id @default(uuid()) @db.Uuid
  room_id    String   @db.Uuid
  service_id String   @db.Uuid
  is_active  Boolean  @default(true)
  created_at DateTime @default(now()) @db.Timestamptz()

  room    Room    @relation(fields: [room_id], references: [room_id], onDelete: Cascade)
  service Service @relation(fields: [service_id], references: [service_id], onDelete: Cascade)

  @@unique([room_id, service_id])
  @@index([service_id, is_active])
  @@map("room_service")
}
```

Kiểm tra tên PK của model `Service` trong schema trước khi viết relation (hiện là `service_id`). Thêm relation ngược `roomServices Room_Service[]` vào cả `Room` và `Service`, và `roomServiceStats Room_Service_Stat[]` vào `Room`.

## 6. Model mới `Queue_Rebalance_Suggestion` (phase 6 dùng)

```prisma
model Queue_Rebalance_Suggestion {
  suggestion_id String                        @id @default(uuid()) @db.Uuid
  queue_id      String                        @db.Uuid
  from_room_id  String                        @db.Uuid
  to_room_id    String                        @db.Uuid
  eta_gain_sec  Int // ETA(phòng nguồn) - ETA(phòng đích) tại thời điểm sinh gợi ý
  status        RebalanceSuggestionStatusEnum @default(PENDING)
  confirmed_by  String?                       @db.Uuid // account_id người duyệt
  expires_at    DateTime                      @db.Timestamptz()
  created_at    DateTime                      @default(now()) @db.Timestamptz()
  updated_at    DateTime                      @default(now()) @updatedAt @db.Timestamptz()

  queue    Queue @relation(fields: [queue_id], references: [queue_id], onDelete: Cascade)
  fromRoom Room  @relation("RebalanceFromRoom", fields: [from_room_id], references: [room_id])
  toRoom   Room  @relation("RebalanceToRoom", fields: [to_room_id], references: [room_id])

  @@index([status, expires_at])
  @@index([from_room_id, status])
  @@map("queue_rebalance_suggestion")
}
```

(Thêm 2 relation ngược vào `Room`: `rebalanceSuggestionsFrom Queue_Rebalance_Suggestion[] @relation("RebalanceFromRoom")` và `rebalanceSuggestionsTo ... @relation("RebalanceToRoom")`.)

## 7. Mở rộng model `Move_Log` (hiện ở dòng ~440)

Thêm các cột:

```prisma
  actor_account_id String? @db.Uuid // ai thực hiện (null = hệ thống)
  reason           String?
  payload          Json?   @db.JsonB // { from_position, to_position, from_room_id, to_room_id, ... }
```

Giữ nguyên `action_type String?` — quy ước giá trị (dùng thống nhất từ phase 4): `CALLED`, `PINNED_TOP`, `MOVED_POSITION`, `MISSED`, `RECALLED`, `REBALANCED`, `FINISHED`.

## 8. Seed rules mặc định

Tạo `prisma/queue-rules.seed.ts` theo pattern của `prisma/room.seed.ts` (PrismaClient + PrismaPg adapter + dotenv, hàm `getPrismaClient()`). Upsert theo `rule_code` (chạy lại không duplicate). Seed các rule sau (từ [priority.md](./priority.md)):

| rule_code | rule_type | weight | conditions / params | Ghi chú |
| --- | --- | --- | --- | --- |
| `PEDIATRIC_ACUTE` | PATIENT_CATEGORY | 10 | `{"age": {"lte": 6}, "temperature": {"gte": 39}}` | Nhi cấp tính |
| `PEDIATRIC` | PATIENT_CATEGORY | 7 | `{"age": {"lte": 6}}` | Nhi thường |
| `GERIATRIC` | PATIENT_CATEGORY | 9 | `{"age": {"gte": 70}}` | Lão khoa |
| `TRIAGE_HIGH` | PATIENT_CATEGORY | 8 | `{"suggested_priority": {"gte": 8}}` | Ưu tiên từ triage (bao phủ thai phụ/khuyết tật do triage đánh giá) |
| `APPOINTMENT_ON_TIME` | APPOINTMENT | 6 | `{"appointment_on_time": {"eq": true}}` | Có hẹn đúng giờ |
| `WALK_IN_BASE` | WALK_IN | 0 | `{}` | Baseline |
| `RETURNING_INTERLEAVE` | RETURNING | 0 | params `{"interleave_ratio": 1}` | Trả kết quả CLS |
| `QUICK_TASK_INTERLEAVE` | QUICK_TASK | 0 | params `{"interleave_ratio": 1}` | Việc nhanh |
| `TRANSFER_PRIORITY` | TRANSFER | 8 | `{"queue_type": {"in": ["TRANSFER"]}}` | Chuyển hội chẩn: cao hơn khách mới, thấp hơn nhi cấp |
| `MISSED_TURN_HOLD` | MISSED_TURN | 0 | params `{"hold_positions": 3}` | Lỡ lượt lùi 3 người |
| `AGING_DEFAULT` | AGING | 0 | `aging_rate = 0.2` | +0.2 điểm/phút chờ (~1 bậc weight sau 5 phút) |
| `REBALANCE_DEFAULT` | REBALANCE | 0 | params `{"eta_gap_minutes": 15, "enabled": true, "suggestion_ttl_minutes": 10}` | Config load balancing |

Tất cả seed với `room_type = null`, `specialty_id = null` (global), `is_active = true`.

## 9. Các bước thực hiện

1. Sửa `prisma/schema.prisma` như trên (enums → Queue → models mới → Move_Log → relations ngược trên Room/Service/Specialty).
2. `npx prisma format` để chuẩn hóa và bắt lỗi relation.
3. `npx prisma db push` (KHÔNG dùng `migrate dev` — project không dùng migrations). Nếu db push cảnh báo mất dữ liệu ở cột đã có, dừng lại xem xét — các thay đổi trên chỉ THÊM cột/bảng nên không được phép có destructive change.
4. `npx prisma generate` (db push thường tự chạy, xác nhận lại).
5. Viết + chạy `npx ts-node prisma/queue-rules.seed.ts`, chạy 2 lần để xác nhận idempotent.
6. `npm run build` pass.

## Tiêu chí hoàn thành

- [ ] `npx prisma format` + `npx prisma db push` thành công, không destructive change.
- [ ] Bảng mới tồn tại trong DB: `queue_priority_rule`, `room_service_stat`, `room_service`, `queue_rebalance_suggestion`; bảng `queue`, `move_log` có cột mới.
- [ ] Seed chạy 2 lần không lỗi, đủ 12 rule.
- [ ] `npm run build` pass (code hiện tại không compile lỗi vì chỉ thêm field optional/default).

## Không được làm

- Không xóa/đổi tên bất kỳ cột hay enum value hiện có.
- Không sửa logic TypeScript nào ở phase này (trừ khi build lỗi do Prisma Client types — khi đó chỉ sửa tối thiểu).
