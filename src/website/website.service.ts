import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateWebsiteDto {
  subdomain: string;
  accentColor: string;
  enableBooking: boolean;
  showGallery: boolean;
  showMeasurements?: boolean;
  reflectUserInfo: boolean;
  customName?: string;
  customAbout?: string;
  customPhone?: string;
  customEmail?: string;
  templateId?: string;
  selectedPictures?: string[]; // Array of image IDs
}

@Injectable()
export class WebsiteService {
  // Reserved subdomains that cannot be used
  private readonly RESERVED_SUBDOMAINS = [
    'admin', 'administrator', 'root', 'system', 'api', 'www', 'mail',
    'ftp', 'smtp', 'webmail', 'email', 'support', 'help', 'blog',
    'news', 'forum', 'shop', 'store', 'dev', 'test', 'staging',
    'demo', 'beta', 'alpha', 'app', 'web', 'mobile', 'secure',
    'login', 'signup', 'register', 'auth', 'account', 'dashboard',
    'portal', 'panel', 'cpanel', 'hosting', 'server', 'cloud',
    'assets', 'static', 'cdn', 'media', 'files', 'uploads',
    'about', 'contact', 'privacy', 'terms', 'legal', 'docs',
  ];

  // Prohibited words/terms
  private readonly PROHIBITED_WORDS = [
    'fuck', 'shit', 'bitch', 'damn', 'hell', 'ass', 'bastard',
    'crap', 'piss', 'dick', 'cock', 'pussy', 'cunt', 'whore',
    'slut', 'fag', 'nigger', 'nigga', 'retard', 'rape',
    'fck', 'fuk', 'fuq', 'fuc', 'sh1t', 'sht',
    'b1tch', 'btch', 'a55', 'azz', 'd1ck', 'dck', 'dik',
    'c0ck', 'cok', 'pu55y', 'psy', 'cnt', 'wh0re', 'slutt',
    'nazi', 'hitler', 'isis', 'terror', 'kill', 'murder', 'death',
    'porn', 'sex', 'nude', 'xxx', 'adult', 'escort',
    'drug', 'cocaine', 'heroin', 'meth', 'weed', 'cannabis',
  ];

  constructor(private prisma: PrismaService) {}

  /**
   * Get user's website configuration
   */
  async getWebsite(userId: string) {
    const website = await this.prisma.website.findUnique({
      where: { userId },
    });

    if (!website) {
      return null;
    }

    return website;
  }

