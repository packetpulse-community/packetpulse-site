-- CreateEnum
CREATE TYPE "ClientLogLevel" AS ENUM ('debug', 'info', 'warn', 'error');

-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "site_name" TEXT NOT NULL DEFAULT 'PacketPulse',
    "site_description" TEXT NOT NULL DEFAULT 'A community platform for networking professionals',
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "registration_enabled" BOOLEAN NOT NULL DEFAULT true,
    "max_upload_size_mb" INTEGER NOT NULL DEFAULT 10,
    "max_user_resources_count" INTEGER NOT NULL DEFAULT 50,
    "email_verification_required" BOOLEAN NOT NULL DEFAULT true,
    "admin_email" TEXT NOT NULL DEFAULT 'packetpulse25@gmail.com',
    "api_rate_limit" INTEGER NOT NULL DEFAULT 100,
    "session_timeout_minutes" INTEGER NOT NULL DEFAULT 60,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "log_level" TEXT NOT NULL DEFAULT 'error',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_logs" (
    "id" TEXT NOT NULL,
    "level" "ClientLogLevel" NOT NULL,
    "context" TEXT,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "user_id" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_logs_created_at_idx" ON "client_logs"("created_at");

-- CreateIndex
CREATE INDEX "client_logs_level_idx" ON "client_logs"("level");
