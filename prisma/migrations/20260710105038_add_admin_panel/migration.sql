-- CreateEnum
CREATE TYPE "ContentFlagType" AS ENUM ('RESUME', 'INTERVIEW_SESSION');

-- CreateEnum
CREATE TYPE "ContentFlagStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isSuspended" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "content_flags" (
    "id" TEXT NOT NULL,
    "type" "ContentFlagType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ContentFlagStatus" NOT NULL DEFAULT 'OPEN',
    "flaggedByUserId" TEXT NOT NULL,
    "resolvedByUserId" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_flags_type_targetId_idx" ON "content_flags"("type", "targetId");

-- CreateIndex
CREATE INDEX "content_flags_status_idx" ON "content_flags"("status");

-- AddForeignKey
ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_flaggedByUserId_fkey" FOREIGN KEY ("flaggedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
