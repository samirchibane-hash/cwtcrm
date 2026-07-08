import { useState } from 'react';
import { Plus, X, Building2, MapPin, GitBranch, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
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
import { CompanyType, MarketType, PIPELINE_STAGES, COMPANY_TYPES, getStageColor } from '@/data/prospects';

const ADD_NEW_VALUE = '__add_new__';

interface AddProspectPanelProps {
  defaultType?: CompanyType;
}

const AddProspectPanel = ({ defaultType }: AddProspectPanelProps) => {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [zip, setZip] = useState('');
  const [type, setType] = useState<CompanyType | ''>(defaultType || '');
  const [marketType, setMarketType] = useState<string>('');
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [linkedIn, setLinkedIn] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
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

  const resetForm = () => {
    setCompanyName('');
    setStreet('');
    setCity('');
    setState('');
    setCountry('');
    setZip('');
    setType(defaultType || '');
    setMarketType('');
    setSelectedStages([]);
    setLinkedIn('');
    setWebsite('');
    setPhone('');
    setShowNewVerticalInput(false);
    setNewVertical('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) resetForm();
  };

  const commitNewVertical = () => {
    if (newVertical.trim()) {
      const added = addVertical(newVertical);
      setMarketType(added);
      setNewVertical('');
      setShowNewVerticalInput(false);
    }
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
      street: street.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
      zip: zip.trim(),
      type: type || '',
      marketType: (marketType || '') as MarketType,
      leadTier: '',
      stage: selectedStages.length > 0 ? selectedStages.join(', ') : 'Contact Made',
      lastContact: new Date().toLocaleDateString('en-US'),
      engagementNotes: '',
      linkedIn: linkedIn.trim(),
      website: website.trim(),
      phone: phone.trim(),
      contacts: [],
      engagements: [],
    });
    setIsSubmitting(false);

    if (result) {
      toast({
        title: 'Success',
        description: `${companyName} has been added.`,
      });
      setOpen(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Prospect
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-6 flex flex-col">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="shrink-0 pb-5 border-b border-border pr-8">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">New Prospect</p>
                <h1 className="text-xl font-semibold tracking-tight truncate">
                  {companyName.trim() || 'Add a company'}
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
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Enter company name"
                    className="rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Business Model</Label>
                    <Select value={type} onValueChange={(value) => setType(value as CompanyType)}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl bg-background">
                        {COMPANY_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Product Vertical</Label>
                    {showNewVerticalInput ? (
                      <div className="flex gap-2">
                        <Input
                          value={newVertical}
                          onChange={(e) => setNewVertical(e.target.value)}
                          placeholder="New vertical"
                          className="rounded-xl flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitNewVertical();
                            }
                            if (e.key === 'Escape') {
                              setShowNewVerticalInput(false);
                              setNewVertical('');
                            }
                          }}
                        />
                        <Button size="sm" type="button" onClick={commitNewVertical} className="rounded-xl shrink-0">
                          Add
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={marketType}
                        onValueChange={(value) => {
                          if (value === ADD_NEW_VALUE) {
                            setShowNewVerticalInput(true);
                          } else {
                            setMarketType(value);
                          }
                        }}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select vertical" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl bg-background">
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
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Add a stage..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl bg-background">
                    {PIPELINE_STAGES.filter(s => !selectedStages.includes(s)).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Defaults to “Contact Made” if none selected.</p>
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
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Enter street address"
                    className="rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. CA, TX"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. USA, Canada"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">Zip Code</Label>
                    <Input
                      id="zip"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="Zip code"
                      className="rounded-xl"
                    />
                  </div>
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
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedIn">LinkedIn URL</Label>
                  <Input
                    id="linkedIn"
                    value={linkedIn}
                    onChange={(e) => setLinkedIn(e.target.value)}
                    placeholder="https://linkedin.com/company/..."
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="rounded-xl"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 pt-4 border-t border-border flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="rounded-xl">
              {isSubmitting ? 'Adding...' : 'Add Prospect'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddProspectPanel;
