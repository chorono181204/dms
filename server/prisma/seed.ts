import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding ...');

    // Clear existing data
    // Delete in order of dependencies (child first)
    await prisma.notification.deleteMany({});
    await prisma.taskAttachment.deleteMany({});
    await prisma.taskComment.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.messageAttachment.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.signatureRequest.deleteMany({});
    await prisma.documentPermission.deleteMany({});
    await prisma.signature.deleteMany({});
    await prisma.documentHistory.deleteMany({});
    await prisma.documentVersion.deleteMany({});
    await prisma.documentAttachment.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.template.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.department.deleteMany({});

    // 1. Seed Departments
    const deptNames = [
        'Vi sinh',
        'Huyết Học Truyền Máu',
        'Hóa Sinh',
        'Quản Lý Chất Lượng'
    ];

    const departments = [];
    for (let i = 0; i < deptNames.length; i++) {
        // Quản Lý Chất Lượng is often supervisory
        const isSupervisory = deptNames[i] === 'Quản Lý Chất Lượng';
        const dept = await prisma.department.create({
            data: {
                name: deptNames[i],
                code: `K${i + 1}`,
                isSupervisory: isSupervisory,
                createdBy: 'system',
                updatedBy: 'system'
            },
        });
        departments.push(dept);
    }
    console.log(`Created ${departments.length} departments.`);

    // 2. Seed Categories (Kept for system functionality)
    const catNames = ['Báo cáo', 'Quyết định', 'Công văn', 'Biên bản', 'Hợp đồng', 'Giấy mời'];
    const categories = [];
    for (let i = 0; i < catNames.length; i++) {
        const cat = await prisma.category.create({
            data: {
                name: catNames[i],
                description: `Các tài liệu loại ${catNames[i]}`,
                isActive: true,
                createdBy: 'system',
                updatedBy: 'system'
            }
        });
        categories.push(cat);
    }
    console.log(`Created ${categories.length} categories.`);

    // 3. Seed Users
    // Only 1 Admin as requested
    const password = bcrypt.hashSync('admin', 8);
    await prisma.user.create({
        data: {
            username: 'admin',
            name: 'Administrator',
            password: password,
            role: 'ADMIN',
            isEmailVerified: true,
            // Attach to 'Quản Lý Chất Lượng' or keep standalone. 
            // Attaching to QLCL is reasonable for an Admin if they need a dept.
            departmentId: departments.find(d => d.name === 'Quản Lý Chất Lượng')?.id,
            position: 'Administrator',
            createdBy: 'system'
        }
    });
    console.log('Created Admin: admin / admin');

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
