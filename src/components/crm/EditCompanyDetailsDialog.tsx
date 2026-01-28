import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { CompanyType, MarketType, COMPANY_TYPES, MARKET_TYPES } from '@/data/prospects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const PIPELINE_STAGES = [
  'New Lead',
  'Contact Made',
  'Disco Call',
  'Quotes',
  'Negotiation',
  'Closed Won',
  'No Current Interest',
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'USA', 'Canada',
];

interface CompanyDetails {
  companyName: string;
  companyType: CompanyType;
  marketType: MarketType;
  state: string;
  stage: string;
  linkedIn: string;
}

interface EditCompanyDetailsDialogProps {
  currentDetails: CompanyDetails;
  onSave: (details: CompanyDetails) => void;
}

const NONE_VALUE = '__none__';

const EditCompanyDetailsDialog = ({ currentDetails, onSave }: EditCompanyDetailsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<CompanyDetails>(currentDetails);
  const { toast } = useToast();

  const handleSave = () => {
    if (!details.companyName.trim()) {
      toast({
        title: 'Company name required',
        description: 'Please enter a company name.',
        variant: 'destructive',
      });
      return;
    }
    onSave(details);
    toast({
      title: 'Company details updated',
      description: 'All changes have been saved.',
    });
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setDetails(currentDetails);
    }
  };

  const updateField = <K extends keyof CompanyDetails>(field: K, value: CompanyDetails[K]) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

  // Convert empty string to NONE_VALUE for Select, and back
  const toSelectValue = (val: string) => val === '' ? NONE_VALUE : val;
  const fromSelectValue = (val: string) => val === NONE_VALUE ? '' : val;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Pencil className="w-4 h-4" />
          Edit Details
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit Company Details</DialogTitle>
          <DialogDescription>
            Update the company information and classification.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={details.companyName}
              onChange={(e) => updateField('companyName', e.target.value)}
              placeholder="Enter company name"
              className="rounded-xl"
            />
          </div>

          {/* Company Type */}
          <div className="space-y-2">
            <Label>Company Type</Label>
            <Select 
              value={toSelectValue(details.companyType)} 
              onValueChange={(value) => updateField('companyType', fromSelectValue(value) as CompanyType)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select company type" />
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
          
          {/* Market Type */}
          <div className="space-y-2">
            <Label>Market Type</Label>
            <Select 
              value={toSelectValue(details.marketType)} 
              onValueChange={(value) => updateField('marketType', fromSelectValue(value) as MarketType)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select market type" />
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

          {/* Location */}
          <div className="space-y-2">
            <Label>Location</Label>
            <Select 
              value={toSelectValue(details.state)} 
              onValueChange={(value) => updateField('state', fromSelectValue(value))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-background max-h-[200px]">
                <SelectItem value={NONE_VALUE}>Not specified</SelectItem>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pipeline Stage */}
          <div className="space-y-2">
            <Label>Pipeline Stage</Label>
            <Select 
              value={toSelectValue(details.stage)} 
              onValueChange={(value) => updateField('stage', fromSelectValue(value))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select pipeline stage" />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-background">
                <SelectItem value={NONE_VALUE}>Not set</SelectItem>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* LinkedIn */}
          <div className="space-y-2">
            <Label htmlFor="linkedIn">LinkedIn URL</Label>
            <Input
              id="linkedIn"
              value={details.linkedIn}
              onChange={(e) => updateField('linkedIn', e.target.value)}
              placeholder="https://linkedin.com/company/..."
              className="rounded-xl"
            />
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

export default EditCompanyDetailsDialog;
