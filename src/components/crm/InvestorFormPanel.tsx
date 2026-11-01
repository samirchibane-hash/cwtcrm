import { z } from 'zod';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Globe, Landmark, Save } from 'lucide-react';
import { Investor, INVESTOR_STAGES, INVESTOR_TYPES, emptyInvestor } from '@/data/investors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SheetDescription, SheetTitle } from '@/components/ui/sheet';

const NONE = '__none__';

const investorSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150, 'Name must be less than 150 characters'),
  investorType: z.string(),
  stage: z.string(),
  website: z.string().trim().max(500, 'Website must be less than 500 characters'),
  linkedIn: z.string().trim().max(500, 'LinkedIn URL must be less than 500 characters'),
  phone: z.string().trim().max(30, 'Phone must be less than 30 characters'),
  city: z.string().trim().max(100),
  state: z.string().trim().max(100),
  country: z.string().trim().max(100),
  notes: z.string().max(5000, 'Notes must be less than 5,000 characters'),
});

export type InvestorFormData = z.infer<typeof investorSchema>;

interface InvestorFormPanelProps {
  /** Omit to add a new investor; pass one to edit it. */
  investor?: Investor;
  onSubmit: (data: InvestorFormData) => Promise<boolean>;
  onClose: () => void;
}

const InvestorFormPanel = ({ investor, onSubmit, onClose }: InvestorFormPanelProps) => {
  const isEditing = Boolean(investor);
  const base = investor ?? { id: '', ...emptyInvestor() };

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InvestorFormData>({
    resolver: zodResolver(investorSchema),
    defaultValues: {
      name: base.name,
      investorType: base.investorType,
      stage: base.stage,
      website: base.website,
      linkedIn: base.linkedIn,
      phone: base.phone,
      city: base.city,
      state: base.state,
      country: base.country,
      notes: base.notes,
    },
  });

  const watchedName = watch('name');

  const submit = async (data: InvestorFormData) => {
    if (await onSubmit(data)) onClose();
  };

  const field = (id: keyof InvestorFormData, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-2">
      <Label htmlFor={`investor-${id}`}>{label}</Label>
      <Input
        id={`investor-${id}`}
        className="rounded-xl"
        aria-invalid={Boolean(errors[id])}
        aria-describedby={errors[id] ? `investor-${id}-error` : undefined}
        {...props}
        {...register(id)}
      />
      {errors[id] && <p id={`investor-${id}-error`} className="text-xs text-destructive">{errors[id]?.message}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(submit)} className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 pb-5 border-b border-border pr-8">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isEditing ? 'Edit investor' : 'New investor'}
            </p>
            <SheetTitle className="text-xl font-semibold tracking-tight truncate">
              {watchedName.trim() || (isEditing ? 'Investor' : 'Add an investor')}
            </SheetTitle>
          </div>
        </div>
        <SheetDescription className="sr-only">
          {isEditing ? 'Update this investor’s details.' : 'Add a firm or individual investor to track the relationship.'}
        </SheetDescription>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto -mx-6 px-6 pt-6 space-y-6">
        <section className="content-card p-6 space-y-4">
          <h2 className="section-header flex items-center gap-2 mb-0">
            <Landmark className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            Investor
          </h2>
          {field('name', 'Firm or person *', { placeholder: 'Blue Delta Ventures', autoFocus: true })}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="investor-type">Investor type</Label>
              <Controller
                control={control}
                name="investorType"
                render={({ field: f }) => (
                  <Select value={f.value || NONE} onValueChange={v => f.onChange(v === NONE ? '' : v)}>
                    <SelectTrigger id="investor-type" className="rounded-xl">
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not set</SelectItem>
                      {INVESTOR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="investor-stage">Stage</Label>
              <Controller
                control={control}
                name="stage"
                render={({ field: f }) => (
                  <Select value={f.value || NONE} onValueChange={v => f.onChange(v === NONE ? '' : v)}>
                    <SelectTrigger id="investor-stage" className="rounded-xl">
                      <SelectValue placeholder="Select a stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not set</SelectItem>
                      {INVESTOR_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </section>

        <section className="content-card p-6 space-y-4">
          <h2 className="section-header flex items-center gap-2 mb-0">
            <Globe className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            Links & location
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('website', 'Website', { placeholder: 'bluedelta.vc' })}
            {field('linkedIn', 'LinkedIn URL', { type: 'url', placeholder: 'https://linkedin.com/company/…' })}
            {field('phone', 'Phone', { type: 'tel', placeholder: '(555) 123-4567' })}
            {field('city', 'City', { placeholder: 'Austin' })}
            {field('state', 'State', { placeholder: 'TX' })}
            {field('country', 'Country', { placeholder: 'USA' })}
          </div>
        </section>

        <section className="content-card p-6 space-y-2">
          <Label htmlFor="investor-notes">Notes</Label>
          <Textarea
            id="investor-notes"
            rows={4}
            placeholder="Thesis, portfolio overlap, who introduced us…"
            className="rounded-xl"
            {...register('notes')}
          />
          {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
        </section>
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 pt-4 border-t border-border flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="rounded-xl">
          <Save className="w-4 h-4 mr-2" />
          {isEditing ? 'Save changes' : 'Add investor'}
        </Button>
      </div>
    </form>
  );
};

export default InvestorFormPanel;
