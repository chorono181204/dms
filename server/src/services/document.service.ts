import { Document, Prisma } from '@prisma/client';
import httpStatus from 'http-status';
import prisma from '../client';
import ApiError from '../utils/ApiError';
import fs from 'fs/promises';
import path from 'path';

/**
 * Create a document
 * @param {Object} documentBody
 * @returns {Promise<Document>}
 */
const createDocument = async (documentBody: Prisma.DocumentUncheckedCreateInput): Promise<Document> => {
    return prisma.document.create({
        data: documentBody
    });
};

/**
 * Query for documents
 * @param {Object} filter - Prisma filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
const queryDocuments = async (
    filter: any,
    options: {
        limit?: number;
        page?: number;
        sortBy?: string;
        sortType?: 'asc' | 'desc';
    }
): Promise<any> => {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;
    const sortBy = options.sortBy;
    const sortType = options.sortType ?? 'desc';

    const [documents, totalResults] = await Promise.all([
        prisma.document.findMany({
            where: filter,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: sortBy ? { [sortBy]: sortType } : { id: 'desc' },
            include: {
                department: {
                    select: { id: true, name: true }
                },
                category: {
                    select: { id: true, name: true }
                },
                permissions: {
                    select: { userId: true, permission: true }
                }
            }
        }),
        prisma.document.count({ where: filter })
    ]);

    const totalPages = Math.ceil(totalResults / limit);

    return {
        results: documents,
        page,
        limit,
        totalPages,
        totalResults
    };
};

/**
 * Get document by id
 * @param {number} id
 * @returns {Promise<Document | null>}
 */
const getDocumentById = async (id: number): Promise<Document | null> => {
    return prisma.document.findUnique({
        where: { id },
        include: {
            department: { select: { id: true, name: true } },
            history: {
                orderBy: { id: 'desc' }
            },
            permissions: {
                select: { userId: true, permission: true }
            }
        }
    });
};

/**
 * Update document by id
 * @param {number} documentId
 * @param {Object} updateBody
 * @returns {Promise<Document>}
 */
const updateDocumentById = async (
    documentId: number,
    updateBody: Prisma.DocumentUncheckedUpdateInput
): Promise<Document> => {
    const document = await getDocumentById(documentId);
    if (!document) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }
    const updatedDocument = await prisma.document.update({
        where: { id: documentId },
        data: updateBody
    });
    return updatedDocument;
};

/**
 * Delete document by id
 * @param {number} documentId
 * @returns {Promise<Document>}
 */
const deleteDocumentById = async (documentId: number): Promise<Document> => {
    const document = await getDocumentById(documentId);
    if (!document) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }
    // Delete actual file if it exists
    if (document.content && document.content.includes(':\\')) {
        try {
            await fs.unlink(document.content);
        } catch (error) {
            console.error(`Failed to delete main file: ${document.content}`, error);
        }
    }

    // Delete versions directory from local uploads
    const versionDirLocal = path.join('uploads', 'documents', documentId.toString());
    try {
        await fs.rm(versionDirLocal, { recursive: true, force: true });
    } catch (error) {
        console.error(`Failed to delete local version directory: ${versionDirLocal}`, error);
    }

    // Delete versions directory from G: Drive backup
    const versionDirBackup = path.join('G:\\My Drive\\DMS\\_Backup_Versions', documentId.toString());
    try {
        await fs.rm(versionDirBackup, { recursive: true, force: true });
    } catch (error) {
        console.error(`Failed to delete backup version directory: ${versionDirBackup}`, error);
    }

    await prisma.document.delete({
        where: { id: documentId }
    });
    return document;
};


/**
 * Update document's current version number
 * @param {number} documentId
 * @param {number} versionNumber
 * @returns {Promise<Document>}
 */
export const updateDocumentVersion = async (
    documentId: number,
    versionNumber: number,
    content?: string
): Promise<Document> => {
    return await prisma.document.update({
        where: { id: documentId },
        data: {
            currentVersion: versionNumber,
            ...(content && { content })
        }
    });
};

export default {
    createDocument,
    queryDocuments,
    getDocumentById,
    updateDocumentById,
    deleteDocumentById,
    updateDocumentVersion
};
