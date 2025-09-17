-- CreateTable
CREATE TABLE "payment_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "periodId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "payment_schedules_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "payment_periods" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "rw" INTEGER NOT NULL,
    "chairman" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_residents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "rt" INTEGER NOT NULL,
    "rw" INTEGER NOT NULL,
    "blok" TEXT,
    "houseNumber" TEXT,
    "paymentIndex" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    "rtId" TEXT,
    CONSTRAINT "residents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "residents_rtId_fkey" FOREIGN KEY ("rtId") REFERENCES "rts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_residents" ("address", "createdAt", "createdById", "email", "id", "isActive", "name", "phone", "rt", "rw", "updatedAt") SELECT "address", "createdAt", "createdById", "email", "id", "isActive", "name", "phone", "rt", "rw", "updatedAt" FROM "residents";
DROP TABLE "residents";
ALTER TABLE "new_residents" RENAME TO "residents";
CREATE UNIQUE INDEX "residents_phone_key" ON "residents"("phone");
CREATE UNIQUE INDEX "residents_paymentIndex_key" ON "residents"("paymentIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "rts_number_rw_key" ON "rts"("number", "rw");
