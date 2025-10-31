import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import sharp from 'sharp';
import * as fs from 'fs/promises';
import { existsSync, unlinkSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import * as path from 'path';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import sizeOf from 'image-size';

export interface CreateMediaDto {
  alt?: string;
  caption?: string;
  tags?: string;
  category?: string;
  isPublic?: boolean;
  latitude?: number;
  longitude?: number;
  locationName?: string;
}

export interface UpdateMediaDto extends Partial<CreateMediaDto> {}

export interface MediaFilters {
  category?: string;
  tags?: string;
  isPublic?: boolean;
  search?: string;
}

@Injectable()
export class GalleryService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'gallery');
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];

  constructor(private prisma: PrismaService) {}

  // Gallery Management
  async getMedia(userId: string, filters?: MediaFilters) {
    const where: any = { 
      userId,
      // Filter out placeholder entries (category placeholders)
      NOT: {
        mimeType: 'text/plain',
        size: 0
      }
    };

    if (filters) {
      if (filters.category) {
        where.category = filters.category;
      }
      if (filters.tags) {
        where.tags = { contains: filters.tags };
      }
      if (filters.isPublic !== undefined) {
        where.isPublic = filters.isPublic;
      }
      if (filters.search) {
        where.OR = [
          { originalName: { contains: filters.search } },
          { alt: { contains: filters.search } },
          { caption: { contains: filters.search } },
          { tags: { contains: filters.search } }
        ];
      }
    }

    return this.prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMediaById(userId: string, mediaId: string) {
    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        userId,
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return media;
  }

  async uploadMedia(userId: string, file: Express.Multer.File, data: CreateMediaDto) {
    // Validate file
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only images are allowed.');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException('File too large. Maximum size is 10MB.');
    }

    try {
      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const filename = `${uuidv4()}${fileExtension}`;
      const filePath = path.join(this.uploadDir, filename);

      // Ensure upload directory exists
      await fs.mkdir(this.uploadDir, { recursive: true });

      // Get image metadata using Sharp
      const imageMetadata = await sharp(file.buffer).metadata();
      const { width, height } = imageMetadata;

      // Save original file
      await fs.writeFile(filePath, file.buffer);

      // Generate public URL
      const publicUrl = `/uploads/gallery/${filename}`;

      // Convert string values to proper types
      const isPublic = typeof data.isPublic === 'string' 
        ? data.isPublic === 'true' 
        : data.isPublic !== undefined ? data.isPublic : true;

      const latitude = data.latitude !== undefined
        ? typeof data.latitude === 'string' ? parseFloat(data.latitude) : data.latitude
        : null;

      const longitude = data.longitude !== undefined
        ? typeof data.longitude === 'string' ? parseFloat(data.longitude) : data.longitude
        : null;

      // Create media record
      const media = await this.prisma.media.create({
        data: {
          filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          width: width || null,
          height: height || null,
          path: filePath,
          url: publicUrl,
          alt: data.alt || '',
          caption: data.caption || '',
          tags: data.tags || '',
          category: data.category || 'general',
          isPublic,
          latitude,
          longitude,
          locationName: data.locationName || null,
          userId,
        },
      });

      return media;
    } catch (error) {
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }
  }

  async updateMedia(userId: string, mediaId: string, data: UpdateMediaDto) {
    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        userId,
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    // Convert string values to proper types
    const updateData: any = { ...data };
    if (data.isPublic !== undefined) {
      updateData.isPublic = typeof data.isPublic === 'string' 
        ? data.isPublic === 'true' 
        : data.isPublic;
    }

    return this.prisma.media.update({
      where: { id: mediaId },
      data: updateData,
    });
  }

  async updateMediaWithCrop(userId: string, mediaId: string, file: Express.Multer.File, data: UpdateMediaDto) {
    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        userId,
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    // Delete old file
    const oldFilePath = join(process.cwd(), 'uploads', 'gallery', media.filename);
    if (existsSync(oldFilePath)) {
      unlinkSync(oldFilePath);
    }

    // Save new cropped file
    const uploadDir = join(process.cwd(), 'uploads', 'gallery');
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueFilename = `${Date.now()}-${file.originalname}`;
    const filePath = join(uploadDir, uniqueFilename);
    
    writeFileSync(filePath, file.buffer);

    // Get image dimensions
    const imageBuffer = readFileSync(filePath);
    const dimensions = sizeOf(imageBuffer);

    // Convert string values to proper types
    const updateData: any = { 
      ...data,
      filename: uniqueFilename,
      size: file.size,
      width: dimensions.width,
      height: dimensions.height,
      path: `/uploads/gallery/${uniqueFilename}`,
      url: `/uploads/gallery/${uniqueFilename}`,
      mimeType: file.mimetype,
    };
    
    if (data.isPublic !== undefined) {
      updateData.isPublic = typeof data.isPublic === 'string' 
        ? data.isPublic === 'true' 
        : data.isPublic;
    }

    if (data.latitude !== undefined) {
      updateData.latitude = typeof data.latitude === 'string' 
        ? parseFloat(data.latitude) 
        : data.latitude;
    }

    if (data.longitude !== undefined) {
      updateData.longitude = typeof data.longitude === 'string' 
        ? parseFloat(data.longitude) 
        : data.longitude;
    }

    if (data.locationName !== undefined) {
      updateData.locationName = data.locationName;
    }

    return this.prisma.media.update({
      where: { id: mediaId },
      data: updateData,
    });
  }

  async deleteMedia(userId: string, mediaId: string) {
    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        userId,
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    try {
      // Delete file from filesystem
      await fs.unlink(media.path);
    } catch (error) {
      console.warn(`Failed to delete file ${media.path}:`, error.message);
    }

    // Delete from database
    return this.prisma.media.delete({
      where: { id: mediaId },
    });
  }

  // Gallery Statistics
  async getGalleryStats(userId: string) {
    const whereClause = { 
      userId,
      // Filter out placeholder entries (category placeholders)
      mimeType: {
        not: 'text/plain'
      },
      size: {
        gt: 0
      }
    };

    const total = await this.prisma.media.count({
      where: whereClause,
    });

    const byCategory = await this.prisma.media.groupBy({
      by: ['category'],
      where: whereClause,
      _count: { category: true },
    });

    const totalSize = await this.prisma.media.aggregate({
      where: whereClause,
      _sum: { size: true },
    });

    const recentUploads = await this.prisma.media.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      total,
      byCategory: byCategory.map(item => ({
        category: item.category || 'uncategorized',
        count: item._count.category,
      })),
      totalSize: totalSize._sum.size || 0,
      recentUploads,
    };
  }

  // Get available categories
  async getAvailableCategories(userId: string) {
    const categories = await this.prisma.media.findMany({
      where: { userId },
      select: { category: true },
      distinct: ['category'],
    });

    return categories.map(item => item.category).filter(Boolean);
  }

  // Get all tags
  async getAllTags(userId: string) {
    const media = await this.prisma.media.findMany({
      where: { userId },
      select: { tags: true },
    });

    const allTags = media
      .map(item => item.tags)
      .filter(Boolean)
      .join(',')
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);

    return [...new Set(allTags)]; // Remove duplicates
  }

  // Helper methods
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDimensions(width: number | null, height: number | null): string {
    if (!width || !height) return 'Unknown';
    return `${width} × ${height}`;
  }

  getFileExtension(filename: string): string {
    return path.extname(filename).toLowerCase();
  }

  isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  // Get media by category
  async getMediaByCategory(userId: string, category: string) {
    return this.prisma.media.findMany({
      where: {
        userId,
        category,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get media by tags
  async getMediaByTags(userId: string, tags: string[]) {
    return this.prisma.media.findMany({
      where: {
        userId,
        tags: {
          contains: tags.join(','),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Bulk operations
  async bulkUpdateMedia(userId: string, mediaIds: string[], data: UpdateMediaDto) {
    return this.prisma.media.updateMany({
      where: {
        id: { in: mediaIds },
        userId,
      },
      data,
    });
  }

  async bulkDeleteMedia(userId: string, mediaIds: string[]) {
    const media = await this.prisma.media.findMany({
      where: {
        id: { in: mediaIds },
        userId,
      },
    });

    // Delete files from filesystem
    for (const item of media) {
      try {
        await fs.unlink(item.path);
      } catch (error) {
        console.warn(`Failed to delete file ${item.path}:`, error.message);
      }
    }

    // Delete from database
    return this.prisma.media.deleteMany({
      where: {
        id: { in: mediaIds },
        userId,
      },
    });
  }

  // Category Management
  async getCategories(userId: string) {
    const categories = await this.prisma.media.findMany({
      where: { userId },
      select: { category: true },
      distinct: ['category'],
    });

    return categories
      .map(c => c.category)
      .filter(c => c && c.trim() !== '')
      .sort();
  }

  async createCategory(userId: string, categoryName: string) {
    // Check if category already exists
    const existingCategory = await this.prisma.media.findFirst({
      where: {
        userId,
        category: categoryName,
      },
    });

    if (existingCategory) {
      return { message: 'Category already exists', category: categoryName };
    }

    // Create a minimal placeholder media entry to establish the category
    // We'll keep this entry but mark it as a category placeholder
    const placeholderMedia = await this.prisma.media.create({
      data: {
        filename: `category-${categoryName}-${Date.now()}`,
        originalName: `Category: ${categoryName}`,
        mimeType: 'text/plain',
        size: 0,
        width: 0,
        height: 0,
        path: `/categories/${categoryName}`,
        url: `/categories/${categoryName}`,
        alt: `Category placeholder: ${categoryName}`,
        caption: `This is a placeholder for the "${categoryName}" category`,
        category: categoryName,
        isPublic: false,
        userId,
      },
    });

    return { 
      message: 'Category created successfully', 
      category: categoryName,
      placeholderId: placeholderMedia.id 
    };
  }

  async getCategoryStats(userId: string) {
    // First get all non-placeholder media
    const media = await this.prisma.media.findMany({
      where: { 
        userId,
        // Filter out placeholder entries (category placeholders)
        mimeType: {
          not: 'text/plain'
        },
        size: {
          gt: 0
        }
      },
      select: {
        category: true,
        size: true
      }
    });

    console.log('getCategoryStats - Found media:', media.length);
    console.log('getCategoryStats - Media details:', media);

    // Group by category manually
    const categoryMap = new Map<string, { count: number, totalSize: number }>();
    
    media.forEach(item => {
      const category = item.category || 'Uncategorized';
      const existing = categoryMap.get(category) || { count: 0, totalSize: 0 };
      categoryMap.set(category, {
        count: existing.count + 1,
        totalSize: existing.totalSize + item.size
      });
    });

    return Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      count: stats.count,
      totalSize: stats.totalSize
    }));
  }

  async updateCategory(userId: string, oldCategory: string, newCategory: string) {
    if (oldCategory === newCategory) {
      return { count: 0 };
    }

    return this.prisma.media.updateMany({
      where: {
        userId,
        category: oldCategory,
      },
      data: {
        category: newCategory,
      },
    });
  }

  async deleteCategory(userId: string, category: string) {
    // Move all images in this category to 'general'
    const result = await this.prisma.media.updateMany({
      where: {
        userId,
        category,
      },
      data: {
        category: 'general',
      },
    });

    return result;
  }

  async getPopularCategories(userId: string, limit: number = 10) {
    const stats = await this.prisma.media.groupBy({
      by: ['category'],
      where: { userId },
      _count: { id: true },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: limit,
    });

    return stats.map(stat => ({
      category: stat.category || 'Uncategorized',
      count: stat._count.id,
    }));
  }

  // Tag Management
  async getTags(userId: string) {
    const media = await this.prisma.media.findMany({
      where: { userId },
      select: { tags: true },
    });

    const allTags = media
      .map(m => m.tags)
      .filter(tags => tags && tags.trim() !== '')
      .flatMap(tags => tags!.split(',').map(tag => tag.trim()))
      .filter(tag => tag !== '');

    return [...new Set(allTags)].sort();
  }

  async getTagStats(userId: string) {
    const media = await this.prisma.media.findMany({
      where: { userId },
      select: { tags: true },
    });

    const tagCounts: { [key: string]: number } = {};
    
    media.forEach(m => {
      if (m.tags && m.tags.trim() !== '') {
        const tags = m.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
        tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  async updateTag(userId: string, oldTag: string, newTag: string) {
    if (oldTag === newTag) {
      return { count: 0 };
    }

    const media = await this.prisma.media.findMany({
      where: {
        userId,
        tags: { contains: oldTag },
      },
    });

    let updateCount = 0;
    for (const item of media) {
      if (!item.tags) continue;
      const tags = item.tags.split(',').map(tag => tag.trim());
      const tagIndex = tags.indexOf(oldTag);
      
      if (tagIndex !== -1) {
        tags[tagIndex] = newTag;
        await this.prisma.media.update({
          where: { id: item.id },
          data: { tags: tags.join(',') },
        });
        updateCount++;
      }
    }

    return { count: updateCount };
  }

  async deleteTag(userId: string, tag: string) {
    const media = await this.prisma.media.findMany({
      where: {
        userId,
        tags: { contains: tag },
      },
    });

    let updateCount = 0;
    for (const item of media) {
      if (!item.tags) continue;
      const tags = item.tags.split(',').map(t => t.trim()).filter(t => t !== tag);
      await this.prisma.media.update({
        where: { id: item.id },
        data: { tags: tags.join(',') },
      });
      updateCount++;
    }

    return { count: updateCount };
  }
}