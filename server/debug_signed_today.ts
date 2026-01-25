
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- SIGNED SIGNATURE REQUESTS ---');
    const signed = await prisma.signatureRequest.findMany({
        where: { status: 'SIGNED' },
        include: { user: true }
    });

    signed.forEach(req => {
        console.log(`User: ${req.user.username} | DocId: ${req.documentId} | SignedAt: ${req.signedAt} | Local: ${req.signedAt?.toLocaleString()}`);
    });

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
    console.log('\n--- DATE RANGE CHECK ---');
    console.log('Start (Local):', startOfDay.toLocaleString());
    console.log('End (Local):', endOfDay.toLocaleString());
    console.log('Start (ISO):', startOfDay.toISOString());
    console.log('End (ISO):', endOfDay.toISOString());

    const count = await prisma.signatureRequest.count({
        where: {
            status: 'SIGNED',
            signedAt: {
                gte: startOfDay,
                lte: endOfDay
            }
        }
    });
    console.log('Count with current logic:', count);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
