
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const docs = await prisma.document.findMany({
        where: {
            OR: [
                { title: { contains: '123' } },
                { code: { contains: '123' } }
            ]
        },
        include: {
            permissions: {
                include: {
                    user: {
                        select: {
                            username: true,
                            name: true
                        }
                    }
                }
            }
        }
    });
    console.log(JSON.stringify(docs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
