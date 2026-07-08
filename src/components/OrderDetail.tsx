import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Building2, Truck, FileText, Save, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Order, OrderModelItem, OrderType, getStatusColor, formatCurrency } from '@/data/orders';
import { defaultTierNames } from '@/data/productModels';
import { useProductModels } from '@/context/ProductModelsContext';
import { useOrders } from '@/context/OrdersContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

// Get pricing tier index based on quantity
const getTierIndex = (quantity: number): number => {
  if (quantity >= 100) return 4;
  if (quantity >= 51) return 3;
  if (quantity >= 26) return 2;
  if (quantity >= 11) return 1;
  return 0;
};

// Format a stored "M/D/YYYY" date into a readable label
const formatPlacedDate = (value: string): string => {
  const [m, d, y] = value.split('/').map(Number);
  if (!m || !d || !y) return value;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

interface EditableModelItem extends OrderModelItem {
  tierOverride?: number; // Allow manual tier selection
  priceOverride?: number; // Allow fully manual price per unit
}

interface OrderDetailProps {
  orderId: string;
  /** `page` = standalone route, `panel` = inside a slide-over Sheet */
  variant?: 'page' | 'panel';
  /** Called after the order is deleted (page navigates away, panel closes) */
  onDeleted?: () => void;
  /** Whether the customer name links to the company profile (off inside the company's own panel) */
  linkCustomer?: boolean;
}

const OrderDetail = ({ orderId, variant = 'page', onDeleted, linkCustomer = true }: OrderDetailProps) => {
  const { toast } = useToast();
  const { models: productModels, getModelByName } = useProductModels();
  const { getOrderById, updateOrder, deleteOrder } = useOrders();

  // Calculate item value: priceOverride > tierOverride > auto tier
  const calculateItemValue = (modelName: string, quantity: number, tierOverride?: number, priceOverride?: number): number => {
    if (priceOverride !== undefined && priceOverride >= 0) {
      return priceOverride * quantity;
    }
    const model = getModelByName(modelName);
    if (!model) return 0;
    const tierIndex = tierOverride !== undefined ? tierOverride : getTierIndex(quantity);
    const unitPrice = model.pricingTiers[tierIndex]?.price || 0;
    return unitPrice * quantity;
  };

  const order = getOrderById(orderId);

  const [formData, setFormData] = useState<Order | null>(null);
  const [modelItems, setModelItems] = useState<EditableModelItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (order) {
      setFormData({ ...order });
      // IMPORTANT: preserve any saved manual pricing tier overrides
      setModelItems(order.modelItems.map(item => ({ ...item })));
      setIsEditing(false);
    }
  }, [order]);

  // Calculate total value from model items (Sample/Replacement = $0)
  const rawTotalValue = modelItems.reduce((total, item) => {
    return total + calculateItemValue(item.modelName, item.quantity, item.tierOverride, item.priceOverride);
  }, 0);

  const isZeroValueType = formData?.orderType === 'Sample' || formData?.orderType === 'Replacement';
  const calculatedTotalValue = isZeroValueType ? 0 : rawTotalValue;

  // Calculate total units
  const totalUnits = modelItems.reduce((sum, item) => sum + item.quantity, 0);

  if (!order || !formData) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-xl font-semibold mb-1">Order not found</h2>
          <p className="text-sm text-muted-foreground">This order may have been deleted.</p>
        </div>
      </div>
    );
  }

  const statusColors = getStatusColor(formData.status);
  const isSpecialType = formData.orderType && formData.orderType !== 'Standard';

  const handleSave = () => {
    const updatedOrder: Order = {
      ...formData,
      units: totalUnits,
      modelItems: modelItems.map(({ quantity, modelName, tierOverride, priceOverride }) => ({
        quantity,
        modelName,
        tierOverride,
        priceOverride,
      })),
      totalValue: calculatedTotalValue,
      modelType: modelItems.map(item => `${item.quantity}x ${item.modelName}`).join(', ')
    };
    setFormData(updatedOrder);
    updateOrder(updatedOrder);
    toast({ title: 'Order updated', description: 'Your changes have been saved.' });
    setIsEditing(false);
  };

  const handleChange = (field: keyof Order, value: string) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleModelItemChange = (index: number, field: keyof EditableModelItem, value: string | number) => {
    setModelItems(prev => {
      const updated = [...prev];
      if (field === 'quantity') {
        updated[index] = { ...updated[index], quantity: Number(value) || 0 };
      } else if (field === 'modelName') {
        updated[index] = { ...updated[index], modelName: String(value) };
      } else if (field === 'tierOverride') {
        updated[index] = { ...updated[index], tierOverride: value === 'auto' ? undefined : Number(value) };
      } else if (field === 'priceOverride') {
        const num = value === '' ? undefined : Number(value);
        updated[index] = { ...updated[index], priceOverride: num };
      }
      return updated;
    });
  };

  const addModelItem = () => {
    setModelItems(prev => [...prev, { quantity: 1, modelName: productModels[0]?.name || '2 GPM' }]);
  };

  const removeModelItem = (index: number) => {
    setModelItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleDelete = () => {
    deleteOrder(order.id);
    toast({ title: 'Order deleted', description: `The order for ${order.customer} has been removed.` });
    onDeleted?.();
  };

  const handleOrderTypeChange = (value: string) => {
    const orderType = value === 'Standard' ? undefined : value as OrderType;
    setFormData(prev => prev ? { ...prev, orderType } : null);
  };

  const cancelEdit = () => {
    setFormData({ ...order });
    setModelItems(order.modelItems.map(item => ({ ...item })));
    setIsEditing(false);
  };

  const isPanel = variant === 'panel';
  const showCustomer = !isPanel; // panel is already scoped to the company

  // ---- Header: date-led identity + status, plus edit/save/delete actions ----
  const header = (
    <div className={isPanel ? 'flex flex-col gap-4 pr-8' : 'flex items-start justify-between gap-4'}>
      <div className="flex items-center gap-4 min-w-0">
        <div className={`${isPanel ? 'w-11 h-11 rounded-xl' : 'w-14 h-14 rounded-2xl'} bg-muted flex items-center justify-center shrink-0`}>
          <Package className={isPanel ? 'w-5 h-5 text-muted-foreground' : 'w-7 h-7 text-muted-foreground'} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order</p>
          <h1 className={`${isPanel ? 'text-xl' : 'text-2xl'} font-semibold tracking-tight truncate`}>
            {formatPlacedDate(formData.placed)}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {showCustomer && (
              linkCustomer && formData.companyId ? (
                <Link to={`/company/${formData.companyId}`} className="flex items-center gap-1.5 text-sm text-accent hover:underline">
                  <Building2 className="w-3.5 h-3.5" />
                  {formData.customer}
                </Link>
              ) : (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5" />
                  {formData.customer}
                </span>
              )
            )}
            <Badge variant="secondary" className={`${statusColors.bg} ${statusColors.text} border-0`}>
              {formData.status}
            </Badge>
            {isSpecialType && (
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-0">
                {formData.orderType}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isEditing ? (
          <>
            <Button variant="outline" size="sm" onClick={cancelEdit}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </>
        ) : (
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Delete this order?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the {formatPlacedDate(formData.placed)} order for {formData.customer}. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button size="sm" onClick={() => setIsEditing(true)}>Edit Order</Button>
          </>
        )}
      </div>
    </div>
  );

  // ---- Editable metadata (only shown in edit mode; view mode reads it off the header) ----
  const metadataCard = (
    <section className="content-card p-6">
      <h2 className="section-header">Details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Customer</Label>
          <Input value={formData.customer} onChange={(e) => handleChange('customer', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Date Placed</Label>
          <Input value={formData.placed} onChange={(e) => handleChange('placed', e.target.value)} className="mt-1" placeholder="MM/DD/YYYY" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Order Type</Label>
          <Select value={formData.orderType || 'Standard'} onValueChange={handleOrderTypeChange}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Standard">Standard</SelectItem>
              <SelectItem value="Sample">Sample ($0)</SelectItem>
              <SelectItem value="Replacement">Replacement ($0)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Delivered">Delivered</SelectItem>
              <SelectItem value="Partially Shipped">Partially Shipped</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="PO/Invoice">PO/Invoice</SelectItem>
              <SelectItem value="Loaner">Loaner</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );

  // ---- Products: the single source of truth for models, units and pricing ----
  const productsCard = (
    <section className="content-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-header mb-0">Products</h2>
        {isEditing && (
          <Button size="sm" variant="outline" onClick={addModelItem}>
            <Plus className="w-4 h-4 mr-1" />
            Add Model
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {modelItems.map((item, index) => {
          const model = productModels.find(m => item.modelName.toLowerCase().includes(m.name.toLowerCase()));
          const effectiveTier = item.tierOverride !== undefined ? item.tierOverride : getTierIndex(item.quantity);
          const tierUnitPrice = model?.pricingTiers[effectiveTier]?.price || 0;
          const unitPrice = item.priceOverride !== undefined ? item.priceOverride : tierUnitPrice;
          const itemTotal = calculateItemValue(item.modelName, item.quantity, item.tierOverride, item.priceOverride);

          return (
            <div key={index} className="p-4 rounded-lg border bg-muted/30">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Item {index + 1}</Label>
                    {modelItems.length > 1 && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => removeModelItem(index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Model</Label>
                      <Select value={model?.name || item.modelName} onValueChange={(value) => handleModelItemChange(index, 'modelName', value)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {productModels.map(pm => (
                            <SelectItem key={pm.id} value={pm.name}>{pm.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Quantity</Label>
                      <Input type="number" min="1" value={item.quantity} onChange={(e) => handleModelItemChange(index, 'quantity', e.target.value)} className="mt-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Pricing Tier</Label>
                      <Select
                        value={item.tierOverride !== undefined ? String(item.tierOverride) : 'auto'}
                        onValueChange={(value) => handleModelItemChange(index, 'tierOverride', value)}
                        disabled={item.priceOverride !== undefined}
                      >
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto (by quantity)</SelectItem>
                          {defaultTierNames.map((tierName, tierIndex) => (
                            <SelectItem key={tierIndex} value={String(tierIndex)}>
                              {tierName} — {model ? formatCurrency(model.pricingTiers[tierIndex]?.price || 0) : 'N/A'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Manual Price/Unit
                        {item.priceOverride !== undefined && (
                          <button className="ml-2 text-accent hover:underline font-normal" onClick={() => handleModelItemChange(index, 'priceOverride', '')} type="button">
                            (clear)
                          </button>
                        )}
                      </Label>
                      <Input
                        type="number" min="0" step="0.01"
                        value={item.priceOverride !== undefined ? item.priceOverride : ''}
                        onChange={(e) => handleModelItemChange(index, 'priceOverride', e.target.value)}
                        className="mt-1"
                        placeholder={`$${tierUnitPrice} (tier)`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm text-muted-foreground">
                      {item.quantity} × {formatCurrency(unitPrice)}
                      {item.priceOverride !== undefined && <span className="ml-1 text-accent">(manual)</span>}
                    </span>
                    <span className="font-semibold text-accent">{formatCurrency(itemTotal)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.quantity} × {item.modelName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.priceOverride !== undefined
                        ? `Manual @ ${formatCurrency(item.priceOverride)}/unit`
                        : `${defaultTierNames[effectiveTier]} @ ${formatCurrency(tierUnitPrice)}/unit`}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums shrink-0">{formatCurrency(itemTotal)}</span>
                </div>
              )}
            </div>
          );
        })}

        {modelItems.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No product models</p>
            {isEditing && (
              <Button size="sm" variant="link" onClick={addModelItem}>Add a model</Button>
            )}
          </div>
        )}

        {/* Summary: units + single order total */}
        <div className="pt-4 border-t flex items-end justify-between">
          <span className="text-sm text-muted-foreground">
            {totalUnits} {totalUnits === 1 ? 'unit' : 'units'}
          </span>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order Total</p>
            <p className="text-2xl font-bold text-accent leading-tight">
              {formatCurrency(calculatedTotalValue)}
              {isZeroValueType && <span className="ml-1.5 text-xs font-normal text-muted-foreground align-middle">({formData.orderType})</span>}
            </p>
          </div>
        </div>
      </div>
    </section>
  );

  // ---- Links & Tracking (view mode only rendered when there's something to show) ----
  const hasLinks = (formData.invoice && formData.invoice.startsWith('http')) || !!formData.tracking;
  const linksCard = (isEditing || hasLinks) ? (
    <section className="content-card p-6">
      <h2 className="section-header">Links & Tracking</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Invoice</Label>
          {isEditing ? (
            <Input value={formData.invoice} onChange={(e) => handleChange('invoice', e.target.value)} className="mt-1" placeholder="https://..." />
          ) : formData.invoice && formData.invoice.startsWith('http') ? (
            <a href={formData.invoice} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-accent hover:underline mt-1">
              <FileText className="w-4 h-4" />
              View Invoice
            </a>
          ) : (
            <p className="text-muted-foreground text-sm mt-1">{formData.invoice || 'No invoice'}</p>
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Tracking</Label>
          {isEditing ? (
            <Input value={formData.tracking} onChange={(e) => handleChange('tracking', e.target.value)} className="mt-1" placeholder="https://..." />
          ) : formData.tracking ? (
            <a href={formData.tracking} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-accent hover:underline mt-1">
              <Truck className="w-4 h-4" />
              Track Shipment
            </a>
          ) : (
            <p className="text-muted-foreground text-sm mt-1">No tracking info</p>
          )}
        </div>
      </div>
    </section>
  ) : null;

  // ---- Order updates / notes ----
  const notesCard = (
    <section className="content-card p-6">
      <h2 className="section-header">Order Updates</h2>
      {isEditing ? (
        <Textarea value={formData.orderUpdates} onChange={(e) => handleChange('orderUpdates', e.target.value)} className="min-h-[120px]" placeholder="Add notes about this order..." />
      ) : (
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {formData.orderUpdates || 'No updates yet'}
        </p>
      )}
    </section>
  );

  const content = (
    <div className={isPanel ? 'space-y-6' : 'space-y-8'}>
      {isEditing && metadataCard}
      {productsCard}
      {linksCard}
      {notesCard}
    </div>
  );

  if (isPanel) {
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0 pb-5 border-b border-border">{header}</div>
        <div className="flex-1 overflow-y-auto -mx-6 px-6 pt-6">{content}</div>
      </div>
    );
  }

  return (
    <>
      {header}
      <div className="mt-8 max-w-3xl">{content}</div>
    </>
  );
};

export default OrderDetail;
