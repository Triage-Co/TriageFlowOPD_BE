# Phase 2 — Priority Engine (`QueuePriorityService`)

> Đọc `docs/queue/00-overview.md` trước. Phụ thuộc: Phase 1 (schema đã push, seed rules đã chạy).
> Kết quả: service tính điểm ưu tiên khi enqueue và thuật toán sắp thứ tự hàng chờ hoàn chỉnh, có unit test cho thuật toán sắp xếp.

## Mục tiêu

Tạo `src/routes/queue/queue-priority.service.ts` — bộ não của toàn hệ thống, gồm 2 chức năng:

1. `evaluateRulesForEntry` — chạy khi enqueue, trả về `base_priority` + `applied_rules`.
2. `computeQueueOrder` — trả về thứ tự hàng chờ cuối cùng của 1 phòng tại thời điểm gọi.

Phase này CHỈ tạo service + đăng ký vào `QueueModule` + unit test. Việc gọi nó từ các luồng nghiệp vụ là Phase 3/4.

## 1. `evaluateRulesForEntry`

```typescript
interface RuleEvaluationInput {
  patient: { dob: Date | null; gender: GenderTypeEnum } | null;
  queueType: QueueTypeEnum;
  suggestedPriority: number | null;   // Triage_Information.suggested_priority (mới nhất của bệnh nhân)
  vitals: { temperature: number | null; heart_rate: number | null; spo2: number | null; blood_pressure_sys: number | null } | null; // Visit_Session theo booking
  appointmentOnTime: boolean;         // booking có slot + thời điểm enqueue nằm trong [start_time - 30ph, end_time]
  missedCount: number;
  roomType: ClinicalRoomType | null;  // của phòng đích
  specialtyId: string | null;         // của phòng đích
}

interface RuleEvaluationResult {
  basePriority: number;                                  // tổng weight các rule khớp
  appliedRules: { rule_code: string; weight: number }[]; // snapshot lưu vào Queue.applied_rules
}

async evaluateRulesForEntry(input: RuleEvaluationInput): Promise<RuleEvaluationResult>
```

Logic:

1. Load rules `is_active = true`, `rule_type` thuộc nhóm tính điểm (`PATIENT_CATEGORY`, `APPOINTMENT`, `WALK_IN`, `TRANSFER`) — cache in-memory 60s (biến instance `{ data, loadedAt }`, không cần Redis).
2. **Scope filter**: giữ rule global (`room_type == null && specialty_id == null`) + rule khớp `room_type`/`specialty_id` của input. Nếu cùng `rule_code` có cả bản global và bản scoped khớp → chỉ dùng bản scoped (override).
3. Với mỗi rule, check `conditions` theo spec ở phase 1 (AND toàn bộ key; operators `eq/neq/gt/gte/lt/lte/in`). Field resolver:
   - `age`: `floor((now - dob) / 1 năm)`; nếu `dob` null → điều kiện về age coi như KHÔNG khớp.
   - `gender`, `queue_type`, `missed_count`: trực tiếp từ input.
   - `suggested_priority`, `temperature`, `heart_rate`, `spo2`, `blood_pressure_sys`: null → không khớp.
   - `appointment_on_time`: boolean từ input.
   - Field không nhận diện được trong conditions → rule đó không khớp (fail-safe), log warning.
4. Cộng dồn `weight` các rule khớp; `conditions` rỗng/`{}` = luôn khớp (dùng cho baseline).

Viết helper `matchConditions(conditions: Record<string, any>, facts: Record<string, unknown>): boolean` thuần túy (pure function, export riêng để test).

## 2. `computeQueueOrder`

```typescript
interface OrderedQueueEntry {
  queue: Queue;              // kèm step + flow + booking + patient (include sẵn)
  effectiveScore: number;    // base_priority + aging
  position: number;          // 0-based sau khi áp mọi lớp
  reasons: string[];         // rule codes + cờ PINNED/HOLD/INTERLEAVE để FE hiển thị lý do
}

async computeQueueOrder(roomId: string): Promise<OrderedQueueEntry[]>
```

