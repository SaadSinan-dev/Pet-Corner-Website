import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, IsUrl, Length, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

const Trim = () => Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value);
export class LoginDto {
  @IsEmail() @MaxLength(254) @Trim() email!: string;
  @IsString() @Length(1, 256) password!: string;
}
export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 12;
}
export class ProductQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(150) @Trim() search?: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000000) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000000) maxPrice?: number;
  @IsOptional() @IsIn(['true', 'false']) inStock?: string;
  @IsOptional() @IsIn(['true', 'false']) featured?: string;
  @IsOptional() @IsIn(['newest', 'price-asc', 'price-desc']) sort?: string;
}
export class CartItemDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) @Max(100) quantity!: number;
}
export class CartDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => CartItemDto) items!: CartItemDto[];
}
export class OrderDto extends CartDto {
  @IsString() @Trim() @Length(2, 100) customerName!: string;
  @IsString() @Trim() @Matches(/^\+?[0-9\s()-]{7,25}$/, { message: 'رقم الهاتف غير صالح' }) phone!: string;
  @IsOptional() @IsString() @Trim() @Length(1, 100) regionId?: string;
  @IsOptional() @IsString() @Trim() @IsIn(['دمشق', 'ريف دمشق', 'القنيطرة', 'درعا', 'السويداء', 'حمص', 'حماة', 'طرطوس', 'اللاذقية', 'إدلب', 'حلب', 'الرقة', 'دير الزور', 'الحسكة']) governorate?: string;
  @IsString() @Trim() @Length(2, 100) city!: string;
  @IsString() @Trim() @Length(8, 500) address!: string;
  @IsOptional() @IsString() @Trim() @MaxLength(1000) notes?: string;
}
export class ImageDto {
  @IsString() @Matches(/^(?:\/(?:uploads|images)\/[a-zA-Z0-9_./-]+|https:\/\/[^\s<>"']+)$/) @MaxLength(1000) url!: string;
  @IsString() @Trim() @Length(1, 200) alt!: string;
}
export class ProductDto {
  @IsString() @Trim() @Length(2, 200) name!: string;
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @Length(1, 120) slug!: string;
  @IsString() @Trim() @Length(1, 350) shortDescription!: string;
  @IsString() @Trim() @Length(1, 10000) description!: string;
  @IsOptional() @IsString() @Trim() @Length(1, 100) sku?: string | null;
  @IsInt() @Min(0) @Max(100000000) price!: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000000) compareAtPrice?: number | null;
  @IsInt() @Min(0) @Max(1000000) stock!: number;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) position?: number;
  @IsUUID() categoryId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ImageDto) images!: ImageDto[];
}
export class UpdateProductDto extends PartialType(ProductDto, { skipNullProperties: false }) {}
export class CategoryDto {
  @IsString() @Trim() @Length(2, 100) name!: string;
  @IsString() @Length(1, 100) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
  @IsOptional() @IsString() @Matches(/^(?:\/(?:uploads|images)\/[a-zA-Z0-9_./-]+|https:\/\/[^\s<>"']+)$/) @MaxLength(1000) image?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) position?: number;
}
export class UpdateCategoryDto extends PartialType(CategoryDto, { skipNullProperties: false }) {}
export class RegionDto {
  @IsString() @Trim() @Length(1, 100) id!: string;
  @IsString() @Trim() @Length(2, 100) name!: string;
  @IsInt() @Min(0) @Max(100000000) fee!: number;
}
export class SocialLinkDto {
  @IsString() @Trim() @Length(1, 100) label!: string;
  @IsString() @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false }) @MaxLength(1000) url!: string;
}
export class SettingsDto {
  @IsOptional() @IsString() @Trim() @Length(2, 100) storeName?: string;
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsString() @Trim() @Length(1, 20) currencyLabel?: string;
  @IsOptional() @IsBoolean() demoMode?: boolean;
  @IsOptional() @IsBoolean() codEnabled?: boolean;
  @IsOptional() @IsBoolean() checkoutEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(30) contactPhone?: string | null;
  @IsOptional() @IsEmail() @MaxLength(254) contactEmail?: string | null;
  @IsOptional() @IsString() @Matches(/^[1-9][0-9]{6,14}$/) whatsappNumber?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => SocialLinkDto) socialLinks?: SocialLinkDto[];
  @IsOptional() @IsString() @Trim() @MaxLength(150) heroEyebrow?: string;
  @IsOptional() @IsString() @Trim() @MaxLength(200) heroTitle?: string;
  @IsOptional() @IsString() @Trim() @MaxLength(1000) heroDescription?: string;
  @IsOptional() @IsString() @Trim() @MaxLength(100) heroButtonText?: string;
  @IsOptional() @IsString() @Matches(/^(?:\/(?:uploads|images)\/[a-zA-Z0-9_./-]+|https:\/\/[^\s<>"']+)$/) @MaxLength(1000) heroImageUrl?: string | null;
  @IsOptional() @IsString() @Trim() @MaxLength(2000) footerText?: string;
  @IsOptional() @IsString() @Trim() @Length(1, 2000) checkoutMessage?: string;
  @IsOptional() @IsString() @Trim() @MaxLength(30000) deliveryPolicy?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => RegionDto) deliveryRegions?: RegionDto[];
  @IsOptional() @IsObject() pages?: Record<string, { title: string; body: string }>;
}
export class StatusDto {
  @IsIn(['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']) status!: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
}
export class DeliveryDto { @IsInt() @Min(0) @Max(100000000) deliveryFee!: number; }
export class OrderQueryDto extends PaginationDto {
  @IsOptional() @IsString() @Trim() @MaxLength(150) search?: string;
  @IsOptional() @IsIn(['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']) status?: StatusDto['status'];
}

// Explicit OpenAPI metadata keeps the runtime DTO validation and Swagger schemas aligned
// without requiring a Nest compiler plugin in this independently runnable service.
const schemas: Array<[Function, Record<string, unknown>, string[]]> = [
  [LoginDto, { email: String, password: String }, []],
  [PaginationDto, { page: Number, limit: Number }, ['page', 'limit']],
  [ProductQueryDto, { search: String, category: String, minPrice: Number, maxPrice: Number, inStock: String, featured: String, sort: String }, ['search', 'category', 'minPrice', 'maxPrice', 'inStock', 'featured', 'sort']],
  [CartItemDto, { productId: String, quantity: Number }, []],
  [CartDto, { items: [CartItemDto] }, []],
  [OrderDto, { customerName: String, phone: String, regionId: String, governorate: String, city: String, address: String, notes: String, items: [CartItemDto] }, ['notes', 'regionId', 'governorate']],
  [ImageDto, { url: String, alt: String }, []],
  [ProductDto, { name: String, slug: String, shortDescription: String, description: String, sku: String, price: Number, compareAtPrice: Number, stock: Number, featured: Boolean, active: Boolean, position: Number, categoryId: String, images: [ImageDto] }, ['sku', 'compareAtPrice', 'featured', 'active', 'position']],
  [UpdateProductDto, { name: String, slug: String, shortDescription: String, description: String, sku: String, price: Number, compareAtPrice: Number, stock: Number, featured: Boolean, active: Boolean, position: Number, categoryId: String, images: [ImageDto] }, ['name', 'slug', 'shortDescription', 'description', 'sku', 'price', 'compareAtPrice', 'stock', 'featured', 'active', 'position', 'categoryId', 'images']],
  [CategoryDto, { name: String, slug: String, image: String, active: Boolean, position: Number }, ['image', 'active', 'position']],
  [UpdateCategoryDto, { name: String, slug: String, image: String, active: Boolean, position: Number }, ['name', 'slug', 'image', 'active', 'position']],
  [RegionDto, { id: String, name: String, fee: Number }, []],
  [SettingsDto, { storeName: String, currency: String, currencyLabel: String, demoMode: Boolean, codEnabled: Boolean, checkoutEnabled: Boolean, contactPhone: String, contactEmail: String, deliveryRegions: [RegionDto], pages: Object }, ['storeName', 'currency', 'currencyLabel', 'demoMode', 'codEnabled', 'checkoutEnabled', 'contactPhone', 'contactEmail', 'deliveryRegions', 'pages']],
  [SocialLinkDto, { label: String, url: String }, []],
  [DeliveryDto, { deliveryFee: Number }, []],
  [StatusDto, { status: String }, []],
  [OrderQueryDto, { status: String, search: String }, ['status', 'search']],
];
for (const [dto, properties, optional] of schemas) {
  for (const [key, type] of Object.entries(properties)) ApiProperty({ type: type as typeof String, required: !optional.includes(key) })(dto.prototype as object, key);
}

for (const [key, type] of Object.entries({ whatsappNumber: String, socialLinks: [SocialLinkDto], heroEyebrow: String, heroTitle: String, heroDescription: String, heroButtonText: String, heroImageUrl: String, footerText: String, checkoutMessage: String, deliveryPolicy: String })) ApiProperty({ type: type as typeof String, required: false, nullable: ['whatsappNumber', 'heroImageUrl'].includes(key) })(SettingsDto.prototype, key);
