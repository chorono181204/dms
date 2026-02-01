import { Server } from 'http';
import app from './app';
import prisma from './client';
import config from './config/config';
import logger from './config/logger';

import { initCleanupTask } from './tasks/cleanup.task';
import { initBackupTask } from './tasks/backup.task';

import { createServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';

let server: Server;
const httpServer = createServer(app);
export const io = new SocketServer(httpServer, {
  cors: {
    origin: '*',
  }
});

io.on('connection', async (socket: Socket) => {
  const userId = socket.handshake.query.userId;
  if (userId) {
    const uid = parseInt(userId as string);
    socket.join(`user_${uid}`);

    try {
      // Find all conversations this user is part of
      const participations = await prisma.participant.findMany({
        where: { userId: uid },
        select: { conversationId: true }
      });

      participations.forEach(p => {
        socket.join(`conv_${p.conversationId}`);
      });

      logger.info(`User ${uid} connected and joined ${participations.length} conversation rooms`);
    } catch (error) {
      logger.error('Error joining conversation rooms:', error);
    }
  }

  // Allow client to join a new conversation room on the fly
  socket.on('join_conversation', (conversationId: number) => {
    socket.join(`conv_${conversationId}`);
    logger.info(`Socket ${socket.id} joined conv_${conversationId}`);
  });

  socket.on('disconnect', () => {
    // console.log('Client disconnected');
  });
});

prisma.$connect().then(() => {
  logger.info('Connected to SQL Database');
  initCleanupTask();
  initBackupTask();
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
