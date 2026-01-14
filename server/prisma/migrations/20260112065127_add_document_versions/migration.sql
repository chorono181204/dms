-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "changeNote" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
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
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("accessLevel", "categoryId", "code", "content", "createdAt", "createdBy", "departmentId", "id", "status", "title", "updatedAt", "updatedBy", "visibility") SELECT "accessLevel", "categoryId", "code", "content", "createdAt", "createdBy", "departmentId", "id", "status", "title", "updatedAt", "updatedBy", "visibility" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE UNIQUE INDEX "Document_code_key" ON "Document"("code");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "DocumentVersion"("documentId", "versionNumber");
