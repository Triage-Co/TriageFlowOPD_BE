# Phase 4 — Lifecycle Endpoints: Call-Next Auto, Override, Miss/Recall, Phân Quyền

> Đọc `docs/queue/00-overview.md` trước. Phụ thuộc: Phase 3.
> Kết quả: bộ endpoint vận hành hàng chờ hoàn chỉnh với phân quyền, audit log và realtime update; cron tự xử lý vắng mặt.

## Mục tiêu

1. `call-next` tự động chọn người đứng đầu theo engine, ghi lifecycle timestamps.
2. Manual override (pin-top / move-to-position) cho ADMIN hoặc staff phụ trách phòng.
3. Miss / recall theo rule MISSED_TURN.
4. Mọi hành động ghi `Move_Log` + emit WebSocket.

## 1. Guard phân quyền `RoomStaffGuard`

Tạo helper/guard kiểm tra: user hiện tại được thao tác trên phòng `roomId` khi thỏa MỘT trong:

- `role === ADMIN`, HOẶC
- Staff có `Shift` tại phòng đó hôm nay (`shift.staff_id = user.id AND shift.room_id = roomId AND shift.date = hôm nay` — so sánh ngày: trích date từ `Shift.date` (Timestamptz) bằng `date-fns-tz` với timezone `Asia/Ho_Chi_Minh`, so với ngày hiện tại cùng timezone), HOẶC
- Là staff được gán trực tiếp trên step đang thao tác (`step.staff_id = user.id`).

Cách triển khai gọn: guard `IsAuthGuard` + check nghiệp vụ trong service (method private `assertCanManageRoom(user, roomId, stepId?)` throw `ForbiddenException`). Tham khảo cách `ticket.service.ts` check ownership với `currentUser` (dòng ~337) và decorator/cách lấy user hiện tại trong các controller có sẵn (tìm `@Req()` hoặc custom decorator trong `src/routes/auth/`).

## 2. Rework `POST /queue/call-next`

DTO mới (sửa `src/routes/queue/dto/create-queue.dto.ts`): `step_id` trở thành **optional**; `room_id` required; `staff_id` required (giữ backward compatible — FE cũ truyền đủ 3 field vẫn chạy).

Logic mới trong `callNextPatient`:

1. `assertCanManageRoom`.
2. Xử lý lượt đang phục vụ (nếu có): kiểm tra queue entry `status = SERVING` của phòng:
   - Nếu `step.step_status === COMPLETED` (bác sĩ đã hoàn thành khám/kê đơn trong lượt) → `status = FINISHED`, `finished_at = now()`. Ghi `Move_Log` `action_type: 'FINISHED'`.
   - Nếu `step.step_status !== COMPLETED` (bác sĩ gọi lượt mới khi bệnh nhân trước chưa hoàn thành/không có mặt) → **tự động chuyển thành `MISSING`**, `missed_at = now()`, `missed_count += 1`, `step.step_status = PENDING`. Ghi `Move_Log` `action_type: 'MISSED'` (lý do: "Tự động đánh dấu vắng mặt khi gọi lượt tiếp theo").
3. Chọn người tiếp theo:
   - Nếu body có `step_id` → gọi đích danh (validate step thuộc phòng, có queue entry active).
   - Nếu không → `computeQueueOrder(roomId)[0]`; hàng rỗng → `BadRequestException('Hàng chờ trống')`.
4. **Optimistic locking**: dùng update với condition `status IN ['PENDING', 'QUEUED']` trên queue entry được chọn.
5. Update queue entry: `status = SERVING`, set cả `called_at = now()` và `serving_started_at = now()`; step → `IN_PROGRESS`. Ghi `Move_Log` `action_type: 'CALLED'`.
6. Emit `emitQueueUpdate`, trả về display payload.

Toàn bộ trong `prisma.$transaction`.

## 3. Manual override — `POST /queue/:queueId/override`

```
Body: { action: 'PIN_TOP' | 'MOVE_TO_POSITION' | 'UNPIN', position?: number, reason?: string }
```

