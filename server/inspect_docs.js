const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const docs = await prisma.document.findMany({
        select: {
            id: true,
            title: true,
            status: true,
            updatedAt: true
        },
        orderBy: {
            updatedAt: 'desc'
        },
        take: 5
    });
    console.log(JSON.stringify(docs, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
