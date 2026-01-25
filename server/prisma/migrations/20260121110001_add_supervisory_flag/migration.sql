/*
  Warnings:

  - You are about to drop the column `departmentId` on the `Category` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Document" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Document" ADD COLUMN "effectiveDate" DATETIME;
ALTER TABLE "Document" ADD COLUMN "expirationDate" DATETIME;

-- CreateTable
CREATE TABLE "_CategoryToDepartment" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_CategoryToDepartment_A_fkey" FOREIGN KEY ("A") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CategoryToDepartment_B_fkey" FOREIGN KEY ("B") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SignatureRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "step" INTEGER NOT NULL DEFAULT 1,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" DATETIME,
    "note" TEXT,
    CONSTRAINT "SignatureRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SignatureRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SignatureRequest" ("documentId", "id", "note", "requestedAt", "signedAt", "status", "userId") SELECT "documentId", "id", "note", "requestedAt", "signedAt", "status", "userId" FROM "SignatureRequest";
DROP TABLE "SignatureRequest";
ALTER TABLE "new_SignatureRequest" RENAME TO "SignatureRequest";
CREATE UNIQUE INDEX "SignatureRequest_documentId_userId_key" ON "SignatureRequest"("documentId", "userId");
CREATE TABLE "new_Category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT
);
INSERT INTO "new_Category" ("createdAt", "createdBy", "description", "id", "isActive", "name", "updatedAt", "updatedBy") SELECT "createdAt", "createdBy", "description", "id", "isActive", "name", "updatedAt", "updatedBy" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE TABLE "new_Department" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "isSupervisory" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Department" ("code", "createdBy", "id", "name", "updatedBy") SELECT "code", "createdBy", "id", "name", "updatedBy" FROM "Department";
DROP TABLE "Department";
ALTER TABLE "new_Department" RENAME TO "Department";
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "_CategoryToDepartment_AB_unique" ON "_CategoryToDepartment"("A", "B");

-- CreateIndex
CREATE INDEX "_CategoryToDepartment_B_index" ON "_CategoryToDepartment"("B");
