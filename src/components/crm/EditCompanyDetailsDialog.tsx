import { useState } from 'react';
import { Pencil, X, Plus } from 'lucide-react';
import { CompanyType, MarketType, COMPANY_TYPES, MARKET_TYPES, PIPELINE_STAGES, getStageColor } from '@/data/prospects';
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
  website?: string;
}

interface EditCompanyDetailsDialogProps {
  currentDetails: CompanyDetails;
  onSave: (details: CompanyDetails) => void;
}

const NONE_VALUE = '__none__';
const ADD_NEW_VALUE = '__add_new__';

const EditCompanyDetailsDialog = ({ currentDetails, onSave }: EditCompanyDetailsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<CompanyDetails>(currentDetails);
  const [stageInput, setStageInput] = useState('');
  const [customMarketTypes, setCustomMarketTypes] = useState<string[]>([]);
  const [newMarketType, setNewMarketType] = useState('');
  const [showNewMarketInput, setShowNewMarketInput] = useState(false);
  const { toast } = useToast();

  // Parse stages from comma-separated string
  const selectedStages = details.stage ? details.stage.split(',').map(s => s.trim()).filter(Boolean) : [];

  // Combine built-in and custom market types
  const allMarketTypes = [...MARKET_TYPES, ...customMarketTypes.filter(mt => !MARKET_TYPES.includes(mt as MarketType))];

  const addStage = (stage: string) => {
    if (!selectedStages.includes(stage)) {
      const newStages = [...selectedStages, stage];
      setDetails(prev => ({ ...prev, stage: newStages.join(', ') }));
    }
    setStageInput('');
  };

  const removeStage = (stage: string) => {
    const newStages = selectedStages.filter(s => s !== stage);
    setDetails(prev => ({ ...prev, stage: newStages.join(', ') }));
  };

  const handleAddNewMarketType = () => {
    if (newMarketType.trim()) {
      const trimmed = newMarketType.trim();
      if (!customMarketTypes.includes(trimmed) && !MARKET_TYPES.includes(trimmed as MarketType)) {
        setCustomMarketTypes(prev => [...prev, trimmed]);
      }
      setDetails(prev => ({ ...prev, marketType: trimmed as MarketType }));
      setNewMarketType('');
      setShowNewMarketInput(false);
      toast({
        title: 'Market type added',
        description: `"${trimmed}" has been added and selected.`,
      });
    }
  };

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
      setShowNewMarketInput(false);
      setNewMarketType('');
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
          
          {/* Market Type with Add New option */}
          <div className="space-y-2">
            <Label>Market Type</Label>
            {showNewMarketInput ? (
              <div className="flex gap-2">
                <Input
                  value={newMarketType}
                  onChange={(e) => setNewMarketType(e.target.value)}
                  placeholder="Enter new market type"
                  className="rounded-xl flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewMarketType();
                    }
                  }}
                  autoFocus
                />
                <Button size="sm" onClick={handleAddNewMarketType} className="rounded-xl">
                  Add
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setShowNewMarketInput(false);
                    setNewMarketType('');
                  }}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Select 
                value={toSelectValue(details.marketType)} 
                onValueChange={(value) => {
                  if (value === ADD_NEW_VALUE) {
                    setShowNewMarketInput(true);
                  } else {
                    updateField('marketType', fromSelectValue(value) as MarketType);
                  }
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select market type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-background">
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {allMarketTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                  <SelectItem value={ADD_NEW_VALUE} className="text-accent">
                    <span className="flex items-center gap-2">
                      <Plus className="w-3 h-3" />
                      Add new market type...
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
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

          {/* Pipeline Stages (Multi-select) */}
          <div className="space-y-2">
            <Label>Pipeline Stages</Label>
            {/* Selected stages */}
            {selectedStages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedStages.map((stage) => {
                  const colors = getStageColor(stage);
                  return (
                    <span
                      key={stage}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                    >
                      {stage}
                      <button
                        type="button"
                        onClick={() => removeStage(stage)}
                        className="hover:opacity-70 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            {/* Add stage dropdown */}
            <Select
              value={stageInput}
              onValueChange={(value) => {
                if (value && value !== NONE_VALUE) {
                  addStage(value);
                }
              }}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Add a stage..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-background">
                {PIPELINE_STAGES.filter(s => !selectedStages.includes(s)).map((s) => (
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

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={details.website || ''}
              onChange={(e) => updateField('website', e.target.value)}
              placeholder="https://example.com"
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