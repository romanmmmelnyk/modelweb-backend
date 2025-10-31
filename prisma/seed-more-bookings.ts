import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Adding more test bookings...')

  // Find the admin user
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@admin.com' }
  })

  if (!adminUser) {
    console.log('❌ Admin user not found. Please run the main seed first.')
    return
  }

  console.log('👤 Found admin user:', adminUser.email)

  // Create additional test bookings
  const additionalBookings = [
    {
      title: 'Portrait Session - Corporate Headshots',
      description: 'Professional headshots for company website and LinkedIn profiles',
      price: 400.00,
      location: 'Corporate Office Building',
      company: 'TechStart Inc.',
      submitter: 'HR Manager Amanda',
      date: new Date('2025-01-18T11:00:00Z'),
      time: '11:00',
      status: 'confirmed' as const,
      notes: 'Need 20 employees photographed. Setup includes backdrop and lighting.',
      userId: adminUser.id
    },
    {
      title: 'Real Estate Photography - Luxury Home',
      description: 'High-end real estate photography for luxury property listing',
      price: 750.00,
      location: '123 Luxury Lane, Beverly Hills',
      company: 'Elite Realty Group',
      submitter: 'Agent Robert Smith',
      date: new Date('2025-01-22T09:00:00Z'),
      time: '09:00',
      status: 'pending' as const,
      notes: '5-bedroom mansion. Drone shots required for aerial views.',
      userId: adminUser.id
    },
    {
      title: 'Food Photography - Restaurant Menu',
      description: 'Menu photography for new restaurant opening',
      price: 600.00,
      location: 'Bella Vista Restaurant',
      company: 'Culinary Creations LLC',
      submitter: 'Chef Maria Rodriguez',
      date: new Date('2025-01-28T10:00:00Z'),
      time: '10:00',
      status: 'confirmed' as const,
      notes: '25 dishes to photograph. Food styling included. Need high-resolution images.',
      userId: adminUser.id
    },
    {
      title: 'Event Photography - Birthday Party',
      description: 'Children\'s birthday party photography',
      price: 250.00,
      location: 'Community Center Hall',
      company: 'Party Planning Plus',
      submitter: 'Event Coordinator Lisa',
      date: new Date('2025-02-01T14:00:00Z'),
      time: '14:00',
      status: 'pending' as const,
      notes: '20 kids party. Need candid shots and group photos.',
      userId: adminUser.id
    },
    {
      title: 'Fashion Photography - Lookbook Shoot',
      description: 'Fashion lookbook for spring collection',
      price: 1500.00,
      location: 'Urban Studio Complex',
      company: 'Style Forward Fashion',
      submitter: 'Creative Director Alex',
      date: new Date('2025-02-05T08:00:00Z'),
      time: '08:00',
      status: 'confirmed' as const,
      notes: 'Full day shoot. 3 models, 15 outfits. Hair, makeup, and styling provided.',
      userId: adminUser.id
    }
  ]

  console.log('📅 Creating additional test bookings...')

  for (const bookingData of additionalBookings) {
    const booking = await prisma.booking.create({
      data: bookingData
    })
    console.log(`✅ Created booking: ${booking.title} (${booking.status})`)
  }

  console.log('🎉 Additional bookings created successfully!')
  console.log(`📊 Added ${additionalBookings.length} more bookings`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


