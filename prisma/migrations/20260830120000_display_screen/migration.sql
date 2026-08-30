-- CreateEnum
CREATE TYPE "DisplayScreenKind" AS ENUM ('KIOSK', 'TV_CLINIC', 'TV_PHARMACY', 'TV_PAYMENT');

-- CreateEnum
CREATE TYPE "DisplayScreenStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateTable
CREATE TABLE "display_screen" (
    "display_screen_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DisplayScreenKind" NOT NULL,
    "status" "DisplayScreenStatus" NOT NULL DEFAULT 'ENABLED',
    "room_id" UUID,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "display_screen_pkey" PRIMARY KEY ("display_screen_id")
);

-- CreateTable
CREATE TABLE "display_pin" (
    "id" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "display_pin_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "prescription" ADD COLUMN IF NOT EXISTS "display_screen_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "display_screen_code_key" ON "display_screen"("code");

-- CreateIndex
CREATE INDEX "display_screen_kind_status_idx" ON "display_screen"("kind", "status");

-- CreateIndex
CREATE INDEX "prescription_display_screen_id_idx" ON "prescription"("display_screen_id");

-- AddForeignKey
ALTER TABLE "display_screen" ADD CONSTRAINT "display_screen_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "room"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_display_screen_id_fkey" FOREIGN KEY ("display_screen_id") REFERENCES "display_screen"("display_screen_id") ON DELETE SET NULL ON UPDATE CASCADE;
