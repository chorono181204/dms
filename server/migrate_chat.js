
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
    console.log('Starting migration...');
    const directConversations = await prisma.conversation.findMany({
        where: {
            type: 'DIRECT',
            user1Id: { not: null },
            user2Id: { not: null }
        }
    });

    console.log(`Found ${directConversations.length} direct conversations to migrate.`);

    for (const conv of directConversations) {
        // Check if participants already exist
        const p1 = await prisma.participant.findUnique({
            where: {
                conversationId_userId: {
                    conversationId: conv.id,
                    userId: conv.user1Id
                }
            }
        });

        if (!p1) {
            await prisma.participant.create({
                data: {
                    conversationId: conv.id,
                    userId: conv.user1Id
                }
            });
        }

        const p2 = await prisma.participant.findUnique({
            where: {
                conversationId_userId: {
                    conversationId: conv.id,
                    userId: conv.user2Id
                }
            }
        });

        if (!p2) {
            await prisma.participant.create({
                data: {
                    conversationId: conv.id,
                    userId: conv.user2Id
                }
            });
        }
    }

    console.log('Migration completed.');
}

migrate()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
