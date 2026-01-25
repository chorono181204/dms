import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const categoryName = 'new'; // Target category name from user report

    console.log(`Searching for category: ${categoryName}`);
    const categories = await prisma.category.findMany({
        where: { name: { contains: categoryName } }
    });

    if (categories.length === 0) {
        console.log('No categories found.');
        return;
    }

    for (const cat of categories) {
        console.log(`\nProcessing Category: ${cat.name} (ID: ${cat.id})`);

        const softDeletedDocs = await prisma.document.findMany({
            where: {
                categoryId: cat.id,
                deletedAt: { not: null }
            }
        });

        console.log(`Found ${softDeletedDocs.length} soft-deleted documents.`);

        if (softDeletedDocs.length > 0) {
            const result = await prisma.document.updateMany({
                where: {
                    categoryId: cat.id,
                    deletedAt: { not: null }
                },
                data: {
                    deletedAt: null
                }
            });
            console.log(`Successfully restored ${result.count} documents.`);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
