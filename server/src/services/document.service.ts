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
const createDocument = async (documentBody: any): Promise<Document> => {
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

    // Handle Date Ranges
    const dateFilters: any = {};
    if (filter.effectiveDateStart) {
        dateFilters.effectiveDate = { ...dateFilters.effectiveDate, gte: new Date(filter.effectiveDateStart) };
        delete filter.effectiveDateStart;
    }
    if (filter.effectiveDateEnd) {
        dateFilters.effectiveDate = { ...dateFilters.effectiveDate, lte: new Date(filter.effectiveDateEnd) };
        delete filter.effectiveDateEnd;
    }
    if (filter.expirationDateStart) {
        dateFilters.expirationDate = { ...dateFilters.expirationDate, gte: new Date(filter.expirationDateStart) };
        delete filter.expirationDateStart;
    }
    if (filter.expirationDateEnd) {
        dateFilters.expirationDate = { ...dateFilters.expirationDate, lte: new Date(filter.expirationDateEnd) };
        delete filter.expirationDateEnd;
    }

    // Merge date filters into main filter
    // exclude soft-deleted documents by default
    const finalFilter: any = {
        ...filter,
        ...dateFilters,
        deletedAt: filter.deletedAt !== undefined ? filter.deletedAt : null
    };

    // If filter has AND array (from Role checks), we need to append date filters to it or merge carefully
    // The controller constructs `filter` with `AND: [...]` for non-admins.
    // If `filter.AND` exists, we should push to it? Or just merge at top level?
    // Prisma `where` supports top-level fields AND `AND` array simultaneously.
    // So `{ AND: [...], effectiveDate: {...} }` is valid AND logic.

    const [documents, totalResults] = await Promise.all([
        prisma.document.findMany({
            where: finalFilter,
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
                    select: { userId: true, departmentId: true, permission: true }
                },
                attachments: true
            }
        }),
        prisma.document.count({ where: finalFilter })
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
    return prisma.document.findFirst({
        where: {
            id,
            deletedAt: null
        },
        include: {
            department: { select: { id: true, name: true } },
            history: {
                orderBy: { id: 'desc' }
            },
            permissions: {
                select: { userId: true, departmentId: true, permission: true }
            },
            attachments: true
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
 * Soft delete document by id
 * @param {number} documentId
 * @returns {Promise<Document>}
 */
const softDeleteDocumentById = async (documentId: number): Promise<Document> => {
    const document = await getDocumentById(documentId);
    if (!document) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }
    return prisma.document.update({
        where: { id: documentId },
        data: { deletedAt: new Date() }
    });
};

/**
 * Restore document by id
 * @param {number} documentId
 * @returns {Promise<Document>}
 */
const restoreDocumentById = async (documentId: number): Promise<Document> => {
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }
    return prisma.document.update({
        where: { id: documentId },
        data: { deletedAt: null }
    });
};

/**
 * Permanently delete document by id
 * @param {number} documentId
 * @returns {Promise<Document>}
 */
const permanentlyDeleteDocumentById = async (documentId: number): Promise<Document> => {
    const document = await prisma.document.findUnique({ where: { id: documentId } });
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
    softDeleteDocumentById,
    restoreDocumentById,
    permanentlyDeleteDocumentById,
    updateDocumentVersion
};
