import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const docs = await prisma.document.findMany({
        select: { id: true, title: true, content: true }
    });
    console.log(JSON.stringify(docs, null, 2));
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
