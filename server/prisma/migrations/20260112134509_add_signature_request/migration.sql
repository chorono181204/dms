-- CreateTable
CREATE TABLE "SignatureRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" DATETIME,
    "note" TEXT,
    CONSTRAINT "SignatureRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SignatureRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRequest_documentId_userId_key" ON "SignatureRequest"("documentId", "userId");
