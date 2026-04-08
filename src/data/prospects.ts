export interface Contact {
  id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  linkedIn?: string;
  isChampion?: boolean;
  emailVerified?: boolean;
}

export interface Engagement {
  id: string;
  date: string;
  type: 'call' | 'email' | 'meeting' | 'note';
  summary: string;
  details?: string;
  activity?: {
    calls?: number;
    emails?: number;
  };
}

export type CompanyType = 'OEM' | 'Distributor' | 'eCommerce' | 'Installer' | '';

export type MarketType = 
  | 'Water Coolers'
  | 'Ice Machines'
  | 'Beverage Dispensers'
  | 'Water Filtration'
  | 'Spas & Hot Tubs'
  | 'Fountains'
  | 'Industrial'
  | 'Residential'
  | 'Commercial'
  | '';

export type LeadTier = 'VIP' | 'Customer' | 'Indirect Customer' | '';

export const COMPANY_TYPES: CompanyType[] = ['OEM', 'Distributor', 'eCommerce', 'Installer'];

export const MARKET_TYPES: MarketType[] = [
  'Water Coolers',
  'Ice Machines',
  'Beverage Dispensers',
  'Water Filtration',
  'Spas & Hot Tubs',
  'Fountains',
  'Industrial',
  'Residential',
  'Commercial',
];

export const LEAD_TIERS: LeadTier[] = ['VIP', 'Customer', 'Indirect Customer'];

export interface Prospect {
  id: string;
  companyName: string;
  contacts: Contact[];
  street?: string;
  city?: string;
  state: string;
  country?: string;
  zip?: string;
  type: CompanyType;
  marketType: MarketType;
  leadTier: LeadTier;
  stage: string;
  lastContact: string;
  engagementNotes: string;
  linkedIn: string;
  website?: string;
  googleMapsUrl?: string;
  engagements: Engagement[];
}

// Parse contacts string into Contact objects
const parseContacts = (contactsStr: string): Contact[] => {
  if (!contactsStr) return [];
  return contactsStr.split(/[,&]/).map((name, idx) => ({
    id: `contact-${idx}`,
    name: name.trim(),
  })).filter(c => c.name);
};

// Generate sample engagements from notes
const generateEngagements = (notes: string, lastContact: string): Engagement[] => {
  if (!notes && !lastContact) return [];
  const engagements: Engagement[] = [];
  
  if (notes) {
    engagements.push({
      id: 'eng-1',
      date: lastContact ? `${lastContact}/2025` : new Date().toLocaleDateString(),
      type: 'note',
      summary: notes.length > 60 ? notes.slice(0, 60) + '...' : notes,
      details: notes,
    });
  }
  
  return engagements;
};

// Infer market type from engagement notes
const inferMarketType = (notes: string): MarketType => {
  const notesLower = notes.toLowerCase();
  if (notesLower.includes('water cooler')) return 'Water Coolers';
  if (notesLower.includes('ice machine') || notesLower.includes('ice systems')) return 'Ice Machines';
  if (notesLower.includes('beverage') || notesLower.includes('soda dispenser')) return 'Beverage Dispensers';
  if (notesLower.includes('fountain')) return 'Fountains';
  if (notesLower.includes('spa') || notesLower.includes('hot tub')) return 'Spas & Hot Tubs';
  if (notesLower.includes('filter') || notesLower.includes('filtration')) return 'Water Filtration';
  return '';
};

