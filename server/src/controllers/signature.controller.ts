import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import prisma from '../client';
import ApiError from '../utils/ApiError';

const createSignatureRequest = catchAsync(async (req, res) => {
    const { documentId } = req.params;
    const { userIds, note } = req.body; // userIds: number[]
    const documentIdInt = parseInt(documentId);

    // 1. Check Document
    const document = await prisma.document.findUnique({
        where: { id: documentIdInt }
    });
    if (!document) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    // 2. Check Permissions (Owner or Editor)
    const user = req.user as any;
    let canRequest = false;
    if (user.role === 'ADMIN' || document.createdBy === user.username) {
        canRequest = true;
    } else {
        const perm = await prisma.documentPermission.findFirst({
            where: { documentId: documentIdInt, userId: user.id, permission: 'EDIT' }
        });
        if (perm) canRequest = true;
    }

    if (!canRequest) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to request signatures for this document');
    }

    // 3. Create Requests
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Please select users to sign');
    }

    const requestsCreated = [];

    // Explicit loop to handle unique constraints gracefully
    for (const targetUserId of userIds) {
        // Prevent requesting yourself? Maybe allowed for self-signing flow tracking?
        // if (targetUserId === user.id) continue;

        const existing = await prisma.signatureRequest.findUnique({
            where: {
                documentId_userId: {
                    documentId: documentIdInt,
                    userId: targetUserId
                }
            }
        });

        if (!existing) {
            const newReq = await prisma.signatureRequest.create({
                data: {
                    documentId: documentIdInt,
                    userId: targetUserId,
                    status: 'PENDING',
                    note: note
                }
            });
            requestsCreated.push(newReq);
        } else if (existing.status !== 'PENDING' && existing.status !== 'SIGNED') {
            // Re-open rejected request?
            const updated = await prisma.signatureRequest.update({
                where: { id: existing.id },
                data: { status: 'PENDING', note: note, signedAt: null }
            });
            requestsCreated.push(updated);
        }
    }

    res.status(httpStatus.CREATED).send({ message: 'Signature requests sent', count: requestsCreated.length });
});

const getPendingSignatures = catchAsync(async (req, res) => {
    const user = req.user as any;

    const requests = await prisma.signatureRequest.findMany({
        where: {
            userId: user.id,
            status: 'PENDING'
        },
        include: {
            document: {
                select: {
                    id: true,
                    title: true,
                    code: true,
                    content: true, // File path - CRITICAL for signing
                    status: true,
                    createdBy: true,
                    createdAt: true,
                    department: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    category: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            },
            user: {
                select: { id: true, name: true, username: true }
            }
        },
        orderBy: {
            requestedAt: 'desc'
        }
    });

    res.send(requests);
});

const getSignatureHistory = catchAsync(async (req, res) => {
    const user = req.user as any;

    const history = await prisma.signatureRequest.findMany({
        where: {
            userId: user.id,
            status: { in: ['SIGNED', 'REJECTED'] }
        },
        include: {
            document: {
                select: {
                    id: true,
                    title: true,
                    code: true,
                    content: true,
                    status: true,
                    createdBy: true,
                    createdAt: true,
                    department: { select: { name: true } },
                    category: { select: { name: true } }
                }
            }
        },
        orderBy: {
            signedAt: 'desc'
        }
    });

    res.send(history);
});

export default {
    createSignatureRequest,
    getPendingSignatures,
    getSignatureHistory
};
