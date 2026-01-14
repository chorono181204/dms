import express from 'express';
import authRoute from './auth.route';
import userRoute from './user.route';
import departmentRoute from './department.route';
import templateRoute from './template.route';
import uploadRoute from './upload.route';
import docsRoute from './docs.route';
import config from '../../config/config';

import documentRoute from './document.route';
import categoryRoute from './category.route';

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute
  },
  {
    path: '/users',
    route: userRoute
  },
  {
    path: '/departments',
    route: departmentRoute
  },
  {
    path: '/templates',
    route: templateRoute
  },
  {
    path: '/upload',
    route: uploadRoute
  },
  {
    path: '/documents',
    route: documentRoute
  },
  {
    path: '/categories',
    route: categoryRoute
  }
];

const devRoutes = [
  // routes available only in development mode
  {
    path: '/docs',
    route: docsRoute
  }
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */
if (config.env === 'development') {
  devRoutes.forEach((route) => {
    router.use(route.path, route.route);
  });
}

export default router;