export const prospects: Prospect[] = [
  { id: '1', companyName: 'Brio Water Technology', contacts: parseContacts(''), street: '', city: '', state: '', zip: '', type: 'OEM', marketType: 'Water Coolers', leadTier: '', stage: '', lastContact: '1/23', engagementNotes: 'Water coolers', linkedIn: 'https://www.linkedin.com/company/briowatertech/people/', engagements: generateEngagements('Water coolers', '1/23') },
  { id: '2', companyName: 'Glacier Fresh / WaterH', contacts: parseContacts(''), street: '', city: '', state: 'NJ', zip: '', type: 'OEM', marketType: 'Water Filtration', leadTier: '', stage: '', lastContact: '1/23', engagementNotes: 'WaterH is parent company', linkedIn: 'https://www.linkedin.com/company/glacier-fresh/people/', engagements: generateEngagements('WaterH is parent company', '1/23') },
  { id: '3', companyName: 'Aquatru', contacts: parseContacts(''), street: '', city: '', state: 'CA', zip: '', type: 'OEM', marketType: 'Water Filtration', leadTier: '', stage: '', lastContact: '1/23', engagementNotes: 'Ideal Living is parent company', linkedIn: 'https://www.linkedin.com/company/aquatru', engagements: generateEngagements('Ideal Living is parent company', '1/23') },
  { id: '4', companyName: 'iSpring', contacts: parseContacts(''), state: 'GA', type: 'OEM', marketType: 'Water Filtration', leadTier: '', stage: '', lastContact: '', engagementNotes: '', linkedIn: '', engagements: [] },
  { id: '5', companyName: 'Multiplex Beverage', contacts: parseContacts(''), state: 'IN', type: 'OEM', marketType: 'Beverage Dispensers', leadTier: '', stage: '', lastContact: '1/20', engagementNotes: 'Soda dispensers', linkedIn: 'https://www.linkedin.com/company/multiplexbeverage/people/', engagements: generateEngagements('Soda dispensers', '1/20') },
  { id: '6', companyName: 'Micro Matic', contacts: parseContacts('Michelle'), state: 'FL', type: 'OEM', marketType: 'Beverage Dispensers', leadTier: '', stage: 'No Current Interest', lastContact: '1/20', engagementNotes: 'Beverage dispensers - hard to locate email format - Michelle cell: 813-727-9420', linkedIn: 'https://www.linkedin.com/company/micro-matic---beverage-dispensing/about/', engagements: generateEngagements('Beverage dispensers - hard to locate email format - Michelle cell: 813-727-9420', '1/20') },
  { id: '7', companyName: 'Foxx Equipment', contacts: parseContacts(''), state: 'KS', type: 'Distributor', marketType: 'Beverage Dispensers', leadTier: '', stage: '', lastContact: '1/20', engagementNotes: 'Beverage dispensers - mainly distributor looks like not OEM', linkedIn: 'https://www.linkedin.com/company/foxx-equipment-company/about/', engagements: generateEngagements('Beverage dispensers - mainly distributor looks like not OEM', '1/20') },
  { id: '8', companyName: 'Charger Water', contacts: parseContacts('Clay & Mike & James A.'), state: 'USA', type: 'Distributor', marketType: 'Water Filtration', leadTier: '', stage: 'Quotes', lastContact: '1/14', engagementNotes: 'Spoke to Mike (Dir. of Purchasing) - PA branch most UV vol - Emailed (George Bosch) directly and resent quotes to Rebecca (FDesk)', linkedIn: '', engagements: generateEngagements('Spoke to Mike (Dir. of Purchasing) - PA branch most UV vol - Emailed (George Bosch) directly and resent quotes to Rebecca (FDesk)', '1/14') },
  { id: '9', companyName: 'Antunes', contacts: parseContacts(''), state: 'IL', type: 'OEM', marketType: 'Commercial', leadTier: '', stage: '', lastContact: '1/14', engagementNotes: '', linkedIn: 'https://www.linkedin.com/company/a.j.-antunes-&-co/people/', engagements: [] },
  { id: '10', companyName: 'Scotsman Ice Systems', contacts: parseContacts(''), state: 'IL', type: 'OEM', marketType: 'Ice Machines', leadTier: '', stage: '', lastContact: '1/14', engagementNotes: '200+ people on Li', linkedIn: 'https://www.linkedin.com/company/scotsman-ice-systems/', engagements: generateEngagements('200+ people on Li', '1/14') },
  { id: '11', companyName: 'Ico-O-Matic', contacts: parseContacts(''), state: 'CO', type: 'OEM', marketType: 'Ice Machines', leadTier: '', stage: '', lastContact: '1/14', engagementNotes: '100+ people on Li', linkedIn: 'https://www.linkedin.com/company/mile-high-equipment-co/posts/?feedView=all', engagements: generateEngagements('100+ people on Li', '1/14') },
  { id: '12', companyName: 'Master Spas', contacts: parseContacts(''), state: 'IN', type: '', marketType: 'Spas & Hot Tubs', leadTier: '', stage: '', lastContact: '1/13', engagementNotes: '', linkedIn: 'https://www.linkedin.com/company/master-spas-inc-/posts/?feedView=all', engagements: [] },
  { id: '13', companyName: 'The Water Clinic', contacts: parseContacts(''), state: 'Canada', type: 'Distributor', marketType: 'Water Filtration', leadTier: '', stage: '', lastContact: '1/13', engagementNotes: 'mention PureAqua systems next', linkedIn: '', engagements: generateEngagements('mention PureAqua systems next', '1/13') },
  { id: '14', companyName: 'U-Line Corp', contacts: parseContacts(''), state: 'MI', type: 'OEM', marketType: 'Ice Machines', leadTier: '', stage: '', lastContact: '1/13', engagementNotes: 'Ice Machines. More contacts on LinkedIn', linkedIn: 'https://www.linkedin.com/company/u-line-corporation/', engagements: generateEngagements('Ice Machines. More contacts on LinkedIn', '1/13') },
  { id: '15', companyName: 'Haws', contacts: parseContacts(''), state: 'NV', type: 'OEM', marketType: 'Fountains', leadTier: '', stage: '', lastContact: '1/13', engagementNotes: 'Fountains. More contacts on LinkedIn', linkedIn: 'https://www.linkedin.com/company/haws-corporation/people/', engagements: generateEngagements('Fountains. More contacts on LinkedIn', '1/13') },
  { id: '16', companyName: 'Canature WaterGroup', contacts: parseContacts(''), state: 'Canada', type: 'OEM', marketType: 'Water Filtration', leadTier: '', stage: '', lastContact: '1/13', engagementNotes: 'More contacts on LinkedIn', linkedIn: 'https://www.linkedin.com/company/canature-watergroup/people/', engagements: generateEngagements('More contacts on LinkedIn', '1/13') },
  { id: '17', companyName: 'Natura Water', contacts: parseContacts('Brandon Wall'), state: 'OH', type: '', marketType: 'Water Filtration', leadTier: '', stage: '', lastContact: '1/13', engagementNotes: 'Call next', linkedIn: 'https://www.linkedin.com/company/natura-water/posts/?feedView=all', engagements: generateEngagements('Call next', '1/13') },
  { id: '18', companyName: 'Hoshizaki America', contacts: parseContacts(''), state: 'GA', type: 'OEM', marketType: 'Ice Machines', leadTier: '', stage: '', lastContact: '1/13', engagementNotes: 'Ice Machines. More contacts on LinkedIn', linkedIn: 'https://www.linkedin.com/company/hoshizaki-america/', engagements: generateEngagements('Ice Machines. More contacts on LinkedIn', '1/13') },
  { id: '19', companyName: 'Blake Equipment', contacts: parseContacts('Mark H. & Jesse Monette'), state: 'CT', type: 'Distributor', marketType: 'Water Filtration', leadTier: '', stage: '', lastContact: '1/7', engagementNotes: 'Jesse Monette is water treatment prod manager so call him. Call diff locations', linkedIn: 'https://www.linkedin.com/company/blake-equipment-company/people/', engagements: generateEngagements('Jesse Monette is water treatment prod manager so call him. Call diff locations', '1/7') },
  { id: '20', companyName: 'Performance Water Products', contacts: parseContacts('John M. & Mat M.'), state: 'CA', type: 'Distributor', marketType: 'Water Filtration', leadTier: '', stage: 'Disco Call, Quotes', lastContact: '1/7', engagementNotes: 'Emailed quotes for 10 GPM and 2 GPM', linkedIn: 'https://www.linkedin.com/in/mat-mecca-48198870/', engagements: generateEngagements('Emailed quotes for 10 GPM and 2 GPM', '1/7') },
  { id: '21', companyName: 'HOPE Hydration', contacts: parseContacts('Jorge R. & Douglas P.'), state: 'NY', type: 'OEM', marketType: 'Water Filtration', leadTier: '', stage: '', lastContact: '1/7', engagementNotes: "Call next - Can't tell if they use UVs", linkedIn: 'https://www.linkedin.com/company/hope-hydration/people/', engagements: generateEngagements("Call next - Can't tell if they use UVs", '1/7') },
  { id: '22', companyName: 'OffGridBox', contacts: parseContacts('Emiliano C. & Davide B.'), state: 'MA', type: 'OEM', marketType: 'Water Filtration', leadTier: '', stage: '', lastContact: '1/7', engagementNotes: 'Call next - Pioneer unit has UVs', linkedIn: 'https://www.linkedin.com/company/offgridbox/people/', engagements: generateEngagements('Call next - Pioneer unit has UVs', '1/7') },
  { id: '23', companyName: 'Follett', contacts: parseContacts(''), state: 'PA', type: 'OEM', marketType: 'Ice Machines', leadTier: '', stage: '', lastContact: '1/7', engagementNotes: 'Calls next but more engineers on Li', linkedIn: 'https://www.linkedin.com/company/follett-corporation/about/', engagements: generateEngagements('Calls next but more engineers on Li', '1/7') },
  { id: '24', companyName: 'Aquaria', contacts: parseContacts('Brian S. & Neil M. & Matt S.'), state: 'TX', type: 'OEM', marketType: 'Water Filtration', leadTier: '', stage: '', lastContact: '1/7', engagementNotes: 'Matt S. : +1 (424) 402-1915 - confirmed they have UVs in all systems', linkedIn: 'https://www.linkedin.com/company/aquariaawg/', engagements: generateEngagements('Matt S. : +1 (424) 402-1915 - confirmed they have UVs in all systems', '1/7') },
  { id: '25', companyName: 'Cal Spas', contacts: parseContacts('Marcus O. & Casey L. & Pedro'), state: 'CA', type: 'OEM', marketType: 'Spas & Hot Tubs', leadTier: '', stage: 'Contact Made', lastContact: '1/7', engagementNotes: 'Spoke to Pedro - FD at 1800-CalSpas transfers to team members', linkedIn: 'https://www.linkedin.com/company/cal-spas/posts/?feedView=all', engagements: generateEngagements('Spoke to Pedro - FD at 1800-CalSpas transfers to team members', '1/7') },
  { id: '26', companyName: 'Rayne Water', contacts: parseContacts('Art V.'), state: 'CA', type: 'OEM', marketType: 'Water Filtration', leadTier: '', stage: '', lastContact: '1/7', engagementNotes: 'Art V. is owner of Big Valley Pure Water', linkedIn: 'https://www.linkedin.com/company/rayne-water/posts/?feedView=all', engagements: generateEngagements('Art V. is owner of Big Valley Pure Water', '1/7') },
  { id: '27', companyName: 'Water Chef', contacts: parseContacts('Lacey R.'), state: 'NY', type: 'eCommerce', marketType: 'Water Filtration', leadTier: '', stage: 'Contact Made', lastContact: '1/6', engagementNotes: 'Spoke to Lacey and resent email (775) 6243011 Ext 107', linkedIn: 'https://www.linkedin.com/company/waterchef/posts/?feedView=all', engagements: generateEngagements('Spoke to Lacey and resent email (775) 6243011 Ext 107', '1/6') },
  { id: '28', companyName: 'Aquaflow Pump & Supply', contacts: parseContacts('David Sr. & Paul C.'), state: 'DE', type: 'Distributor', marketType: 'Water Filtration', leadTier: '', stage: 'Quotes', lastContact: '1/6', engagementNotes: 'Spoke to David Sr. (purchasing) and connected with Paul C. then emailed quotes and lab tests.', linkedIn: 'https://www.linkedin.com/company/aquaflow-pump-&-supply-co.-inc/posts/?feedView=all', engagements: generateEngagements('Spoke to David Sr. (purchasing) and connected with Paul C. then emailed quotes and lab tests.', '1/6') },
  { id: '29', companyName: 'Canadian Water Warehouse', contacts: parseContacts('Chris P. & Jillian'), state: 'Canada', type: 'eCommerce', marketType: 'Water Filtration', leadTier: '', stage: '', lastContact: '1/6', engagementNotes: 'No Li. Call next 905-853-0040', linkedIn: 'https://www.linkedin.com/in/chris-polanowski-02648a18/', engagements: generateEngagements('No Li. Call next 905-853-0040', '1/6') },
  { id: '30', companyName: 'Preferred Pump', contacts: parseContacts('Sara C'), state: 'USA', type: 'Distributor', marketType: 'Industrial', leadTier: '', stage: '', lastContact: '1/6', engagementNotes: 'Keep calling through team directory and Li contacts', linkedIn: 'https://www.linkedin.com/company/preferred-pump-&-equipment/posts/?feedView=all', engagements: generateEngagements('Keep calling through team directory and Li contacts', '1/6') },
  { id: '31', companyName: 'Nelsen Corporation', contacts: parseContacts('Dave N. & John I.'), state: 'OH', type: 'Distributor', marketType: 'Water Filtration', leadTier: '', stage: 'Contact Made', lastContact: '1/6', engagementNotes: 'FD transfers calls (except Dave N.) so keep hammering - (800) 362-9686', linkedIn: 'https://www.linkedin.com/company/nelsencorporation/posts/?feedView=all', engagements: generateEngagements('FD transfers calls (except Dave N.) so keep hammering - (800) 362-9686', '1/6') },
  { id: '32', companyName: 'Atlantic Filter', contacts: parseContacts('James W. & Amanda M. & Whit W.'), state: 'FL', type: 'Distributor', marketType: 'Water Filtration', leadTier: '', stage: '', lastContact: '1/6', engagementNotes: 'Amanda M (VP) Whit W (Purchasing) - Office: (561) 683-0100', linkedIn: '', engagements: generateEngagements('Amanda M (VP) Whit W (Purchasing) - Office: (561) 683-0100', '1/6') },
  { id: '33', companyName: 'Polar Station', contacts: parseContacts('Heather & Terrance'), state: 'MO', type: 'OEM', marketType: 'Water Filtration', leadTier: '', stage: 'No Current Interest, Quotes', lastContact: '1/22', engagementNotes: 'Terrance replied "it\'s all about price of 4 GPM"', linkedIn: '', engagements: generateEngagements('Terrance replied "it\'s all about price of 4 GPM"', '1/22') },
  { id: '34', companyName: 'A.O. Smith', contacts: parseContacts('Doug Moser & Jeff R.'), state: 'USA', type: 'OEM', marketType: 'Water Filtration', leadTier: '', stage: 'Contact Made', lastContact: '12/18', engagementNotes: 'Jeff R said new PoC is Doug Moser at corporate.', linkedIn: '', engagements: generateEngagements('Jeff R said new PoC is Doug Moser at corporate.', '12/18') },
  { id: '35', companyName: 'Franklin Water', contacts: parseContacts('Don L. & Michael B. & Patrick M.'), state: 'IN', type: 'Distributor', marketType: 'Water Filtration', leadTier: '', stage: '', lastContact: '12/18', engagementNotes: 'Added Michael B(Vp) and Patrick M(Vp) to funnel', linkedIn: 'https://www.linkedin.com/company/franklin-electric', engagements: generateEngagements('Added Michael B(Vp) and Patrick M(Vp) to funnel', '12/18') },
  { id: '36', companyName: 'Quench', contacts: parseContacts('James D.'), state: 'USA', type: 'OEM', marketType: 'Water Coolers', leadTier: '', stage: '', lastContact: '12/17', engagementNotes: '', linkedIn: 'https://www.linkedin.com/company/quench-usa-inc/posts/', engagements: [] },
  { id: '37', companyName: 'ERE (Environmental Remediation Equipment)', contacts: parseContacts('Angelo D & Mary B.'), state: 'Canada', type: 'Distributor', marketType: 'Industrial', leadTier: '', stage: '', lastContact: '12/17', engagementNotes: '', linkedIn: '', engagements: [] },
  { id: '38', companyName: 'Murdock Mfg (Morris Group Int.)', contacts: parseContacts(''), state: 'CA', type: 'OEM', marketType: 'Fountains', leadTier: '', stage: '', lastContact: '12/16', engagementNotes: 'Fountains. Find more engineers and product devs', linkedIn: 'https://www.linkedin.com/company/morrisgroupinternational/people/', engagements: generateEngagements('Fountains. Find more engineers and product devs', '12/16') },
  { id: '39', companyName: 'Miller Leaman', contacts: parseContacts('Marty S. & Denis & Larry'), state: 'FL', type: 'OEM', marketType: 'Industrial', leadTier: '', stage: '', lastContact: '12/11', engagementNotes: 'Denis "sent to the team" but emailing others - Ask for others than Larry Call', linkedIn: 'https://www.linkedin.com/company/miller-leaman/posts/?feedView=all', engagements: generateEngagements('Denis "sent to the team" but emailing others - Ask for others than Larry Call', '12/11') },
  { id: '40', companyName: 'Kold Draft', contacts: parseContacts(''), state: 'PA', type: 'OEM', marketType: 'Ice Machines', leadTier: '', stage: '', lastContact: '', engagementNotes: '', linkedIn: 'https://www.linkedin.com/company/kold-draft/', engagements: [] },
];

