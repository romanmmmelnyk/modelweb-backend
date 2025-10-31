import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateBookingDto {
  title: string;
  description?: string;
  price?: number;
  location?: string;
  company?: string;
  submitter?: string;
  date: string | Date; // Accept both string (from frontend) and Date (after conversion)
  time?: string;
  notes?: string;
}

export interface UpdateBookingDto extends Partial<CreateBookingDto> {
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
}

export interface BookingFilters {
  status?: string;
  date?: Date;
  company?: string;
  submitter?: string;
}

@Injectable()
export class BookingService {
  constructor(private prisma: PrismaService) {}

  // Booking Management
  async getBookings(userId: string, filters?: BookingFilters) {
    const where: any = { userId };

    if (filters) {
      if (filters.status) {
        where.status = filters.status;
      }
      if (filters.date) {
        where.date = { gte: filters.date };
      }
      if (filters.company) {
        where.company = { contains: filters.company, mode: 'insensitive' };
      }
      if (filters.submitter) {
        where.submitter = { contains: filters.submitter, mode: 'insensitive' };
      }
    }

    return this.prisma.booking.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async getBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async createBooking(userId: string, data: CreateBookingDto) {
    // Convert and validate date
    const date = this.parseAndValidateDate(data.date, 'date');

    // Validate time
    if (data.time && !this.isValidTimeFormat(data.time)) {
      throw new BadRequestException('Invalid time format. Use HH:MM format');
    }

    return this.prisma.booking.create({
      data: {
        userId,
        ...data,
        date,
      },
    });
  }

  async updateBooking(userId: string, bookingId: string, data: UpdateBookingDto) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Convert and validate date if provided
    const updateData: any = { ...data };
    if (data.date) {
      updateData.date = this.parseAndValidateDate(data.date, 'date');
    }

    // Validate time if provided
    if (data.time && !this.isValidTimeFormat(data.time)) {
      throw new BadRequestException('Invalid time format. Use HH:MM format');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
    });
  }

  async deleteBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return this.prisma.booking.delete({
      where: { id: bookingId },
    });
  }

  // Booking Statistics
  async getBookingStats(userId: string) {
    const total = await this.prisma.booking.count({
      where: { userId },
    });

    const pending = await this.prisma.booking.count({
      where: { userId, status: 'pending' },
    });

    const confirmed = await this.prisma.booking.count({
      where: { userId, status: 'confirmed' },
    });

    const cancelled = await this.prisma.booking.count({
      where: { userId, status: 'cancelled' },
    });

    const completed = await this.prisma.booking.count({
      where: { userId, status: 'completed' },
    });

    const totalRevenue = await this.prisma.booking.aggregate({
      where: {
        userId,
        status: 'completed',
        price: { not: null },
      },
      _sum: {
        price: true,
      },
    });

    return {
      total,
      pending,
      confirmed,
      cancelled,
      completed,
      totalRevenue: totalRevenue._sum.price || 0,
    };
  }

  // Upcoming bookings
  async getUpcomingBookings(userId: string, limit: number = 5) {
    return this.prisma.booking.findMany({
      where: {
        userId,
        date: { gte: new Date() },
        status: { in: ['pending', 'confirmed'] },
      },
      orderBy: { date: 'asc' },
      take: limit,
    });
  }

  // Recent bookings
  async getRecentBookings(userId: string, limit: number = 5) {
    return this.prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // Booking by date range
  async getBookingsByDateRange(userId: string, startDate: Date, endDate: Date) {
    return this.prisma.booking.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });
  }

  // Helper methods
  private parseAndValidateDate(dateInput: string | Date, fieldName: string): Date {
    let date: Date;
    
    if (typeof dateInput === 'string') {
      // Handle empty or null strings
      if (!dateInput || dateInput.trim() === '') {
        throw new BadRequestException(`${fieldName} cannot be empty.`);
      }
      
      // Parse the date string
      date = new Date(dateInput);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        throw new BadRequestException(`Invalid ${fieldName} format: "${dateInput}". Please provide a valid date in YYYY-MM-DD format.`);
      }
      
      // Additional validation for reasonable date ranges
      const year = date.getFullYear();
      if (year < 1900 || year > 2100) {
        throw new BadRequestException(`${fieldName} must be between 1900 and 2100. Received year: ${year}`);
      }
    } else {
      date = dateInput;
      
      // Validate Date object as well
      if (isNaN(date.getTime())) {
        throw new BadRequestException(`Invalid ${fieldName} Date object.`);
      }
    }
    
    return date;
  }

  private isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  // Get available booking statuses
  getAvailableStatuses() {
    return [
      { value: 'pending', label: 'Pending', color: 'yellow' },
      { value: 'confirmed', label: 'Confirmed', color: 'green' },
      { value: 'cancelled', label: 'Cancelled', color: 'red' },
      { value: 'completed', label: 'Completed', color: 'blue' },
    ];
  }

  // Format booking for display
  formatBookingForDisplay(booking: any) {
    return {
      ...booking,
      formattedDate: this.formatDate(booking.date),
      formattedPrice: booking.price ? this.formatPrice(booking.price) : null,
      duration: this.calculateDuration(booking.date, booking.time),
    };
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  }

  private calculateDuration(date: Date, time?: string): string {
    if (!time) return 'All day';
    
    return `Scheduled for ${time}`;
  }
}
