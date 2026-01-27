
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const data = {
        title: 'TEST_UNCHECKED',
        content: 'test',
        status: 'DRAFT',
        createdBy: 'admin',
        departmentId: 14,
        permissions: {
            create: [
                { userId: 26, permission: 'EDIT' }
            ]
        }
    };

    // Try to use it with create
    const doc = await prisma.document.create({
        data: data
    });
    console.log('Perms:', doc.permissions); // Should be undefined or []

    // Check in DB
    const saved = await prisma.document.findUnique({
        where: { id: doc.id },
        include: { permissions: true }
    });
    console.log('Saved Perms:', saved.permissions);
}

main().catch(console.error).finally(() => prisma.$disconnect());
