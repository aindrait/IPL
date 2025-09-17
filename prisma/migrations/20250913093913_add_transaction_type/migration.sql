-- AlterTable
ALTER TABLE "bank_mutations" ADD COLUMN "transactionType" TEXT;

-- CreateIndex
CREATE INDEX "bank_mutations_transactionType_idx" ON "bank_mutations"("transactionType");
