import { PrismaClient, User, Department, Category } from '@prisma/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding ...');

    // Clear existing data
    // Delete in order of dependencies (child first)
    await prisma.documentPermission.deleteMany({});
    await prisma.signature.deleteMany({});
    await prisma.documentHistory.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.template.deleteMany({});
    await prisma.category.deleteMany({}); // New
    await prisma.user.deleteMany({});
    await prisma.department.deleteMany({});

    // 1. Seed Departments
    const departments: Department[] = [];
    const deptNames = ['Khoa Nội', 'Khoa Ngoại', 'Khoa Sản', 'Khoa Nhi', 'Khoa Hóa sinh', 'Phòng Hành chính', 'Phòng Kế hoạch', 'Phòng CNTT'];

    for (let i = 0; i < deptNames.length; i++) {
        const dept = await prisma.department.create({
            data: {
                name: deptNames[i],
                code: `D${i + 1}`,
                createdBy: 'system',
                updatedBy: 'system'
            },
        });
        departments.push(dept);
    }
    console.log(`Created ${departments.length} departments.`);

    // 2. Seed Categories (New)
    const categories: Category[] = [];
    const catNames = ['Báo cáo', 'Quyết định', 'Công văn', 'Biên bản', 'Hợp đồng', 'Giấy mời'];

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
    // Fixed Admin
    const password = bcrypt.hashSync('password1', 8);
    const adminUser = await prisma.user.create({
        data: {
            username: 'admin',
            name: 'Administrator',
            password: password,
            role: 'ADMIN',
            isEmailVerified: true,
            departmentId: departments[departments.length - 1].id, // CNTT
            position: 'Trưởng phòng CNTT',
            createdBy: 'system'
        }
    });
    console.log('Created Fixed Admin: admin / password1');

    // Random Users
    const users: User[] = [adminUser];
    for (let i = 0; i < 15; i++) {
        const dept = faker.helpers.arrayElement(departments);
        const role = i < 3 ? 'MANAGER' : 'USER';
        const position = role === 'MANAGER' ? 'Trưởng khoa' : faker.name.jobTitle();

        const user = await prisma.user.create({
            data: {
                username: `user${i + 1}`,
                name: faker.name.fullName(),
                password: password,
                role: role,
                isEmailVerified: true,
                departmentId: dept.id,
                position: position,
                createdBy: 'admin'
            },
        });
        users.push(user);
    }
    console.log(`Created ${users.length - 1} random users.`);

    // 4. Seed Documents
    for (let i = 0; i < 30; i++) {
        const creator = faker.helpers.arrayElement(users);
        if (!creator.departmentId) continue;
        const category = faker.helpers.arrayElement(categories);

        const doc = await prisma.document.create({
            data: {
                code: `DOC-2024-${String(i + 1).padStart(3, '0')}`,
                title: faker.company.catchPhrase(),
                content: `<h1>${faker.lorem.sentence()}</h1><p>${faker.lorem.paragraphs(3)}</p>`,
                status: faker.helpers.arrayElement(['DRAFT', 'PENDING', 'APPROVED', 'SIGNED']),
                departmentId: creator.departmentId,
                categoryId: category.id,
                visibility: faker.helpers.arrayElement(['PRIVATE', 'DEPARTMENT', 'PUBLIC']),
                accessLevel: faker.helpers.arrayElement(['VIEW', 'EDIT']),
                createdBy: creator.username,
                updatedBy: creator.username
            },
        });

        // Seed Permissions
        await prisma.documentPermission.create({
            data: {
                documentId: doc.id,
                userId: creator.id,
                permission: 'EDIT',
                createdBy: creator.username
            }
        });
    }
    console.log('Created 30 documents.');

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
