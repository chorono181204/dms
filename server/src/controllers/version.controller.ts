import { Request, Response } from 'express';
import httpStatus from 'http-status';
import * as versionService from '../services/version.service';
import documentService from '../services/document.service';
import ApiError from '../utils/ApiError';
import path from 'path';
import fs from 'fs/promises';

/**
 * Get all versions for a document
 * GET /documents/:id/versions
 */
export const getVersions = async (req: Request, res: Response) => {
    try {
        const documentId = parseInt(req.params.documentId);
        const user = req.user as any;
        console.log(`[getVersions] Accessed for DocID: ${documentId}, User: ${user?.username}`);

        // Check if user has access to the document
        const document = await documentService.getDocumentById(documentId) as any;
        if (!document) {
            console.log('[getVersions] Document not found');
            throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
        }

        // Permission check
        const isOwner = document.createdBy === user.username;
        const isAdmin = user.role === 'ADMIN';
        const hasPermission = document.permissions?.some((p: any) => p.userId === user.id);
        const hasDepartmentAccess = document.visibility === 'DEPARTMENT' && document.departmentId === user.departmentId;

        console.log(`[getVersions] Perms - Owner: ${isOwner}, Admin: ${isAdmin}, Shared: ${hasPermission}, Dept: ${hasDepartmentAccess}`);

        if (!isOwner && !isAdmin && !hasPermission && !hasDepartmentAccess) {
            console.log('[getVersions] Permission denied');
            throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this document');
        }

        const versions = await versionService.getVersions(documentId);
        console.log(`[getVersions] Found ${versions.length} versions`);
        res.send(versions);
    } catch (error) {
        console.error('[getVersions] Error:', error);
        throw error;
    }
};

/**
 * Download a specific version
 * GET /documents/:id/versions/:versionNumber/download
 */
export const downloadVersion = async (req: Request, res: Response) => {
    const documentId = parseInt(req.params.documentId);
    const versionNumber = parseInt(req.params.versionNumber);
    const user = req.user as any;

    // Check document access
    const document = await documentService.getDocumentById(documentId) as any;
    if (!document) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    // Permission check (same as getVersions)
    const isOwner = document.createdBy === user.username;
    const isAdmin = user.role === 'ADMIN';
    const hasPermission = document.permissions?.some((p: any) => p.userId === user.id);
    const hasDepartmentAccess = document.visibility === 'DEPARTMENT' && document.departmentId === user.departmentId;

    if (!isOwner && !isAdmin && !hasPermission && !hasDepartmentAccess) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this document');
    }

    // Get version
    const version = await versionService.getVersion(documentId, versionNumber);
    if (!version) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Version not found');
    }

    // Check if file exists
    try {
        await fs.access(version.filePath);
    } catch (error) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Version file not found on disk');
    }

    // Send file
    const filename = path.basename(version.filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(path.resolve(version.filePath));
};

/**
 * Restore a version (creates a new version from an old one)
 * POST /documents/:id/versions/:versionNumber/restore
 */
export const restoreVersion = async (req: Request, res: Response) => {
    const documentId = parseInt(req.params.documentId);
    const versionNumber = parseInt(req.params.versionNumber);
    const user = req.user as any;

    // Check document access and edit permission
    const document = await documentService.getDocumentById(documentId) as any;
    if (!document) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    const isOwner = document.createdBy === user.username;
    const isAdmin = user.role === 'ADMIN';
    const canEdit = isOwner || isAdmin || document.permissions?.some((p: any) => p.userId === user.id && p.permission === 'EDIT');

    if (!canEdit) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to restore versions');
    }

    // Get the version to restore
    const oldVersion = await versionService.getVersion(documentId, versionNumber);
    if (!oldVersion) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Version not found');
    }

    // Check if old file exists
    try {
        await fs.access(oldVersion.filePath);
    } catch (error) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Version file not found on disk');
    }

    // Get next version number
    const newVersionNumber = await versionService.getNextVersionNumber(documentId);

    // Copy old file to new version
    const oldFilePath = oldVersion.filePath;
    const ext = path.extname(oldFilePath);

    // Save restored version to G: Drive backup folder
    const versionRoot = 'G:\\My Drive\\DMS\\_Backup_Versions';
    const uploadDir = path.join(versionRoot, documentId.toString());

    await fs.mkdir(uploadDir, { recursive: true });

    const newFileName = `${documentId}_v${newVersionNumber}${ext}`;
    const newFilePath = path.join(uploadDir, newFileName);

    await fs.copyFile(oldFilePath, newFilePath);

    // Get file size
    const stats = await fs.stat(newFilePath);

    // Create new version
    const newVersion = await versionService.createVersion(
        documentId,
        newVersionNumber,
        newFilePath,
        stats.size,
        `Restored from version ${versionNumber}`,
        user.username,
        user.name || user.username
    );

    // Update document currentVersion and content (filePath)
    await documentService.updateDocumentVersion(documentId, newVersionNumber, newFilePath);

    // Cleanup old versions
    await versionService.cleanupOldVersions(documentId);

    res.status(httpStatus.CREATED).send(newVersion);
};
