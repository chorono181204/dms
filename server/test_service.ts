import { userService } from './src/services';
import prisma from './src/client';

async function test() {
    try {
        const users = await prisma.user.findMany({ take: 1 });
        if (users.length === 0) {
            console.log('No users found in DB');
            return;
        }
        const userId = users[0].id;
        console.log('Testing with user ID:', userId);

        const user = await userService.getUserById(userId);
        console.log('User fetched successfully:', user);
    } catch (error) {
        console.error('ERROR during service call:', error);
    } finally {
        await prisma.$disconnect();
    }
}

test();
