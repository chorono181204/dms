
import { PrismaClient } from '@prisma/client';
import * as path from 'path';

const prisma = new PrismaClient();

async function syncPaths() {
    console.log('Starting Category Path Sync...');

    const categories = await prisma.category.findMany({
        where: { isActive: true },
        include: { department: true }
    });

    for (const cat of categories) {
        if (!cat.department) {
            console.warn(`Skipping category ${cat.name} (ID: ${cat.id}) - No Department`);
            continue;
        }

        const pathParts = [];
        let currentId = cat.parentId;

        // Build recursive path
        while (currentId) {
            const parent = categories.find(c => c.id === currentId);
            if (parent) {
                pathParts.unshift(parent.name);
                currentId = parent.parentId;
            } else {
                break;
            }
        }

        // Add self
        pathParts.push(cat.name);

        // Sanitize function same as service
        const sanitize = (name: string) => name.replace(/[<>:"\\/\\|?*]/g, '_');

        const safeDept = sanitize(cat.department.name);
        const safePath = [safeDept, ...pathParts.map(sanitize)].join('/');

        // Update if different
        if (cat.path !== safePath) {
            await prisma.category.update({
                where: { id: cat.id },
                data: { path: safePath }
            });
            console.log(`Updated path for [${cat.name}]: ${safePath}`);
        }
    }

    console.log('Sync Complete!');
}

syncPaths()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
