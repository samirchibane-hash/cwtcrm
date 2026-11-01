import { Contact, Engagement } from '@/data/prospects';

export interface Investor {
  id: string;
  name: string;
  investorType: string;
  stage: string;
  contacts: Contact[];
  engagements: Engagement[];
  website: string;
  linkedIn: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  notes: string;
  lastContact: string;
}

// Relationship funnel (investor relations, not a single round)
export const INVESTOR_STAGES = ['Cold', 'Warm', 'Engaged', 'Investor', 'Not a fit'] as const;
export type InvestorStage = typeof INVESTOR_STAGES[number];

export const INVESTOR_TYPES = ['VC', 'Angel', 'Family office', 'Corporate / Strategic', 'Private equity', 'Accelerator'] as const;

// Reuses the existing stage-* scale so investor capsules sit in the same visual family
const STAGE_COLORS: Record<InvestorStage, { bg: string; text: string }> = {
  'Cold': { bg: 'bg-stage-longterm', text: 'text-stage-longterm-foreground' },
  'Warm': { bg: 'bg-stage-quotes', text: 'text-stage-quotes-foreground' },
  'Engaged': { bg: 'bg-stage-contact', text: 'text-stage-contact-foreground' },
  'Investor': { bg: 'bg-stage-closed', text: 'text-stage-closed-foreground' },
  'Not a fit': { bg: 'bg-stage-lost', text: 'text-stage-lost-foreground' },
};

export const isInvestorStage = (value: unknown): value is InvestorStage =>
  typeof value === 'string' && (INVESTOR_STAGES as readonly string[]).includes(value);

export const getInvestorStageColor = (stage: string) =>
  isInvestorStage(stage) ? STAGE_COLORS[stage] : { bg: 'bg-stage-new', text: 'text-stage-new-foreground' };

export const emptyInvestor = (): Omit<Investor, 'id'> => ({
  name: '',
  investorType: '',
  stage: 'Cold',
  contacts: [],
  engagements: [],
  website: '',
  linkedIn: '',
  phone: '',
  city: '',
  state: '',
  country: '',
  notes: '',
  lastContact: '',
});
