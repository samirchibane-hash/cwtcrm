import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Check, ExternalLink, Loader2, Plus, Trash2, Truck } from 'lucide-react';
import {
  Order,
  OrderShipment,
  ShipmentLine,
  ShipmentProgress,
  getShipmentProgress,
  getStatusForShipments,
} from '@/data/orders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ToastAction } from '@/components/ui/toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

const today = () => format(new Date(), 'yyyy-MM-dd');

const formatShipDate = (value: string): string => {
  try {
    return format(parseISO(value), 'MMM d, yyyy');
  } catch {
    return value;
  }
};

const unitsIn = (shipment: OrderShipment) => shipment.items.reduce((sum, i) => sum + i.quantity, 0);
const pluralUnits = (n: number) => `${n} ${n === 1 ? 'unit' : 'units'}`;

// ---- Log shipment form ----

const buildSchema = (lines: ShipmentLine[]) =>
  z.object({
    items: z
      .array(
        z.object({
          modelName: z.string(),
          quantity: z
            .number({ invalid_type_error: 'Enter a number (0 to skip)' })
            .int('Whole units only')
            .min(0, "Can't be negative"),
        }),
      )
      .superRefine((items, ctx) => {
        items.forEach((item, index) => {
          const line = lines.find(l => l.modelName === item.modelName);
          if (line && item.quantity > line.remaining) {
            ctx.addIssue({ code: 'custom', path: [index, 'quantity'], message: `Only ${line.remaining} left to ship` });
          }
        });
        if (items.every(item => !item.quantity)) {
          ctx.addIssue({ code: 'custom', path: [], message: 'Enter at least one unit to log a shipment.' });
        }
      }),
    shippedOn: z
      .string()
      .min(1, 'Pick the ship date')
      .refine(v => v <= today(), "Ship date can't be in the future"),
    tracking: z.string().trim().max(500, 'Tracking is too long'),
    note: z.string().trim().max(300, 'Keep notes under 300 characters'),
  });

type ShipmentFormValues = z.infer<ReturnType<typeof buildSchema>>;

