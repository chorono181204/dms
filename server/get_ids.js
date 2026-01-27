
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const u = await prisma.user.findFirst();
    const d = await prisma.department.findFirst();
    console.log('User:', u?.id, u?.username);
    console.log('Dept:', d?.id, d?.name);
}

main().catch(console.error).finally(() => prisma.$disconnect());