Input là các bản ghi `Queue` của phòng với `status` thuộc `[PENDING, QUEUED, MISSING?]` — chỉ lấy `PENDING`/`QUEUED` (MISSING không xếp hàng cho tới khi recall). KHÔNG lấy `CALLED`/`SERVING`/`FINISHED`/`CANCELLED`.

Thuật toán (viết thành pure function `orderEntries(entries, rules, now)` export riêng để test):

```text
1. effectiveScore = base_priority + agingRate * số_phút_chờ(now - enqueued_at)
   agingRate: từ rule AGING active có scope khớp phòng (scoped đè global); mặc định 0 nếu không có rule.

2. Chia 3 nhóm:
   - PINNED:     is_pinned = true                          → sort theo pinned_at ASC (pin trước đứng trước)
   - INTERLEAVE: queue_type ∈ {RETURNING, QUICK_TASK}      → sort theo effectiveScore DESC, tie: enqueued_at ASC
   - REGULAR:    còn lại                                    → sort theo effectiveScore DESC, tie: enqueued_at ASC

3. Merge REGULAR và INTERLEAVE theo tỉ lệ interleave_ratio (mặc định 1:1, đọc từ params rule
   RETURNING_INTERLEAVE nếu có): lấy 1 REGULAR rồi 1 INTERLEAVE, lặp; nhóm nào hết thì lấy nốt nhóm kia.

4. Áp hold_positions: duyệt danh sách merged; entry có hold_positions = n mà đang ở index < n
   → dời xuống đúng index n (các entry khác dồn lên). Duyệt theo thứ tự index tăng dần, xử lý từng entry một.

5. Prepend nhóm PINNED lên đầu (pinned bỏ qua interleave và hold).

6. Gán position = index, build reasons: rule codes từ applied_rules, cộng "AGING+x.x" nếu aging > 0,
   "PINNED" / "HOLD_n" / "INTERLEAVE" theo nhóm.
```

Tie-break cuối cùng luôn deterministic: `enqueued_at ASC`, rồi `queue_number ASC`.

**Aging tính tại thời điểm đọc** — không có cron re-score, không update DB trong `computeQueueOrder` (hàm read-only).

## 3. Đăng ký module

- Thêm `QueuePriorityService` vào `providers` + `exports` của `src/routes/queue/queue.module.ts`.
- Service inject `PrismaService` (import từ `src/shared/config/prisma.service` — theo pattern của `queue.service.ts`).

## 4. Unit test

Tạo `src/routes/queue/queue-priority.service.spec.ts` test 2 pure function (KHÔNG cần mock Prisma/NestJS TestingModule cho phần thuật toán):

- `matchConditions`: mỗi operator 1 case; field null không khớp; conditions rỗng luôn khớp; field lạ không khớp.
- `orderEntries`:
  - Score cao đứng trước; tie-break theo enqueued_at.
  - Aging: entry chờ lâu vượt entry weight cao hơn khi đủ phút.
  - Pinned luôn đứng đầu, 2 pinned giữ thứ tự pinned_at.
  - Interleave 1-1: [R1,R2,R3] + [I1,I2] → R1,I1,R2,I2,R3.
  - hold_positions=3 với hàng 5 người: entry bị hold không đứng trên index 3.
  - Hàng rỗng, hàng chỉ có interleave, hàng chỉ có pinned.

## Tiêu chí hoàn thành

- [ ] `queue-priority.service.ts` tồn tại, đăng ký trong `QueueModule`, build + lint pass.
- [ ] `orderEntries` + `matchConditions` là pure function được export, có unit test pass (`npx jest queue-priority`).
- [ ] `computeQueueOrder` trả về đúng shape `OrderedQueueEntry[]`, không mutate DB.

## Không được làm

- Không sửa `queue.service.ts`, `ticket.service.ts`, `step.service.ts` ở phase này.
- Không thêm endpoint mới.
- Không tính ETA (phase 5).
