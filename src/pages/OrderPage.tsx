import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowLeft, Package, Building2, Truck, FileText, Save, Calendar, Hash, Tag } from 'lucide-react';
import { orders, Order, getStatusColor } from '@/data/orders';
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

const OrderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const order = orders.find(o => o.id === id);

  const [formData, setFormData] = useState<Order | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (order) {
      setFormData({ ...order });
    }
  }, [order]);

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
    // In a real app, this would update the database
    // For now, we just show a toast
    toast({
      title: 'Order updated',
      description: 'Your changes have been saved.',
    });
    setIsEditing(false);
  };

  const handleChange = (field: keyof Order, value: string) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : null);
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
                {isEditing ? (
                  <Input 
                    type="number"
                    value={formData.units}
                    onChange={(e) => handleChange('units', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <p className="font-medium flex items-center gap-2">
                    <Hash className="w-4 h-4 text-muted-foreground" />
                    {formData.units} units
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Model Type</Label>
                {isEditing ? (
                  <Input 
                    value={formData.modelType}
                    onChange={(e) => handleChange('modelType', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <p className="font-medium flex items-center gap-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    {formData.modelType}
                  </p>
                )}
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

          {/* Links & Tracking */}
          <section className="content-card p-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <h2 className="section-header">Links & Tracking</h2>
            <div className="space-y-4">
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
          <section className="content-card p-6 animate-fade-in lg:col-span-2" style={{ animationDelay: '150ms' }}>
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
