# Phase 5 — ETA Service (EMA + Fallback Config)

> Đọc `docs/queue/00-overview.md` trước. Phụ thuộc: Phase 4 (cần `serving_started_at`/`finished_at` được ghi khi call-next).
> Kết quả: ETA hiển thị cho staff view, TV display và bệnh nhân tra cứu ticket.

## Mục tiêu

Tạo `src/routes/queue/queue-eta.service.ts`:

1. Cập nhật EMA thời gian phục vụ mỗi khi một lượt kết thúc.
2. Tính ETA cho từng bệnh nhân trong hàng và tổng quan hàng chờ.

## 1. Cập nhật EMA — `recordServiceDuration`

```typescript
async recordServiceDuration(roomId: string, stepType: StepTypeEnum, durationSec: number): Promise<void>
```

- Gọi từ `callNextPatient` (phase 4) tại bước kết thúc lượt SERVING: `durationSec = finished_at - serving_started_at`. `stepType` từ `step.step_type`, null → dùng `OTHER`.
- Bỏ qua outlier: `durationSec < 30` (bấm nhầm) hoặc `> 7200` (quên đóng) → không cập nhật.
- Công thức EMA, α = 0.3:

```text
sample_count == 0:  ema = durationSec
sample_count > 0:   ema = 0.3 * durationSec + 0.7 * ema_cũ
```

- Upsert `Room_Service_Stat` theo `@@unique([room_id, step_type])`, tăng `sample_count`.
- Fire-and-forget từ call-next (không await trong transaction chính; lỗi chỉ log warning, không fail request).

## 2. Thời gian phục vụ kỳ vọng — `getExpectedDurationSec`

```typescript
async getExpectedDurationSec(roomId: string, stepType: StepTypeEnum): Promise<number>
```

- `Room_Service_Stat` có bản ghi và `sample_count >= 5` → dùng `ema_duration_sec`.
- Ngược lại → `default_duration_sec` (bản ghi có sẵn) hoặc 900 (chưa có bản ghi).

## 3. Tính ETA cho hàng chờ — `computeEtaForRoom`

```typescript
interface RoomEta {
  roomId: string;
  expectedDurationSec: number;
  currentServingRemainingSec: number; // max(0, expectedDuration - (now - serving_started_at)); không ai đang khám = 0
  entries: { queueId: string; position: number; etaSec: number; etaTime: string }[]; // etaTime = ISO now + etaSec
  totalWaitingSec: number; // ETA nếu xếp cuối hàng ngay bây giờ
}

async computeEtaForRoom(roomId: string): Promise<RoomEta>
```

```text
etaSec(entry tại position i) = currentServingRemainingSec + i * expectedDurationSec
totalWaitingSec              = currentServingRemainingSec + waiting_count * expectedDurationSec
```

- `position` lấy từ `computeQueueOrder(roomId)` (phase 2) — inject `QueuePriorityService`.
- Mô hình 1 server/phòng (đơn giản hóa có chủ đích — mỗi Room một bàn khám; KHÔNG chia theo staff).
- `expectedDurationSec` theo `step_type` phổ biến nhất trong hàng hiện tại (hoặc của từng entry nếu muốn chính xác hơn — chọn per-entry: `etaSec = remaining + Σ expectedDuration(các entry đứng trước)`; triển khai per-entry).

## 4. Gắn ETA vào các API

1. **`GET /queue/room/:roomId`** (phase 4): thêm `eta_minutes` (làm tròn phút) vào từng entry `waiting`, thêm `expected_service_minutes` vào root.
2. **TV payload `getRoomDisplayPayload`**: thêm `eta_minutes` vào từng phần tử `upcoming_patients` (giữ field cũ).
3. **`GET /ticket/:code`** (`src/routes/ticket/ticket.service.ts`, method `getTicketInfo`): với `current_step` có queue entry đang chờ, thêm vào response:

```json
"queue_info": {
  "queue_number": "12",
  "position": 4,
  "waiting_ahead": 4,
  "eta_minutes": 35,
  "eta_time": "2026-08-03T10:45:00+07:00",
  "queue_status": "QUEUED"
}
```

(`queue_info: null` nếu không có entry active.) `TicketModule` đã import QueueModule từ phase 3.

## 5. Admin chỉnh `default_duration_sec`

Endpoint tối thiểu (CRUD đầy đủ ở phase 7):

```
PATCH /queue/admin/room-stats/:roomId
Body: { step_type: StepTypeEnum, default_duration_sec: number }
```

Guard ADMIN (`is-role.guard.ts`). Upsert `Room_Service_Stat`.

## Tiêu chí hoàn thành

- [ ] Hoàn thành 1 lượt khám → `Room_Service_Stat` được upsert, `sample_count` tăng, EMA đúng công thức (kiểm bằng 2-3 lượt liên tiếp).
- [ ] ETA xuất hiện trong staff view, TV payload và `GET /ticket/:code`; phòng chưa có lịch sử dùng default 900s.
- [ ] Outlier không làm hỏng EMA.
- [ ] Unit test cho công thức EMA + `computeEtaForRoom` với mock order (pure logic tách được thì tách như phase 2).
- [ ] Build + lint pass, test cũ pass.

## Không được làm

- Không tạo bảng thống kê lịch sử theo giờ (đã chốt: heatmap chỉ cần snapshot — phase 7 tính trực tiếp từ bảng `queue` của ngày).
- Không đụng logic chọn phòng (phase 6).