  /**
   * Create or update website configuration
   */
  async createOrUpdateWebsite(userId: string, dto: CreateWebsiteDto) {
    // Normalize and validate subdomain
    const normalizedSub = (dto.subdomain || '').trim().toLowerCase();
    const subdomainRegex = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
    if (!normalizedSub || !subdomainRegex.test(normalizedSub)) {
      throw new BadRequestException(
        'Subdomain must contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen',
      );
    }

    // Check if subdomain is reserved
    if (this.RESERVED_SUBDOMAINS.includes(normalizedSub)) {
      throw new BadRequestException('This subdomain is reserved and cannot be used');
    }

    // Check for prohibited words
    const lowerSubdomain = normalizedSub;
    const containsProhibited = this.PROHIBITED_WORDS.some((word) =>
      lowerSubdomain.includes(word),
    );

    if (containsProhibited) {
      throw new BadRequestException('This subdomain contains inappropriate content');
    }

    // Check if subdomain is already taken (by another user)
    const existingWebsite = await this.prisma.website.findUnique({
      where: { subdomain: normalizedSub },
    });

    if (existingWebsite && existingWebsite.userId !== userId) {
      throw new BadRequestException('This subdomain is already taken');
    }

    const fullDomain = `${normalizedSub}.modelsweb.co`;

    // Check if user already has a website
    const userWebsite = await this.prisma.website.findUnique({
      where: { userId },
    });

    // Normalize selectedPictures (accept up to 5, ignore extras)
    const normalizedSelectedPictures = Array.isArray(dto.selectedPictures)
      ? Array.from(new Set(dto.selectedPictures.map((p) => String(p).trim()).filter(Boolean))).slice(0, 5)
      : [];

    // Validate templateId if provided
    if (dto.templateId) {
      const template = await this.prisma.websiteTemplate.findUnique({
        where: { id: dto.templateId },
      });

      if (!template) {
        throw new BadRequestException('Selected template does not exist');
      }

      if (!template.isActive) {
        throw new BadRequestException('Selected template is not available');
      }
    }

    const updateData: any = {
      subdomain: normalizedSub,
      fullDomain,
      accentColor: dto.accentColor,
      enableBooking: dto.enableBooking,
      showGallery: dto.showGallery,
      showMeasurements: !!dto.showMeasurements,
      reflectUserInfo: dto.reflectUserInfo,
      customName: dto.customName,
      customAbout: dto.customAbout,
      customPhone: dto.customPhone,
      customEmail: dto.customEmail,
      templateId: dto.templateId || null,
      selectedPictures: normalizedSelectedPictures.length ? JSON.stringify(normalizedSelectedPictures) : null,
    };

    // If the website is being configured (not submitted yet), mark status as 'configured'
    // Preserve existing status if already submitted or in progress
    const existing = await this.prisma.website.findUnique({ where: { userId } });
    if (!existing || (existing.status !== 'pending' && existing.status !== 'in_progress' && existing.status !== 'completed' && existing.status !== 'published')) {
      updateData.status = 'configured';
    }

    if (userWebsite) {
      // Update existing website
      return this.prisma.website.update({
        where: { userId },
        data: updateData,
      });
    }

    // Create new website
    return this.prisma.website.create({
      data: {
        userId,
        ...updateData,
      },
    });
  }

  /**
   * Submit website request for development
   * Generates JSON configuration
   */
  async submitWebsiteRequest(userId: string) {
    // Fetch minimal data to validate current state
    const website = await this.prisma.website.findUnique({
      where: { userId },
      include: {
        template: true,
      },
    });

    if (!website) {
      throw new NotFoundException('Website configuration not found');
    }

    if (website.status === 'pending' || website.status === 'in_progress') {
      throw new BadRequestException('Website request already submitted');
    }

    // Ensure a template is selected
    if (!website.templateId) {
      throw new BadRequestException('Please select a template before submitting');
    }

    // Ensure the selected template is still active
    if (!website.template || !website.template.isActive) {
      throw new BadRequestException('Selected template is no longer available. Please choose another template');
    }

    // Simply flip flags and status; configuration and pictures were already saved in step 1
    const updatedWebsite = await this.prisma.website.update({
      where: { userId },
      data: {
        status: 'pending',
        templateSubmitted: true,
        templateSubmittedAt: new Date(),
        requestedAt: new Date(),
      },
    });

    return updatedWebsite;
  }

  /**
   * Withdraw a previously submitted website request.
   * Resets status to 'configured' and clears submission flags. Keeps configJson intact.
   */
  async withdrawWebsiteRequest(userId: string) {
    const website = await this.prisma.website.findUnique({ where: { userId } });
    if (!website) {
      throw new NotFoundException('Website configuration not found');
    }

    if (website.status !== 'pending' && website.status !== 'in_progress') {
      throw new BadRequestException('No active submission to withdraw');
    }

    return this.prisma.website.update({
      where: { userId },
      data: {
        status: 'configured',
        templateSubmitted: false,
        templateSubmittedAt: null,
      },
    });
  }

