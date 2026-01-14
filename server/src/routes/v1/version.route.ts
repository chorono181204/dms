import express from 'express';
import auth from '../../middlewares/auth';
import * as versionController from '../../controllers/version.controller';
import catchAsync from '../../utils/catchAsync';

const router = express.Router({ mergeParams: true }); // mergeParams to access :id from parent route

router
    .route('/')
    .get(auth(), catchAsync(versionController.getVersions));

router
    .route('/:versionNumber/download')
    .get(auth(), catchAsync(versionController.downloadVersion));

router
    .route('/:versionNumber/restore')
    .post(auth(), catchAsync(versionController.restoreVersion));

export default router;
