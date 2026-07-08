import { useState } from 'react';
import { Building2, X, Plus, Save, MapPin, GitBranch, Link2 } from 'lucide-react';
import { CompanyType, MarketType, LeadTier, COMPANY_TYPES, PIPELINE_STAGES, getStageColor } from '@/data/prospects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useProductVerticals } from '@/hooks/useProductVerticals';

interface CompanyDetails {
  companyName: string;
  companyType: CompanyType;
  marketType: MarketType;
  leadTier: LeadTier;
  street: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  stage: string;
  linkedIn: string;
  website?: string;
  googleMapsUrl?: string;
  phone?: string;
}

interface EditCompanyDetailsPanelProps {
  currentDetails: CompanyDetails;
  onSave: (details: CompanyDetails) => void;
  onClose: () => void;
}

const NONE_VALUE = '__none__';
const ADD_NEW_VALUE = '__add_new__';

const EditCompanyDetailsPanel = ({ currentDetails, onSave, onClose }: EditCompanyDetailsPanelProps) => {
  const [details, setDetails] = useState<CompanyDetails>(currentDetails);
  const [stageInput, setStageInput] = useState('');
  const [newMarketType, setNewMarketType] = useState('');
  const [showNewMarketInput, setShowNewMarketInput] = useState(false);
  const { toast } = useToast();
  const { allVerticals, addVertical } = useProductVerticals();

  const selectedStages = details.stage ? details.stage.split(',').map(s => s.trim()).filter(Boolean) : [];

  const addStage = (stage: string) => {
    if (!selectedStages.includes(stage)) {
      setDetails(prev => ({ ...prev, stage: [...selectedStages, stage].join(', ') }));
    }
    setStageInput('');
  };

  const removeStage = (stage: string) => {
    setDetails(prev => ({ ...prev, stage: selectedStages.filter(s => s !== stage).join(', ') }));
  };

  const handleAddNewMarketType = () => {
    if (newMarketType.trim()) {
      const trimmed = addVertical(newMarketType);
      setDetails(prev => ({ ...prev, marketType: trimmed as MarketType }));
      setNewMarketType('');
      setShowNewMarketInput(false);
      toast({
        title: 'Product vertical added',
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
    onClose();
  };

  const updateField = <K extends keyof CompanyDetails>(field: K, value: CompanyDetails[K]) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

  const toSelectValue = (val: string) => val === '' ? NONE_VALUE : val;
  const fromSelectValue = (val: string) => val === NONE_VALUE ? '' : val;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 pb-5 border-b border-border pr-8">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Edit Company</p>
            <h1 className="text-xl font-semibold tracking-tight truncate">
              {details.companyName || 'Company details'}
            </h1>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto -mx-6 px-6 pt-6 space-y-6">
        {/* Company / classification */}
        <section className="content-card p-6">
          <h2 className="section-header flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            Company
          </h2>
          <div className="space-y-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Business Model</Label>
                <Select
                  value={toSelectValue(details.companyType)}
                  onValueChange={(value) => updateField('companyType', fromSelectValue(value) as CompanyType)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select business model" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl bg-background">
                    <SelectItem value={NONE_VALUE}>None</SelectItem>
                    {COMPANY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Product Vertical</Label>
                {showNewMarketInput ? (
                  <div className="flex gap-2">
                    <Input
                      value={newMarketType}
                      onChange={(e) => setNewMarketType(e.target.value)}
                      placeholder="New vertical"
                      className="rounded-xl flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewMarketType();
                        }
                        if (e.key === 'Escape') {
                          setShowNewMarketInput(false);
                          setNewMarketType('');
                        }
                      }}
                      autoFocus
                    />
                    <Button size="sm" onClick={handleAddNewMarketType} className="rounded-xl shrink-0">
                      Add
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
                      <SelectValue placeholder="Select product vertical" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-background">
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {allVerticals.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
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
            </div>
          </div>
        </section>

        {/* Pipeline */}
        <section className="content-card p-6">
          <h2 className="section-header flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-muted-foreground" />
            Pipeline Stages
          </h2>
          <div className="space-y-2">
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
            <Select
              value={stageInput}
              onValueChange={(value) => {
                if (value && value !== NONE_VALUE) addStage(value);
              }}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Add a stage..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-background">
                {PIPELINE_STAGES.filter(s => !selectedStages.includes(s)).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Location */}
        <section className="content-card p-6">
          <h2 className="section-header flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            Location
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="street">Street Address</Label>
              <Input
                id="street"
                value={details.street}
                onChange={(e) => updateField('street', e.target.value)}
                placeholder="Enter street address"
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={details.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="City"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={details.state}
                  onChange={(e) => updateField('state', e.target.value)}
                  placeholder="e.g. CA, NY"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={details.country}
                  onChange={(e) => updateField('country', e.target.value)}
                  placeholder="e.g. USA, Canada"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">Zip Code</Label>
                <Input
                  id="zip"
                  value={details.zip}
                  onChange={(e) => updateField('zip', e.target.value)}
                  placeholder="Zip code"
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="googleMapsUrl">Google Maps Link</Label>
              <Input
                id="googleMapsUrl"
                value={details.googleMapsUrl || ''}
                onChange={(e) => updateField('googleMapsUrl', e.target.value)}
                placeholder="https://maps.google.com/..."
                className="rounded-xl"
              />
            </div>
          </div>
        </section>

        {/* Links & contact */}
        <section className="content-card p-6">
          <h2 className="section-header flex items-center gap-2">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            Links & Contact
          </h2>
          <div className="space-y-4">
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
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={details.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="(555) 123-4567"
                className="rounded-xl"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 pt-4 border-t border-border flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose} className="rounded-xl">
          Cancel
        </Button>
        <Button onClick={handleSave} className="rounded-xl">
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default EditCompanyDetailsPanel;
