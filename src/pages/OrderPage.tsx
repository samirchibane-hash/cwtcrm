import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowLeft, Package, Building2, Truck, FileText, Save, Calendar, Hash, Tag, DollarSign, Plus, Trash2 } from 'lucide-react';
import { Order, OrderModelItem, getStatusColor, formatCurrency } from '@/data/orders';
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
import { useToast } from '@/hooks/use-toast';

// Get pricing tier index based on quantity
const getTierIndex = (quantity: number): number => {
  if (quantity >= 100) return 4;
  if (quantity >= 51) return 3;
  if (quantity >= 26) return 2;
  if (quantity >= 11) return 1;
  return 0;
};

interface EditableModelItem extends OrderModelItem {
  tierOverride?: number; // Allow manual tier selection
}

const OrderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { models: productModels, getModelByName } = useProductModels();
  const { getOrderById, updateOrder } = useOrders();

  // Calculate item value based on model, tier, and quantity
  const calculateItemValue = (modelName: string, quantity: number, tierOverride?: number): number => {
    const model = getModelByName(modelName);
    if (!model) return 0;
    
    const tierIndex = tierOverride !== undefined ? tierOverride : getTierIndex(quantity);
    const unitPrice = model.pricingTiers[tierIndex]?.price || 0;
    return unitPrice * quantity;
  };

  const order = getOrderById(id || '');

  const [formData, setFormData] = useState<Order | null>(null);
  const [modelItems, setModelItems] = useState<EditableModelItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (order) {
      setFormData({ ...order });
      // IMPORTANT: preserve any saved manual pricing tier overrides
      setModelItems(order.modelItems.map(item => ({ ...item })));
    }
  }, [order]);

  // Calculate total value from model items
  const calculatedTotalValue = modelItems.reduce((total, item) => {
    return total + calculateItemValue(item.modelName, item.quantity, item.tierOverride);
  }, 0);

  // Calculate total units
  const totalUnits = modelItems.reduce((sum, item) => sum + item.quantity, 0);

  if (!order || !formData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h1 className="text-2xl font-semibold mb-2">Order not found</h1>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  const statusColors = getStatusColor(formData.status);

  const handleSave = () => {
    // Update formData with calculated values
    const updatedOrder: Order = {
      ...formData,
      units: totalUnits,
      modelItems: modelItems.map(({ quantity, modelName, tierOverride }) => ({
        quantity,
        modelName,
        tierOverride,
      })),
      totalValue: calculatedTotalValue,
      modelType: modelItems.map(item => `${item.quantity}x ${item.modelName}`).join(', ')
    };
    setFormData(updatedOrder);
    
    // Persist to context (and localStorage)
    updateOrder(updatedOrder);
    
    toast({
      title: 'Order updated',
      description: 'Your changes have been saved.',
    });
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Orders</span>
          </button>
          
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <Package className="w-7 h-7 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Order #{formData.id}</h1>
                <div className="flex items-center gap-3 mt-1">
                  {formData.companyId ? (
                    <Link 
                      to={`/company/${formData.companyId}`}
                      className="flex items-center gap-1.5 text-accent hover:underline"
                    >
                      <Building2 className="w-4 h-4" />
                      {formData.customer}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                      {formData.customer}
                    </span>
                  )}
                  <Badge variant="secondary" className={`${statusColors.bg} ${statusColors.text} border-0`}>
                    {formData.status}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                <Button variant="outline" size="sm" onClick={() => {
                    setFormData({ ...order });
                    setModelItems(order.modelItems.map(item => ({ ...item })));
                    setIsEditing(false);
                  }}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => setIsEditing(true)}>
                  Edit Order
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Details */}
          <section className="content-card p-6 animate-fade-in">
            <h2 className="section-header">Order Details</h2>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Customer</Label>
                {isEditing ? (
                  <Input 
                    value={formData.customer}
                    onChange={(e) => handleChange('customer', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <p className="font-medium">{formData.customer}</p>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Date Placed</Label>
                {isEditing ? (
                  <Input 
                    value={formData.placed}
                    onChange={(e) => handleChange('placed', e.target.value)}
                    className="mt-1"
                    placeholder="MM/DD/YYYY"
                  />
                ) : (
                  <p className="font-medium font-mono flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {formData.placed}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Units</Label>
                <p className="font-medium flex items-center gap-2">
                  <Hash className="w-4 h-4 text-muted-foreground" />
                  {totalUnits} units
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Model Type</Label>
                <p className="font-medium flex items-center gap-2">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  {formData.modelType}
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Total Value</Label>
                <p className="font-medium text-lg flex items-center gap-2 text-accent">
                  <DollarSign className="w-4 h-4" />
                  {formatCurrency(calculatedTotalValue)}
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                {isEditing ? (
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => handleChange('status', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Delivered">Delivered</SelectItem>
                      <SelectItem value="Partially Shipped">Partially Shipped</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="PO/Invoice">PO/Invoice</SelectItem>
                      <SelectItem value="Loaner">Loaner</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1">
                    <Badge variant="secondary" className={`${statusColors.bg} ${statusColors.text} border-0`}>
                      {formData.status}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Product Models & Pricing */}
          <section className="content-card p-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-header mb-0">Product Models & Pricing</h2>
              {isEditing && (
                <Button size="sm" variant="outline" onClick={addModelItem}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Model
                </Button>
              )}
            </div>
            
            <div className="space-y-4">
              {modelItems.map((item, index) => {
                const model = productModels.find(m => 
                  item.modelName.toLowerCase().includes(m.name.toLowerCase())
                );
                const effectiveTier = item.tierOverride !== undefined ? item.tierOverride : getTierIndex(item.quantity);
                const unitPrice = model?.pricingTiers[effectiveTier]?.price || 0;
                const itemTotal = calculateItemValue(item.modelName, item.quantity, item.tierOverride);

                return (
                  <div key={index} className="p-4 rounded-lg border bg-muted/30">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Item {index + 1}</Label>
                          {modelItems.length > 1 && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => removeModelItem(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Model</Label>
                            <Select 
                              value={model?.name || item.modelName}
                              onValueChange={(value) => handleModelItemChange(index, 'modelName', value)}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {productModels.map(pm => (
                                  <SelectItem key={pm.id} value={pm.name}>{pm.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label className="text-xs text-muted-foreground">Quantity</Label>
                            <Input 
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleModelItemChange(index, 'quantity', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-xs text-muted-foreground">Pricing Tier</Label>
                          <Select 
                            value={item.tierOverride !== undefined ? String(item.tierOverride) : 'auto'}
                            onValueChange={(value) => handleModelItemChange(index, 'tierOverride', value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto (based on quantity)</SelectItem>
                              {defaultTierNames.map((tierName, tierIndex) => (
                                <SelectItem key={tierIndex} value={String(tierIndex)}>
                                  {tierName} - {model ? formatCurrency(model.pricingTiers[tierIndex]?.price || 0) : 'N/A'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-sm text-muted-foreground">
                            {item.quantity} × {formatCurrency(unitPrice)}
                          </span>
                          <span className="font-semibold text-accent">
                            {formatCurrency(itemTotal)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{item.quantity}x {item.modelName}</p>
                          <p className="text-sm text-muted-foreground">
                            {defaultTierNames[effectiveTier]} @ {formatCurrency(unitPrice)}/unit
                          </p>
                        </div>
                        <span className="font-semibold text-accent">
                          {formatCurrency(itemTotal)}
                        </span>
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
                    <Button size="sm" variant="link" onClick={addModelItem}>
                      Add a model
                    </Button>
                  )}
                </div>
              )}
              
              {/* Total */}
              <div className="pt-4 border-t flex justify-between items-center">
                <span className="font-medium">Order Total</span>
                <span className="text-xl font-bold text-accent">
                  {formatCurrency(calculatedTotalValue)}
                </span>
              </div>
            </div>
          </section>

          {/* Links & Tracking */}
          <section className="content-card p-6 animate-fade-in lg:col-span-2" style={{ animationDelay: '150ms' }}>
            <h2 className="section-header">Links & Tracking</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Invoice URL</Label>
                {isEditing ? (
                  <Input 
                    value={formData.invoice}
                    onChange={(e) => handleChange('invoice', e.target.value)}
                    className="mt-1"
                    placeholder="https://..."
                  />
                ) : formData.invoice && formData.invoice.startsWith('http') ? (
                  <a 
                    href={formData.invoice} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-accent hover:underline mt-1"
                  >
                    <FileText className="w-4 h-4" />
                    View Invoice
                  </a>
                ) : (
                  <p className="text-muted-foreground text-sm mt-1">{formData.invoice || 'No invoice'}</p>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Tracking URL</Label>
                {isEditing ? (
                  <Input 
                    value={formData.tracking}
                    onChange={(e) => handleChange('tracking', e.target.value)}
                    className="mt-1"
                    placeholder="https://..."
                  />
                ) : formData.tracking ? (
                  <a 
                    href={formData.tracking} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-accent hover:underline mt-1"
                  >
                    <Truck className="w-4 h-4" />
                    Track Shipment
                  </a>
                ) : (
                  <p className="text-muted-foreground text-sm mt-1">No tracking info</p>
                )}
              </div>
            </div>
          </section>

          {/* Order Updates / Notes */}
          <section className="content-card p-6 animate-fade-in lg:col-span-2" style={{ animationDelay: '200ms' }}>
            <h2 className="section-header">Order Updates</h2>
            {isEditing ? (
              <Textarea 
                value={formData.orderUpdates}
                onChange={(e) => handleChange('orderUpdates', e.target.value)}
                className="min-h-[120px]"
                placeholder="Add notes about this order..."
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {formData.orderUpdates || 'No updates yet'}
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default OrderPage;
