import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString({ message: 'Mật khẩu không hợp lệ' })
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
  password_raw: string;

  @IsOptional()
  @IsString({ message: 'Guest ID không hợp lệ' })
  guest_id?: string;
}
