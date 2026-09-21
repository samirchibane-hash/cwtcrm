import { SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ORDER_STATUSES, ORDER_STATUS_META, Order, OrderStatus, getShipmentProgress } from '@/data/orders';

const OrderStatusBadge = ({ status, className }: { status: OrderStatus; className?: string }) => {
  const meta = ORDER_STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        meta?.badge ?? 'bg-muted text-muted-foreground',
        className,
      )}
      title={meta?.description}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', meta?.dot ?? 'bg-muted-foreground')} />
      {status}
    </span>
  );
};

/** "30/50 shipped" beside the badge while an order still has units outstanding. */
export const ShipmentProgressText = ({ order }: { order: Pick<Order, 'modelItems' | 'shipments'> }) => {
  if (!order.shipments?.length) return null;
  const { shipped, ordered, remaining } = getShipmentProgress(order);
  if (remaining === 0) return null;
  return (
    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
      {shipped}/{ordered}<span className="sr-only"> units</span> shipped
    </span>
  );
};

/** Status options for any status <Select>, in lifecycle order. */
export const OrderStatusSelectItems = () => (
  <>
    {ORDER_STATUSES.map(status => (
      <SelectItem key={status} value={status}>
        <span className="flex items-center gap-2">
          <span aria-hidden className={cn('h-2 w-2 rounded-full shrink-0', ORDER_STATUS_META[status].dot)} />
          {status}
        </span>
      </SelectItem>
    ))}
  </>
);

export default OrderStatusBadge;
