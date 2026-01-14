import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import templateValidation from '../../validations/template.validation';
import templateController from '../../controllers/template.controller';
import upload from '../../config/multer';

const router = express.Router();

router
    .route('/')
    .post(
        auth('manageTemplates'),
        upload.single('file'),
        validate(templateValidation.createTemplate),
        templateController.createTemplate
    )
    .get(auth('getTemplates'), validate(templateValidation.getTemplates), templateController.getTemplates);

router
    .route('/:templateId')
    .get(auth('getTemplates'), validate(templateValidation.getTemplate), templateController.getTemplate)
    .patch(
        auth('manageTemplates'),
        upload.single('file'),
        validate(templateValidation.updateTemplate),
        templateController.updateTemplate
    )
    .delete(auth('manageTemplates'), validate(templateValidation.deleteTemplate), templateController.deleteTemplate);

export default router;
