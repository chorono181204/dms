
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DEBUG: LAST 5 CATEGORIES ---');
    const categories = await prisma.category.findMany({
        take: 5,
        orderBy: { id: 'desc' },
        include: { department: true }
    });

    categories.forEach(cat => {
        console.log(`ID: ${cat.id}`);
        console.log(`Name: ${cat.name}`);
        console.log(`IsTemplate: ${cat.isTemplate}`);
        console.log(`IsGlobal: ${cat.isGlobal}`);
        console.log(`Department: ${cat.department?.name} (ID: ${cat.departmentId})`);
        console.log(`Path (DB): ${cat.path}`);
        console.log('---------------------------');
    });

    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
