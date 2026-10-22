import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminGuard } from './auth';
import { CartDto, CategoryDto, DeliveryDto, OrderDto, OrderQueryDto, ProductDto, ProductQueryDto, SettingsDto, StatusDto, UpdateCategoryDto, UpdateProductDto } from './dto';
import { StoreService } from './store';
import { StorageService } from './storage';

@ApiTags('Storefront')
@Controller('storefront')
export class StorefrontController {
  constructor(private readonly store: StoreService) {}
  @Get('settings') settings() { return this.store.settings(); }
  @Get('categories') categories() { return this.store.categories(); }
  @Get('products') products(@Query() query: ProductQueryDto) { return this.store.products(query); }
  @Get('categories/:slug/products') categoryProducts(@Param('slug') slug: string, @Query() query: ProductQueryDto) { return this.store.products(query, false, slug); }
  @Get('products/:slug') product(@Param('slug') slug: string) { return this.store.product(slug); }
  @Post('cart/validate') cart(@Body() dto: CartDto) { return this.store.cart(dto.items); }
  @Post('orders')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID retained for retries of the same checkout' })
  createOrder(@Body() dto: OrderDto, @Headers('idempotency-key') key?: string) { return this.store.createOrder(dto, key); }
  @Get('orders/:orderCode')
  @ApiHeader({ name: 'X-Order-Token', required: true, description: 'Private receipt token returned on order creation' })
  receipt(@Param('orderCode') code: string, @Headers('x-order-token') token?: string) { return this.store.getReceipt(code, token); }
}
@ApiTags('Administration')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly store: StoreService, private readonly storage: StorageService) {}
  @Get('products') products(@Query() dto: ProductQueryDto) { return this.store.products(dto, true); }
  @Get('products/:id') product(@Param('id', ParseUUIDPipe) id: string) { return this.store.product(id, true); }
  @Post('products') createProduct(@Body() dto: ProductDto) { return this.store.createProduct(dto); }
  @Patch('products/:id') updateProduct(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) { return this.store.updateProduct(id, dto); }
  @Delete('products/:id') removeProduct(@Param('id', ParseUUIDPipe) id: string) { return this.store.removeProduct(id); }
  @Get('categories') categories() { return this.store.categories(true); }
  @Get('categories/:id') async category(@Param('id', ParseUUIDPipe) id: string) {
    const category = (await this.store.categories(true)).find(c => c.id === id);
    if (!category) throw new BadRequestException('الفئة غير موجودة');
    return category;
  }
  @Post('categories') createCategory(@Body() dto: CategoryDto) { return this.store.createCategory(dto); }
  @Patch('categories/:id') updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) { return this.store.updateCategory(id, dto); }
  @Delete('categories/:id') removeCategory(@Param('id', ParseUUIDPipe) id: string) { return this.store.removeCategory(id); }
  @Get('settings') settings() { return this.store.settings(true); }
  @Patch('settings') patchSettings(@Body() dto: SettingsDto) { return this.store.patchSettings(dto); }
  @Get('orders') orders(@Query() dto: OrderQueryDto) { return this.store.orders(dto); }
  @Get('orders/:id') order(@Param('id', ParseUUIDPipe) id: string) { return this.store.order(id); }
  @Patch('orders/:id/status') status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto, @Req() req: Request & { adminId: string }) { return this.store.status(id, dto.status, req.adminId); }
  @Patch('orders/:id/delivery') delivery(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DeliveryDto, @Req() req: Request & { adminId: string }) { return this.store.delivery(id, dto.deliveryFee, req.adminId); }
  @Post('uploads')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } }))
  upload(@UploadedFile() file?: Express.Multer.File) { return this.storage.upload(file); }
}
