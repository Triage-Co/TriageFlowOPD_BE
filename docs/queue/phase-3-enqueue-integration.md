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

1. **Feature flag check**: đọc `process.env.QUEUE_ENGINE_ENABLED`. Nếu `'false'` → tạo Queue record cơ bản (chỉ `step_id`, `queue_number`, `room_id`, `status = QUEUED`) mà KHÔNG evaluate rules / set `base_priority` / `applied_rules`. Return ngay.
2. Load step kèm `room` (lấy `room_type`, `specialty_id`), `flow.booking.patient`, `flow.booking.slot.shift`, `flow.booking.visitSession`.
3. Lấy `Triage_Information.suggested_priority` mới nhất theo patient — dùng helper riêng `getLatestTriagePriority(patientId): Promise<number | null>`: query `Triage_Information` JOIN `Patient_Answer` WHERE `patient_answer.patient_id = patientId` ORDER BY `created_at DESC` LIMIT 1. Nếu không truy được → null, không throw.
4. **Idempotent check**: query `Queue` WHERE `step_id = stepId` AND `status NOT IN (FINISHED, CANCELLED)`. Nếu có → return entry đó NGAY mà không tạo mới. **QUAN TRỌNG**: check này phải nằm TRONG transaction (dùng `tx` nếu truyền vào, hoặc tạo transaction mới) để tránh race condition với `generateServiceQueueNumber` gọi song song.
5. Nếu `step.room_id` null → throw `BadRequestException` message tiếng Việt.
6. Sinh `queue_number` bằng method riêng `generateQueueNumberForRoom(roomId, tx)`: count queue của phòng trong ngày + 1 (extract từ logic `generateServiceQueueNumber` hiện tại). Method này được export để phase 6 (confirm rebalance) tái sử dụng.
7. Gọi `evaluateRulesForEntry` với input build từ dữ liệu trên.
   - `appointmentOnTime`: booking có slot và thời điểm enqueue trong khoảng `[slot.start_time - 30 phút, slot.end_time]` của ngày `shift.date`. Extract thành pure function `isAppointmentOnTime(slotStartTime: string, slotEndTime: string, shiftDate: Date, checkTime: Date): boolean` — dùng `date-fns-tz` parse timezone `Asia/Ho_Chi_Minh`. Viết unit test cho hàm này (trong `queue.service.spec.ts`).
8. Tạo `Queue` với đầy đủ field mới: `room_id = step.room_id`, `queue_type`, `base_priority`, `applied_rules`, `enqueued_at = now()`, `status = QUEUED`.
9. Emit `queueGateway.emitQueueUpdate(roomId, payload)` — payload từ `getRoomDisplayPayload` (nếu đang trong transaction, emit sau khi commit; đơn giản nhất: emit ở caller sau transaction hoặc fire-and-forget sau await).

## 2. Điểm enqueue 1 — sau thanh toán (walk-in / dịch vụ)

Refactor `generateServiceQueueNumber(serviceOrderId)` trong `queue.service.ts` (được gọi từ `src/routes/transaction/transaction.service.ts` dòng ~168 và ~261 — GIỮ NGUYÊN signature để không sửa transaction.service):

- Với mỗi step đủ điều kiện (đã thanh toán, có room, chưa có queue) → gọi `enqueueStep(step.step_id, queueType)`. `enqueueStep` idempotent check sẽ skip nếu đã có entry → **KHÔNG duplicate Queue record**.
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
- Ghi `Move_Log` với `action_type: 'TRANSFERRED'` (chuyển phòng thủ công, KHÔNG phải `REBALANCED` — `REBALANCED` dành cho load balancing tự động ở phase 6), `payload { from_room_id, to_room_id }`.
- Emit WS cho cả 2 phòng.
- Guard: tạm dùng `IsAuthGuard` (phân quyền chi tiết làm ở phase 4, chạy liên tục nên không có khoảng trống bảo mật).

## 6. Display payload dùng thứ tự engine

Sửa `getRoomDisplayPayload` trong `queue.service.ts`:

- `upcoming_patients`: thay query `step.findMany + orderBy created_at` bằng `computeQueueOrder(roomId)` (lấy 5 entry đầu). Giữ nguyên shape `{ queue_number, patient_name }`, THÊM field mới không phá FE: `queue_type`, `priority_reasons` (mảng `reasons` từ engine). **TV display không cần guard** (public endpoint).
- `current_patient`: dựa trên queue entry `status = SERVING` hoặc `CALLED` của phòng (fallback logic cũ theo step IN_PROGRESS nếu không có).
- Xóa bản duplicate `getRoomDisplayPayload` trong `ticket.service.ts` (dòng ~432) — thay bằng gọi `queueService.getRoomDisplayPayload`. Hợp nhất: param `staffId` optional, chỉ filter khi có giá trị. Dùng `forwardRef` trong TicketModule import QueueModule nếu gặp circular dependency.
- Param `staffId` giữ optional: TV payload truyền null, staff view truyền staffId.

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
