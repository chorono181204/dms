import { Server } from 'http';
import app from './app';
import prisma from './client';
import config from './config/config';
import logger from './config/logger';

import { initCleanupTask } from './tasks/cleanup.task';

import { createServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';

let server: Server;
const httpServer = createServer(app);
export const io = new SocketServer(httpServer, {
  cors: {
    origin: '*',
  }
});

io.on('connection', (socket: Socket) => {
  // Client sends userId upon connection (simple auth for now)
  const userId = socket.handshake.query.userId;
  if (userId) {
    socket.join(`user_${userId}`);
    logger.info(`User connected: ${userId}`);
  }

  socket.on('disconnect', () => {
    // console.log('Client disconnected');
  });
});

prisma.$connect().then(() => {
  logger.info('Connected to SQL Database');
  initCleanupTask();
  server = httpServer.listen(config.port, () => {
    logger.info(`Listening to port ${config.port}`);
  });
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error: unknown) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
