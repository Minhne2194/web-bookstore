export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

type OrderStatusMeta = {
  label: string;
  badgeClassName: string;
  selectClassName: string;
};

const ORDER_STATUS_META: Record<OrderStatus, OrderStatusMeta> = {
  pending: {
    label: 'Chờ thanh toán',
    badgeClassName: 'bg-amber-100 text-amber-700 border border-amber-200',
    selectClassName: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  confirmed: {
    label: 'Đã xác nhận',
    badgeClassName: 'bg-sky-100 text-sky-700 border border-sky-200',
    selectClassName: 'bg-sky-100 text-sky-700 border-sky-200',
  },
  shipping: {
    label: 'Đang giao hàng',
    badgeClassName: 'bg-blue-100 text-blue-700 border border-blue-200',
    selectClassName: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  delivered: {
    label: 'Đã giao hàng',
    badgeClassName: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    selectClassName: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  cancelled: {
    label: 'Đã hủy',
    badgeClassName: 'bg-rose-100 text-rose-700 border border-rose-200',
    selectClassName: 'bg-rose-100 text-rose-700 border-rose-200',
  },
  refunded: {
    label: 'Đã hoàn tiền',
    badgeClassName: 'bg-violet-100 text-violet-700 border border-violet-200',
    selectClassName: 'bg-violet-100 text-violet-700 border-violet-200',
  },
};

const FALLBACK_STATUS_META: OrderStatusMeta = {
  label: 'Không xác định',
  badgeClassName: 'bg-slate-100 text-slate-700 border border-slate-200',
  selectClassName: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'pending', label: ORDER_STATUS_META.pending.label },
  { value: 'confirmed', label: ORDER_STATUS_META.confirmed.label },
  { value: 'shipping', label: ORDER_STATUS_META.shipping.label },
  { value: 'delivered', label: ORDER_STATUS_META.delivered.label },
  { value: 'cancelled', label: ORDER_STATUS_META.cancelled.label },
  { value: 'refunded', label: ORDER_STATUS_META.refunded.label },
];

export function getOrderStatusMeta(status?: string): OrderStatusMeta {
  const normalizedStatus = status?.toLowerCase() as OrderStatus | undefined;
  return normalizedStatus ? ORDER_STATUS_META[normalizedStatus] ?? FALLBACK_STATUS_META : FALLBACK_STATUS_META;
}
