import { IsIn } from 'class-validator';

export class UpdateStatusDto {
  @IsIn(
    ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled', 'refunded'],
    { message: 'Trạng thái đơn hàng không hợp lệ' },
  )
  status: string;
}
