import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAddressDto {
  @IsString({ message: 'Tên người nhận không hợp lệ' })
  @IsNotEmpty({ message: 'Tên người nhận không được để trống' })
  receiver_name: string;

  @IsString({ message: 'Số điện thoại không hợp lệ' })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  phone: string;

  @IsString({ message: 'Tỉnh/Thành phố không hợp lệ' })
  @IsNotEmpty({ message: 'Tỉnh/Thành phố không được để trống' })
  province: string;

  @IsString({ message: 'Quận/Huyện không hợp lệ' })
  @IsNotEmpty({ message: 'Quận/Huyện không được để trống' })
  district: string;

  @IsString({ message: 'Phường/Xã không hợp lệ' })
  @IsNotEmpty({ message: 'Phường/Xã không được để trống' })
  ward: string;

  @IsString({ message: 'Địa chỉ cụ thể không hợp lệ' })
  @IsNotEmpty({ message: 'Địa chỉ cụ thể không được để trống' })
  street: string;

  @IsOptional()
  @IsBoolean({ message: 'is_default phải là kiểu boolean' })
  is_default?: boolean;

  @IsOptional()
  @IsString({ message: 'Loại địa chỉ không hợp lệ' })
  @IsIn(['home', 'office'], {
    message: "Loại địa chỉ phải là 'home' hoặc 'office'",
  })
  address_type?: string;
}
