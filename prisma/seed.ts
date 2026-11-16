import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    // 1. Ensure Super Administrator Role exists
    const superAdminRole = await prisma.role.upsert({
        where: { id: 1 },
        update: {
            role_name: 'Super Administrator',
            status: 1,
        },
        create: {
            id: 1,
            role_name: 'Super Administrator',
            status: 1,
        },
    });

    // 2. Ensure Super Admin User exists
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {
            password: hashedPassword,
            user_type: superAdminRole.id,
            status: 1,
            is_verify: 1,
            mobile: '+8801711111111',
            ccode: '+880',
        },
        create: {
            email: 'admin@example.com',
            password: hashedPassword,
            user_type: superAdminRole.id,
            status: 1,
            is_verify: 1,
            mobile: '+8801711111111',
            ccode: '+880',
            userInfo: {
                create: {
                    first_name: 'Super',
                    last_name: 'Admin',
                    occupation: 'Administrator',
                    pre_city: 'Dhaka',
                    pre_country: 1,
                    same_as_present_address: 1,
                },
            },
        },
    });

    console.log('Seed completed successfully!');
    console.log(`Admin User ID: ${adminUser.id}, Email: ${adminUser.email}`);
}

main()
    .catch((e) => {
        console.error('Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
