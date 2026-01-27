
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const perms = await prisma.documentPermission.findMany({
        include: {
            document: {
                select: { title: true, code: true }
            },
            user: {
                select: { username: true }
            }
        }
    });
    console.log(JSON.stringify(perms, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
