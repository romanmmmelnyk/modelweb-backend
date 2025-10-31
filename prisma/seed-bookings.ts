import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Find the admin user
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@admin.com' }
  })

  if (!adminUser) {
    console.log('❌ Admin user not found. Please run the auth seed first.')
    return
  }

  console.log('👤 Found admin user:', adminUser.email)

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
    const booking = await prisma.booking.create({
      data: bookingData
    })
    console.log(`✅ Created booking: ${booking.title} (${booking.status})`)
  }

  console.log('🎉 Seed completed successfully!')
  console.log(`📊 Created ${testBookings.length} test bookings for user: ${adminUser.email}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


