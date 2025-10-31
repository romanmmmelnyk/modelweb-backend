import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingService } from './booking.service';
import type { CreateBookingDto, UpdateBookingDto, BookingFilters } from './booking.service';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingController {
  constructor(private bookingService: BookingService) {}

  // Booking Management
  @Get()
  async getBookings(
    @Request() req,
    @Query('status') status?: string,
    @Query('date') date?: string,
    @Query('company') company?: string,
    @Query('submitter') submitter?: string,
  ) {
    const filters: BookingFilters = {};
    
    if (status) filters.status = status;
    if (date) filters.date = new Date(date);
    if (company) filters.company = company;
    if (submitter) filters.submitter = submitter;

    return this.bookingService.getBookings(req.user.id, filters);
  }

  @Get('stats')
  async getBookingStats(@Request() req) {
    return this.bookingService.getBookingStats(req.user.id);
  }

  @Get('upcoming')
  async getUpcomingBookings(
    @Request() req,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.bookingService.getUpcomingBookings(req.user.id, limitNum);
  }

  @Get('recent')
  async getRecentBookings(
    @Request() req,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.bookingService.getRecentBookings(req.user.id, limitNum);
  }

  @Get('date-range')
  async getBookingsByDateRange(
    @Request() req,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.bookingService.getBookingsByDateRange(
      req.user.id,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get(':id')
  async getBooking(@Request() req, @Param('id') id: string) {
    return this.bookingService.getBooking(req.user.id, id);
  }

  @Post()
  @HttpCode(201)
  async createBooking(@Request() req, @Body() createBookingDto: CreateBookingDto) {
    return this.bookingService.createBooking(req.user.id, createBookingDto);
  }

  @Put(':id')
  @HttpCode(200)
  async updateBooking(
    @Request() req,
    @Param('id') id: string,
    @Body() updateBookingDto: UpdateBookingDto,
  ) {
    return this.bookingService.updateBooking(req.user.id, id, updateBookingDto);
  }

  @Delete(':id')
  @HttpCode(200)
  async deleteBooking(@Request() req, @Param('id') id: string) {
    return this.bookingService.deleteBooking(req.user.id, id);
  }

  // Configuration endpoints
  @Get('config/statuses')
  async getAvailableStatuses() {
    return this.bookingService.getAvailableStatuses();
  }
}
