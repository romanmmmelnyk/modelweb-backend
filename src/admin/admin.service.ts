import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
import { BulkUpdateUsersDto, BulkActionDto, BulkAction } from './dto/bulk.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ========== USERS MANAGEMENT ==========

  async getUsers(query: GetUsersQueryDto) {
    const { page = 1, limit = 20, search, isActive, isAdmin } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { profile: { firstName: { contains: search } } },
        { profile: { lastName: { contains: search } } },
      ];
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (typeof isAdmin === 'boolean') {
      where.isAdmin = isAdmin;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          profile: true,
          billing: true,
          website: true,
          _count: {
            select: {
              bookings: true,
              media: true,
              notifications: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: {
          include: {
            socials: true,
            measurements: true,
          },
        },
        billing: true,
        website: true,
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        media: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        application: true,
        _count: {
          select: {
            bookings: true,
            media: true,
            notifications: true,
            sessions: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {};

    if (updateUserDto.email !== undefined) {
      updateData.email = updateUserDto.email;
    }

    if (updateUserDto.isActive !== undefined) {
      updateData.isActive = updateUserDto.isActive;
    }

    if (updateUserDto.isAdmin !== undefined) {
      updateData.isAdmin = updateUserDto.isAdmin;
    }

    if (updateUserDto.password) {
      updateData.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        profile: true,
      },
    });
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }

  // ========== WEBSITE REQUESTS MANAGEMENT ==========

  async getWebsiteRequests(query: GetWebsiteRequestsQueryDto) {
    const { page = 1, limit = 20, status, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { subdomain: { contains: search } },
        { fullDomain: { contains: search } },
        { user: { email: { contains: search } } },
        { user: { profile: { firstName: { contains: search } } } },
        { user: { profile: { lastName: { contains: search } } } },
      ];
    }

    const [websites, total] = await Promise.all([
      this.prisma.website.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          template: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.website.count({ where }),
    ]);

    const dataWithLinks = websites.map((w: any) => ({
      ...w,
      publicConfigUrl: w.subdomain ? `/api/public/website/${w.subdomain}` : null,
    }));

    return {
      data: dataWithLinks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getWebsiteRequestById(id: string) {
    const website = await this.prisma.website.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            profile: {
              include: {
                socials: true,
              },
            },
            billing: true,
          },
        },
        template: true,
      },
    });

    if (!website) {
      throw new NotFoundException('Website request not found');
    }

    return website;
  }

  async updateWebsiteStatus(id: string, updateDto: UpdateWebsiteStatusDto) {
    const website = await this.prisma.website.findUnique({ where: { id } });
    if (!website) {
      throw new NotFoundException('Website request not found');
    }

    const updateData: any = {
      status: updateDto.status,
    };

    if (updateDto.status === 'completed' && !website.completedAt) {
      updateData.completedAt = new Date();
    }

    if (updateDto.status === 'published' && !website.publishedAt) {
      updateData.publishedAt = new Date();
    }

    if (updateDto.notes) {
      updateData.notes = updateDto.notes;
    }

    return this.prisma.website.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        template: true,
      },
    });
  }

  // ========== BILLING MANAGEMENT ==========

  async getBillings(query: GetBillingQueryDto) {
    const { page = 1, limit = 20, status, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { stripeCustomerId: { contains: search } },
        { stripeSubscriptionId: { contains: search } },
        { user: { email: { contains: search } } },
      ];
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate);
      }
    }

    const [billings, total] = await Promise.all([
      this.prisma.billing.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          application: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.billing.count({ where }),
    ]);

    return {
      data: billings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBillingById(id: string) {
    const billing = await this.prisma.billing.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            profile: true,
            website: true,
          },
        },
        application: true,
      },
    });

    if (!billing) {
      throw new NotFoundException('Billing not found');
    }

    return billing;
  }

  async updateBillingStatus(id: string, updateDto: UpdateBillingStatusDto) {
    const billing = await this.prisma.billing.findUnique({ where: { id } });
    if (!billing) {
      throw new NotFoundException('Billing not found');
    }

    return this.prisma.billing.update({
      where: { id },
      data: {
        status: updateDto.status,
        ...(updateDto.status === 'cancelled' && !billing.cancelledAt
          ? { cancelledAt: new Date() }
          : {}),
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        application: true,
      },
    });
  }

  // ========== STATISTICS ==========

  async getStats(query: GetStatsQueryDto) {
    const { fromDate, toDate } = query;

    const dateFilter: any = {};
    if (fromDate || toDate) {
      if (fromDate) dateFilter.gte = new Date(fromDate);
      if (toDate) dateFilter.lte = new Date(toDate);
    }

    const userCountWhere = dateFilter.createdAt ? { where: { createdAt: dateFilter } } : undefined;
    const applicationCountWhere = dateFilter.createdAt ? { where: { createdAt: dateFilter } } : undefined;
    const websiteCountWhere = dateFilter.createdAt ? { where: { createdAt: dateFilter } } : undefined;
    const billingCountWhere = dateFilter.createdAt ? { where: { createdAt: dateFilter } } : undefined;

    const [
      totalUsers,
      activeUsers,
      adminUsers,
      totalApplications,
      pendingApplications,
      completedApplications,
      totalWebsites,
      pendingWebsites,
      publishedWebsites,
      totalBillings,
      activeBillings,
      totalRevenue,
      recentUsers,
      recentApplications,
    ] = await Promise.all([
      // Users
      userCountWhere ? this.prisma.user.count(userCountWhere) : this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isAdmin: true } }),

      // Applications
      applicationCountWhere ? this.prisma.application.count(applicationCountWhere) : this.prisma.application.count(),
      this.prisma.application.count({ where: { status: 'pending' } }),
      this.prisma.application.count({ where: { status: 'completed' } }),

      // Websites
      websiteCountWhere ? this.prisma.website.count(websiteCountWhere) : this.prisma.website.count(),
      this.prisma.website.count({ where: { status: 'pending' } }),
      this.prisma.website.count({ where: { status: 'published' } }),

      // Billings
      billingCountWhere ? this.prisma.billing.count(billingCountWhere) : this.prisma.billing.count(),
      this.prisma.billing.count({ where: { status: 'active' } }),

      // Revenue calculation
      this.prisma.billing.aggregate({
        _sum: {
          recurringAmount: true,
          initialAmount: true,
        },
        where: dateFilter.createdAt ? { createdAt: dateFilter } : {},
      }),

      // Recent activity
      this.prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
        },
      }),
      this.prisma.application.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      }),
    ]);

    return {
      overview: {
        users: {
          total: totalUsers,
          active: activeUsers,
          admins: adminUsers,
        },
        applications: {
          total: totalApplications,
          pending: pendingApplications,
          completed: completedApplications,
        },
        websites: {
          total: totalWebsites,
          pending: pendingWebsites,
          published: publishedWebsites,
        },
        billing: {
          total: totalBillings,
          active: activeBillings,
          revenue: {
            total: (totalRevenue._sum.initialAmount || 0) + (totalRevenue._sum.recurringAmount || 0),
            initial: totalRevenue._sum.initialAmount || 0,
            recurring: totalRevenue._sum.recurringAmount || 0,
          },
        },
      },
      recentActivity: {
        users: recentUsers,
        applications: recentApplications,
      },
    };
  }

  // ========== ACTIVITY/LOGS ==========

  async getActivity(query: { page?: number; limit?: number; userId?: string }) {
    const { page = 1, limit = 50, userId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (userId) {
      where.userId = userId;
    }

    // Combine various activity sources
    const [sessions, notifications, bookings] = await Promise.all([
      this.prisma.userSession.findMany({
        where,
        skip,
        take: Math.floor(limit / 3),
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { lastAccessed: 'desc' },
      }),
      this.prisma.notification.findMany({
        where,
        skip,
        take: Math.floor(limit / 3),
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.findMany({
        where,
        skip,
        take: Math.floor(limit / 3),
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Combine and sort by date
    const activities = [
      ...sessions.map((s) => ({ type: 'session', data: s, timestamp: s.lastAccessed })),
      ...notifications.map((n) => ({ type: 'notification', data: n, timestamp: n.createdAt })),
      ...bookings.map((b) => ({ type: 'booking', data: b, timestamp: b.createdAt })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      data: activities.slice(0, limit),
      pagination: {
        page,
        limit,
        total: activities.length,
      },
    };
  }

  async getUserActivity(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [sessions, bookings, media, notifications] = await Promise.all([
      this.prisma.userSession.findMany({
        where: { userId },
        orderBy: { lastAccessed: 'desc' },
        take: 20,
      }),
      this.prisma.booking.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.media.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      sessions,
      bookings,
      media,
      notifications,
    };
  }

  // ========== APPLICATIONS MANAGEMENT ==========

  async getApplications(query: GetApplicationsQueryDto) {
    const { page = 1, limit = 20, status, processed, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (typeof processed === 'boolean') {
      where.processed = processed;
    }

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ];
    }

    const [applications, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          billing: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      data: applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getApplicationById(id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            profile: true,
            website: true,
          },
        },
        billing: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  async updateApplicationStatus(id: string, updateDto: UpdateApplicationStatusDto) {
    const application = await this.prisma.application.findUnique({ where: { id } });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return this.prisma.application.update({
      where: { id },
      data: {
        status: updateDto.status,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        billing: true,
      },
    });
  }

  // ========== BOOKINGS MANAGEMENT ==========

  async getBookings(query: GetBookingsQueryDto) {
    const { page = 1, limit = 20, status, search, fromDate, toDate, userId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { company: { contains: search } },
        { submitter: { contains: search } },
        { location: { contains: search } },
      ];
    }

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) {
        where.date.gte = new Date(fromDate);
      }
      if (toDate) {
        where.date.lte = new Date(toDate);
      }
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBookingById(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async updateBookingStatus(id: string, updateDto: UpdateBookingStatusDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        status: updateDto.status,
        ...(updateDto.notes ? { notes: updateDto.notes } : {}),
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  async deleteBooking(id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    await this.prisma.booking.delete({ where: { id } });
    return { message: 'Booking deleted successfully' };
  }

  // ========== MEDIA/GALLERY MANAGEMENT ==========

  async getMedia(query: GetMediaQueryDto) {
    const { page = 1, limit = 20, category, isPublic, search, userId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (typeof isPublic === 'boolean') {
      where.isPublic = isPublic;
    }

    if (userId) {
      where.userId = userId;
    }

    if (search) {
      where.OR = [
        { filename: { contains: search } },
        { originalName: { contains: search } },
        { alt: { contains: search } },
        { caption: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    const [media, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.media.count({ where }),
    ]);

    return {
      data: media,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMediaById(id: string) {
    const media = await this.prisma.media.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return media;
  }

  async updateMedia(id: string, updateDto: UpdateMediaDto) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return this.prisma.media.update({
      where: { id },
      data: updateDto,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  async deleteMedia(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    await this.prisma.media.delete({ where: { id } });
    return { message: 'Media deleted successfully' };
  }

  // ========== NOTIFICATIONS MANAGEMENT ==========

  async getNotifications(query: GetNotificationsQueryDto) {
    const { page = 1, limit = 20, type, read, userId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (typeof read === 'boolean') {
      where.read = read;
    }

    if (userId) {
      where.userId = userId;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createNotification(createDto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: createDto,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  async deleteNotification(id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notification deleted successfully' };
  }

  async bulkDeleteNotifications(ids: string[]) {
    await this.prisma.notification.deleteMany({
      where: { id: { in: ids } },
    });
    return { message: `${ids.length} notifications deleted successfully` };
  }

  // ========== TEMPLATES MANAGEMENT ==========

  async getTemplates(query: GetTemplatesQueryDto) {
    const { isActive } = query;
    const where: any = {};

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    return this.prisma.websiteTemplate.findMany({
      where,
      include: {
        _count: {
          select: {
            websites: true,
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }],
    });
  }

  async getTemplateById(id: string) {
    const template = await this.prisma.websiteTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            websites: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async createTemplate(createDto: CreateTemplateDto) {
    // Backward-compatible mapping until DB migration is applied
    const { name, description, isActive, sortOrder, ...rest } = createDto as any;
    const pdfUrl: string | undefined = (rest && rest.pdfUrl) || undefined;
    return this.prisma.websiteTemplate.create({
      data: {
        name,
        description: description || null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
        // Map pdf into legacy screenshot fields for now
        desktopScreenshot: pdfUrl || 'N/A',
        tabletScreenshot: pdfUrl || 'N/A',
        mobileScreenshot: pdfUrl || 'N/A',
      } as any,
    });
  }

  async updateTemplate(id: string, updateDto: UpdateTemplateDto) {
    const template = await this.prisma.websiteTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const data: any = { ...updateDto } as any;
    if ((updateDto as any).pdfUrl) {
      const pdfUrl = (updateDto as any).pdfUrl;
      data.desktopScreenshot = pdfUrl;
      data.tabletScreenshot = pdfUrl;
      data.mobileScreenshot = pdfUrl;
      delete data.pdfUrl;
    }

    return this.prisma.websiteTemplate.update({
      where: { id },
      data,
    });
  }

  async deleteTemplate(id: string) {
    const template = await this.prisma.websiteTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Check if template is in use
    const inUse = await this.prisma.website.count({
      where: { templateId: id },
    });

    if (inUse > 0) {
      throw new BadRequestException(`Cannot delete template that is used by ${inUse} website(s)`);
    }

    await this.prisma.websiteTemplate.delete({ where: { id } });
    return { message: 'Template deleted successfully' };
  }

  async updateTemplatePdf(id: string, pdfUrl: string) {
    const template = await this.prisma.websiteTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return this.prisma.websiteTemplate.update({
      where: { id },
      data: {
        desktopScreenshot: pdfUrl,
        tabletScreenshot: pdfUrl,
        mobileScreenshot: pdfUrl,
      } as any,
    });
  }

  // ========== SESSIONS MANAGEMENT ==========

  async getSessions(query: GetSessionsQueryDto) {
    const { page = 1, limit = 50, isActive, userId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (userId) {
      where.userId = userId;
    }

    const [sessions, total] = await Promise.all([
      this.prisma.userSession.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { lastAccessed: 'desc' },
      }),
      this.prisma.userSession.count({ where }),
    ]);

    return {
      data: sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteSession(id: string) {
    const session = await this.prisma.userSession.findUnique({ where: { id } });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.userSession.delete({ where: { id } });
    return { message: 'Session deleted successfully' };
  }

  async revokeUserSessions(userId: string) {
    await this.prisma.userSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
    return { message: 'All user sessions revoked successfully' };
  }

  // ========== TENANT MANAGEMENT ==========

  async getTenants() {
    return this.prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTenantById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
        users: {
          take: 10,
          include: {
            profile: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  // ========== BULK OPERATIONS ==========

  async bulkUpdateUsers(bulkDto: BulkUpdateUsersDto) {
    const { userIds, isActive, isAdmin } = bulkDto;

    const updateData: any = {};
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }
    if (typeof isAdmin === 'boolean') {
      updateData.isAdmin = isAdmin;
    }

    const result = await this.prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: updateData,
    });

    return {
      message: `${result.count} users updated successfully`,
      count: result.count,
    };
  }

  async bulkDeleteUsers(userIds: string[]) {
    const result = await this.prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });

    return {
      message: `${result.count} users deleted successfully`,
      count: result.count,
    };
  }

  async bulkDeleteBookings(ids: string[]) {
    const result = await this.prisma.booking.deleteMany({
      where: { id: { in: ids } },
    });

    return {
      message: `${result.count} bookings deleted successfully`,
      count: result.count,
    };
  }

  async bulkDeleteMedia(ids: string[]) {
    const result = await this.prisma.media.deleteMany({
      where: { id: { in: ids } },
    });

    return {
      message: `${result.count} media files deleted successfully`,
      count: result.count,
    };
  }

  // ========== REPORTS ==========

  async getUsersReport(query: GetStatsQueryDto) {
    const { fromDate, toDate } = query;
    const dateFilter: any = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate);

    const users = await this.prisma.user.findMany({
      where: dateFilter.createdAt ? { createdAt: dateFilter } : {},
      include: {
        profile: true,
        billing: true,
        website: true,
        _count: {
          select: {
            bookings: true,
            media: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users;
  }

  async getRevenueReport(query: GetStatsQueryDto) {
    const { fromDate, toDate } = query;
    const dateFilter: any = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate);

    const billings = await this.prisma.billing.findMany({
      where: dateFilter.createdAt ? { createdAt: dateFilter } : {},
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        application: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = billings.reduce(
      (acc, billing) => {
        acc.totalInitial += billing.initialAmount || 0;
        acc.totalRecurring += billing.recurringAmount || 0;
        acc.totalSetup += billing.setupFee || 0;
        acc.customDesignFees += billing.customDesignFee || 0;
        return acc;
      },
      {
        totalInitial: 0,
        totalRecurring: 0,
        totalSetup: 0,
        customDesignFees: 0,
      },
    );

    return {
      billings,
      summary: {
        ...summary,
        total: summary.totalInitial + summary.totalRecurring + summary.totalSetup + summary.customDesignFees,
      },
    };
  }
}
