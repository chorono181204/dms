import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const docs = await prisma.document.findMany({
        select: {
            id: true,
            title: true,
            visibility: true,
            accessLevel: true,
            createdBy: true,
            status: true
        },
        take: 20
    });

    console.log('ID | Title | Visibility | AccessLevel | CreatedBy | Status');
    console.log('------------------------------------------------------------');
    docs.forEach(d => {
        console.log(`${d.id} | ${d.title} | ${d.visibility} | ${d.accessLevel} | ${d.createdBy} | ${d.status}`);
    });

    const permissions = await prisma.documentPermission.groupBy({
        by: ['permission'],
        _count: true
    });
    console.log('\nPermission Counts:');
    console.log(permissions);
}

main().catch(console.error).finally(() => prisma.$disconnect());
