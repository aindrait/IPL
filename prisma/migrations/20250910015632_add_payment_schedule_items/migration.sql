-- CreateTable
CREATE TABLE "payment_schedule_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'MONTHLY',
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "amount" REAL NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "paidDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "paymentId" TEXT,
    CONSTRAINT "payment_schedule_items_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "payment_schedules" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_schedule_items_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "payment_periods" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_schedule_items_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_schedule_items_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_schedule_items_paymentId_key" ON "payment_schedule_items"("paymentId");

-- CreateIndex
CREATE INDEX "payment_schedule_items_residentId_idx" ON "payment_schedule_items"("residentId");

-- CreateIndex
CREATE INDEX "payment_schedule_items_periodId_idx" ON "payment_schedule_items"("periodId");

-- CreateIndex
CREATE INDEX "payment_schedule_items_scheduleId_idx" ON "payment_schedule_items"("scheduleId");
