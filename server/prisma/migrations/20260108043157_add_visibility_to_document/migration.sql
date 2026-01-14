/*
  Warnings:

  - You are about to drop the `Token` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `createdAt` on the `DocumentPermission` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `actorId` on the `DocumentHistory` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `DocumentHistory` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Department` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Department` table. All the data in the column will be lost.
  - You are about to drop the column `creatorId` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `signedAt` on the `Signature` table. All the data in the column will be lost.
  - You are about to drop the column `signerId` on the `Signature` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Template` table. All the data in the column will be lost.
  - Added the required column `username` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `signedBy` to the `Signature` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Token";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "departmentId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "Category_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DocumentPermission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "permission" TEXT NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "DocumentPermission_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DocumentPermission" ("documentId", "id", "permission", "userId") SELECT "documentId", "id", "permission", "userId" FROM "DocumentPermission";
DROP TABLE "DocumentPermission";
ALTER TABLE "new_DocumentPermission" RENAME TO "DocumentPermission";
CREATE UNIQUE INDEX "DocumentPermission_documentId_userId_permission_key" ON "DocumentPermission"("documentId", "userId", "permission");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT true,
    "phone" TEXT,
    "position" TEXT,
    "departmentId" INTEGER,
    "signatureImage" TEXT,
    "digitalCert" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("departmentId", "digitalCert", "id", "isEmailVerified", "name", "password", "role", "signatureImage") SELECT "departmentId", "digitalCert", "id", "isEmailVerified", "name", "password", "role", "signatureImage" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE TABLE "new_DocumentHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "createdBy" TEXT,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "departmentId" INTEGER NOT NULL,
    CONSTRAINT "DocumentHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentHistory_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DocumentHistory" ("action", "departmentId", "description", "documentId", "id") SELECT "action", "departmentId", "description", "documentId", "id" FROM "DocumentHistory";
DROP TABLE "DocumentHistory";
ALTER TABLE "new_DocumentHistory" RENAME TO "DocumentHistory";
CREATE TABLE "new_Department" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT
);
INSERT INTO "new_Department" ("code", "id", "name") SELECT "code", "id", "name" FROM "Department";
DROP TABLE "Department";
ALTER TABLE "new_Department" RENAME TO "Department";
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");
CREATE TABLE "new_Document" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "departmentId" INTEGER NOT NULL,
    "categoryId" INTEGER,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "accessLevel" TEXT NOT NULL DEFAULT 'VIEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("code", "content", "createdAt", "departmentId", "id", "status", "title", "updatedAt") SELECT "code", "content", "createdAt", "departmentId", "id", "status", "title", "updatedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE UNIQUE INDEX "Document_code_key" ON "Document"("code");
CREATE TABLE "new_Signature" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "signedBy" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "comment" TEXT,
    "hash" TEXT,
    "signatureValue" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "departmentId" INTEGER NOT NULL,
    CONSTRAINT "Signature_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Signature_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Signature" ("comment", "departmentId", "documentId", "hash", "id", "signatureValue", "step", "type") SELECT "comment", "departmentId", "documentId", "hash", "id", "signatureValue", "step", "type" FROM "Signature";
DROP TABLE "Signature";
ALTER TABLE "new_Signature" RENAME TO "Signature";
CREATE TABLE "new_Template" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "categoryId" INTEGER,
    "departmentId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "Template_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Template_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Template" ("content", "departmentId", "id", "isActive", "name") SELECT "content", "departmentId", "id", "isActive", "name" FROM "Template";
DROP TABLE "Template";
ALTER TABLE "new_Template" RENAME TO "Template";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
