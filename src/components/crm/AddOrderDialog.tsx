import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrders } from '@/context/OrdersContext';
import { useProductModels } from '@/context/ProductModelsContext';
import { useProspects } from '@/context/ProspectsContext';
import { useToast } from '@/hooks/use-toast';
import { Order, OrderModelItem, OrderType } from '@/data/orders';

interface AddOrderDialogProps {
  defaultCompanyName?: string;
  defaultCompanyId?: string;
  trigger?: React.ReactNode;
  onOrderCreated?: () => void;
}

const AddOrderDialog = ({ 
  defaultCompanyName, 
  defaultCompanyId,
  trigger,
  onOrderCreated 
}: AddOrderDialogProps = {}) => {
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState(defaultCompanyName || '');
  const [companyId, setCompanyId] = useState(defaultCompanyId || '');
  const [placed, setPlaced] = useState(new Date().toLocaleDateString('en-US'));
  const [status, setStatus] = useState<Order['status']>('PO/Invoice');
  const [orderType, setOrderType] = useState<OrderType>('Standard');
  const [invoice, setInvoice] = useState('');
  const [modelItems, setModelItems] = useState<Array<{ modelName: string; quantity: number; priceOverride?: number }>>([
    { modelName: '', quantity: 1 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addOrder } = useOrders();
  const { models: productModels } = useProductModels();
  const { prospects } = useProspects();
  const { toast } = useToast();

  // Reset form when dialog opens (with defaults)
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
      updated[index].priceOverride = value === '' ? undefined : Number(value);
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

  const handleSubmit = async () => {
    if (!customer.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Customer name is required.',
        variant: 'destructive',
      });
      return;
    }

    const validItems = modelItems.filter(item => item.modelName && item.quantity > 0);
    if (validItems.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'At least one model item is required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    const orderModelItems: OrderModelItem[] = validItems.map(item => ({
      modelName: item.modelName,
      quantity: item.quantity,
      priceOverride: item.priceOverride,
    }));

    const totalUnits = orderModelItems.reduce((sum, item) => sum + item.quantity, 0);
    const modelType = orderModelItems.map(item => `${item.quantity}x ${item.modelName}`).join(', ');

    const result = await addOrder({
      customer: customer.trim(),
      companyId: companyId || undefined,
      placed,
      units: totalUnits,
      modelType,
      modelItems: orderModelItems,
      totalValue: 0, // Will be calculated by context
      invoice: invoice.trim(),
      status,
      tracking: '',
      orderUpdates: '',
      orderType,
    });

    setIsSubmitting(false);

    if (result) {
      toast({
        title: 'Success',
        description: `Order for ${customer} has been created.`,
      });
      // Reset form
      setCustomer('');
      setCompanyId('');
      setPlaced(new Date().toLocaleDateString('en-US'));
      setStatus('PO/Invoice');
      setOrderType('Standard');
      setInvoice('');
      setModelItems([{ modelName: '', quantity: 1 }]);
      setOpen(false);
      onOrderCreated?.();
    }
  };

  const hasDefaultCompany = Boolean(defaultCompanyName);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Order
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Order</DialogTitle>
          <DialogDescription>
            Add a new order with product models and quantities.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {!hasDefaultCompany && (
            <div className="grid gap-2">
              <Label htmlFor="company">Link to Company (Optional)</Label>
              <Select value={companyId} onValueChange={handleCompanySelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company or enter manually" />
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

          <div className="grid gap-2">
            <Label htmlFor="customer">Customer Name *</Label>
            <Input
              id="customer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Enter customer name"
              disabled={hasDefaultCompany}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="placed">Date Placed</Label>
              <Input
                id="placed"
                value={placed}
                onChange={(e) => setPlaced(e.target.value)}
                placeholder="MM/DD/YYYY"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="orderType">Order Type</Label>
              <Select value={orderType} onValueChange={(value) => setOrderType(value as OrderType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Sample">Sample</SelectItem>
                  <SelectItem value="Replacement">Replacement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as Order['status'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PO/Invoice">PO/Invoice</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Partially Shipped">Partially Shipped</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                  <SelectItem value="Loaner">Loaner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invoice">Invoice URL</Label>
              <Input
                id="invoice"
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Product Models *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addModelItem}>
                <Plus className="h-3 w-3 mr-1" />
                Add Item
              </Button>
            </div>
            <div className="space-y-3">
              {modelItems.map((item, index) => (
                <div key={index} className="space-y-2 p-3 rounded-lg border bg-muted/30">
                  <div className="flex gap-2 items-center">
                    <Select
                      value={item.modelName}
                      onValueChange={(value) => updateModelItem(index, 'modelName', value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {productModels.map((model) => (
                          <SelectItem key={model.id} value={model.name}>
                            {model.name}
                          </SelectItem>
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
                    />
                    {modelItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeModelItem(index)}
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Price/unit ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.priceOverride !== undefined ? item.priceOverride : ''}
                      onChange={(e) => updateModelItem(index, 'priceOverride', e.target.value)}
                      placeholder="Auto from tier"
                      className="flex-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddOrderDialog;
