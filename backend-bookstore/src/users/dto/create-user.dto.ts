import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString({ message: 'Mật khẩu không hợp lệ' })
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  password_raw: string;

  @IsOptional()
  @IsString({ message: 'Họ tên không hợp lệ' })
  @MaxLength(200, { message: 'Họ tên tối đa 200 ký tự' })
  full_name?: string;
}
