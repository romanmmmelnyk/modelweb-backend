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
  UseInterceptors,
  UploadedFile,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GalleryService } from './gallery.service';
import type { CreateMediaDto, UpdateMediaDto, MediaFilters } from './gallery.service';

@Controller('gallery')
@UseGuards(JwtAuthGuard)
export class GalleryController {
  constructor(private galleryService: GalleryService) {}

  // Gallery Management
  @Get()
  async getMedia(
    @Request() req,
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('isPublic') isPublic?: string,
    @Query('search') search?: string,
  ) {
    const filters: MediaFilters = {};
    
    if (category) filters.category = category;
    if (tags) filters.tags = tags;
    if (isPublic !== undefined) filters.isPublic = isPublic === 'true';
    if (search) filters.search = search;

    return this.galleryService.getMedia(req.user.id, filters);
  }

  @Get('stats')
  async getGalleryStats(@Request() req) {
    return this.galleryService.getGalleryStats(req.user.id);
  }

  @Get('categories')
  async getAvailableCategories(@Request() req) {
    return this.galleryService.getCategories(req.user.id);
  }

  @Get('tags')
  async getAllTags(@Request() req) {
    return this.galleryService.getTags(req.user.id);
  }

  // Category Management
        @Get('categories/list')
        async getCategories(@Request() req) {
          return this.galleryService.getCategories(req.user.id);
        }

        @Post('categories/create')
        @HttpCode(201)
        async createCategory(
          @Request() req,
          @Body() body: { name: string },
        ) {
          return this.galleryService.createCategory(req.user.id, body.name);
        }

  @Get('categories/stats')
  async getCategoryStats(@Request() req) {
    return this.galleryService.getCategoryStats(req.user.id);
  }

  @Get('categories/popular')
  async getPopularCategories(@Request() req, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.galleryService.getPopularCategories(req.user.id, limitNum);
  }

  @Put('categories/update')
  @HttpCode(200)
  async updateCategory(
    @Request() req,
    @Body() body: { oldCategory: string; newCategory: string },
  ) {
    return this.galleryService.updateCategory(req.user.id, body.oldCategory, body.newCategory);
  }

  @Delete('categories/:category')
  @HttpCode(200)
  async deleteCategory(@Request() req, @Param('category') category: string) {
    return this.galleryService.deleteCategory(req.user.id, category);
  }

  // Tag Management
  @Get('tags/list')
  async getTags(@Request() req) {
    return this.galleryService.getTags(req.user.id);
  }

  @Get('tags/stats')
  async getTagStats(@Request() req) {
    return this.galleryService.getTagStats(req.user.id);
  }

  @Put('tags/update')
  @HttpCode(200)
  async updateTag(
    @Request() req,
    @Body() body: { oldTag: string; newTag: string },
  ) {
    return this.galleryService.updateTag(req.user.id, body.oldTag, body.newTag);
  }

  @Delete('tags/:tag')
  @HttpCode(200)
  async deleteTag(@Request() req, @Param('tag') tag: string) {
    return this.galleryService.deleteTag(req.user.id, tag);
  }

  @Get('category/:category')
  async getMediaByCategory(@Request() req, @Param('category') category: string) {
    return this.galleryService.getMediaByCategory(req.user.id, category);
  }

  @Get('tags/:tags')
  async getMediaByTags(@Request() req, @Param('tags') tags: string) {
    const tagArray = tags.split(',').map(tag => tag.trim());
    return this.galleryService.getMediaByTags(req.user.id, tagArray);
  }

  @Get(':id')
  async getMediaById(@Request() req, @Param('id') id: string) {
    return this.galleryService.getMediaById(req.user.id, id);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(201)
  async uploadMedia(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() createMediaDto: CreateMediaDto,
  ) {
    return this.galleryService.uploadMedia(req.user.id, file, createMediaDto);
  }

  @Put(':id')
  @HttpCode(200)
  async updateMedia(
    @Request() req,
    @Param('id') id: string,
    @Body() updateMediaDto: UpdateMediaDto,
  ) {
    return this.galleryService.updateMedia(req.user.id, id, updateMediaDto);
  }

  @Put(':id/crop')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(200)
  async updateMediaWithCrop(
    @Request() req,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() updateMediaDto: UpdateMediaDto,
  ) {
    return this.galleryService.updateMediaWithCrop(req.user.id, id, file, updateMediaDto);
  }

  @Delete(':id')
  @HttpCode(200)
  async deleteMedia(@Request() req, @Param('id') id: string) {
    return this.galleryService.deleteMedia(req.user.id, id);
  }

  // Bulk operations
  @Put('bulk/update')
  @HttpCode(200)
  async bulkUpdateMedia(
    @Request() req,
    @Body() body: { mediaIds: string[]; data: UpdateMediaDto },
  ) {
    return this.galleryService.bulkUpdateMedia(req.user.id, body.mediaIds, body.data);
  }

  @Delete('bulk/delete')
  @HttpCode(200)
  async bulkDeleteMedia(
    @Request() req,
    @Body() body: { mediaIds: string[] },
  ) {
    return this.galleryService.bulkDeleteMedia(req.user.id, body.mediaIds);
  }

}
