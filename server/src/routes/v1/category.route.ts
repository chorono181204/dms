import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import categoryValidation from '../../validations/category.validation';
import categoryController from '../../controllers/category.controller';

const router = express.Router();

router
    .route('/')
    .post(auth('manageTemplates'), validate(categoryValidation.createCategory), categoryController.createCategory) // Re-using manageTemplates or create new permission? Let's use manageTemplates for now or new 'manageCategories'. Roles need update.
    .get(auth('getTemplates'), validate(categoryValidation.getCategories), categoryController.getCategories);

router
    .route('/:categoryId')
    .get(auth('getTemplates'), validate(categoryValidation.getCategory), categoryController.getCategory)
    .patch(auth('manageTemplates'), validate(categoryValidation.updateCategory), categoryController.updateCategory)
    .delete(auth('manageTemplates'), validate(categoryValidation.deleteCategory), categoryController.deleteCategory);

export default router;
