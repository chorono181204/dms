-- AlterTable
ALTER TABLE "DocumentHistory" ADD COLUMN "createdByName" TEXT;

-- AlterTable
ALTER TABLE "DocumentVersion" ADD COLUMN "createdByName" TEXT;

-- CreateTable
CREATE TABLE "DocumentAttachment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentAttachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" INTEGER,
    "path" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Category" ("createdAt", "createdBy", "description", "id", "isActive", "isGlobal", "name", "updatedAt", "updatedBy") SELECT "createdAt", "createdBy", "description", "id", "isActive", "isGlobal", "name", "updatedAt", "updatedBy" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE TABLE "new_Document" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "departmentId" INTEGER NOT NULL,
    "categoryId" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT,
    "updatedBy" TEXT,
    "updatedByName" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "accessLevel" TEXT NOT NULL DEFAULT 'VIEW',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "effectiveDate" DATETIME,
    "expirationDate" DATETIME,
    "deletedAt" DATETIME,
    "isReference" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Document_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("accessLevel", "categoryId", "code", "content", "createdAt", "createdBy", "currentVersion", "deletedAt", "departmentId", "effectiveDate", "expirationDate", "id", "status", "title", "updatedAt", "updatedBy", "visibility") SELECT "accessLevel", "categoryId", "code", "content", "createdAt", "createdBy", "currentVersion", "deletedAt", "departmentId", "effectiveDate", "expirationDate", "id", "status", "title", "updatedAt", "updatedBy", "visibility" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE UNIQUE INDEX "Document_code_key" ON "Document"("code");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE INDEX "DocumentAttachment_documentId_idx" ON "DocumentAttachment"("documentId");
