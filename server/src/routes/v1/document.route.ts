import express from 'express';
import upload from '../../config/multer';
import validate from '../../middlewares/validate';
import documentValidation from '../../validations/document.validation';
import documentController from '../../controllers/document.controller';
import auth from '../../middlewares/auth';
import versionRoute from './version.route';

import signatureController from '../../controllers/signature.controller';

const router = express.Router();

router
    .route('/')
    .post(auth('manageDocuments'), upload.single('file'), validate(documentValidation.createDocument), documentController.createDocument)
    .get(auth('getDocuments'), validate(documentValidation.getDocuments), documentController.getDocuments);

// Signature routes - Must be before /:documentId
router
    .route('/pending-signatures')
    .get(auth('getDocuments'), signatureController.getPendingSignatures);

router
    .route('/history-signatures')
    .get(auth('getDocuments'), signatureController.getSignatureHistory);

// Version routes
router.use('/:documentId/versions', versionRoute);

router
    .route('/:documentId/sign-request')
    .post(auth('manageDocuments'), signatureController.createSignatureRequest);

// Approval routes - Must be before /:documentId
router
    .route('/pending-approvals')
    .get(auth('manageDocuments'), documentController.getPendingApprovals);

router
    .route('/history-approvals')
    .get(auth('getDocuments'), documentController.getApprovalHistory);

router
    .route('/:documentId/approve')
    .post(auth('manageDocuments'), documentController.approveDocument);

router
    .route('/:documentId/reject')
    .post(auth('manageDocuments'), documentController.rejectDocument);

router
    .route('/:documentId')
    .get(auth('getDocuments'), validate(documentValidation.getDocument), documentController.getDocument)
    .patch(auth('manageDocuments'), upload.single('file'), validate(documentValidation.updateDocument), documentController.updateDocument)
    .delete(auth('manageDocuments'), validate(documentValidation.deleteDocument), documentController.deleteDocument);

export default router;
