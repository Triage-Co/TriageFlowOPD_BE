# Phase 6 — Load Balancing Giữa Các Hàng Chờ Tương Đương

> Đọc `docs/queue/00-overview.md` trước. Phụ thuộc: Phase 5 (cần ETA service).
> Kết quả: bệnh nhân xét nghiệm/thủ thuật mới được route vào phòng ít tải nhất; khi 1 phòng nghẽn, hệ thống sinh gợi ý chuyển và staff xác nhận để thực thi.

## Phạm vi áp dụng — QUAN TRỌNG

Chỉ áp dụng cho hàng chờ **KHÔNG gắn booking/bác sĩ cụ thể**: step có `step_type` thuộc:

```typescript
const REBALANCEABLE_STEP_TYPES = [LAB_TEST, IMAGING, PROCEDURE, FUNCTIONAL_EXPLORATION];
```

Phòng khám lâm sàng (CLINICAL — bệnh nhân đặt lịch với bác sĩ/chuyên khoa cụ thể) **không bao giờ** bị điều phối. Mọi hàm trong phase này phải check điều kiện này.

Nhóm phòng tương đương được xác định bằng bảng `Room_Service` (phase 1 đã seed cơ bản): các phòng cùng làm được `service` của step đó (match qua `step.service_code` → `Service` → `Room_Service.room_id`).

## 1. Chọn phòng least-ETA lúc enqueue (Lớp 1)

Sửa `src/routes/service_order/service_order.service.ts`, nhánh `else if (service.room_type)` (dòng ~128-135, hiện gọi `findBestRoomByRoomType`):

```text
1. Nếu service.type/step sắp tạo KHÔNG thuộc REBALANCEABLE_STEP_TYPES → giữ nguyên logic cũ.
2. Query Room_Service: các phòng is_active làm được service này.
3. Nếu rỗng → fallback logic cũ (findBestRoomByRoomType). KHÔNG throw.
4. Nếu có ≥ 1 phòng → tính totalWaitingSec (QueueEtaService.computeEtaForRoom) từng phòng, chọn nhỏ nhất.
```

`ServiceOrderModule` import `QueueModule` (forwardRef nếu vòng lặp).

## 2. Detector nghẽn + sinh suggestion (Lớp 2)

Tạo `src/routes/queue/queue-rebalance.service.ts`:

```typescript
async detectAndSuggest(): Promise<{ created: number }>
```

```text
1. Đọc config từ rule REBALANCE_DEFAULT (Queue_Priority_Rule, rule_type = REBALANCE, scoped đè global):
   { eta_gap_minutes = 15, enabled = true, suggestion_ttl_minutes = 10 }. enabled = false → return.
2. Gom nhóm: mọi service có ≥ 2 phòng active trong Room_Service → mỗi service là 1 nhóm phòng.
3. Với mỗi nhóm:
   a. Tính totalWaitingSec từng phòng (ETA service).
   b. gap = max - min. Nếu gap <= eta_gap_minutes * 60 → bỏ qua.
   c. Chọn ứng viên từ phòng max: duyệt từ CUỐI danh sách computeQueueOrder (ưu tiên thấp nhất trước),
      lọc: status = QUEUED, không is_pinned, không CALLED/SERVING, step_type thuộc REBALANCEABLE,
      service của step nằm trong mapping của phòng đích, CHƯA có suggestion PENDING nào cho queue đó.
      **Atomic check**: query suggestion PENDING WHERE queue_id nằm TRONG transaction để tránh cron + enqueue trigger tạo duplicate.
   d. Số lượng chuyển: k nhỏ nhất sao cho sau khi chuyển k người, gap ước tính <= ngưỡng
      (mỗi người chuyển: nguồn -expectedDuration(nguồn), đích +expectedDuration(đích)). Giới hạn k <= 3/lần chạy.
   e. Tạo Queue_Rebalance_Suggestion: from_room, to_room (phòng min ETA), eta_gain_sec = gap hiện tại,
      status PENDING, expires_at = now + suggestion_ttl_minutes.
   f. Emit WS tới cả 2 phòng: event mới 'onRebalanceSuggestion' (thêm method emitRebalanceSuggestion
      vào queue.gateway.ts, emit tới room_${roomId} của cả 2 phòng).
4. Đánh EXPIRED mọi suggestion PENDING có expires_at < now (làm đầu hàm).
```

