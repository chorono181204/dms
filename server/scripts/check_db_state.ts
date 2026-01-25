
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Departments ---');
    const departments = await prisma.department.findMany();
    console.log(JSON.stringify(departments.map(d => ({ id: d.id, name: d.name, isSupervisory: d.isSupervisory })), null, 2));

    console.log('\n--- Checking Users ---');
    const users = await prisma.user.findMany({
        include: { department: true }
    });
    console.log(JSON.stringify(users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        deptId: u.departmentId,
        deptName: u.department?.name,
        isSupervisory: u.department?.isSupervisory
    })), null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
