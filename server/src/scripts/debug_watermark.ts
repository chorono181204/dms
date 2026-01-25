import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // First, find all departments
    const departments = await prisma.department.findMany();
    console.log('All departments:');
    departments.forEach(d => console.log(`  ${d.id}: ${d.name}`));
    console.log('\n');

    // Find HHTM department
    const hhtmDept = departments.find(d =>
        d.name.toLowerCase().includes('huyết') ||
        d.name.toLowerCase().includes('hhtm')
    );

    if (hhtmDept) {
        console.log('HHTM Department found:', hhtmDept.name, '(ID:', hhtmDept.id, ')');

        // Test the matching logic
        const deptLower = hhtmDept.name.toLowerCase();
        console.log('Lowercase name:', deptLower);
        console.log('Includes "hóa sinh":', deptLower.includes('hóa sinh'));
        console.log('Includes "vi sinh":', deptLower.includes('vi sinh'));
        console.log('Includes "huyết học":', deptLower.includes('huyết học'));

        // Find documents in this department
        const docs = await prisma.document.findMany({
            where: { departmentId: hhtmDept.id },
            include: { department: true },
            take: 5
        });

        console.log(`\nDocuments in ${hhtmDept.name}:`);
        docs.forEach(doc => {
            console.log(`  - ${doc.title} (ID: ${doc.id}, Visibility: ${doc.visibility})`);
        });
    } else {
        console.log('HHTM department not found');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
