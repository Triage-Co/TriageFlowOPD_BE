# Phase 7 — Admin Config & Heatmap

> Đọc `docs/queue/00-overview.md` trước. Phụ thuộc: Phase 5 (ETA/timestamps cho heatmap); mục room-services CRUD phụ thuộc Phase 6 (hoặc chỉ cần Phase 1 schema nếu làm trước Phase 6).
> Kết quả: admin quản trị được toàn bộ rule/mapping/duration qua API; dashboard heatmap REST hoàn chỉnh.

## Mục tiêu

1. CRUD `Queue_Priority_Rule` (bao gồm rule REBALANCE) cho admin.
2. CRUD `Room_Service` mapping.
3. Heatmap snapshot theo phòng.

Tất cả endpoint prefix `/queue/admin/*`, guard: `IsAuthGuard` + `is-role.guard.ts` với role `ADMIN` (xem cách các controller khác dùng 2 guard này — grep `RolesGuard`/`Roles(` trong `src/routes/`).

## 1. CRUD Priority Rules

```
GET    /queue/admin/rules            ?rule_type=&is_active=&room_type=&specialty_id=
POST   /queue/admin/rules
PATCH  /queue/admin/rules/:ruleId
DELETE /queue/admin/rules/:ruleId    (soft: set is_active = false; KHÔNG hard delete để giữ applied_rules audit)
```

DTO validation (class-validator, file `src/routes/queue/dto/admin-rule.dto.ts`):

- `rule_code`: bắt buộc khi POST, regex `^[A-Z0-9_]+$`, unique (bắt lỗi P2002 → BadRequest tiếng Việt).
- `rule_type`: enum `QueueRuleTypeEnum`.
- `weight`: int -100..100. `aging_rate`: float 0..10.
- `conditions`: validate cấu trúc bằng hàm thủ công — mỗi key phải thuộc danh sách field hỗ trợ (xem phase 1: `age, gender, queue_type, suggested_priority, temperature, heart_rate, spo2, blood_pressure_sys, appointment_on_time, missed_count`), mỗi value object chỉ chứa operator hợp lệ (`eq/neq/gt/gte/lt/lte/in`). Sai → `BadRequestException` nêu rõ key lỗi.
- `params`: validate theo `rule_type` (vd MISSED_TURN phải có `hold_positions` int > 0; REBALANCE phải có `eta_gap_minutes` > 0).
- `room_type`: enum `ClinicalRoomType` nullable; `specialty_id`: uuid nullable, phải tồn tại.

Sau mỗi mutation: invalidate cache rules trong `QueuePriorityService` (thêm method `clearRulesCache()` public, gọi từ admin service).

## 2. CRUD Room-Service mapping

```
GET    /queue/admin/room-services        ?room_id=&service_id=
POST   /queue/admin/room-services        Body: { room_id, service_id }
DELETE /queue/admin/room-services/:id    (hard delete OK)
PATCH  /queue/admin/room-services/:id    Body: { is_active }
```

- Validate room/service tồn tại; room phải có `room_type` phù hợp loại phòng thực hiện dịch vụ (warning trong response nếu room_type là CLINICAL — không chặn nhưng cảnh báo vì load balancing chỉ áp dụng phòng CLS/thủ thuật).
- Unique `[room_id, service_id]` — bắt P2002.

## 3. Cấu hình default duration (hoàn thiện từ phase 5)

```
GET   /queue/admin/room-stats            ?room_id=      → danh sách Room_Service_Stat kèm room_name
PATCH /queue/admin/room-stats/:roomId    Body: { step_type, default_duration_sec }  (đã có từ phase 5, chuyển vào nhóm admin nếu chưa đúng prefix)
```

## 4. Heatmap — `GET /queue/admin/heatmap`

Snapshot tính TRỰC TIẾP từ bảng `queue` của ngày hiện tại (timezone `Asia/Ho_Chi_Minh`) + ETA service. KHÔNG tạo bảng aggregate. FE tự polling 15-30s.

Response per phòng có hoạt động hôm nay (hoặc mọi phòng có queue entry hôm nay):

```json
{
  "code": 200, "status": "success", "message": "Lấy dữ liệu heatmap thành công",
  "data": {
    "generated_at": "2026-08-03T10:00:00+07:00",
    "rooms": [
      {
        "room_id": "...",
        "room_name": "XN Máu 1",
        "room_type": "LABORATORY",
        "physical_room_id": "...",        // để FE tô màu lên bản đồ indoor có sẵn
        "specialty_name": "...",
        "waiting_count": 12,
        "serving_count": 1,
        "missing_count": 2,
        "avg_wait_minutes_today": 25.5,   // AVG(serving_started_at - enqueued_at) các entry đã được gọi hôm nay
        "max_current_wait_minutes": 47,   // MAX(now - enqueued_at) các entry đang QUEUED
        "expected_service_minutes": 12,   // từ ETA service
        "eta_full_queue_minutes": 150,    // totalWaitingSec / 60
        "completed_today": 34,
        "congestion_level": "HIGH"        // LOW < 15ph, MEDIUM 15-30ph, HIGH > 30ph theo eta_full_queue
      }
    ],
    "summary": {
      "total_waiting": 145,
      "busiest_room_id": "...",
      "avg_wait_minutes_all": 22.1
    }
  }
}
```

Ghi chú triển khai:

- 1 query groupBy `queue` theo `room_id` + `status` cho các count; 1 query aggregate cho avg/max wait; ghép với ETA per room (gọi `computeEtaForRoom` cho từng phòng có người chờ — chấp nhận N queries vì số phòng hữu hạn; nếu chậm, chỉ tính ETA cho phòng `waiting_count > 0`).
- `avg_wait_minutes_today`: entries hôm nay có `serving_started_at != null`.
- Ngưỡng congestion_level hard-code 15/30 phút (có thể đọc từ rule REBALANCE params nếu tiện).

## 5. Tổ chức code

- Controller mới: `src/routes/queue/queue-admin.controller.ts` (đăng ký trong `QueueModule`).
- Service mới: `src/routes/queue/queue-admin.service.ts` (CRUD + heatmap; inject PrismaService, QueueEtaService, QueuePriorityService).
- Swagger đầy đủ, tag `Queue Admin`.

## Tiêu chí hoàn thành

- [ ] CRUD rules: tạo/sửa/tắt rule qua API làm thay đổi hành vi xếp hàng ngay (sau cache 60s hoặc clearRulesCache) — kiểm chứng bằng cách đổi weight và xem lại thứ tự.
- [ ] Conditions/params sai cấu trúc bị chặn với message rõ ràng.
- [ ] CRUD room-services hoạt động, ảnh hưởng nhóm phòng của load balancing (phase 6).
- [ ] Heatmap trả đủ field như spec, số liệu khớp dữ liệu thật; user không phải ADMIN bị 403.
- [ ] Build + lint pass, toàn bộ test pass.

## Không được làm

- Không thêm WebSocket cho heatmap (đã chốt REST polling).
- Không tạo bảng thống kê lịch sử.
- Không xây UI.
