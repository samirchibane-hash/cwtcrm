import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { CompanyType, MarketType, COMPANY_TYPES, MARKET_TYPES } from '@/data/prospects';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface EditCompanyTypeDialogProps {
  currentType: CompanyType;
  currentMarketType: MarketType;
  onSave: (type: CompanyType, marketType: MarketType) => void;
}

const NONE_VALUE = '__none__';

const EditCompanyTypeDialog = ({ currentType, currentMarketType, onSave }: EditCompanyTypeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CompanyType>(currentType);
  const [marketType, setMarketType] = useState<MarketType>(currentMarketType);
  const { toast } = useToast();

  const handleSave = () => {
    onSave(type, marketType);
    toast({
      title: 'Classification updated',
      description: 'The business model and product vertical have been updated.',
    });
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setType(currentType);
      setMarketType(currentMarketType);
    }
  };

  const toSelectValue = (val: string) => val === '' ? NONE_VALUE : val;
  const fromSelectValue = (val: string) => val === NONE_VALUE ? '' : val;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit Company Classification</DialogTitle>
          <DialogDescription>
            Update the business model and product vertical for this prospect.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Business Model</Label>
            <Select 
              value={toSelectValue(type)} 
              onValueChange={(value) => setType(fromSelectValue(value) as CompanyType)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select business model" />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-background">
                <SelectItem value={NONE_VALUE}>None</SelectItem>
                {COMPANY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Product Vertical</Label>
            <Select 
              value={toSelectValue(marketType)} 
              onValueChange={(value) => setMarketType(fromSelectValue(value) as MarketType)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select product vertical" />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-background">
                <SelectItem value={NONE_VALUE}>None</SelectItem>
                {MARKET_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={handleSave} className="rounded-xl">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditCompanyTypeDialog;