  /**
   * Build and return a public JSON view of a submitted website by subdomain.
   */
  async getPublicWebsiteConfig(subdomain: string) {
    const website = await this.prisma.website.findUnique({
      where: { subdomain },
      include: {
        user: {
          include: {
            profile: {
              include: {
                measurements: true,
                socials: true,
              },
            },
            media: {
              where: {
                NOT: { mimeType: 'text/plain' },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        template: true,
      },
    });

    if (!website || !website.templateSubmitted) {
      throw new NotFoundException('Submitted website not found');
    }

    const useProfileData = website.reflectUserInfo;
    const name = useProfileData
      ? `${website.user.profile?.firstName || ''} ${website.user.profile?.lastName || ''}`.trim()
      : website.customName || '';
    const about = useProfileData ? website.user.profile?.bio || '' : website.customAbout || '';
    const phone = useProfileData ? website.user.profile?.phone || '' : website.customPhone || '';
    const email = useProfileData ? website.user.email : website.customEmail || website.user.email;

    const measurements = useProfileData && website.showMeasurements && website.user.profile?.measurements?.length
      ? website.user.profile.measurements.map((m) => ({ type: m.type, value: m.value, unit: m.unit }))
      : [];
    const socials = useProfileData && website.user.profile?.socials?.length
      ? website.user.profile.socials.map((s) => ({ platform: s.platform, url: s.url }))
      : [];

    const selectedPictureIds = website.selectedPictures ? JSON.parse(website.selectedPictures) : [];
    const selectedPictures = selectedPictureIds.length
      ? await this.prisma.media.findMany({ where: { id: { in: selectedPictureIds }, userId: website.userId } })
      : [];

    const galleryPictures = website.showGallery
      ? website.user.media.map((m) => ({
          id: m.id,
          filename: m.filename,
          originalName: m.originalName,
          url: m.url,
          path: m.path,
          width: m.width,
          height: m.height,
          alt: m.alt,
          caption: m.caption,
          tags: m.tags,
          mimeType: m.mimeType,
        }))
      : [];

    return {
      meta: {
        subdomain: website.subdomain,
        fullDomain: website.fullDomain,
        status: website.status,
        templateSubmitted: website.templateSubmitted,
        templateSubmittedAt: website.templateSubmittedAt,
        requestedAt: website.requestedAt,
      },
      template: website.template
        ? { id: website.template.id, name: website.template.name, description: website.template.description }
        : null,
      features: { enableBooking: website.enableBooking, showGallery: website.showGallery },
      content: {
        name,
        about,
        contacts: { phone, email },
        measurements,
        socials,
      },
      selectedPictures: selectedPictures.map((p) => ({
        id: p.id,
        filename: p.filename,
        originalName: p.originalName,
        url: p.url,
        path: p.path,
        width: p.width,
        height: p.height,
        alt: p.alt,
        caption: p.caption,
        mimeType: p.mimeType,
      })),
      gallery: galleryPictures,
    };
  }

  /**
   * Check if subdomain is available
   */
  async checkSubdomainAvailability(subdomain: string, userId?: string) {
    // Check if subdomain is reserved
    if (this.RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) {
      return { available: false, reason: 'reserved' };
    }

    // Check for prohibited words
    const lowerSubdomain = subdomain.toLowerCase();
    const containsProhibited = this.PROHIBITED_WORDS.some((word) =>
      lowerSubdomain.includes(word),
    );

    if (containsProhibited) {
      return { available: false, reason: 'prohibited' };
    }

    const website = await this.prisma.website.findUnique({
      where: { subdomain },
    });

    if (!website) {
      return { available: true };
    }

    // If the subdomain belongs to the current user, it's available for them
    if (userId && website.userId === userId) {
      return { available: true, ownedByUser: true };
    }

    return { available: false, reason: 'taken' };
  }

  /**
   * Delete website configuration
   */
  async deleteWebsite(userId: string) {
    const website = await this.prisma.website.findUnique({
      where: { userId },
    });

    if (!website) {
      throw new NotFoundException('Website configuration not found');
    }

    return this.prisma.website.delete({
      where: { userId },
    });
  }

  /**
   * Get all active templates
   */
  async getTemplates() {
    return this.prisma.websiteTemplate.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });
  }

  /**
   * Get user's gallery images
   */
  async getUserGalleryImages(userId: string) {
    return this.prisma.media.findMany({
      where: {
        userId,
        // Exclude category placeholders
        NOT: {
          mimeType: 'text/plain',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        filename: true,
        originalName: true,
        url: true,
        path: true,
        width: true,
        height: true,
        alt: true,
        caption: true,
        tags: true,
      },
    });
  }
}

