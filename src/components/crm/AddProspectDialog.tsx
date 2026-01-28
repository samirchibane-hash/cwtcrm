import { useState } from 'react';
import { Plus } from 'lucide-react';
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
import { useProspects } from '@/context/ProspectsContext';
import { useToast } from '@/hooks/use-toast';
import { CompanyType, MarketType } from '@/data/prospects';

const AddProspectDialog = () => {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [state, setState] = useState('');
  const [type, setType] = useState<CompanyType | ''>('');
  const [marketType, setMarketType] = useState<MarketType | ''>('');
  const [stage, setStage] = useState('');
  const [linkedIn, setLinkedIn] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addProspect } = useProspects();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!companyName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Company name is required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const result = await addProspect({
      companyName: companyName.trim(),
      state: state.trim(),
      type: type || '',
      marketType: marketType || '',
      stage: stage || 'Contact Made',
      lastContact: new Date().toLocaleDateString('en-US'),
      engagementNotes: '',
      linkedIn: linkedIn.trim(),
      contacts: [],
      engagements: [],
    });
    setIsSubmitting(false);

    if (result) {
      toast({
        title: 'Success',
        description: `${companyName} has been added.`,
      });
      // Reset form
      setCompanyName('');
      setState('');
      setType('');
      setMarketType('');
      setStage('');
      setLinkedIn('');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Prospect
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Prospect</DialogTitle>
          <DialogDescription>
            Create a new prospect company. You can add contacts and more details later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter company name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="state">State/Location</Label>
              <Input
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. CA, TX"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Company Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as CompanyType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OEM">OEM</SelectItem>
                  <SelectItem value="Distributor">Distributor</SelectItem>
                  <SelectItem value="eCommerce">eCommerce</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="marketType">Market Type</Label>
              <Select value={marketType} onValueChange={(value) => setMarketType(value as MarketType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select market" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Residential">Residential</SelectItem>
                  <SelectItem value="Commercial">Commercial</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stage">Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Contact Made">Contact Made</SelectItem>
                  <SelectItem value="Quotes">Quotes</SelectItem>
                  <SelectItem value="No Current Interest">No Current Interest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="linkedIn">LinkedIn URL</Label>
            <Input
              id="linkedIn"
              value={linkedIn}
              onChange={(e) => setLinkedIn(e.target.value)}
              placeholder="https://linkedin.com/company/..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add Prospect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddProspectDialog;
