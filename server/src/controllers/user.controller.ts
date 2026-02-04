import httpStatus from 'http-status';
import pick from '../utils/pick';
import ApiError from '../utils/ApiError';
import catchAsync from '../utils/catchAsync';
import { userService } from '../services';
import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

const createUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { username, password, name, role, departmentId, position } = req.body;
  const currentUser = req.user as any;
  const user = await userService.createUser(
    username,
    password,
    name,
    role,
    departmentId,
    currentUser.username, // createdBy
    position
  );
  res.status(httpStatus.CREATED).send(user);
});

const getUsers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const filter = pick(req.query, ['name', 'role', 'departmentId']);
  if (filter.name) {
    filter.name = { contains: filter.name };
  }
  const options = pick(req.query, ['sortBy', 'limit', 'page']);

  const user = req.user as any; // Cast to any to access role and departmentId
  /*
   * Allow non-admin users to view all users IF 'scope=all' is passed (for Sharing feature).
   * Otherwise, restrict to their own department.
   */
  const allowAll = req.query.scope === 'all';
  if (user.role !== 'ADMIN' && !allowAll) {
    if (user.department?.isSupervisory) {
      // Supervisor: Can see all departments, but exclude ADMINs.
      // Respect filter.departmentId if passed by frontend (e.g. SettingsPage).
      const existingAnd = Array.isArray(filter.AND) ? filter.AND : (filter.AND ? [filter.AND] : []);
      filter.AND = [...existingAnd, { role: { not: 'ADMIN' } }];
    } else {
      // Normal: Restrict to own department
      if (user.departmentId) {
        Object.assign(filter, { departmentId: user.departmentId });
      } else {
        // If no department assigned/found, restrict to impossible ID to show no users
        Object.assign(filter, { departmentId: -1 });
      }
    }
  } else {
    // Explicitly remove departmentId from filter if scope=all, to ensure we get ALL users
    // even if frontend accidentally sends departmentId
    if (allowAll) {
      delete filter.departmentId;
    }
  }

  const result = await userService.queryUsers(filter, options);
  res.send(result);
});

const getUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await userService.getUserById(parseInt(req.params.userId));
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  res.send(user);
});

const updateUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = req.user as any;
  const user = await userService.updateUserById(parseInt(req.params.userId), {
    ...req.body,
    updatedBy: currentUser.username
  });
  res.send(user);
});

const deleteUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  await userService.deleteUserById(parseInt(req.params.userId));
  res.status(httpStatus.NO_CONTENT).send();
});

const getProfile = catchAsync(async (req, res, next) => {
  console.log('GET /profile request received');
  console.log('User from request:', req.user);
  const user = await userService.getUserById((req.user as any).id);
  console.log('Fetched user from service:', user);
  res.send(user);
});

const updateProfile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await userService.updateUserById((req.user as any).id, req.body);
  res.send(user);
});

