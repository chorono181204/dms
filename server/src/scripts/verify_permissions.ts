import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testPermissions() {
    console.log('--- Testing Download Permissions Logic ---');

    // 1. Mock a document with visibility DEPARTMENT and accessLevel VIEW
    const doc = {
        id: 999,
        visibility: 'DEPARTMENT',
        accessLevel: 'VIEW',
        departmentId: 1,
        createdBy: 'owner'
    };

    // 2. Mock users
    const userSameDept = { id: 2, username: 'user1', departmentId: 1, role: 'USER' };
    const userOtherDept = { id: 3, username: 'user2', departmentId: 2, role: 'USER' };
    const admin = { id: 1, username: 'admin', departmentId: 1, role: 'ADMIN' };

    // 3. Logic from upload.controller.ts
    const checkDownload = (u: any, d: any, explicitPermission?: string) => {
        const isOwner = d.createdBy === u.username;
        const isAdmin = u.role === 'ADMIN';
        const hasExplicitDownload = explicitPermission === 'DOWNLOAD' || explicitPermission === 'EDIT' || explicitPermission === 'SIGN';

        // canView check (simplified)
        const canView = isOwner || isAdmin || (explicitPermission) ||
            (d.visibility === 'PUBLIC') ||
            (d.visibility === 'DEPARTMENT' && (d.departmentId === u.departmentId));

        if (!canView) return 'FORBIDDEN_VIEW';

        const canDownload = isOwner || isAdmin || hasExplicitDownload ||
            (d.visibility !== 'PRIVATE' && d.accessLevel !== 'VIEW');

        return canDownload ? 'ALLOWED' : 'FORBIDDEN_DOWNLOAD';
    };

    console.log('Test 1: Same department user, Doc is VIEW-only');
    console.log('Result:', checkDownload(userSameDept, doc)); // Expected: FORBIDDEN_DOWNLOAD

    console.log('\nTest 2: Same department user, Doc is DOWNLOAD-level');
    console.log('Result:', checkDownload(userSameDept, { ...doc, accessLevel: 'DOWNLOAD' })); // Expected: ALLOWED

    console.log('\nTest 3: Owner of VIEW-only doc');
    console.log('Result:', checkDownload({ username: 'owner', role: 'USER' }, doc)); // Expected: ALLOWED

    console.log('\nTest 4: Admin of VIEW-only doc');
    console.log('Result:', checkDownload(admin, doc)); // Expected: ALLOWED

    console.log('\nTest 5: Other department user, Doc is DEPARTMENT');
    console.log('Result:', checkDownload(userOtherDept, doc)); // Expected: FORBIDDEN_VIEW

    console.log('\nTest 6: User with explicit DOWNLOAD permission on PRIVATE doc');
    const privateDoc = { ...doc, visibility: 'PRIVATE' };
    console.log('Result:', checkDownload(userSameDept, privateDoc, 'DOWNLOAD')); // Expected: ALLOWED

    console.log('\nTest 7: User with explicit VIEW permission on PRIVATE doc');
    console.log('Result:', checkDownload(userSameDept, privateDoc, 'VIEW')); // Expected: FORBIDDEN_DOWNLOAD
}

testPermissions().catch(console.error).finally(() => prisma.$disconnect());
