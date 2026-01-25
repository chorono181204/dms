
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const username = 'user123';
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
        console.log(`User ${username} not found!`);
        return;
    }

    console.log(`User found: ${user.id}, Role: ${user.role}`);

    console.log('--- ALL SIGNATURE REQUESTS FOR USER ---');
    const requests = await prisma.signatureRequest.findMany({
        where: { userId: user.id },
        include: { document: true }
    });

    requests.forEach(req => {
        console.log(`ReqID: ${req.id} | DocID: ${req.documentId} | Status: ${req.status} | Step: ${req.step} | SignedAt: ${req.signedAt ? req.signedAt.toISOString() : 'null'} | Local: ${req.signedAt ? req.signedAt.toLocaleString() : ''}`);
    });

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

    const count = await prisma.signatureRequest.count({
        where: {
            userId: user.id,
            status: 'SIGNED',
            signedAt: { gte: startOfDay, lte: endOfDay }
        }
    });
    console.log(`Count for today according to DB logic: ${count}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
