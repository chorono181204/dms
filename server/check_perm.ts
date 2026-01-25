
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPermissions() {
    try {
        // Find the user 'user-test' (Thắng)
        const user = await prisma.user.findFirst({
            where: { username: 'user-test' }
        });

        if (!user) {
            console.log('User user-test not found');
            return;
        }
        console.log('User found:', user.id, user.username, 'Dept:', user.departmentId);

        // Find the document 'test1234' or 'test' (from screenshots)
        // Screenshot 1: 536307 (Number), Title "test"
        // Screenshot 2: Title "test123"

        // Let's check "test" (536307)
        // Actually the ID might be 536307? Or that's the documentNumber?
        // Let's search by title logic

        const docs = await prisma.document.findMany({
            where: {
                OR: [
                    { title: { contains: 'test' } },
                    { documentNumber: { contains: '536307' } }
                ]
            },
            include: {
                permissions: true
            }
        });

        console.log(`Found ${docs.length} documents matching 'test' or '536307'`);

        for (const doc of docs) {
            console.log(`--- Document: ${doc.title} (ID: ${doc.id}) ---`);
            console.log(`CreatedBy: ${doc.createdBy}`);
            console.log(`Visibility: ${doc.visibility}`);

            const perm = doc.permissions.find(p => p.userId === user.id);
            if (perm) {
                console.log(`✅ Permission for user ${user.username}: ${perm.permission}`);
            } else {
                console.log(`❌ NO Permission record for user ${user.username}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkPermissions();
