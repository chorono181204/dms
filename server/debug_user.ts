
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const username = 'manager';
    const user = await prisma.user.findUnique({
        where: { username },
        include: { department: true }
    });
    console.log('User manager:', user);

    if (user) {
        console.log('DepartmentId type:', typeof user.departmentId);
        // Check count logic for this user specifically
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

        const count = await prisma.signatureRequest.count({
            where: {
                status: 'SIGNED',
                signedAt: { gte: startOfDay, lte: endOfDay },
                user: { departmentId: user.departmentId } // emulate logic
            }
        });
        console.log('Count for manager department:', count);

        const countPersonal = await prisma.signatureRequest.count({
            where: {
                status: 'SIGNED',
                signedAt: { gte: startOfDay, lte: endOfDay },
                userId: user.id
            }
        });
        console.log('Count personal:', countPersonal);
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
