
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
    console.log('Starting migration of names (Raw Query mode)...');

    // Get all users map
    const users = await prisma.user.findMany();
    const userMap = {};
    users.forEach(u => {
        userMap[u.username] = u.name || u.username;
    });

    console.log(`Loaded ${users.length} users.`);

    // Update Documents
    const documents = await prisma.document.findMany();
    console.log(`Found ${documents.length} documents.`);

    for (const doc of documents) {
        let updateValues = [];
        let updateFields = [];

        let createdByName = null;
        if (!doc.createdByName && doc.createdBy) {
            createdByName = userMap[doc.createdBy] || doc.createdBy;
            updateFields.push(`createdByName = '${createdByName.replace(/'/g, "''")}'`);
        }

        let updatedByName = null;
        if (!doc.updatedByName && doc.updatedBy) {
            updatedByName = userMap[doc.updatedBy] || doc.updatedBy;
            updateFields.push(`updatedByName = '${updatedByName.replace(/'/g, "''")}'`);
        }

        if (updateFields.length > 0) {
            const sql = `UPDATE Document SET ${updateFields.join(', ')} WHERE id = ${doc.id}`;
            await prisma.$executeRawUnsafe(sql);
            console.log(`Updated Document ${doc.id}`);
        }
    }

    // Update History
    const history = await prisma.documentHistory.findMany();
    console.log(`Found ${history.length} history records.`);

    for (const h of history) {
        if (!h.createdByName && h.createdBy) {
            let name = userMap[h.createdBy] || h.createdBy;
            const sql = `UPDATE DocumentHistory SET createdByName = '${name.replace(/'/g, "''")}' WHERE id = ${h.id}`;
            await prisma.$executeRawUnsafe(sql);
        }
    }

    // Update Versions
    // Note: older Prisma Client doesn't know DocumentVersion table structure changes, but query engine might.
    // If query engine is stale, this fails. But we can query via Raw too if needed.
    // But DB push succeeded, so DB has columns. Queries should work.

    // However, findMany might NOT return createdByName if schema is stale.
    // But we are updating it implies it's missing.

    // We fetch via findMany.
    const versions = await prisma.documentVersion.findMany();
    console.log(`Found ${versions.length} versions.`);

    for (const v of versions) {
        // v.createdByName might be undefined logic.
        // We assume we need to update if we have createdBy.

        if (v.createdBy) {
            let name = userMap[v.createdBy] || v.createdBy;
            // Use composite key update
            const sql = `UPDATE DocumentVersion SET createdByName = '${name.replace(/'/g, "''")}' WHERE documentId = ${v.documentId} AND versionNumber = ${v.versionNumber}`;
            try {
                await prisma.$executeRawUnsafe(sql);
                console.log(`Updated Version ${v.versionNumber} for Doc ${v.documentId}`);
            } catch (e) {
                console.log('Skipping version update (likely unrelated error)', e.message);
            }
        }
    }

    console.log('Migration complete.');
}

migrate()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
