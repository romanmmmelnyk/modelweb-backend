import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateProfileDto {
  firstName?: string;
  lastName?: string;
  bio?: string;
  dateOfBirth?: Date;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface UpdateProfileDto extends Partial<CreateProfileDto> {}

export interface CreateSocialDto {
  platform: 'instagram' | 'facebook' | 'whatsapp';
  username: string;
  url?: string;
}

export interface UpdateSocialDto {
  username?: string;
  url?: string;
  isActive?: boolean;
}

export interface CreateMeasurementDto {
  type: string;
  value: number;
  unit: string;
  notes?: string;
}

export interface UpdateMeasurementDto {
  value?: number;
  unit?: string;
  notes?: string;
}

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  // Profile Management
  async getProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        socials: true,
        measurements: {
          orderBy: { recordedAt: 'desc' }
        }
      }
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  async createProfile(userId: string, data: CreateProfileDto) {
    const existingProfile = await this.prisma.profile.findUnique({
      where: { userId }
    });

    if (existingProfile) {
      throw new BadRequestException('Profile already exists');
    }

    return this.prisma.profile.create({
      data: {
        userId,
        ...data
      },
      include: {
        socials: true,
        measurements: true
      }
    });
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId }
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return this.prisma.profile.update({
      where: { userId },
      data,
      include: {
        socials: true,
        measurements: {
          orderBy: { recordedAt: 'desc' }
        }
      }
    });
  }

  // Social Media Management
  async getSocials(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { socials: true }
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile.socials;
  }

  async addSocial(userId: string, data: CreateSocialDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId }
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Check if social already exists for this platform
    const existingSocial = await this.prisma.social.findUnique({
      where: {
        profileId_platform: {
          profileId: profile.id,
          platform: data.platform
        }
      }
    });

    if (existingSocial) {
      throw new BadRequestException(`${data.platform} social already exists`);
    }

    return this.prisma.social.create({
      data: {
        profileId: profile.id,
        ...data
      }
    });
  }

  async updateSocial(userId: string, socialId: string, data: UpdateSocialDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId }
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const social = await this.prisma.social.findFirst({
      where: {
        id: socialId,
        profileId: profile.id
      }
    });

    if (!social) {
      throw new NotFoundException('Social not found');
    }

    return this.prisma.social.update({
      where: { id: socialId },
      data
    });
  }

  async deleteSocial(userId: string, socialId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId }
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const social = await this.prisma.social.findFirst({
      where: {
        id: socialId,
        profileId: profile.id
      }
    });

    if (!social) {
      throw new NotFoundException('Social not found');
    }

    return this.prisma.social.delete({
      where: { id: socialId }
    });
  }

  // Measurements Management
  async getMeasurements(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        measurements: {
          orderBy: { recordedAt: 'desc' }
        }
      }
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile.measurements;
  }

  async getLatestMeasurements(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        measurements: {
          orderBy: { recordedAt: 'desc' }
        }
      }
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Group measurements by type and get the latest for each
    const latestMeasurements = {};
    profile.measurements.forEach(measurement => {
      if (!latestMeasurements[measurement.type] || 
          measurement.recordedAt > latestMeasurements[measurement.type].recordedAt) {
        latestMeasurements[measurement.type] = measurement;
      }
    });

    return Object.values(latestMeasurements);
  }

  async addMeasurement(userId: string, data: CreateMeasurementDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId }
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return this.prisma.measurement.create({
      data: {
        profileId: profile.id,
        ...data
      }
    });
  }

  async updateMeasurement(userId: string, measurementId: string, data: UpdateMeasurementDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId }
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const measurement = await this.prisma.measurement.findFirst({
      where: {
        id: measurementId,
        profileId: profile.id
      }
    });

    if (!measurement) {
      throw new NotFoundException('Measurement not found');
    }

    return this.prisma.measurement.update({
      where: { id: measurementId },
      data
    });
  }

  async deleteMeasurement(userId: string, measurementId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId }
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const measurement = await this.prisma.measurement.findFirst({
      where: {
        id: measurementId,
        profileId: profile.id
      }
    });

    if (!measurement) {
      throw new NotFoundException('Measurement not found');
    }

    return this.prisma.measurement.delete({
      where: { id: measurementId }
    });
  }

  // Get available measurement types
  getAvailableMeasurementTypes() {
    return [
      { type: 'bust', label: 'Bust', unit: 'cm', required: false },
      { type: 'waist', label: 'Waist', unit: 'cm', required: false },
      { type: 'hips', label: 'Hips', unit: 'cm', required: false },
      { type: 'height', label: 'Height', unit: 'cm', required: false },
      { type: 'weight', label: 'Weight', unit: 'kg', required: false },
      { type: 'shoulder_width', label: 'Shoulder Width', unit: 'cm', required: false },
      { type: 'inseam', label: 'Inseam', unit: 'cm', required: false },
      { type: 'outseam', label: 'Outseam', unit: 'cm', required: false },
      { type: 'neck_circumference', label: 'Neck Circumference', unit: 'cm', required: false },
      { type: 'arm_length', label: 'Arm Length', unit: 'cm', required: false },
      { type: 'sleeve_length', label: 'Sleeve Length', unit: 'cm', required: false },
      { type: 'wrist_circumference', label: 'Wrist Circumference', unit: 'cm', required: false },
      { type: 'thigh_circumference', label: 'Thigh Circumference', unit: 'cm', required: false },
      { type: 'calf_circumference', label: 'Calf Circumference', unit: 'cm', required: false },
      { type: 'ankle_circumference', label: 'Ankle Circumference', unit: 'cm', required: false },
      { type: 'torso_length', label: 'Torso Length', unit: 'cm', required: false },
      { type: 'rise', label: 'Rise', unit: 'cm', required: false },
      { type: 'foot_size', label: 'Foot Size', unit: 'us', required: false },
      { type: 'head_circumference', label: 'Head Circumference', unit: 'cm', required: false }
    ];
  }

  // Get available social platforms
  getAvailableSocialPlatforms() {
    return [
      { platform: 'instagram', label: 'Instagram', icon: 'instagram' },
      { platform: 'facebook', label: 'Facebook', icon: 'facebook' },
      { platform: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' }
    ];
  }
}


