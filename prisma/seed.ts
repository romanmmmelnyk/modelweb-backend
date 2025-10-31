import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting comprehensive seed...')

  // Create default tenant
  const defaultTenant = await prisma.tenant.upsert({
    where: { id: 'default-tenant' },
    update: {},
    create: {
      id: 'default-tenant',
      name: 'Default Tenant',
      description: 'Default tenant for the management system'
    }
  })

  console.log('🏢 Created/Found tenant:', defaultTenant.name)

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin', 10)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@admin.com' },
    update: {},
    create: {
      email: 'admin@admin.com',
      password: hashedPassword,
      provider: 'email',
      tenantId: defaultTenant.id,
      isActive: true
    }
  })

  console.log('👤 Created/Found admin user:', adminUser.email)

  // Create admin profile
  const adminProfile = await prisma.profile.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      firstName: 'Admin',
      lastName: 'User',
      bio: 'System administrator for the management system. I manage the booking and profile system for our organization.'
    }
  })

  console.log('👤 Created/Found admin profile:', adminProfile.firstName, adminProfile.lastName)

  // Create staff user
  const hashedStaffPassword = await bcrypt.hash('staff', 10)
  const staffUser = await prisma.user.upsert({
    where: { email: 'staff@staff.com' },
    update: {},
    create: {
      email: 'staff@staff.com',
      password: hashedStaffPassword,
      provider: 'email',
      tenantId: defaultTenant.id,
      isActive: true,
      isAdmin: false
    }
  })

  console.log('👤 Created/Found staff user:', staffUser.email)

  // Create staff profile
  const staffProfile = await prisma.profile.upsert({
    where: { userId: staffUser.id },
    update: {},
    create: {
      userId: staffUser.id,
      firstName: 'Staff',
      lastName: 'Member',
      bio: 'Staff member for the management system.'
    }
  })

  console.log('👤 Created/Found staff profile:', staffProfile.firstName, staffProfile.lastName)

  // Create test bookings
  const testBookings = [
    {
      title: 'Photography Session - Fashion Shoot',
      description: 'Professional fashion photography session for portfolio',
      price: 500.00,
      location: 'Studio Downtown',
      company: 'Fashion Forward Agency',
      submitter: 'Sarah Johnson',
      date: new Date('2025-01-15T10:00:00Z'),
      time: '10:00',
      status: 'confirmed' as const,
      notes: 'Bring 3 outfit changes. Hair and makeup included.',
      userId: adminUser.id
    },
    {
      title: 'Commercial Video Production',
      description: 'Corporate video shoot for product launch campaign',
      price: 1200.00,
      location: 'Tech Campus Building A',
      company: 'InnovateTech Solutions',
      submitter: 'Mike Chen',
      date: new Date('2025-01-20T09:00:00Z'),
      time: '09:00',
      status: 'pending' as const,
      notes: 'Full day shoot. Lunch provided. Need to bring portfolio samples.',
      userId: adminUser.id
    },
    {
      title: 'Wedding Photography - Sarah & John',
      description: 'Full wedding day photography coverage',
      price: 2500.00,
      location: 'Garden Venue Resort',
      company: 'Elegant Events',
      submitter: 'Wedding Planner Lisa',
      date: new Date('2025-02-14T08:00:00Z'),
      time: '08:00',
      status: 'confirmed' as const,
      notes: '12-hour coverage. Engagement session included. Deliverables: 500+ edited photos.',
      userId: adminUser.id
    },
    {
      title: 'Product Photography - E-commerce',
      description: 'Product shots for online store catalog',
      price: 300.00,
      location: 'Home Studio',
      company: 'ShopSmart Online',
      submitter: 'David Wilson',
      date: new Date('2025-01-25T14:00:00Z'),
      time: '14:00',
      status: 'completed' as const,
      notes: '50 products to photograph. White background setup required.',
      userId: adminUser.id
    },
    {
      title: 'Event Photography - Charity Gala',
      description: 'Documentary photography for annual charity event',
      price: 800.00,
      location: 'Grand Ballroom Hotel',
      company: 'Hope Foundation',
      submitter: 'Jennifer Martinez',
      date: new Date('2025-01-30T18:00:00Z'),
      time: '18:00',
      status: 'cancelled' as const,
      notes: 'Event cancelled due to weather. Rescheduling for March.',
      userId: adminUser.id
    }
  ]

  console.log('📅 Creating test bookings...')

  for (const bookingData of testBookings) {
    const booking = await prisma.booking.upsert({
      where: { 
        id: `${bookingData.title.toLowerCase().replace(/\s+/g, '-')}-${bookingData.userId}`
      },
      update: {},
      create: {
        ...bookingData,
        id: `${bookingData.title.toLowerCase().replace(/\s+/g, '-')}-${bookingData.userId}`
      }
    })
    console.log(`✅ Created/Upserted booking: ${booking.title} (${booking.status})`)
  }

  // Create sample social media links
  const socialLinks = [
    {
      platform: 'INSTAGRAM',
      username: '@admin_photography',
      url: 'https://instagram.com/admin_photography',
      profileId: adminProfile.id
    },
    {
      platform: 'FACEBOOK',
      username: 'Admin Photography Studio',
      url: 'https://facebook.com/adminphotography',
      profileId: adminProfile.id
    },
    {
      platform: 'WHATSAPP',
      username: '+1-555-0123',
      url: 'https://wa.me/15550123',
      profileId: adminProfile.id
    }
  ]

  console.log('📱 Creating social media links...')

  for (const socialData of socialLinks) {
    const social = await prisma.social.upsert({
      where: {
        profileId_platform: {
          profileId: socialData.profileId,
          platform: socialData.platform
        }
      },
      update: {},
      create: socialData
    })
    console.log(`✅ Created/Upserted social: ${social.platform} - ${social.username}`)
  }

  // Create sample measurements
  const measurements = [
    {
      type: 'HEIGHT',
      value: 175.5,
      unit: 'CM',
      notes: 'Current height measurement',
      profileId: adminProfile.id
    },
    {
      type: 'WEIGHT',
      value: 70.0,
      unit: 'KG',
      notes: 'Current weight',
      profileId: adminProfile.id
    },
    {
      type: 'BUST',
      value: 86.0,
      unit: 'CM',
      notes: 'Bust measurement',
      profileId: adminProfile.id
    },
    {
      type: 'WAIST',
      value: 72.0,
      unit: 'CM',
      notes: 'Waist measurement',
      profileId: adminProfile.id
    },
    {
      type: 'HIPS',
      value: 92.0,
      unit: 'CM',
      notes: 'Hip measurement',
      profileId: adminProfile.id
    }
  ]

  console.log('📏 Creating sample measurements...')

  for (const measurementData of measurements) {
    const measurement = await prisma.measurement.create({
      data: measurementData
    })
    console.log(`✅ Created measurement: ${measurement.type} - ${measurement.value} ${measurement.unit}`)
  }

  console.log('🎉 Comprehensive seed completed successfully!')
  console.log(`📊 Summary:`)
  console.log(`   - 1 Tenant: ${defaultTenant.name}`)
  console.log(`   - 2 Users: ${adminUser.email}, ${staffUser.email}`)
  console.log(`   - 2 Profiles: ${adminProfile.firstName} ${adminProfile.lastName}, ${staffProfile.firstName} ${staffProfile.lastName}`)
  console.log(`   - ${testBookings.length} Bookings`)
  console.log(`   - ${socialLinks.length} Social Links`)
  console.log(`   - ${measurements.length} Measurements`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })