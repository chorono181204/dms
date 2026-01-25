
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
    try {
        const user = await prisma.user.findUnique({
            where: { username: 'test1234' } // Checking test1234 based on user prompt (actually user mentioned it?)
            // Wait, check check_perm.js output: CreatedBy: test123.
        });
        const user2 = await prisma.user.findUnique({ where: { username: 'test123' } });

        console.log('User test1234:', user);
        console.log('User test123:', user2);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
checkUser();
