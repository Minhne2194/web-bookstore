import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBookDto {
  @IsString({ message: 'Tiêu đề sách không hợp lệ' })
  @IsNotEmpty({ message: 'Tiêu đề sách không được để trống' })
  @MaxLength(500, { message: 'Tiêu đề sách tối đa 500 ký tự' })
  title: string;

  @IsOptional()
  @IsString({ message: 'Slug không hợp lệ' })
  slug?: string;

  @IsNumber({}, { message: 'Giá sách phải là số' })
  @Min(0, { message: 'Giá sách không được nhỏ hơn 0' })
  price: number;

  @IsOptional()
  @IsNumber({}, { message: 'Giá so sánh phải là số' })
  @Min(0, { message: 'Giá so sánh không được nhỏ hơn 0' })
  compare_price?: number;

  @IsOptional()
  @IsInt({ message: 'Số lượng tồn kho phải là số nguyên' })
  @Min(0, { message: 'Số lượng tồn kho không được nhỏ hơn 0' })
  stock_qty?: number;

  @IsOptional()
  @IsString({ message: 'Mô tả sách không hợp lệ' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Ảnh bìa không hợp lệ' })
  cover_url?: string;

  @IsOptional()
  @IsArray({ message: 'extra_images phải là mảng' })
  extra_images?: string[];

  @IsOptional()
  @IsString({ message: 'Ngôn ngữ không hợp lệ' })
  @IsIn(['vi', 'en'], { message: "Ngôn ngữ phải là 'vi' hoặc 'en'" })
  language?: string;

  @IsOptional()
  @IsInt({ message: 'Năm xuất bản phải là số nguyên' })
  @Min(1500, { message: 'Năm xuất bản không được nhỏ hơn 1500' })
  @Max(2100, { message: 'Năm xuất bản không được lớn hơn 2100' })
  publish_year?: number;

  @IsOptional()
  @IsInt({ message: 'Số trang phải là số nguyên' })
  @Min(1, { message: 'Số trang phải lớn hơn 0' })
  page_count?: number;

  @IsOptional()
  @IsUUID('4', { message: 'ID nhà xuất bản không hợp lệ' })
  publisher_id?: string;

  @IsOptional()
  @IsString({ message: 'ISBN không hợp lệ' })
  @MaxLength(20, { message: 'ISBN tối đa 20 ký tự' })
  isbn?: string;

  @IsOptional()
  @IsBoolean({ message: 'is_active phải là kiểu boolean' })
  is_active?: boolean;

  @IsOptional()
  @IsArray({ message: 'author_ids phải là mảng' })
  @IsUUID('4', { each: true, message: 'author_ids chứa ID không hợp lệ' })
  author_ids?: string[];

  @IsOptional()
  @IsArray({ message: 'category_ids phải là mảng' })
  @IsUUID('4', { each: true, message: 'category_ids chứa ID không hợp lệ' })
  category_ids?: string[];

  @IsOptional()
  @IsBoolean({ message: 'is_primary_category phải là kiểu boolean' })
  is_primary_category?: boolean;

  @IsOptional()
  @IsObject({ message: 'metadata phải là object' })
  metadata?: Record<string, unknown>;
}
