import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import categoryValidation from '../../validations/category.validation';
import categoryController from '../../controllers/category.controller';

const router = express.Router();

router
    .route('/')
    .post(auth('manageDocuments'), validate(categoryValidation.createCategory), categoryController.createCategory) // Changed from manageTemplates to manageDocuments to allow Users
    .get(auth('getTemplates'), validate(categoryValidation.getCategories), categoryController.getCategories);

router
    .route('/:categoryId')
    .all((req, res, next) => {
        console.log(`[CategoryRoute] ${req.method} ${req.originalUrl} - Params:`, req.params);
        next();
    })
    .get(auth('getTemplates'), validate(categoryValidation.getCategory), categoryController.getCategory)
    .patch(auth('manageDocuments'), validate(categoryValidation.updateCategory), categoryController.updateCategory)
    .delete(auth('manageDocuments'), validate(categoryValidation.deleteCategory), categoryController.deleteCategory);

// NEW: Hierarchical category routes
router
    .route('/tree/all')
    .get(auth('getTemplates'), categoryController.getCategoryTree);

router
    .route('/:categoryId/breadcrumbs')
    .get(auth('getTemplates'), categoryController.getCategoryBreadcrumbs);

router
    .route('/:categoryId/contents')
    .get(auth('getTemplates'), categoryController.getCategoryContents);

router
    .route('/:categoryId/move')
    .patch(auth('manageDocuments'), categoryController.moveCategory);

export default router;
