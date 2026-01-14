
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking SignatureRequests...');
    const requests = await prisma.signatureRequest.findMany({
        include: {
            user: true,
            document: true
        }
    });

    console.log(`Found ${requests.length} requests.`);

    requests.forEach(r => {
        console.log(`ID: ${r.id} | Doc: ${r.document.title} (${r.documentId}) | User: ${r.user.username} (${r.userId}) | Status: ${r.status} | SignedAt: ${r.signedAt}`);
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
