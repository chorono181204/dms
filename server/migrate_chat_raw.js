
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
    console.log('Starting raw migration...');

    // Get direct conversations
    const convs = await prisma.$queryRaw`SELECT id, user1Id, user2Id FROM Conversation WHERE type = 'DIRECT'`;

    console.log(`Found ${convs.length} conversations.`);

    for (const conv of convs) {
        try {
            // In SQLite, we can use INSERT OR IGNORE
            await prisma.$executeRaw`INSERT OR IGNORE INTO Participant (conversationId, userId, joinedAt) VALUES (${conv.id}, ${conv.user1Id}, CURRENT_TIMESTAMP)`;
            await prisma.$executeRaw`INSERT OR IGNORE INTO Participant (conversationId, userId, joinedAt) VALUES (${conv.id}, ${conv.user2Id}, CURRENT_TIMESTAMP)`;
        } catch (e) {
            console.error(`Failed for conv ${conv.id}:`, e.message);
        }
    }

    console.log('Raw migration completed.');
}

migrate()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
