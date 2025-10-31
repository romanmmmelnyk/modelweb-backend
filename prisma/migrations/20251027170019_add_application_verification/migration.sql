-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "about" TEXT,
    "purposes" TEXT NOT NULL,
    "customDesign" BOOLEAN NOT NULL DEFAULT false,
    "paymentPlan" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_verification',
    "verificationToken" TEXT,
    "verificationTokenExpiry" DATETIME,
    "userId" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" DATETIME,
    "tempPassword" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_applications" ("about", "createdAt", "customDesign", "email", "firstName", "id", "lastName", "paymentPlan", "processed", "processedAt", "purposes", "status", "stripeSessionId", "tempPassword", "updatedAt", "userId") SELECT "about", "createdAt", "customDesign", "email", "firstName", "id", "lastName", "paymentPlan", "processed", "processedAt", "purposes", "status", "stripeSessionId", "tempPassword", "updatedAt", "userId" FROM "applications";
DROP TABLE "applications";
ALTER TABLE "new_applications" RENAME TO "applications";
CREATE UNIQUE INDEX "applications_verificationToken_key" ON "applications"("verificationToken");
CREATE UNIQUE INDEX "applications_userId_key" ON "applications"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
