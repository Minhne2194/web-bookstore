import {
  IsIn,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateOrderDto {
  @IsIn(['cod', 'bank_transfer', 'momo', 'vnpay'], {
    message: 'Phương thức thanh toán không hợp lệ',
  })
  payment_method: string;

  @IsObject({ message: 'Địa chỉ giao hàng không hợp lệ' })
  @IsNotEmptyObject({}, { message: 'Địa chỉ giao hàng không hợp lệ' })
  shipping_address: object;

  @IsOptional()
  @IsString({ message: 'Mã khuyến mãi không hợp lệ' })
  promo_code?: string;
}
