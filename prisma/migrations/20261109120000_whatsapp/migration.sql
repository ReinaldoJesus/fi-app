-- WhatsApp bot: the linked number, a short-lived link code, and handled message ids.
ALTER TABLE "User" ADD COLUMN "whatsappPhone" TEXT;
ALTER TABLE "User" ADD COLUMN "whatsappCodeHash" TEXT;
ALTER TABLE "User" ADD COLUMN "whatsappCodeExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_whatsappPhone_key" ON "User"("whatsappPhone");
CREATE UNIQUE INDEX "User_whatsappCodeHash_key" ON "User"("whatsappCodeHash");

CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);
