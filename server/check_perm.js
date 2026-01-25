
const { PrismaClient } = require('@prisma/client');

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
        console.log(`Checking for User: ${user.username} (ID: ${user.id}) Dept: ${user.departmentId}`);

        // Find documents with 'test' in title
        const docs = await prisma.document.findMany({
            where: {
                title: { contains: 'test' }
            },
            include: {
                permissions: true
            }
        });

        console.log(`Found ${docs.length} documents matching 'test'`);

        for (const doc of docs) {
            console.log(`\n--- Document: ${doc.title} (ID: ${doc.id}) ---`);
            console.log(`CreatedBy: ${doc.createdBy}`);
            console.log(`Visibility: ${doc.visibility}`);

            // Check if user is creator
            if (doc.createdBy === user.username) {
                console.log(`👑 User IS CREATOR (Owner) -> Can Download: YES`);
            } else {
                console.log(`User is NOT Creator.`);
            }

            const perm = doc.permissions.find(p => p.userId === user.id);
            if (perm) {
                console.log(`✅ Permission RECORD FOUND: ${perm.permission}`);
            } else {
                console.log(`❌ NO Permission record found.`);
                // If internal, check if same department
                if (doc.visibility === 'DEPARTMENT' && doc.departmentId === user.departmentId) {
                    console.log(`⚠️ Document is Internal & Same Dept -> Implicit Access? (Default: Download allowed if no restriction)`);
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkPermissions();
