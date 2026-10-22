import { IsIn } from 'class-validator';

export class ChangePaymentDto {
  @IsIn(['cod', 'bank_transfer', 'momo', 'vnpay'], {
    message: 'Phương thức thanh toán không hợp lệ',
  })
  payment_method: string;
}
