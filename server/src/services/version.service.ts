import prisma from '../client';
import path from 'path';
import fs from 'fs/promises';

const MAX_VERSIONS = 10;

/**
 * Create a new version for a document
 */
export const createVersion = async (
    documentId: number,
    versionNumber: number,
    filePath: string,
    fileSize: number,
    changeNote: string | undefined,
    createdBy: string
) => {
    return await prisma.documentVersion.create({
        data: {
            documentId,
            versionNumber,
            filePath,
            fileSize,
            changeNote,
            createdBy
        }
    });
};

/**
 * Get all versions for a document
 */
export const getVersions = async (documentId: number) => {
    return await prisma.documentVersion.findMany({
        where: { documentId },
        orderBy: { versionNumber: 'desc' }
    });
};

/**
 * Get a specific version
 */
export const getVersion = async (documentId: number, versionNumber: number) => {
    return await prisma.documentVersion.findUnique({
        where: {
            documentId_versionNumber: {
                documentId,
                versionNumber
            }
        }
    });
};

/**
 * Clean up old versions - keep only MAX_VERSIONS most recent
 */
export const cleanupOldVersions = async (documentId: number) => {
    const versions = await prisma.documentVersion.findMany({
        where: { documentId },
        orderBy: { versionNumber: 'desc' },
        select: { id: true, versionNumber: true, filePath: true }
    });

    if (versions.length > MAX_VERSIONS) {
        const versionsToDelete = versions.slice(MAX_VERSIONS);

        // Delete files from disk
        for (const version of versionsToDelete) {
            try {
                await fs.unlink(version.filePath);
            } catch (error) {
                console.error(`Failed to delete file: ${version.filePath}`, error);
            }
        }

        // Delete from database
        await prisma.documentVersion.deleteMany({
            where: {
                id: { in: versionsToDelete.map(v => v.id) }
            }
        });

        return versionsToDelete.length;
    }

    return 0;
};

/**
 * Get the next version number for a document
 */
export const getNextVersionNumber = async (documentId: number): Promise<number> => {
    const lastVersion = await prisma.documentVersion.findFirst({
        where: { documentId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true }
    });

    return (lastVersion?.versionNumber || 0) + 1;
};
