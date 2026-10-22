import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString({ message: 'Refresh token không hợp lệ' })
  @IsNotEmpty({ message: 'Thiếu refresh token' })
  refresh_token: string;
}
