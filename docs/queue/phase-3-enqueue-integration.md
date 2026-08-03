# Phase 3 — Tích Hợp Engine Vào Các Điểm Enqueue

> Đọc `docs/queue/00-overview.md` trước. Phụ thuộc: Phase 2.
> Kết quả: mọi bản ghi `Queue` mới được tạo đều có `room_id`, `queue_type`, `base_priority`, `applied_rules`, `enqueued_at` đúng; bệnh nhân trả kết quả CLS tự động vào lại hàng với type RETURNING.

## Mục tiêu

Nối `QueuePriorityService.evaluateRulesForEntry` vào 4 điểm sinh/kích hoạt queue entry, và chuẩn hóa 1 hàm enqueue duy nhất.

## 1. Hàm enqueue tập trung trong `QueueService`

Thêm vào `src/routes/queue/queue.service.ts`:

```typescript
async enqueueStep(stepId: string, queueType: QueueTypeEnum, tx?: Prisma.TransactionClient): Promise<Queue>
```

Logic:

1. Load step kèm `room` (lấy `room_type`, `specialty_id`), `flow.booking.patient`, `flow.booking.slot.shift`, `flow.booking.visitSession`; lấy `Triage_Information.suggested_priority` mới nhất theo patient (join qua `Patient_Answer` hoặc `interview_token` — nếu không truy được thì null, không throw).
2. Nếu step đã có queue entry active (status không phải FINISHED/CANCELLED) → return entry đó (idempotent, thay cho check `step.queues.length > 0` hiện tại).
3. Nếu `step.room_id` null → throw `BadRequestException` message tiếng Việt.
4. Sinh `queue_number`: giữ logic hiện tại (count queue của phòng trong ngày + 1, xem `generateServiceQueueNumber` hiện tại) — bọc trong transaction để tránh race.
5. Gọi `evaluateRulesForEntry` với input build từ dữ liệu trên. `appointmentOnTime`: booking có slot và thời điểm enqueue trong khoảng `[slot.start_time - 30 phút, slot.end_time]` của ngày `shift.date` (slot `start_time`/`end_time` là string "HH:mm", `shift.date` là ngày — parse với timezone `Asia/Ho_Chi_Minh`, dùng `date-fns-tz` đã có trong dependencies).
6. Tạo `Queue` với đầy đủ field mới: `room_id = step.room_id`, `queue_type`, `base_priority`, `applied_rules`, `enqueued_at = now()`, `status = QUEUED`.
7. Emit `queueGateway.emitQueueUpdate(roomId, payload)` — payload từ `getRoomDisplayPayload` (nếu đang trong transaction, emit sau khi commit; đơn giản nhất: emit ở caller sau transaction hoặc fire-and-forget sau await).

## 2. Điểm enqueue 1 — sau thanh toán (walk-in / dịch vụ)

Refactor `generateServiceQueueNumber(serviceOrderId)` trong `queue.service.ts` (được gọi từ `src/routes/transaction/transaction.service.ts` dòng ~168 và ~261 — GIỮ NGUYÊN signature để không sửa transaction.service):

- Với mỗi step đủ điều kiện (đã thanh toán, có room, chưa có queue) → gọi `enqueueStep(step.step_id, queueType)`.
- `queueType`: `APPOINTMENT` nếu flow có booking với slot hợp lệ, ngược lại `NEW`.

## 3. Điểm enqueue 2 — check-in tại phòng

Trong `src/routes/ticket/ticket.service.ts` method `checkIn` (dòng ~309):

- Sau khi xác định step tại phòng: nếu step CHƯA có queue entry active → gọi `queueService.enqueueStep(...)` (type `APPOINTMENT`/`NEW` như trên). Nếu ĐÃ có → update `enqueued_at = now()` **chỉ khi** entry chưa từng check-in (thêm nhận biết đơn giản: nếu `status = PENDING` thì đây là lần check-in đầu → set `enqueued_at = now()` và `status = QUEUED`; nếu đã `QUEUED` thì giữ nguyên).
- Mục đích: `enqueued_at` phản ánh lúc bệnh nhân THẬT SỰ có mặt, aging và ETA tính từ đó.
- `TicketModule` cần import `QueueModule` (đã export QueueService). Cẩn thận vòng lặp module: `QueueGateway` (shared) đã forwardRef với QueueService — nếu gặp circular import giữa TicketModule/QueueModule, dùng `forwardRef`.

