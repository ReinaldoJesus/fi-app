-- Wallet / bank card → account, chosen by the person or learned when they fix a movement's account.
CREATE TABLE "card_aliases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_aliases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "card_aliases_userId_alias_key" ON "card_aliases"("userId", "alias");
CREATE INDEX "card_aliases_accountId_idx" ON "card_aliases"("accountId");

ALTER TABLE "card_aliases" ADD CONSTRAINT "card_aliases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_aliases" ADD CONSTRAINT "card_aliases_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "fin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
