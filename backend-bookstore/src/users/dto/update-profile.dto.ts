import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'Họ tên không hợp lệ' })
  @MaxLength(200, { message: 'Họ tên tối đa 200 ký tự' })
  full_name?: string;

  @IsOptional()
  @IsString({ message: 'Số điện thoại không hợp lệ' })
  @MaxLength(20, { message: 'Số điện thoại tối đa 20 ký tự' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Giới tính không hợp lệ' })
  @IsIn(['male', 'female', 'other'], {
    message: "Giới tính phải là 'male', 'female' hoặc 'other'",
  })
  gender?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Ngày sinh phải là ngày hợp lệ ISO' })
  birthday?: string;
}
