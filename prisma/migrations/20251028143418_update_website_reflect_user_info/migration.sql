/*
  Warnings:

  - You are about to drop the column `showLocation` on the `websites` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_websites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subdomain" TEXT NOT NULL,
    "fullDomain" TEXT NOT NULL,
    "accentColor" TEXT NOT NULL,
    "enableBooking" BOOLEAN NOT NULL,
    "showGallery" BOOLEAN NOT NULL DEFAULT false,
    "reflectUserInfo" BOOLEAN NOT NULL DEFAULT true,
    "customName" TEXT,
    "customAbout" TEXT,
    "customPhone" TEXT,
    "customEmail" TEXT,
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
INSERT INTO "new_websites" ("accentColor", "completedAt", "configJson", "createdAt", "enableBooking", "fullDomain", "id", "notes", "publishedAt", "requestedAt", "status", "subdomain", "updatedAt", "userId") SELECT "accentColor", "completedAt", "configJson", "createdAt", "enableBooking", "fullDomain", "id", "notes", "publishedAt", "requestedAt", "status", "subdomain", "updatedAt", "userId" FROM "websites";
DROP TABLE "websites";
ALTER TABLE "new_websites" RENAME TO "websites";
CREATE UNIQUE INDEX "websites_subdomain_key" ON "websites"("subdomain");
CREATE UNIQUE INDEX "websites_fullDomain_key" ON "websites"("fullDomain");
CREATE UNIQUE INDEX "websites_userId_key" ON "websites"("userId");
CREATE INDEX "websites_subdomain_idx" ON "websites"("subdomain");
CREATE INDEX "websites_status_idx" ON "websites"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
