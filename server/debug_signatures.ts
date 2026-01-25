
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- USERS ---');
    const users = await prisma.user.findMany();
    users.forEach(u => console.log(`${u.id}: ${u.username} (${u.name || 'No Name'})`));

    console.log('\n--- SIGNATURE REQUESTS ---');
    const requests = await prisma.signatureRequest.findMany({
        include: { user: true, document: true },
        orderBy: { id: 'desc' }
    });

    requests.forEach(req => {
        console.log(`[${req.id}] Doc: ${req.documentId} | User: ${req.user.username} | Status: ${req.status} | Step: ${req.step} | Note: ${req.note}`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
