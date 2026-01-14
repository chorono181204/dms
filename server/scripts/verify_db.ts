import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const userCount = await prisma.user.count();
    const deptCount = await prisma.department.count();
    const docCount = await prisma.document.count();

    console.log(`Verification:`);
    console.log(`Users: ${userCount}`);
    console.log(`Departments: ${deptCount}`);
    console.log(`Documents: ${docCount}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
