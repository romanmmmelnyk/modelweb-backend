import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createDefaultTenant() {
  let tenant = await prisma.tenant.findFirst();
  
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Default Tenant',
        description: 'Default tenant for the management system',
      },
    });
    console.log('✅ Default tenant created');
  } else {
    console.log('ℹ️ Default tenant already exists');
  }
  
  return tenant;
}

async function createTestAdmin(tenantId: string) {
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@admin.com' },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin', 10);
    
    const admin = await prisma.user.create({
      data: {
        email: 'admin@admin.com',
        password: hashedPassword,
        provider: 'email',
        providerId: null,
        twoFactorEnabled: false,
        tenantId: tenantId,
        isActive: true,
        isAdmin: true,
      },
    });

    await prisma.profile.create({
      data: {
        userId: admin.id,
        firstName: 'Admin',
        lastName: 'User',
        bio: 'Test administrator account',
      },
    });

    console.log('✅ Test admin user created!');
    console.log('📧 Email: admin@admin.com');
    console.log('🔑 Password: admin');
  } else {
    console.log('ℹ️ Test admin user already exists');
  }
}

async function main() {
  try {
    console.log('🌱 Starting database seeding...');
    
    const tenant = await createDefaultTenant();
    await createTestAdmin(tenant.id);
    
    console.log('✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