## 4. Điểm enqueue 3 — RETURNING sau CLS (use case #1 priority.md)

Trong `src/routes/step/step.service.ts`, method `unlockNextSteps` (dòng ~165): hiện khi mọi prerequisite hoàn thành thì set step kế tiếp thành `IN_PROGRESS`.

Sửa: sau khi unlock một step, nếu step đó có `room_id` và các prerequisite vừa xong là step CLS (prerequisite có `step_type` thuộc `LAB_TEST | IMAGING | PROCEDURE | FUNCTIONAL_EXPLORATION`) → gọi `queueService.enqueueStep(nextStep.step_id, QueueTypeEnum.RETURNING)`.

- `StepModule` import `QueueModule` (chú ý forwardRef nếu cần).
- Nếu step được unlock đã có queue entry active → `enqueueStep` idempotent trả entry cũ, nhưng cần UPDATE `queue_type = RETURNING` + re-evaluate `base_priority` cho entry đó (bổ sung param `forceType?: boolean` hoặc method riêng `requeueAsType(queueId, type)`).

## 5. Điểm enqueue 4 — TRANSFER (use case #4 priority.md)

Chưa có luồng "chuyển phòng hội chẩn" tường minh trong codebase. Bổ sung endpoint mới trong `queue.controller.ts`:

```
POST /queue/transfer
Body: { step_id: string, to_room_id: string, staff_id?: string }
```

- Update `step.room_id = to_room_id` (+ `staff_id` nếu truyền), hủy queue entry active cũ nếu có (`status = CANCELLED`), gọi `enqueueStep(step_id, QueueTypeEnum.TRANSFER)`.
- Ghi `Move_Log` (`action_type: 'REBALANCED'`? — KHÔNG, dùng `action_type: 'TRANSFERRED'`, thêm giá trị này vào quy ước) với `payload { from_room_id, to_room_id }`.
- Emit WS cho cả 2 phòng.
- Guard: tạm dùng `IsAuthGuard` (phân quyền chi tiết làm ở phase 4, nhất quán chuẩn guard tại đó).

## 6. Display payload dùng thứ tự engine

Sửa `getRoomDisplayPayload` trong `queue.service.ts`:

- `upcoming_patients`: thay query `step.findMany + orderBy created_at` bằng `computeQueueOrder(roomId)` (lấy 5 entry đầu). Giữ nguyên shape `{ queue_number, patient_name }`, THÊM field mới không phá FE: `queue_type`, `priority_reasons` (mảng `reasons` từ engine).
- `current_patient`: dựa trên queue entry `status = SERVING` hoặc `CALLED` của phòng (fallback logic cũ theo step IN_PROGRESS nếu không có).
- Xóa bản duplicate `getRoomDisplayPayload` trong `ticket.service.ts` (dòng ~432) — thay bằng gọi `queueService.getRoomDisplayPayload`. Lưu ý bản của ticket cho phép `staffId` rỗng — hợp nhất: param `staffId` optional, chỉ filter khi có giá trị.

## Tiêu chí hoàn thành

- [ ] `enqueueStep` là đường duy nhất tạo `Queue` record trong toàn codebase (grep `queue.create` chỉ còn trong QueueService/repository).
- [ ] Thanh toán xong → queue entry có đủ `room_id`, `queue_type`, `base_priority`, `applied_rules` (kiểm chứng bằng flow thật hoặc script nhỏ).
- [ ] Check-in đặt lại `enqueued_at` đúng lần đầu.
- [ ] Hoàn thành hết step CLS prerequisite → step khám kết luận có queue entry `RETURNING`.
- [ ] `POST /queue/transfer` hoạt động, ghi Move_Log, emit WS 2 phòng.
- [ ] TV payload giữ nguyên field cũ, thêm field mới; không còn code duplicate trong ticket.service.
- [ ] `npm run build` + `npm run lint` pass; test phase 2 vẫn pass.

## Không được làm

- Không đổi signature `generateServiceQueueNumber` (transaction.service đang gọi).
- Không sửa logic thanh toán/booking.
- Không implement call-next/override/miss (phase 4), ETA (phase 5).