Trigger:

- **Cron mỗi 2 phút** trong `cron.service.ts`: `@Cron('*/2 * * * *')` gọi `detectAndSuggest()` (import QueueModule vào CronModule).
- **Sau mỗi enqueue** vào phòng thuộc nhóm rebalanceable: gọi fire-and-forget (không await chặn response, catch log lỗi).

## 3. Confirm / Reject flow

Endpoints trong `queue.controller.ts` (hoặc controller mới `queue-rebalance.controller.ts` trong cùng module):

**`GET /queue/rebalance/suggestions?room_id=`**

- Trả suggestions `PENDING` chưa hết hạn. `room_id` optional: staff truyền phòng mình (guard `assertCanManageRoom`), ADMIN không truyền = xem tất cả.
- Kèm thông tin hiển thị: queue_number, patient_name, from/to room_name, eta_gain phút.

**`POST /queue/rebalance/suggestions/:id/confirm`**

Guard: ADMIN hoặc staff phòng nguồn HOẶC phòng đích (`assertCanManageRoom` với 1 trong 2). Transaction:

```text
1. Validate: status = PENDING, chưa hết hạn; queue entry vẫn QUEUED (đã bị gọi/hủy → BadRequest 'Gợi ý không còn hiệu lực').
2. Update step.room_id = to_room_id; staff_id của step: set null (phòng mới tự phân staff theo shift khi gọi).
3. Update queue: room_id = to_room_id, queue_number = số mới theo phòng đích (dùng `generateQueueNumberForRoom(toRoomId, tx)` đã extract ở phase 3),
   GIỮ NGUYÊN enqueued_at, base_priority, applied_rules, queue_type (bảo toàn aging).
4. Suggestion: status = CONFIRMED, confirmed_by = user.account_id.
5. Move_Log: action_type 'REBALANCED', actor_account_id, payload { from_room_id, to_room_id, suggestion_id, old_queue_number, new_queue_number }.
6. Notification cho bệnh nhân (bảng Notification: account_id của patient qua `Patient.account_id`, message tiếng Việt nêu phòng mới + số mới). Lưu ý: chỉ ghi DB, FE cần poll hoặc dùng WS event để hiển thị.
7. Sau commit: emitQueueUpdate cho CẢ 2 phòng.
```

**`POST /queue/rebalance/suggestions/:id/reject`** — status = REJECTED, confirmed_by = user. Cùng guard.

## 4. Điều kiện tương thích với engine

- Entry được chuyển sang phòng mới tham gia `computeQueueOrder` của phòng đích ngay (đã có room_id mới) — không cần code thêm, xác nhận hoạt động.
- ETA phòng nguồn/đích tự phản ánh ở lần đọc kế tiếp.

## Tiêu chí hoàn thành

- [ ] Service order mới cho xét nghiệm được gán vào phòng ETA thấp nhất trong mapping; service chưa có mapping vẫn hoạt động như cũ (fallback).
- [ ] Dựng dữ liệu test: 2 phòng cùng service, dồn hàng vào 1 phòng vượt ngưỡng → cron/enqueue sinh suggestion PENDING, đẩy WS.
- [ ] Confirm: bệnh nhân xuất hiện trong hàng phòng mới với số mới, aging giữ nguyên (waited_minutes không reset), notification tạo, Move_Log ghi, TV 2 phòng cập nhật.
- [ ] Reject và expire (quá TTL) hoạt động.
- [ ] Queue entry CLINICAL/pinned/đang CALLED không bao giờ được gợi ý chuyển.
- [ ] Build + lint pass, test cũ pass.

## Không được làm

- Không tự động chuyển khi chưa confirm (chế độ auto là đề xuất tương lai, KHÔNG làm).
- Không rebalance step CLINICAL hoặc step gắn booking với bác sĩ cụ thể.
- Không xây UI — chỉ backend + WS event.
