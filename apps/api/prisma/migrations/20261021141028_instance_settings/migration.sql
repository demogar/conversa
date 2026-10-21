-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isInstanceAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InstanceSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceSetting_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "InstanceSetting" ADD CONSTRAINT "InstanceSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The earliest account set the installation up, so it becomes its first
-- instance admin (later sign-ups get the flag only from another admin).
UPDATE "User" SET "isInstanceAdmin" = true
WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
