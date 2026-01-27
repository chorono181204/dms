
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const doc = await prisma.document.create({
        data: {
            title: 'TEST_PERM',
            content: 'test',
            status: 'DRAFT',
            createdBy: 'admin',
            departmentId: 14,
            permissions: {
                create: [
                    { userId: 26, permission: 'EDIT' }
                ]
            }
        },
        include: {
            permissions: true
        }
    });
    console.log(JSON.stringify(doc, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
