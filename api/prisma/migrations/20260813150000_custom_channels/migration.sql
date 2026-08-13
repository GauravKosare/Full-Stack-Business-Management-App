ALTER TYPE "ChannelType" ADD VALUE 'custom';

ALTER TABLE "channels" ADD COLUMN "name" TEXT;
ALTER TABLE "channels" ADD COLUMN "description" TEXT;
ALTER TABLE "channels" ADD COLUMN "created_by" TEXT;