const uploadSignature = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Vui lòng chọn file chữ ký');
  }

  const currentUser = req.user as any;
  let targetUserId = currentUser.id;
  let targetUsername = currentUser.username;

  // If userId is provided and current user is admin, allow uploading for that user
  if (req.params.userId && (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER')) {
    const targetUser = await userService.getUserById(parseInt(req.params.userId));
    if (targetUser) {
      targetUserId = targetUser.id;
      targetUsername = targetUser.username;
    }
  }

  // Always save as .png regardless of uploaded file extension
  // Persistent logging to file
  const logFile = path.join(process.cwd(), 'signature_upload.log');
  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
    console.log(msg);
  };

  log(`--- New Upload: user=${targetUsername} file=${req.file.originalname} ---`);

  const targetRoot = 'G:\\My Drive\\DMS\\Signatures';
  const targetPath = path.join(targetRoot, `${targetUsername}.png`);
  const fallbackRoot = path.join(process.cwd(), 'uploads', 'signatures');
  const fallbackPath = path.join(fallbackRoot, `${targetUsername}.png`);

  let finalTargetPath = targetPath;

  try {
    log(`Checking G: drive path: ${targetRoot}`);
    if (!fs.existsSync(targetRoot)) {
      log(`Creating G: drive directory: ${targetRoot}`);
      fs.mkdirSync(targetRoot, { recursive: true });
    }

    log(`Attempting copy to G: drive: ${targetPath}`);
    fs.copyFileSync(req.file.path, targetPath);
    log(`Success: file saved to G: drive.`);
  } catch (error: any) {
    log(`G: drive error: ${error.message}. Falling back to E: drive.`);
    finalTargetPath = fallbackPath;

    if (!fs.existsSync(fallbackRoot)) {
      log(`Creating fallback directory: ${fallbackRoot}`);
      fs.mkdirSync(fallbackRoot, { recursive: true });
    }

    log(`Attempting copy to E: drive: ${fallbackPath}`);
    fs.copyFileSync(req.file.path, fallbackPath);
    log(`Success: file saved to E: drive.`);
  }

  try {
    log(`Updating database for user ${targetUserId} with path: ${finalTargetPath}`);
    const updatedUser = await userService.updateUserById(targetUserId, {
      signatureImage: finalTargetPath
    });

    // Cleanup temp file
    if (fs.existsSync(req.file.path)) {
      log(`Cleaning up temp file: ${req.file.path}`);
      fs.unlinkSync(req.file.path);
    }

    log(`Upload process complete for ${targetUsername}`);
    res.send(updatedUser);
  } catch (error: any) {
    log(`Finalization error: ${error.message}`);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Lỗi cập nhật thông tin chữ ký');
  }
});

const getAssignableUsers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;
  const filter: any = {};
  const options = pick(req.query, ['sortBy', 'limit', 'page']);

  // Cast options to numbers (Fix "Provided String, expected Int" error)
  const limitStr = options.limit;
  const pageStr = options.page;
  options.limit = limitStr ? parseInt(limitStr as any, 10) : 1000;
  options.page = pageStr ? parseInt(pageStr as any, 10) : 1;
  // Apply name search if present
  if (req.query.name) {
    filter.OR = [
      { name: { contains: req.query.name as string } },
      { username: { contains: req.query.name as string } }
    ];
  }

  const isAdmin = user.role === 'ADMIN';
  const isManager = user.role === 'MANAGER';
  // Check if user's department is supervisory (e.g. Quality Control, Board of Directors)
  const isSupervisory = user.department?.isSupervisory;

  // 1. SCOPE FILTER (Department Level)
  // Admin OR User in Supervisory Department -> Can see ALL Departments
  if (isAdmin || isSupervisory) {
    // No department restriction
  } else {
    // Normal Department -> Restricted to Own Department
    if (user.departmentId) {
      filter.departmentId = user.departmentId;
    } else {
      filter.departmentId = -1; // No dept assigned -> No access
    }
  }

  // 2. ROLE FILTER (User Level)

  // GLOBAL RULE: Never show ADMINs in assignment list (unless we want to allow assigning to admins?)
  // User request: "ko lấy ra admin" -> Exclude ADMIN role always.

  // Admin OR Manager -> Can see Managers, Chiefs, Users (BUT NOT Other Admins)
  if (isAdmin || isManager) {
    // Exclude ADMINs from the list
    // We need to be careful not to overwrite if we set other things, but here it's the first role setting.
    filter.role = { not: 'ADMIN' };
  } else {
    // Chief OR Regular User -> Can ONLY see Regular Users
    // "ktv trưởng thì chỉ đc lấy ra user thường"
    filter.role = 'USER';
    filter.isChief = false;
  }

  const result = await userService.queryUsers(filter, options);
  res.send(result);
});

export default {
  createUser,
  getUsers,
  getAssignableUsers,
  getUser,
  getProfile,
  updateProfile,
  updateUser,
  deleteUser,
  uploadSignature
};