export const getProspectById = (id: string): Prospect | undefined => {
  return prospects.find(p => p.id === id);
};

export const PIPELINE_STAGES = [
  'New Lead',
  'Contact Made',
  'Disco Call',
  'Sample Req',
  'Quotes',
  'Negotiation',
  'Closed Won',
  'No Current Interest',
  'Longterm',
];

export const getStageColor = (stage: string): { bg: string; text: string } => {
  const stageLower = stage.toLowerCase().trim();
  if (stageLower === 'quotes') return { bg: 'bg-stage-quotes', text: 'text-stage-quotes-foreground' };
  if (stageLower === 'contact made') return { bg: 'bg-stage-contact', text: 'text-stage-contact-foreground' };
  if (stageLower === 'no current interest') return { bg: 'bg-stage-lost', text: 'text-stage-lost-foreground' };
  if (stageLower === 'closed won' || stageLower === 'closed') return { bg: 'bg-stage-closed', text: 'text-stage-closed-foreground' };
  if (stageLower === 'sample req') return { bg: 'bg-stage-sample', text: 'text-stage-sample-foreground' };
  if (stageLower === 'disco call') return { bg: 'bg-stage-disco', text: 'text-stage-disco-foreground' };
  if (stageLower === 'negotiation') return { bg: 'bg-stage-negotiation', text: 'text-stage-negotiation-foreground' };
  if (stageLower === 'new lead') return { bg: 'bg-stage-new', text: 'text-stage-new-foreground' };
  if (stageLower === 'longterm') return { bg: 'bg-stage-longterm', text: 'text-stage-longterm-foreground' };
  return { bg: 'bg-stage-new', text: 'text-stage-new-foreground' };
};

