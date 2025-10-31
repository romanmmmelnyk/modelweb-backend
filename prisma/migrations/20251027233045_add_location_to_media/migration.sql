/*
  Warnings:

  - You are about to drop the column `verificationToken` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `verificationTokenExpiry` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerified` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `verificationToken` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `verificationTokenExpiry` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "media" ADD COLUMN "latitude" REAL;
ALTER TABLE "media" ADD COLUMN "locationName" TEXT;
ALTER TABLE "media" ADD COLUMN "longitude" REAL;

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
    "status" TEXT NOT NULL DEFAULT 'pending',
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
CREATE UNIQUE INDEX "applications_userId_key" ON "applications"("userId");
CREATE TABLE "new_billing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "billingType" TEXT NOT NULL,
    "billingDay" INTEGER,
    "nextBillingDate" DATETIME,
    "amount" REAL NOT NULL,
    "initialAmount" REAL,
    "recurringAmount" REAL,
    "setupFee" REAL NOT NULL DEFAULT 60.00,
    "customDesignFee" REAL,
    "currency" TEXT NOT NULL DEFAULT 'gbp',
    "status" TEXT NOT NULL DEFAULT 'active',
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    CONSTRAINT "billing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "billing_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_billing" ("amount", "applicationId", "billingDay", "billingType", "cancelledAt", "createdAt", "currency", "id", "initialAmount", "nextBillingDate", "recurringAmount", "status", "stripeCustomerId", "stripeSubscriptionId", "updatedAt", "userId") SELECT "amount", "applicationId", "billingDay", "billingType", "cancelledAt", "createdAt", "currency", "id", "initialAmount", "nextBillingDate", "recurringAmount", "status", "stripeCustomerId", "stripeSubscriptionId", "updatedAt", "userId" FROM "billing";
DROP TABLE "billing";
ALTER TABLE "new_billing" RENAME TO "billing";
CREATE UNIQUE INDEX "billing_stripeCustomerId_key" ON "billing"("stripeCustomerId");
CREATE UNIQUE INDEX "billing_stripeSubscriptionId_key" ON "billing"("stripeSubscriptionId");
CREATE UNIQUE INDEX "billing_userId_key" ON "billing"("userId");
CREATE UNIQUE INDEX "billing_applicationId_key" ON "billing"("applicationId");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'email',
    "providerId" TEXT,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "hasSeenOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_users" ("createdAt", "email", "hasSeenOnboarding", "id", "isActive", "lastLogin", "password", "provider", "providerId", "tenantId", "twoFactorEnabled", "twoFactorSecret", "updatedAt") SELECT "createdAt", "email", "hasSeenOnboarding", "id", "isActive", "lastLogin", "password", "provider", "providerId", "tenantId", "twoFactorEnabled", "twoFactorSecret", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