const LogShipmentForm = ({ lines, onCancel, onSubmit }: {
  lines: ShipmentLine[];
  onCancel: () => void;
  onSubmit: (values: ShipmentFormValues) => Promise<void>;
}) => {
  // Snapshot the open lines for the life of the form so validation limits don't shift mid-entry
  const [schema] = useState(() => buildSchema(lines));
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ShipmentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      // Default to the full balance: the most common entry is "the rest shipped"
      items: lines.map(l => ({ modelName: l.modelName, quantity: l.remaining })),
      shippedOn: today(),
      tracking: '',
      note: '',
    },
  });

  const itemsError = errors.items?.message || errors.items?.root?.message;

  return (
    <form
      data-escape-scope
      noValidate
      aria-label="Log shipment"
      onSubmit={handleSubmit(onSubmit)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      className="mt-5 rounded-lg border border-border bg-muted/30 p-4 space-y-4"
    >
      <fieldset>
        <legend className="text-xs text-muted-foreground mb-2">Units in this shipment</legend>
        <div className="space-y-2">
          {lines.map((line, index) => {
            const error = errors.items?.[index]?.quantity?.message;
            return (
              <div key={line.modelName} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                <Label htmlFor={`ship-qty-${index}`} className="min-w-0 font-normal">
                  <span className="block truncate text-sm">{line.modelName}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {line.remaining} of {line.ordered} left
                  </span>
                </Label>
                <Input
                  id={`ship-qty-${index}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={line.remaining}
                  step={1}
                  autoFocus={index === 0}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-invalid={!!error}
                  aria-describedby={error ? `ship-qty-${index}-error` : undefined}
                  className="h-9 w-24 text-right tabular-nums"
                  {...register(`items.${index}.quantity` as const, { valueAsNumber: true })}
                />
                {error && (
                  <p id={`ship-qty-${index}-error`} className="col-span-2 text-xs text-destructive">{error}</p>
                )}
              </div>
            );
          })}
        </div>
        {itemsError && <p role="alert" className="mt-2 text-xs text-destructive">{itemsError}</p>}
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="ship-date" className="text-xs text-muted-foreground">Ship date</Label>
          <Input
            id="ship-date"
            type="date"
            max={today()}
            aria-invalid={!!errors.shippedOn}
            className="h-9"
            {...register('shippedOn')}
          />
          {errors.shippedOn && <p className="text-xs text-destructive">{errors.shippedOn.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ship-tracking" className="text-xs text-muted-foreground">
            Tracking <span className="font-normal opacity-70">(optional)</span>
          </Label>
          <Input
            id="ship-tracking"
            placeholder="Link or tracking #"
            aria-invalid={!!errors.tracking}
            className="h-9"
            {...register('tracking')}
          />
          {errors.tracking && <p className="text-xs text-destructive">{errors.tracking.message}</p>}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ship-note" className="text-xs text-muted-foreground">
          Note <span className="font-normal opacity-70">(optional)</span>
        </Label>
        <Input
          id="ship-note"
          placeholder="e.g. Balance ships after restock"
          aria-invalid={!!errors.note}
          className="h-9"
          {...register('note')}
        />
        {errors.note && <p className="text-xs text-destructive">{errors.note.message}</p>}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Truck className="w-4 h-4 mr-1.5" />}
          Log shipment
        </Button>
      </div>
    </form>
  );
};

// ---- Shipments card ----

interface OrderShipmentsProps {
  order: Order;
  /** Inline changes are paused while the whole order is in edit mode (they'd save its draft too). */
  disabled?: boolean;
  /** Saves a patch to the order; resolves false when the save failed (and was rolled back). */
  onPersist: (patch: Partial<Order>) => Promise<boolean>;
}

const OrderShipments = ({ order, disabled = false, onPersist }: OrderShipmentsProps) => {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);

  const progress = getShipmentProgress(order);
  const openLines = progress.lines.filter(l => l.remaining > 0 && l.ordered > 0);
  const fullyShipped = progress.ordered > 0 && progress.remaining === 0;
  const percent = progress.ordered ? Math.min(100, Math.round((progress.shipped / progress.ordered) * 100)) : 0;
  const canLog = !disabled && openLines.length > 0;

  // Newest first; ties broken by when they were entered
  const shipments = useMemo(
    () => [...(order.shipments ?? [])].sort(
      (a, b) => b.shippedOn.localeCompare(a.shippedOn) || b.createdAt.localeCompare(a.createdAt),
    ),
    [order.shipments],
  );

  // Save a new shipment log, move the status along with it, and offer a one-click undo
  const commit = async (
    nextShipments: OrderShipment[],
    title: string,
    describe: (p: ShipmentProgress) => string,
  ) => {
    const previous: Partial<Order> = { shipments: order.shipments ?? [], status: order.status };
    const nextProgress = getShipmentProgress({ modelItems: order.modelItems, shipments: nextShipments });
    const nextStatus = getStatusForShipments(order.status, nextProgress);

    const ok = await onPersist({ shipments: nextShipments, ...(nextStatus ? { status: nextStatus } : {}) });
    if (!ok) return false;

    toast({
      title,
      description: `${describe(nextProgress)}${nextStatus ? ` Status set to ${nextStatus}.` : ''}`,
      action: (
        <ToastAction altText="Undo" onClick={() => { void onPersist(previous); }}>
          Undo
        </ToastAction>
      ),
    });
    return true;
  };

  const handleLog = async (values: ShipmentFormValues) => {
    const shipment: OrderShipment = {
      id: crypto.randomUUID(),
      shippedOn: values.shippedOn,
      items: values.items.filter(i => i.quantity > 0).map(({ modelName, quantity }) => ({ modelName, quantity })),
      tracking: values.tracking || undefined,
      note: values.note || undefined,
      createdAt: new Date().toISOString(),
    };
    const ok = await commit(
      [...(order.shipments ?? []), shipment],
      'Shipment logged',
      p => p.remaining === 0
        ? `${pluralUnits(unitsIn(shipment))} shipped. Order is fully shipped.`
        : `${pluralUnits(unitsIn(shipment))} shipped, ${p.remaining} still to ship.`,
    );
    if (ok) setFormOpen(false);
  };

  const handleDelete = (shipment: OrderShipment) =>
    commit(
      (order.shipments ?? []).filter(s => s.id !== shipment.id),
      'Shipment deleted',
      p => `${p.shipped} of ${p.ordered} units now logged as shipped.`,
    );

  return (
    <section className="content-card p-6" aria-labelledby={`shipments-${order.id}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 id={`shipments-${order.id}`} className="section-header mb-0">Shipments</h2>
        {canLog && !formOpen && shipments.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Log shipment
          </Button>
        )}
      </div>

      {progress.ordered === 0 ? (
        <p className="text-sm text-muted-foreground">Add products to this order before logging shipments.</p>
      ) : (
        <>
          {/* Shipped vs ordered */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>
                <span className="font-semibold tabular-nums">{progress.shipped}</span>
                <span className="text-muted-foreground"> of </span>
                <span className="tabular-nums">{pluralUnits(progress.ordered)}</span>
                <span className="text-muted-foreground"> shipped</span>
              </span>
              {fullyShipped ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-order-delivered-foreground">
                  <Check className="w-3.5 h-3.5" aria-hidden />
                  All shipped
                </span>
              ) : (
                <span className="text-xs text-muted-foreground tabular-nums">{progress.remaining} remaining</span>
              )}
            </div>
            <Progress
              value={percent}
              aria-label={`${progress.shipped} of ${progress.ordered} units shipped`}
              className="h-2"
              indicatorClassName={fullyShipped ? 'bg-order-delivered' : 'bg-order-partial'}
            />
            {progress.lines.length > 1 && (
              <ul className="pt-1 space-y-1">
                {progress.lines.map(line => (
                  <li key={line.modelName} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="truncate">{line.modelName}</span>
                    <span className="tabular-nums shrink-0">
                      {line.shipped}/{line.ordered}
                      {line.shipped > line.ordered && ` (${line.shipped - line.ordered} over)`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {formOpen && canLog && (
            <LogShipmentForm lines={openLines} onCancel={() => setFormOpen(false)} onSubmit={handleLog} />
          )}

          {shipments.length === 0 ? (
            !formOpen && (
              <div className="mt-5 rounded-lg border border-dashed border-border p-5 text-center">
                <p className="text-sm text-muted-foreground">
                  {order.status === 'Partially Shipped'
                    ? 'Marked Partially Shipped, but nothing is logged yet. Log what has gone out to track the balance.'
                    : 'No shipments logged yet. Log each shipment as it goes out to track what is left.'}
                </p>
                {canLog && (
                  <Button size="sm" className="mt-3" onClick={() => setFormOpen(true)}>
                    <Truck className="w-4 h-4 mr-1.5" />
                    Log shipment
                  </Button>
                )}
              </div>
            )
          ) : (
            <ol className="mt-5 space-y-2" aria-label="Shipment history">
              {shipments.map(shipment => {
                const units = unitsIn(shipment);
                const dateLabel = formatShipDate(shipment.shippedOn);
                const isLink = !!shipment.tracking?.startsWith('http');
                return (
                  <li key={shipment.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4 text-muted-foreground" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {dateLabel} <span className="text-muted-foreground font-normal">· {pluralUnits(units)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {shipment.items.map(i => `${i.quantity} × ${i.modelName}`).join(', ')}
                      </p>
                      {shipment.tracking && (
                        isLink ? (
                          <a
                            href={shipment.tracking}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                          >
                            Track shipment
                            <ExternalLink className="w-3 h-3" aria-hidden />
                          </a>
                        ) : (
                          <p className="mt-1 text-xs font-mono text-foreground break-all">{shipment.tracking}</p>
                        )
                      )}
                      {shipment.note && <p className="mt-1 text-xs text-muted-foreground whitespace-pre-line">{shipment.note}</p>}
                    </div>
                    {!disabled && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${dateLabel} shipment`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-destructive" />
                              Delete this shipment?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Removes the {dateLabel} shipment of {pluralUnits(units)} from this order's log.
                              Those units will count as unshipped again.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => { void handleDelete(shipment); }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete shipment
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </section>
  );
};

export default OrderShipments;