export const getTypeColor = (type: string): { bg: string; text: string } => {
  switch (type) {
    case 'OEM': return { bg: 'bg-type-oem', text: 'text-type-oem-foreground' };
    case 'Distributor': return { bg: 'bg-type-distributor', text: 'text-type-distributor-foreground' };
    case 'eCommerce': return { bg: 'bg-type-ecommerce', text: 'text-type-ecommerce-foreground' };
    default: return { bg: 'bg-muted', text: 'text-muted-foreground' };
  }
};

export const getLeadTierColor = (tier: string): { bg: string; text: string } => {
  switch (tier) {
    case 'VIP': return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-300' };
    case 'Customer': return { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300' };
    case 'Indirect Customer': return { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-800 dark:text-pink-300' };
    default: return { bg: 'bg-muted', text: 'text-muted-foreground' };
  }
};

export const getStats = () => {
  const total = prospects.length;
  const byType = {
    OEM: prospects.filter(p => p.type === 'OEM').length,
    Distributor: prospects.filter(p => p.type === 'Distributor').length,
    eCommerce: prospects.filter(p => p.type === 'eCommerce').length,
  };
  const withQuotes = prospects.filter(p => p.stage.toLowerCase().includes('quotes')).length;
  const contactMade = prospects.filter(p => p.stage.toLowerCase().includes('contact made')).length;
  const noInterest = prospects.filter(p => p.stage.toLowerCase().includes('no current interest')).length;

  return { total, byType, withQuotes, contactMade, noInterest };
};
