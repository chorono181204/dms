-- CreateTable
CREATE TABLE "Department" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "departmentId" INTEGER,
    "signatureImage" TEXT,
    "digitalCert" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Template" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "departmentId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Template_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "departmentId" INTEGER NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentPermission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentPermission_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DocumentPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "signerId" INTEGER NOT NULL,
    "step" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,
    "hash" TEXT,
    "signatureValue" TEXT,
    "departmentId" INTEGER NOT NULL,
    CONSTRAINT "Signature_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Signature_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Signature_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DocumentHistory_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Token" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    "blacklisted" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Document_code_key" ON "Document"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPermission_documentId_userId_permission_key" ON "DocumentPermission"("documentId", "userId", "permission");
