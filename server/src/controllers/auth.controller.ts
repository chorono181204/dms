import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { authService, tokenService } from '../services';
import exclude from '../utils/exclude';
import { User } from '@prisma/client';

const login = catchAsync(async (req, res) => {
  const { username, password } = req.body;
  const user = await authService.loginUserWithUsernameAndPassword(username, password);
  const tokens = await tokenService.generateAuthTokens(user);
  res.send({ user, tokens });
});

const changePassword = catchAsync(async (req, res) => {
  await authService.changePassword(
    (req.user as User).id,
    req.body.newPassword
  );
  res.status(httpStatus.NO_CONTENT).send();
});

export default {
  login,
  changePassword
};
