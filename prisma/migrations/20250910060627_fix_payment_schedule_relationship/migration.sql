/*
  Warnings:

  - You are about to drop the column `periodId` on the `payments` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "payment_schedule_items_paymentId_key";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "residentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "payments_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_payments" ("amount", "createdAt", "createdById", "id", "notes", "paymentDate", "paymentMethod", "residentId", "status", "updatedAt") SELECT "amount", "createdAt", "createdById", "id", "notes", "paymentDate", "paymentMethod", "residentId", "status", "updatedAt" FROM "payments";
DROP TABLE "payments";
ALTER TABLE "new_payments" RENAME TO "payments";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "payment_schedule_items_paymentId_idx" ON "payment_schedule_items"("paymentId");
