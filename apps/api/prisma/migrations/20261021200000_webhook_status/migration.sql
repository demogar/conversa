-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "lastEventAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WebhookStatus" (
    "channelType" "ChannelType" NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),

    CONSTRAINT "WebhookStatus_pkey" PRIMARY KEY ("channelType")
);
