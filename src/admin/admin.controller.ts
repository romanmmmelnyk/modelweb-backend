import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { AdminService } from './admin.service';
import { Admin } from './decorators/admin.decorator';
import { UpdateUserDto, GetUsersQueryDto } from './dto/users.dto';
import { UpdateWebsiteStatusDto, GetWebsiteRequestsQueryDto } from './dto/website-requests.dto';
import { GetBillingQueryDto, UpdateBillingStatusDto } from './dto/billing.dto';
import { GetStatsQueryDto } from './dto/stats.dto';
import { GetApplicationsQueryDto, UpdateApplicationStatusDto } from './dto/applications.dto';
import { GetBookingsQueryDto, UpdateBookingStatusDto } from './dto/bookings.dto';
import { GetMediaQueryDto, UpdateMediaDto } from './dto/media.dto';
import { GetNotificationsQueryDto, CreateNotificationDto } from './dto/notifications.dto';
import { CreateTemplateDto, UpdateTemplateDto, GetTemplatesQueryDto } from './dto/templates.dto';
import { GetSessionsQueryDto } from './dto/sessions.dto';
import { BulkUpdateUsersDto, BulkDeleteDto } from './dto/bulk.dto';

@Controller('admin')
@Admin()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ========== USERS MANAGEMENT ==========

  @Get('users')
  async getUsers(@Query() query: GetUsersQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Put('users/:id')
  async updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.adminService.updateUser(id, updateUserDto);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // ========== WEBSITE REQUESTS MANAGEMENT ==========

  @Get('website-requests')
  async getWebsiteRequests(@Query() query: GetWebsiteRequestsQueryDto) {
    return this.adminService.getWebsiteRequests(query);
  }

  @Get('website-requests/:id')
  async getWebsiteRequestById(@Param('id') id: string) {
    return this.adminService.getWebsiteRequestById(id);
  }

  @Put('website-requests/:id/status')
  async updateWebsiteStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateWebsiteStatusDto,
  ) {
    return this.adminService.updateWebsiteStatus(id, updateDto);
  }

  // ========== BILLING MANAGEMENT ==========

  @Get('billings')
  async getBillings(@Query() query: GetBillingQueryDto) {
    return this.adminService.getBillings(query);
  }

  @Get('billings/:id')
  async getBillingById(@Param('id') id: string) {
    return this.adminService.getBillingById(id);
  }

  @Put('billings/:id/status')
  async updateBillingStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateBillingStatusDto,
  ) {
    return this.adminService.updateBillingStatus(id, updateDto);
  }

  // ========== STATISTICS ==========

  @Get('stats')
  async getStats(@Query() query: GetStatsQueryDto) {
    return this.adminService.getStats(query);
  }

  // ========== ACTIVITY/LOGS ==========

  @Get('activity')
  async getActivity(@Query() query: { page?: number; limit?: number; userId?: string }) {
    return this.adminService.getActivity(query);
  }

  @Get('activity/user/:userId')
  async getUserActivity(@Param('userId') userId: string) {
    return this.adminService.getUserActivity(userId);
  }

  // ========== APPLICATIONS MANAGEMENT ==========

  @Get('applications')
  async getApplications(@Query() query: GetApplicationsQueryDto) {
    return this.adminService.getApplications(query);
  }

  @Get('applications/:id')
  async getApplicationById(@Param('id') id: string) {
    return this.adminService.getApplicationById(id);
  }

  @Put('applications/:id/status')
  async updateApplicationStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateApplicationStatusDto,
  ) {
    return this.adminService.updateApplicationStatus(id, updateDto);
  }

  // ========== BOOKINGS MANAGEMENT ==========

  @Get('bookings')
  async getBookings(@Query() query: GetBookingsQueryDto) {
    return this.adminService.getBookings(query);
  }

  @Get('bookings/:id')
  async getBookingById(@Param('id') id: string) {
    return this.adminService.getBookingById(id);
  }

  @Put('bookings/:id/status')
  async updateBookingStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateBookingStatusDto,
  ) {
    return this.adminService.updateBookingStatus(id, updateDto);
  }

  @Delete('bookings/:id')
  async deleteBooking(@Param('id') id: string) {
    return this.adminService.deleteBooking(id);
  }

  // ========== MEDIA/GALLERY MANAGEMENT ==========

  @Get('media')
  async getMedia(@Query() query: GetMediaQueryDto) {
    return this.adminService.getMedia(query);
  }

  @Get('media/:id')
  async getMediaById(@Param('id') id: string) {
    return this.adminService.getMediaById(id);
  }

  @Put('media/:id')
  async updateMedia(@Param('id') id: string, @Body() updateDto: UpdateMediaDto) {
    return this.adminService.updateMedia(id, updateDto);
  }

  @Delete('media/:id')
  async deleteMedia(@Param('id') id: string) {
    return this.adminService.deleteMedia(id);
  }

  // ========== NOTIFICATIONS MANAGEMENT ==========

  @Get('notifications')
  async getNotifications(@Query() query: GetNotificationsQueryDto) {
    return this.adminService.getNotifications(query);
  }

  @Post('notifications')
  async createNotification(@Body() createDto: CreateNotificationDto) {
    return this.adminService.createNotification(createDto);
  }

  @Delete('notifications/:id')
  async deleteNotification(@Param('id') id: string) {
    return this.adminService.deleteNotification(id);
  }

  @Post('notifications/bulk-delete')
  async bulkDeleteNotifications(@Body() body: BulkDeleteDto) {
    return this.adminService.bulkDeleteNotifications(body.ids);
  }

  // ========== TEMPLATES MANAGEMENT ==========

  @Get('templates')
  async getTemplates(@Query() query: GetTemplatesQueryDto) {
    return this.adminService.getTemplates(query);
  }

  @Get('templates/:id')
  async getTemplateById(@Param('id') id: string) {
    return this.adminService.getTemplateById(id);
  }

  @Post('templates')
  async createTemplate(@Body() createDto: CreateTemplateDto) {
    return this.adminService.createTemplate(createDto);
  }

  @Put('templates/:id')
  async updateTemplate(@Param('id') id: string, @Body() updateDto: UpdateTemplateDto) {
    return this.adminService.updateTemplate(id, updateDto);
  }

  @Delete('templates/:id')
  async deleteTemplate(@Param('id') id: string) {
    return this.adminService.deleteTemplate(id);
  }

  // ========== TEMPLATE PDF UPLOAD ==========

  @Post('templates/:id/pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dest = path.join(process.cwd(), 'uploads', 'templates');
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
          }
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname) || '.pdf';
          const base = path.basename(file.originalname, ext).replace(/[^a-z0-9-_]/gi, '_');
          const stamp = Date.now();
          cb(null, `${base}_${stamp}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new Error('Only PDF files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadTemplatePdf(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const relativeUrl = `/uploads/templates/${file.filename}`;
    return this.adminService.updateTemplatePdf(id, relativeUrl);
  }

  // ========== SESSIONS MANAGEMENT ==========

  @Get('sessions')
  async getSessions(@Query() query: GetSessionsQueryDto) {
    return this.adminService.getSessions(query);
  }

  @Delete('sessions/:id')
  async deleteSession(@Param('id') id: string) {
    return this.adminService.deleteSession(id);
  }

  @Post('sessions/user/:userId/revoke')
  async revokeUserSessions(@Param('userId') userId: string) {
    return this.adminService.revokeUserSessions(userId);
  }

  // ========== TENANT MANAGEMENT ==========

  @Get('tenants')
  async getTenants() {
    return this.adminService.getTenants();
  }

  @Get('tenants/:id')
  async getTenantById(@Param('id') id: string) {
    return this.adminService.getTenantById(id);
  }

  // ========== BULK OPERATIONS ==========

  @Post('users/bulk-update')
  async bulkUpdateUsers(@Body() bulkDto: BulkUpdateUsersDto) {
    return this.adminService.bulkUpdateUsers(bulkDto);
  }

  @Post('users/bulk-delete')
  async bulkDeleteUsers(@Body() body: BulkDeleteDto) {
    return this.adminService.bulkDeleteUsers(body.ids);
  }

  @Post('bookings/bulk-delete')
  async bulkDeleteBookings(@Body() body: BulkDeleteDto) {
    return this.adminService.bulkDeleteBookings(body.ids);
  }

  @Post('media/bulk-delete')
  async bulkDeleteMedia(@Body() body: BulkDeleteDto) {
    return this.adminService.bulkDeleteMedia(body.ids);
  }

  // ========== REPORTS ==========

  @Get('reports/users')
  async getUsersReport(@Query() query: GetStatsQueryDto) {
    return this.adminService.getUsersReport(query);
  }

  @Get('reports/revenue')
  async getRevenueReport(@Query() query: GetStatsQueryDto) {
    return this.adminService.getRevenueReport(query);
  }
}
