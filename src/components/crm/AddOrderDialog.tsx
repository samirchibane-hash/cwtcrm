import { useState } from 'react';
import { Plus, Trash2, Package, Building2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useOrders } from '@/context/OrdersContext';
import { useProductModels } from '@/context/ProductModelsContext';
import { useProspects } from '@/context/ProspectsContext';
import { useToast } from '@/hooks/use-toast';
import { defaultTierNames } from '@/data/productModels';
import { Order, OrderModelItem, OrderType, getStatusColor, formatCurrency } from '@/data/orders';

interface AddOrderDialogProps {
  defaultCompanyName?: string;
  defaultCompanyId?: string;
  trigger?: React.ReactNode;
  onOrderCreated?: () => void;
}

// Pricing tier index by quantity (mirrors OrderDetail)
const getTierIndex = (quantity: number): number => {
  if (quantity >= 100) return 4;
  if (quantity >= 51) return 3;
  if (quantity >= 26) return 2;
  if (quantity >= 11) return 1;
  return 0;
};

type DraftItem = { modelName: string; quantity: number; priceOverride?: number };

const AddOrderDialog = ({
  defaultCompanyName,
  defaultCompanyId,
  trigger,
  onOrderCreated,
}: AddOrderDialogProps = {}) => {
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState(defaultCompanyName || '');
  const [companyId, setCompanyId] = useState(defaultCompanyId || '');
  const [placed, setPlaced] = useState(new Date().toLocaleDateString('en-US'));
  const [status, setStatus] = useState<Order['status']>('PO/Invoice');
  const [orderType, setOrderType] = useState<OrderType>('Standard');
  const [invoice, setInvoice] = useState('');
  const [modelItems, setModelItems] = useState<DraftItem[]>([{ modelName: '', quantity: 1 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addOrder } = useOrders();
  const { models: productModels, getModelByName } = useProductModels();
  const { prospects } = useProspects();
  const { toast } = useToast();

  // Reset form when panel opens (with defaults)
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setCustomer(defaultCompanyName || '');
      setCompanyId(defaultCompanyId || '');
      setPlaced(new Date().toLocaleDateString('en-US'));
      setStatus('PO/Invoice');
      setOrderType('Standard');
      setInvoice('');
      setModelItems([{ modelName: '', quantity: 1 }]);
    }
    setOpen(isOpen);
  };

  const addModelItem = () => {
    setModelItems([...modelItems, { modelName: '', quantity: 1 }]);
  };

  const removeModelItem = (index: number) => {
    if (modelItems.length > 1) {
      setModelItems(modelItems.filter((_, i) => i !== index));
    }
  };

  const updateModelItem = (index: number, field: 'modelName' | 'quantity' | 'priceOverride', value: string | number) => {
    const updated = [...modelItems];
    if (field === 'quantity') {
      updated[index].quantity = Math.max(1, Number(value) || 1);
    } else if (field === 'priceOverride') {
      updated[index].priceOverride = value === '' ? undefined : Math.max(0, Number(value));
    } else {
      updated[index].modelName = value as string;
    }
    setModelItems(updated);
  };

  const handleCompanySelect = (prospectId: string) => {
    const prospect = prospects.find(p => p.id === prospectId);
    if (prospect) {
      setCompanyId(prospectId);
      setCustomer(prospect.companyName);
    }
  };

  // ---- Live pricing (matches the view/edit panel) ----
  const priceItem = (item: DraftItem) => {
    const model = getModelByName(item.modelName);
    const tierIndex = getTierIndex(item.quantity);
    const tierUnitPrice = model?.pricingTiers[tierIndex]?.price || 0;
    const unitPrice = item.priceOverride !== undefined ? item.priceOverride : tierUnitPrice;
    return { model, tierIndex, tierUnitPrice, unitPrice, lineTotal: unitPrice * item.quantity };
  };

  const isZeroValueType = orderType === 'Sample' || orderType === 'Replacement';
  const totalUnits = modelItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const rawTotal = modelItems.reduce((sum, item) => sum + priceItem(item).lineTotal, 0);
  const orderTotal = isZeroValueType ? 0 : rawTotal;

  const handleSubmit = async () => {
    if (!customer.trim()) {
      toast({ title: 'Customer required', description: 'Add a customer name before creating the order.', variant: 'destructive' });
      return;
    }

    const validItems = modelItems.filter(item => item.modelName && item.quantity > 0);
    if (validItems.length === 0) {
      toast({ title: 'Add a product', description: 'Select at least one product model and quantity.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    const orderModelItems: OrderModelItem[] = validItems.map(item => ({
      modelName: item.modelName,
      quantity: item.quantity,
      priceOverride: item.priceOverride,
    }));

    const units = orderModelItems.reduce((sum, item) => sum + item.quantity, 0);
    const modelType = orderModelItems.map(item => `${item.quantity}x ${item.modelName}`).join(', ');

    const result = await addOrder({
      customer: customer.trim(),
      companyId: companyId || undefined,
      placed,
      units,
      modelType,
      modelItems: orderModelItems,
      totalValue: 0, // Recalculated by context from pricing tiers
      invoice: invoice.trim(),
      status,
      tracking: '',
      orderUpdates: '',
      orderType,
    });

    setIsSubmitting(false);

    if (result) {
      toast({ title: 'Order created', description: `New order for ${customer} has been added.` });
      setOpen(false);
      onOrderCreated?.();
    }
  };

  const hasDefaultCompany = Boolean(defaultCompanyName);
  const statusColors = getStatusColor(status);
  const validItemCount = modelItems.filter(i => i.modelName).length;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Order
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-6 flex flex-col">
        <div className="flex h-full flex-col">
          {/* Accessible title/description for screen readers; the visible header below is custom */}
          <SheetTitle className="sr-only">Create New Order</SheetTitle>
          <SheetDescription className="sr-only">Add a new order with product models, quantities, and pricing.</SheetDescription>

          {/* Header — mirrors the order detail panel */}
          <div className="shrink-0 pb-5 border-b border-border pr-8">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">New Order</p>
                <h1 className="text-xl font-semibold tracking-tight truncate">
                  {customer.trim() || 'Create Order'}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <Badge variant="secondary" className={`${statusColors.bg} ${statusColors.text} border-0`}>
                    {status}
                  </Badge>
                  {isZeroValueType && (
                    <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-0">
                      {orderType}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto -mx-6 px-6 py-6 space-y-6">
            {/* Details */}
            <section className="content-card p-6">
              <h2 className="section-header">Details</h2>
              <div className="space-y-4">
                {!hasDefaultCompany && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      Link to Company <span className="font-normal opacity-70">(optional)</span>
                    </Label>
                    <Select value={companyId} onValueChange={handleCompanySelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Search companies…" />
                      </SelectTrigger>
                      <SelectContent>
                        {prospects.map((prospect) => (
                          <SelectItem key={prospect.id} value={prospect.id}>
                            {prospect.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid gap-1.5">
                  <Label htmlFor="customer" className="text-xs text-muted-foreground">Customer *</Label>
                  <Input
                    id="customer"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    placeholder="Enter customer name"
                    disabled={hasDefaultCompany}
                  />
                  {hasDefaultCompany && (
                    <p className="text-xs text-muted-foreground">Scoped to this company profile.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="placed" className="text-xs text-muted-foreground">Date Placed</Label>
                    <Input
                      id="placed"
                      value={placed}
                      onChange={(e) => setPlaced(e.target.value)}
                      placeholder="MM/DD/YYYY"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Order Type</Label>
                    <Select value={orderType} onValueChange={(value) => setOrderType(value as OrderType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Standard">Standard</SelectItem>
                        <SelectItem value="Sample">Sample ($0)</SelectItem>
                        <SelectItem value="Replacement">Replacement ($0)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={status} onValueChange={(value) => setStatus(value as Order['status'])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PO/Invoice">PO/Invoice</SelectItem>
                        <SelectItem value="Paid">Paid</SelectItem>
                        <SelectItem value="Partially Shipped">Partially Shipped</SelectItem>
                        <SelectItem value="Delivered">Delivered</SelectItem>
                        <SelectItem value="Loaner">Loaner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </section>

            {/* Products — with live per-line pricing + running total */}
            <section className="content-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-header mb-0">Products</h2>
                <Button size="sm" variant="outline" onClick={addModelItem}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Model
                </Button>
              </div>

              <div className="space-y-3">
                {modelItems.map((item, index) => {
                  const { model, tierIndex, tierUnitPrice, unitPrice, lineTotal } = priceItem(item);
                  const isManual = item.priceOverride !== undefined;
                  return (
                    <div key={index} className="p-4 rounded-lg border bg-muted/30 space-y-3">
                      <div className="flex items-center gap-2">
                        <Select value={item.modelName} onValueChange={(value) => updateModelItem(index, 'modelName', value)}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {productModels.map((m) => (
                              <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateModelItem(index, 'quantity', e.target.value)}
                          className="w-20"
                          placeholder="Qty"
                          aria-label="Quantity"
                        />
                        {modelItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeModelItem(index)}
                            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 items-end">
                        <div className="grid gap-1.5">
                          <Label className="text-xs text-muted-foreground">
                            Price/unit
                            {isManual && (
                              <button
                                type="button"
                                className="ml-2 text-accent hover:underline font-normal"
                                onClick={() => updateModelItem(index, 'priceOverride', '')}
                              >
                                (reset)
                              </button>
                            )}
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={isManual ? item.priceOverride : ''}
                            onChange={(e) => updateModelItem(index, 'priceOverride', e.target.value)}
                            placeholder={model ? `${formatCurrency(tierUnitPrice)} (auto)` : 'Select model'}
                          />
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Line Total</p>
                          <p className="font-semibold tabular-nums text-accent">{formatCurrency(isZeroValueType ? 0 : lineTotal)}</p>
                        </div>
                      </div>

                      {model && (
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} × {formatCurrency(unitPrice)}
                          {isManual
                            ? <span className="text-accent"> · manual price</span>
                            : <> · {defaultTierNames[tierIndex]}</>}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Running summary */}
              <div className="pt-4 mt-4 border-t flex items-end justify-between">
                <span className="text-sm text-muted-foreground">
                  {totalUnits} {totalUnits === 1 ? 'unit' : 'units'}
                  {validItemCount > 0 && <> · {validItemCount} {validItemCount === 1 ? 'model' : 'models'}</>}
                </span>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order Total</p>
                  <p className="text-2xl font-bold text-accent leading-tight">
                    {formatCurrency(orderTotal)}
                    {isZeroValueType && <span className="ml-1.5 text-xs font-normal text-muted-foreground align-middle">({orderType})</span>}
                  </p>
                </div>
              </div>
            </section>

            {/* Documents */}
            <section className="content-card p-6">
              <h2 className="section-header">Documents</h2>
              <div className="grid gap-1.5">
                <Label htmlFor="invoice" className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Invoice URL <span className="font-normal opacity-70">(optional)</span>
                </Label>
                <Input
                  id="invoice"
                  value={invoice}
                  onChange={(e) => setInvoice(e.target.value)}
                  placeholder="https://…"
                />
                <p className="text-xs text-muted-foreground">Tracking links and file uploads can be added after the order is created.</p>
              </div>
            </section>
          </div>

          {/* Pinned footer */}
          <div className="shrink-0 pt-4 border-t border-border flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {isZeroValueType ? `${orderType} order — $0` : <>Total <span className="font-semibold text-foreground tabular-nums">{formatCurrency(orderTotal)}</span></>}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Creating…' : 'Create Order'}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddOrderDialog;
