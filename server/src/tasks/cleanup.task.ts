import prisma from '../client';
import { documentService } from '../services';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const cleanupTrashedDocuments = async () => {
    console.log('[Cleanup Task] Checking for expired trashed documents...');
    try {
        const expiryDate = new Date(Date.now() - THIRTY_DAYS_MS);

        const expiredDocs = await prisma.document.findMany({
            where: {
                deletedAt: {
                    lte: expiryDate,
                    not: null,
                },
            },
            select: { id: true },
        });

        if (expiredDocs.length === 0) {
            console.log('[Cleanup Task] No expired documents found.');
            return;
        }

        console.log(`[Cleanup Task] Found ${expiredDocs.length} expired documents. Starting permanent deletion...`);

        for (const doc of expiredDocs) {
            try {
                await documentService.permanentlyDeleteDocumentById(doc.id);
                console.log(`[Cleanup Task] Permanently deleted document ID: ${doc.id}`);
            } catch (error) {
                console.error(`[Cleanup Task] Failed to delete document ID: ${doc.id}`, error);
            }
        }

        console.log('[Cleanup Task] Cleanup completed.');
    } catch (error) {
        console.error('[Cleanup Task] Error during cleanup:', error);
    }
};

export const initCleanupTask = () => {
    // Run once on startup
    cleanupTrashedDocuments();

    // Run every 24 hours
    const interval = 24 * 60 * 60 * 1000;
    setInterval(cleanupTrashedDocuments, interval);
};
