-- CreateTable
CREATE TABLE "websites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subdomain" TEXT NOT NULL,
    "fullDomain" TEXT NOT NULL,
    "accentColor" TEXT NOT NULL DEFAULT '#FF4757',
    "showLocation" BOOLEAN NOT NULL DEFAULT false,
    "enableBooking" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "configJson" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "publishedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "websites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "websites_subdomain_key" ON "websites"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "websites_fullDomain_key" ON "websites"("fullDomain");

-- CreateIndex
CREATE UNIQUE INDEX "websites_userId_key" ON "websites"("userId");

-- CreateIndex
CREATE INDEX "websites_subdomain_idx" ON "websites"("subdomain");

-- CreateIndex
CREATE INDEX "websites_status_idx" ON "websites"("status");
