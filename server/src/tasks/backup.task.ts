import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import logger from '../config/logger';

// Backup configuration
const BACKUP_DIR = 'G:\\My Drive\\DMS\\Database_Backups';
const DB_PATH = path.join(__dirname, '../../prisma/dev.db');

export const backupDatabase = async () => {
    logger.info('[Backup Task] Starting database backup...');
    try {
        // Ensure backup directory exists
        if (!fs.existsSync(BACKUP_DIR)) {
            logger.info(`[Backup Task] Backup directory not found. Creating: ${BACKUP_DIR}`);
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }

        // Generate filename with timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-mm-ss
        const backupFileName = `backup_dms_${timestamp}.db`;
        const backupPath = path.join(BACKUP_DIR, backupFileName);

        // Check if source DB exists
        if (!fs.existsSync(DB_PATH)) {
            logger.error(`[Backup Task] Source database not found at: ${DB_PATH}`);
            return;
        }

        // Copy file
        fs.copyFileSync(DB_PATH, backupPath);

        logger.info(`[Backup Task] Backup created successfully: ${backupPath}`);

        // Optional: Retention policy (e.g., keep last 30 backups)
        // cleanOldBackups(BACKUP_DIR);

    } catch (error) {
        logger.error('[Backup Task] Backup failed:', error);
    }
};

export const initBackupTask = () => {
    // Schedule task to run at 12:00 PM every day
    // Cron format: Minute Hour Day Month Weekday
    cron.schedule('0 12 * * *', () => {
        backupDatabase();
    });

    logger.info('[Backup Task] Initialized - Scheduled for 12:00 PM daily');
};
