
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
    const docs = await prisma.document.findMany({
        where: {
            OR: [
                { title: { contains: '123' } },
                { code: { contains: '123' } }
            ]
        }
    });
    fs.writeFileSync('output.json', JSON.stringify(docs, null, 2), 'utf8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
