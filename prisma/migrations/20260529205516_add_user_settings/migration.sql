-- AlterTable
ALTER TABLE "User" ADD COLUMN     "budgetCarryOver" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultAccountId" TEXT,
ADD COLUMN     "hideAmountsOnStart" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifInactivity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifSubscriptions" BOOLEAN NOT NULL DEFAULT true;
