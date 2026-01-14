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
  const options = pick(req.query, ['sortBy', 'limit', 'page']);

  const user = req.user as any; // Cast to any to access role and departmentId
  if (user.role !== 'ADMIN') {
    if (user.departmentId) {
      Object.assign(filter, { departmentId: user.departmentId });
    } else {
      Object.assign(filter, { departmentId: -1 }); // specific impossible ID
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

export default {
  createUser,
  getUsers,
  getUser,
  getProfile,
  updateProfile,
  updateUser,
  deleteUser,
  uploadSignature
};