- `PIN_TOP`: set `is_pinned = true, pinned_at = now()`. (Use case #2 priority.md — chèn next-in-line.)
- `MOVE_TO_POSITION`: cơ chế đơn giản hóa — set `hold_positions = position` và `is_pinned = false` nếu muốn đẩy XUỐNG; nếu muốn đẩy LÊN vị trí cụ thể, set `is_pinned = true` + `pinned_at` (pin nhiều người thì thứ tự theo pinned_at). Ghi rõ trong Swagger rằng position là "đứng sau ít nhất n người".
- Hủy pin: `action: 'UNPIN'` → `is_pinned = false, pinned_at = null`.
- Guard: `assertCanManageRoom(user, queue.room_id)`.
- Ghi `Move_Log`: `action_type: 'PINNED_TOP' | 'MOVED_POSITION'`, `actor_account_id`, `reason`, `payload { from_position, to_position }` (from_position lấy từ computeQueueOrder trước khi đổi).
- Emit WS.

## 4. Miss / Recall — use case #3 priority.md

**`POST /queue/:queueId/miss`** (staff bấm khi gọi mà bệnh nhân vắng):

- Điều kiện: entry đang `CALLED`/`SERVING` hoặc đứng đầu hàng. Set `status = MISSING`, `missed_at = now()`, `missed_count += 1`; step quay về `PENDING`. Ghi Move_Log `MISSED`. Emit WS.

**`POST /queue/:queueId/recall`** (bệnh nhân quay lại):

- Điều kiện: `status = MISSING`. Set `status = QUEUED`, `hold_positions = n` (đọc từ rule `MISSED_TURN_HOLD` params, scoped theo phòng, mặc định 3), `enqueued_at` GIỮ NGUYÊN (không mất aging). Ghi Move_Log `RECALLED`. Emit WS.
- Ai gọi: staff phòng đó, admin, hoặc kiosk (`is_kiosk.guard.ts` + orGuards nếu muốn cho bệnh nhân tự recall qua kiosk — làm nếu tiện, không bắt buộc).

## 5. `GET /queue/room/:roomId` — view vận hành cho staff

Trả về danh sách đầy đủ từ `computeQueueOrder`:

```json
{
  "code": 200, "status": "success", "message": "...",
  "data": {
    "room_id": "...",
    "serving": { "queue_id": "...", "queue_number": "...", "patient_name": "...", "serving_started_at": "..." },
    "waiting": [
      {
        "position": 0, "queue_id": "...", "queue_number": "...", "patient_name": "...",
        "queue_type": "RETURNING", "effective_score": 12.4, "reasons": ["GERIATRIC", "AGING+2.4"],
        "is_pinned": false, "enqueued_at": "...", "waited_minutes": 32
      }
    ],
    "missing": [ { "queue_id": "...", "queue_number": "...", "missed_at": "..." } ]
  }
}
```

Guard: `assertCanManageRoom`. Endpoint này dành cho **staff view** (full data, guarded).

TV display sử dụng `getRoomDisplayPayload` (phase 3) — **không cần guard** (public endpoint).

## 6. Cron trong `src/routes/cron/cron.service.ts`

- **Đóng cuối ngày**: 23h50 hằng ngày (`@Cron('50 23 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })`) — mọi queue entry của ngày còn `QUEUED/CALLED/SERVING/MISSING` → `CANCELLED` (khớp với cron `updateFlowAndStepExpired` hiện chạy 23h59 đánh ABANDONED flow). Các lượt `MISSING` sẽ giữ trạng thái trong suốt cả ngày cho đến mốc 23h50 này.

## 7. Swagger

Mọi endpoint mới có `@ApiOperation`, `@ApiBody` example, `@ApiResponse` — theo phong cách `queue.controller.ts` hiện tại.

## Tiêu chí hoàn thành

- [ ] `call-next` không truyền `step_id` tự chọn đúng người đầu hàng theo engine; truyền `step_id` vẫn hoạt động như cũ.
- [ ] Timestamps được ghi đúng: `called_at`, `serving_started_at` khi gọi; `finished_at` khi kết thúc.
- [ ] Override/miss/recall hoạt động và thứ tự trong `GET /queue/room/:roomId` phản ánh đúng (pin lên đầu, recall đứng sau ≥ n người).
- [ ] User không phải admin/staff phòng bị `ForbiddenException`.
- [ ] Mỗi hành động tạo 1 bản ghi `Move_Log` đúng `action_type`, `actor_account_id`, `payload`.
- [ ] 2 cron job đăng ký chạy không lỗi.
- [ ] Build + lint pass.

## Không được làm

- Không tính ETA (phase 5) — field ETA chưa xuất hiện trong response phase này.
- Không đụng vào logic chọn phòng của service_order (phase 6).
