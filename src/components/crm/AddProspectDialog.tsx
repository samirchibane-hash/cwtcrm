import { useState } from 'react';
import { Plus, X } from 'lucide-react';
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
import { useProductVerticals } from '@/hooks/useProductVerticals';
import { CompanyType, MarketType, LeadTier, PIPELINE_STAGES, COMPANY_TYPES, LEAD_TIERS, getStageColor } from '@/data/prospects';

const ADD_NEW_VALUE = '__add_new__';

interface AddProspectDialogProps {
  defaultType?: CompanyType;
}

const AddProspectDialog = ({ defaultType }: AddProspectDialogProps) => {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [state, setState] = useState('');
  const [type, setType] = useState<CompanyType | ''>(defaultType || '');
  const [marketType, setMarketType] = useState<string>('');
  const [leadTier, setLeadTier] = useState<LeadTier | ''>('');
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [linkedIn, setLinkedIn] = useState('');
  const [website, setWebsite] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewVerticalInput, setShowNewVerticalInput] = useState(false);
  const [newVertical, setNewVertical] = useState('');

  const { addProspect } = useProspects();
  const { toast } = useToast();
  const { allVerticals, addVertical } = useProductVerticals();

  const addStage = (stage: string) => {
    if (!selectedStages.includes(stage)) {
      setSelectedStages([...selectedStages, stage]);
    }
  };

  const removeStage = (stage: string) => {
    setSelectedStages(selectedStages.filter(s => s !== stage));
  };

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
      street: '',
      city: '',
      state: state.trim(),
      zip: '',
      type: type || '',
      marketType: (marketType || '') as MarketType,
      leadTier: leadTier || '',
      stage: selectedStages.length > 0 ? selectedStages.join(', ') : 'Contact Made',
      lastContact: new Date().toLocaleDateString('en-US'),
      engagementNotes: '',
      linkedIn: linkedIn.trim(),
      website: website.trim(),
      contacts: [],
      engagements: [],
    });
    setIsSubmitting(false);

    if (result) {
      toast({
        title: 'Success',
        description: `${companyName} has been added.`,
      });
      setCompanyName('');
      setState('');
      setType('');
      setMarketType('');
      setLeadTier('');
      setSelectedStages([]);
      setLinkedIn('');
      setWebsite('');
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
              <Label htmlFor="type">Business Model</Label>
              <Select value={type} onValueChange={(value) => setType(value as CompanyType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="marketType">Product Vertical</Label>
              {showNewVerticalInput ? (
                <div className="flex gap-1">
                  <Input
                    value={newVertical}
                    onChange={(e) => setNewVertical(e.target.value)}
                    placeholder="New vertical name"
                    className="flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newVertical.trim()) {
                          const added = addVertical(newVertical);
                          setMarketType(added);
                          setNewVertical('');
                          setShowNewVerticalInput(false);
                        }
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => {
                      if (newVertical.trim()) {
                        const added = addVertical(newVertical);
                        setMarketType(added);
                        setNewVertical('');
                        setShowNewVerticalInput(false);
                      }
                    }}
                  >Add</Button>
                  <Button size="sm" variant="outline" type="button" onClick={() => { setShowNewVerticalInput(false); setNewVertical(''); }}>✕</Button>
                </div>
              ) : (
                <Select value={marketType} onValueChange={(value) => {
                  if (value === ADD_NEW_VALUE) {
                    setShowNewVerticalInput(true);
                  } else {
                    setMarketType(value);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vertical" />
                  </SelectTrigger>
                  <SelectContent>
                    {allVerticals.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                    <SelectItem value={ADD_NEW_VALUE} className="text-accent">
                      <span className="flex items-center gap-2">
                        <Plus className="w-3 h-3" />
                        Add new vertical...
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Lead Tier</Label>
              <Select value={leadTier} onValueChange={(value) => setLeadTier(value as LeadTier)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_TIERS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Stages</Label>
            {selectedStages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                {selectedStages.map((stg) => {
                  const colors = getStageColor(stg);
                  return (
                    <span
                      key={stg}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                    >
                      {stg}
                      <button
                        type="button"
                        onClick={() => removeStage(stg)}
                        className="hover:opacity-70 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <Select
              value=""
              onValueChange={(value) => {
                if (value) addStage(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Add a stage..." />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.filter(s => !selectedStages.includes(s)).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div className="grid gap-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
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
