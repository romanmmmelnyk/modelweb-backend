-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_websites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subdomain" TEXT NOT NULL,
    "fullDomain" TEXT NOT NULL,
    "accentColor" TEXT NOT NULL DEFAULT '#1E40AF',
    "enableBooking" BOOLEAN NOT NULL,
    "showGallery" BOOLEAN NOT NULL DEFAULT false,
    "showMeasurements" BOOLEAN NOT NULL DEFAULT false,
    "templateId" TEXT,
    "selectedPictures" TEXT,
    "reflectUserInfo" BOOLEAN NOT NULL DEFAULT true,
    "customName" TEXT,
    "customAbout" TEXT,
    "customPhone" TEXT,
    "customEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'configured',
    "configJson" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "publishedAt" DATETIME,
    "notes" TEXT,
    "templateSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "templateSubmittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "websites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "websites_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "website_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_websites" ("accentColor", "completedAt", "configJson", "createdAt", "customAbout", "customEmail", "customName", "customPhone", "enableBooking", "fullDomain", "id", "notes", "publishedAt", "reflectUserInfo", "requestedAt", "selectedPictures", "showGallery", "status", "subdomain", "templateId", "templateSubmitted", "templateSubmittedAt", "updatedAt", "userId") SELECT "accentColor", "completedAt", "configJson", "createdAt", "customAbout", "customEmail", "customName", "customPhone", "enableBooking", "fullDomain", "id", "notes", "publishedAt", "reflectUserInfo", "requestedAt", "selectedPictures", "showGallery", "status", "subdomain", "templateId", "templateSubmitted", "templateSubmittedAt", "updatedAt", "userId" FROM "websites";
DROP TABLE "websites";
ALTER TABLE "new_websites" RENAME TO "websites";
CREATE UNIQUE INDEX "websites_subdomain_key" ON "websites"("subdomain");
CREATE UNIQUE INDEX "websites_fullDomain_key" ON "websites"("fullDomain");
CREATE UNIQUE INDEX "websites_userId_key" ON "websites"("userId");
CREATE INDEX "websites_subdomain_idx" ON "websites"("subdomain");
CREATE INDEX "websites_status_idx" ON "websites"("status");
CREATE INDEX "websites_templateId_idx" ON "websites"("templateId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
