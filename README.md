<div align="center">

# 🏥 TriageFlow OPD

### Hệ thống AI phân loại thông minh và điều phối bệnh nhân khoa ngoại trú

### AI-Powered Smart Triage & Outpatient Dispatch System

[![NestJS](https://img.shields.io/badge/NestJS-v11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-v7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PostGIS-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Azure](https://img.shields.io/badge/Azure-Web_App-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white)](https://azure.microsoft.com/)

[English](#english) • [Tiếng Việt](#tiếng-việt)

</div>

---

<!-- ==================== ENGLISH ==================== -->

<a id="english"></a>

## 🌐 English

### 📋 Overview

**TriageFlow OPD** is a backend system designed to modernize and optimize the outpatient department (OPD) workflow in hospitals. The system leverages AI-based symptom analysis to intelligently triage patients, auto-generate clinical workflows (flows), manage priority-aware queues, and provide indoor navigation — all through a unified RESTful API.

The core idea is to **eliminate long wait times, reduce administrative burden, and ensure each patient is routed to the right specialty with the right priority**, from check-in to prescription dispensing.

### ✨ Key Features

| Module | Description |
|---|---|
| 🤖 **AI Triage** | Integrates with Infermedica API for symptom-based triage; maps AI-suggested specialties to hospital-specific clinical rooms |
| 🔄 **Flow Engine** | Automatically generates multi-step clinical workflows (Registration → Triage → Clinical → Lab/Imaging → Payment → Pharmacy) with dependency management |
| 📋 **Smart Queue** | Priority-aware queue management with configurable rules (appointment, pediatric, geriatric, returning patients, aging score, missed-turn penalty, load rebalancing) |
| 🗺️ **Indoor Navigation** | PostGIS-powered spatial model with graph-based routing (Dijkstra), supporting buildings, floors, rooms, doors, elevators, stairs, and scheduled blockages |
| 👨‍⚕️ **Doctor & Shift Management** | Doctor shift scheduling, slot-based appointment booking, specialty assignment |
| 💊 **Pharmacy & Prescription** | Complete prescription workflow from doctor ordering to pharmacist dispensing |
| 🧾 **Billing & Payment** | Service orders, invoices, PayOS payment gateway integration, transaction tracking |
| 📊 **Admin Dashboard** | Administrative analytics and reporting |
| 🏥 **Clinical Records** | Visit sessions with vital signs, diagnosis, HPI, PMH, physical examination, and clinical documents |
| 🔔 **Real-time Notifications** | WebSocket-based (Socket.IO) notifications for queue calls, status updates |
| 📦 **Exam Packages** | Pre-defined examination packages with flow templates |
| 🎟️ **Ticket System** | Unique ticket codes per patient flow for tracking |

### 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Apps                          │
│            (Mobile App / Web App / Kiosk)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │  HTTPS / WSS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    NestJS Backend (API)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │   Auth   │  │  Triage  │  │   Flow   │  │   Queue    │  │
│  │ (Supabase│  │(Inferme- │  │  Engine  │  │ (Priority  │  │
│  │  + JWT)  │  │  dica)   │  │          │  │  Rules)    │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  Booking │  │ Pharmacy │  │ Invoice  │  │ Navigation │  │
│  │ & Shift  │  │    Rx    │  │ & PayOS  │  │  (PostGIS) │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  Doctor  │  │  Visit   │  │  Admin   │  │ Real-time  │  │
│  │ & Staff  │  │ Session  │  │Dashboard │  │ (Socket.IO)│  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│  PostgreSQL  │ │  Redis   │ │   Supabase   │
│  + PostGIS   │ │  Cache   │ │   Auth       │
└──────────────┘ └──────────┘ └──────────────┘
```

### 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 24.x |
| **Framework** | NestJS 11 |
| **Language** | TypeScript 5.9 |
| **ORM** | Prisma 7 (with PostgreSQL adapter) |
| **Database** | PostgreSQL + PostGIS extension |
| **Cache** | Redis (via `cache-manager-redis-yet`) |
| **Auth** | Supabase Auth + Passport JWT + JWKS-RSA |
| **Payment** | PayOS (`@payos/node`) |
| **AI Triage** | Infermedica API |
| **Email** | Resend |
| **Real-time** | Socket.IO (`@nestjs/websockets`) |
| **Geo/Spatial** | Turf.js + PostGIS |
| **API Docs** | Swagger (`@nestjs/swagger`) |
| **Monitoring** | Sentry (`@sentry/nestjs`) |
| **Scheduling** | `@nestjs/schedule` (cron jobs) |
| **CI/CD** | GitHub Actions → Azure Web App |
| **Package Manager** | pnpm |

### 📁 Project Structure

```
src/
├── main.ts                      # Application entry point
├── app.module.ts                # Root module
├── routes/                      # Feature modules (33 modules)
│   ├── auth/                    # Authentication (Supabase + JWT)
│   ├── account/                 # User account management
│   ├── patient/                 # Patient profiles
│   ├── doctor/                  # Doctor operations
│   ├── staff/                   # Staff management
│   ├── specialty/               # Clinical specialties
│   ├── ai-specialty/            # AI ↔ Hospital specialty mapping
│   ├── infermedica/             # Infermedica AI triage integration
│   ├── triage_config/           # Triage configuration rules
│   ├── booking/                 # Appointment booking
│   ├── shift/                   # Doctor shift scheduling
│   ├── flow/                    # Clinical flow engine
│   ├── step/                    # Flow step management
│   ├── queue/                   # Smart queue system
│   ├── room/                    # Room management
│   ├── map/                     # Spatial layout (Building/Floor/Room)
│   ├── navigation/              # Indoor navigation & routing
│   ├── service/                 # Medical services catalog
│   ├── service_order/           # Service orders
│   ├── service_order_detail/    # Service order line items
│   ├── invoice/                 # Invoices
│   ├── invoice_detail/          # Invoice line items
│   ├── transaction/             # Payment transactions (PayOS)
│   ├── pharmacy/                # Pharmacy & dispensing
│   ├── visit-session/           # Visit sessions & clinical records
│   ├── clinical-document/       # Clinical documents
│   ├── template/                # Flow templates
│   ├── exam-package/            # Examination packages
│   ├── ticket/                  # Ticket code generation
│   ├── notification/            # Push notifications
│   ├── vnpt/                    # VNPT integration
│   ├── cron/                    # Scheduled tasks
│   └── admin-dashboard/         # Admin analytics
├── shared/                      # Shared layer
│   ├── config/                  # Prisma, Supabase, PayOS, Sentry, env
│   ├── repositories/            # Prisma repository implementations
│   ├── interfaces/              # Repository interfaces (DI contracts)
│   ├── guards/                  # JWT auth guards
│   ├── decorator/               # Custom decorators
│   ├── exceptions/              # Custom exception filters
│   ├── gateways/                # WebSocket gateways
│   ├── geo/                     # GeoService (PostGIS utilities)
│   ├── globals/                 # Global filters & interceptors
│   ├── constraint/              # Validation constraints
│   ├── template/                # Email/notification templates
│   └── types/                   # Shared TypeScript types
prisma/
├── schema.prisma                # Database schema (1250 lines, 40+ models)
├── *.seed.ts                    # Seed scripts (rooms, shifts, medicines, etc.)
└── generate-graph.ts            # Navigation graph generator
```

### 📊 Database Schema Overview

The system uses **40+ Prisma models** organized into the following domains:

| Domain | Key Models |
|---|---|
| **Identity** | `Account`, `Patient`, `Staff`, `Specialty` |
| **Scheduling** | `Shift`, `Slot`, `Booking` |
| **Clinical Flow** | `Flow`, `Step`, `Step_Dependency`, `Flow_Template`, `Exam_Package` |
| **Queue** | `Queue`, `Queue_Priority_Rule`, `Queue_Rebalance_Suggestion`, `Move_Log`, `Room_Service_Stat` |
| **Medical** | `Visit_Session`, `Clinical_Document`, `Prescription`, `Prescription_Detail`, `Medicine`, `Triage_Information`, `Patient_Answer` |
| **Billing** | `Service`, `Service_Order`, `Service_Order_Detail`, `Invoice`, `Invoice_Detail`, `Transaction` |
| **Spatial** | `Building`, `Floor`, `PhysicalRoom`, `Room`, `Area`, `Boundary`, `Door`, `Node`, `Edge`, `Connector`, `ScheduledBlockage` |
| **Directory** | `Category`, `Poi`, `FeatureTemplate`, `PlacedFeature` |
| **AI Mapping** | `AiSpecialty`, `AiSpecialtyMapping` |
| **Config** | `Triage_Config`, `Flow_Rules_Config`, `Notification` |

### 🚀 Getting Started

#### Prerequisites

- **Node.js** ≥ 24.x
- **pnpm** (package manager)
- **PostgreSQL** with PostGIS extension enabled
- **Redis** (optional, falls back to in-memory cache)
- **Supabase** project (for authentication)

#### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Triage-Co/TriageFlowOPD_BE.git
cd TriageFlowOPD_BE

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .demo.env .env
# Edit .env with your actual configuration (see Environment Variables section)

# 4. Generate Prisma client
npx prisma generate

# 5. Run database migrations
npx prisma db push

# 6. (Optional) Seed the database
npx tsx prisma/room.seed.ts
npx tsx prisma/medicine.seed.ts
npx tsx prisma/service.seed.ts
npx tsx prisma/shift.seed.ts
npx tsx prisma/queue-rules.seed.ts
```

#### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DIRECT_URL` | Direct PostgreSQL URL (for Prisma) |
| `REDIS_URL` | Redis connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon/service key |
| `SUPABASE_JWT_SECRET` | JWT secret for Supabase auth |
| `PAYOS_CLIENT_ID` | PayOS client ID |
| `PAYOS_API_KEY` | PayOS API key |
| `PAYOS_CHECKSUM_KEY` | PayOS checksum key |
| `INFERMEDICA_APP_ID` | Infermedica application ID |
| `INFERMEDICA_APP_KEY` | Infermedica API key |
| `RESEND_API_KEY` | Resend email API key |
| `SENTRY_DSN` | Sentry DSN for error monitoring |
| `KIOSK_KEY` | JWT secret for kiosk authentication |
| `PORT` | Server port (default: 3000) |

#### Running the Application

```bash
# Development (watch mode)
pnpm run start:dev

# Debug mode
pnpm run start:debug

# Production mode
pnpm run build
pnpm run start:prod
```

#### Running Tests

```bash
# Unit tests
pnpm run test

# Watch mode
pnpm run test:watch

# Coverage
pnpm run test:cov

# E2E tests
pnpm run test:e2e
```

### 📖 API Documentation

Once the server is running, access the **Swagger UI** at:

```
http://localhost:3000/api-docs
```

All API endpoints are prefixed with `/api`. The documentation includes all 33+ modules with request/response schemas, authentication requirements, and example payloads.

### 🚢 Deployment

The project uses **GitHub Actions** for CI/CD, automatically deploying to **Azure Web App** on pushes to the `dev` branch.

**Pipeline stages:**
1. **Build** — Install dependencies, generate Prisma client, compile TypeScript
2. **Package** — Create optimized deployment ZIP (dist + production node_modules)
3. **Deploy** — Deploy to Azure Web App via OIDC authentication

```yaml
# Trigger: push to dev branch
on:
  push:
    branches:
      - dev
```

### 🔗 Related Repositories

| Repository | Description |
|---|---|
| [TriageFlow Frontend](https://github.com/Triage-Co/triageflow_fe) | Frontend application (Mobile / Web) |

---

<!-- ==================== TIẾNG VIỆT ==================== -->

<a id="tiếng-việt"></a>

## 🇻🇳 Tiếng Việt

### 📋 Tổng Quan

**TriageFlow OPD** là hệ thống backend được thiết kế để hiện đại hóa và tối ưu quy trình khám bệnh ngoại trú (OPD) tại bệnh viện. Hệ thống sử dụng AI phân tích triệu chứng để phân loại bệnh nhân thông minh, tự động sinh quy trình khám (flow), quản lý hàng đợi ưu tiên, và cung cấp dẫn đường trong nhà — tất cả thông qua RESTful API thống nhất.

Ý tưởng cốt lõi: **Loại bỏ thời gian chờ đợi dài, giảm gánh nặng hành chính, và đảm bảo mỗi bệnh nhân được điều phối đến đúng chuyên khoa với đúng mức ưu tiên**, từ lúc đăng ký đến khi nhận thuốc.

### ✨ Tính Năng Chính

| Module | Mô tả |
|---|---|
| 🤖 **Phân loại AI** | Tích hợp Infermedica API phân tích triệu chứng; ánh xạ chuyên khoa AI sang phòng khám thực tế |
| 🔄 **Cỗ máy Flow** | Tự động sinh quy trình khám nhiều bước (Đăng ký → Sàng lọc → Khám → XN/CĐHA → Thanh toán → Nhà thuốc) với quản lý phụ thuộc |
| 📋 **Hàng đợi Thông minh** | Quản lý hàng đợi theo ưu tiên với rule cấu hình được (lịch hẹn, nhi khoa, lão khoa, bệnh nhân quay lại, điểm chờ lâu, phạt lỡ lượt, cân bằng tải) |
| 🗺️ **Dẫn đường Trong nhà** | Mô hình không gian PostGIS với thuật toán định tuyến (Dijkstra), hỗ trợ tòa nhà, tầng, phòng, cửa, thang máy, cầu thang, và chặn đường theo lịch |
| 👨‍⚕️ **Quản lý Bác sĩ & Ca trực** | Lập lịch ca trực, đặt lịch khám theo slot, phân công chuyên khoa |
| 💊 **Nhà thuốc & Đơn thuốc** | Quy trình đơn thuốc hoàn chỉnh từ bác sĩ kê đến dược sĩ phát thuốc |
| 🧾 **Thanh toán & Hóa đơn** | Đơn dịch vụ, hóa đơn, tích hợp cổng thanh toán PayOS, theo dõi giao dịch |
| 📊 **Bảng điều khiển Admin** | Phân tích và báo cáo cho quản trị viên |
| 🏥 **Hồ sơ Lâm sàng** | Phiên khám với sinh hiệu, chẩn đoán, bệnh sử, tiền sử, khám thực thể, và tài liệu lâm sàng |
| 🔔 **Thông báo Thời gian thực** | Thông báo qua WebSocket (Socket.IO) cho gọi số, cập nhật trạng thái |
| 📦 **Gói Khám** | Gói khám sức khỏe định sẵn với template flow |
| 🎟️ **Hệ thống Vé** | Mã vé duy nhất cho mỗi lượt khám để theo dõi |

### 🏗️ Kiến Trúc

```
┌─────────────────────────────────────────────────────────────┐
│                    Ứng dụng Client                          │
│            (Mobile App / Web App / Kiosk)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │  HTTPS / WSS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    NestJS Backend (API)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Xác thực │  │ Phân loại│  │  Cỗ máy  │  │ Hàng đợi   │  │
│  │(Supabase │  │   AI     │  │   Flow   │  │  Thông     │  │
│  │ + JWT)   │  │(Inferme- │  │          │  │  minh      │  │
│  │          │  │  dica)   │  │          │  │            │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Đặt lịch │  │ Nhà thuốc│  │ Hóa đơn  │  │ Dẫn đường  │  │
│  │ & Ca trực│  │  & Rx    │  │ & PayOS  │  │  (PostGIS) │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│  PostgreSQL  │ │  Redis   │ │   Supabase   │
│  + PostGIS   │ │  Cache   │ │   Auth       │
└──────────────┘ └──────────┘ └──────────────┘
```

### 🛠️ Công Nghệ Sử Dụng

| Tầng | Công nghệ |
|---|---|
| **Runtime** | Node.js 24.x |
| **Framework** | NestJS 11 |
| **Ngôn ngữ** | TypeScript 5.9 |
| **ORM** | Prisma 7 (với PostgreSQL adapter) |
| **CSDL** | PostgreSQL + PostGIS |
| **Cache** | Redis (`cache-manager-redis-yet`) |
| **Xác thực** | Supabase Auth + Passport JWT + JWKS-RSA |
| **Thanh toán** | PayOS (`@payos/node`) |
| **AI Phân loại** | Infermedica API |
| **Email** | Resend |
| **Thời gian thực** | Socket.IO (`@nestjs/websockets`) |
| **Không gian/GIS** | Turf.js + PostGIS |
| **Tài liệu API** | Swagger (`@nestjs/swagger`) |
| **Giám sát** | Sentry (`@sentry/nestjs`) |
| **Lên lịch** | `@nestjs/schedule` (cron jobs) |
| **CI/CD** | GitHub Actions → Azure Web App |
| **Package Manager** | pnpm |

### 📁 Cấu Trúc Dự Án

```
src/
├── main.ts                      # Điểm khởi chạy ứng dụng
├── app.module.ts                # Module gốc
├── routes/                      # Các module chức năng (33 module)
│   ├── auth/                    # Xác thực (Supabase + JWT)
│   ├── account/                 # Quản lý tài khoản
│   ├── patient/                 # Hồ sơ bệnh nhân
│   ├── doctor/                  # Thao tác bác sĩ
│   ├── staff/                   # Quản lý nhân viên
│   ├── specialty/               # Chuyên khoa lâm sàng
│   ├── ai-specialty/            # Ánh xạ AI ↔ Chuyên khoa bệnh viện
│   ├── infermedica/             # Tích hợp AI phân loại Infermedica
│   ├── triage_config/           # Cấu hình quy tắc phân loại
│   ├── booking/                 # Đặt lịch khám
│   ├── shift/                   # Lập lịch ca trực
│   ├── flow/                    # Cỗ máy quy trình khám
│   ├── step/                    # Quản lý bước trong flow
│   ├── queue/                   # Hệ thống hàng đợi thông minh
│   ├── room/                    # Quản lý phòng khám
│   ├── map/                     # Bố cục không gian (Tòa nhà/Tầng/Phòng)
│   ├── navigation/              # Dẫn đường trong nhà & định tuyến
│   ├── service/                 # Danh mục dịch vụ y tế
│   ├── service_order/           # Đơn dịch vụ
│   ├── service_order_detail/    # Chi tiết đơn dịch vụ
│   ├── invoice/                 # Hóa đơn
│   ├── invoice_detail/          # Chi tiết hóa đơn
│   ├── transaction/             # Giao dịch thanh toán (PayOS)
│   ├── pharmacy/                # Nhà thuốc & phát thuốc
│   ├── visit-session/           # Phiên khám & hồ sơ lâm sàng
│   ├── clinical-document/       # Tài liệu lâm sàng
│   ├── template/                # Template quy trình
│   ├── exam-package/            # Gói khám sức khỏe
│   ├── ticket/                  # Sinh mã vé
│   ├── notification/            # Thông báo đẩy
│   ├── vnpt/                    # Tích hợp VNPT
│   ├── cron/                    # Tác vụ định kỳ
│   └── admin-dashboard/         # Phân tích quản trị
├── shared/                      # Tầng chia sẻ
│   ├── config/                  # Prisma, Supabase, PayOS, Sentry, env
│   ├── repositories/            # Repository implementations (Prisma)
│   ├── interfaces/              # Interface repository (DI contracts)
│   ├── guards/                  # JWT auth guards
│   ├── decorator/               # Custom decorators
│   ├── exceptions/              # Custom exception filters
│   ├── gateways/                # WebSocket gateways
│   ├── geo/                     # GeoService (PostGIS utilities)
│   ├── globals/                 # Global filters & interceptors
│   ├── constraint/              # Validation constraints
│   ├── template/                # Template email/thông báo
│   └── types/                   # Shared TypeScript types
prisma/
├── schema.prisma                # Database schema (1250 dòng, 40+ models)
├── *.seed.ts                    # Script seed dữ liệu
└── generate-graph.ts            # Bộ sinh đồ thị dẫn đường
```

### 📊 Tổng Quan Lược Đồ CSDL

Hệ thống sử dụng **hơn 40 Prisma model** được tổ chức theo các miền nghiệp vụ:

| Miền | Model chính |
|---|---|
| **Định danh** | `Account`, `Patient`, `Staff`, `Specialty` |
| **Lịch trình** | `Shift`, `Slot`, `Booking` |
| **Quy trình khám** | `Flow`, `Step`, `Step_Dependency`, `Flow_Template`, `Exam_Package` |
| **Hàng đợi** | `Queue`, `Queue_Priority_Rule`, `Queue_Rebalance_Suggestion`, `Move_Log`, `Room_Service_Stat` |
| **Y khoa** | `Visit_Session`, `Clinical_Document`, `Prescription`, `Prescription_Detail`, `Medicine`, `Triage_Information`, `Patient_Answer` |
| **Thanh toán** | `Service`, `Service_Order`, `Service_Order_Detail`, `Invoice`, `Invoice_Detail`, `Transaction` |
| **Không gian** | `Building`, `Floor`, `PhysicalRoom`, `Room`, `Area`, `Boundary`, `Door`, `Node`, `Edge`, `Connector`, `ScheduledBlockage` |
| **Danh bạ** | `Category`, `Poi`, `FeatureTemplate`, `PlacedFeature` |
| **Ánh xạ AI** | `AiSpecialty`, `AiSpecialtyMapping` |
| **Cấu hình** | `Triage_Config`, `Flow_Rules_Config`, `Notification` |

### 🚀 Bắt Đầu

#### Yêu Cầu Hệ Thống

- **Node.js** ≥ 24.x
- **pnpm** (trình quản lý gói)
- **PostgreSQL** đã bật PostGIS extension
- **Redis** (tùy chọn, tự động fallback sang in-memory cache)
- **Supabase** project (xác thực người dùng)

#### Cài Đặt

```bash
# 1. Clone repository
git clone https://github.com/Triage-Co/TriageFlowOPD_BE.git
cd TriageFlowOPD_BE

# 2. Cài đặt dependencies
pnpm install

# 3. Cấu hình biến môi trường
cp .demo.env .env
# Chỉnh sửa .env với cấu hình thực tế (xem phần Biến Môi Trường)

# 4. Sinh Prisma client
npx prisma generate

# 5. Đẩy schema lên database
npx prisma db push

# 6. (Tùy chọn) Seed dữ liệu mẫu
npx tsx prisma/room.seed.ts
npx tsx prisma/medicine.seed.ts
npx tsx prisma/service.seed.ts
npx tsx prisma/shift.seed.ts
npx tsx prisma/queue-rules.seed.ts
```

#### Biến Môi Trường

| Biến | Mô tả |
|---|---|
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL |
| `DIRECT_URL` | URL trực tiếp PostgreSQL (cho Prisma) |
| `REDIS_URL` | Chuỗi kết nối Redis |
| `SUPABASE_URL` | URL dự án Supabase |
| `SUPABASE_KEY` | Supabase anon/service key |
| `SUPABASE_JWT_SECRET` | JWT secret của Supabase |
| `PAYOS_CLIENT_ID` | PayOS client ID |
| `PAYOS_API_KEY` | PayOS API key |
| `PAYOS_CHECKSUM_KEY` | PayOS checksum key |
| `INFERMEDICA_APP_ID` | Infermedica application ID |
| `INFERMEDICA_APP_KEY` | Infermedica API key |
| `RESEND_API_KEY` | Resend email API key |
| `SENTRY_DSN` | Sentry DSN giám sát lỗi |
| `KIOSK_KEY` | JWT secret cho xác thực kiosk |
| `PORT` | Cổng server (mặc định: 3000) |

#### Chạy Ứng Dụng

```bash
# Chế độ phát triển (watch mode)
pnpm run start:dev

# Chế độ debug
pnpm run start:debug

# Chế độ production
pnpm run build
pnpm run start:prod
```

#### Chạy Tests

```bash
# Unit tests
pnpm run test

# Watch mode
pnpm run test:watch

# Coverage
pnpm run test:cov

# E2E tests
pnpm run test:e2e
```

### 📖 Tài Liệu API

Sau khi server chạy, truy cập **Swagger UI** tại:

```
http://localhost:3000/api-docs
```

Tất cả API endpoint đều có prefix `/api`. Tài liệu bao gồm đầy đủ 33+ module với request/response schema, yêu cầu xác thực, và payload mẫu.

### 🚢 Triển Khai

Dự án sử dụng **GitHub Actions** cho CI/CD, tự động triển khai lên **Azure Web App** khi push vào nhánh `dev`.

**Các bước pipeline:**
1. **Build** — Cài dependencies, sinh Prisma client, biên dịch TypeScript
2. **Package** — Tạo ZIP triển khai tối ưu (dist + production node_modules)
3. **Deploy** — Triển khai lên Azure Web App qua xác thực OIDC

### 🔗 Repository Liên Quan

| Repository | Mô tả |
|---|---|
| [TriageFlow Frontend](https://github.com/Triage-Co/triageflow_fe) | Ứng dụng Frontend (Mobile / Web) |

---

<div align="center">

**TriageFlow OPD** — *Transforming outpatient care with intelligent triage*

*Chuyển đổi quy trình khám ngoại trú bằng phân loại thông minh*

</div>
