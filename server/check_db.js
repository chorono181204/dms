
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const result = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table'`;
    console.log(result);
}

check().finally(() => prisma.$disconnect());
