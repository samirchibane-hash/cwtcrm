export interface Prospect {
  id: string;
  companyName: string;
  contacts: string;
  state: string;
  type: 'OEM' | 'Distributor' | 'eCommerce' | '';
  stage: string;
  lastContact: string;
  engagementNotes: string;
  linkedIn: string;
}

export const prospects: Prospect[] = [
  { id: '1', companyName: 'Brio Water Technology', contacts: '', state: '', type: 'OEM', stage: '', lastContact: '1/23', engagementNotes: 'Water coolers', linkedIn: 'https://www.linkedin.com/company/briowatertech/people/' },
  { id: '2', companyName: 'Glacier Fresh / WaterH', contacts: '', state: 'NJ', type: 'OEM', stage: '', lastContact: '1/23', engagementNotes: 'WaterH is parent company', linkedIn: 'https://www.linkedin.com/company/glacier-fresh/people/' },
  { id: '3', companyName: 'Aquatru', contacts: '', state: 'CA', type: 'OEM', stage: '', lastContact: '1/23', engagementNotes: 'Ideal Living is parent company', linkedIn: 'https://www.linkedin.com/company/aquatru' },
  { id: '4', companyName: 'iSpring', contacts: '', state: 'GA', type: 'OEM', stage: '', lastContact: '', engagementNotes: '', linkedIn: '' },
  { id: '5', companyName: 'Multiplex Beverage', contacts: '', state: 'IN', type: 'OEM', stage: '', lastContact: '1/20', engagementNotes: 'Soda dispensers', linkedIn: 'https://www.linkedin.com/company/multiplexbeverage/people/' },
  { id: '6', companyName: 'Micro Matic', contacts: '', state: 'FL', type: 'OEM', stage: 'No Current Interest', lastContact: '1/20', engagementNotes: 'Beverage dispensers - hard to locate email format - Michelle cell: 813-727-9420', linkedIn: 'https://www.linkedin.com/company/micro-matic---beverage-dispensing/about/' },
  { id: '7', companyName: 'Foxx Equipment', contacts: '', state: 'KS', type: 'Distributor', stage: '', lastContact: '1/20', engagementNotes: 'Beverage dispensers - mainly distributor looks like not OEM', linkedIn: 'https://www.linkedin.com/company/foxx-equipment-company/about/' },
  { id: '8', companyName: 'Charger Water', contacts: 'Clay & Mike & James A.', state: 'USA', type: 'Distributor', stage: 'Quotes', lastContact: '1/14', engagementNotes: 'Spoke to Mike (Dir. of Purchasing) - PA branch most UV vol - Emailed (George Bosch) directly and resent quotes to Rebecca (FDesk)', linkedIn: '' },
  { id: '9', companyName: 'Antunes', contacts: '', state: 'IL', type: 'OEM', stage: '', lastContact: '1/14', engagementNotes: '', linkedIn: 'https://www.linkedin.com/company/a.j.-antunes-&-co/people/' },
  { id: '10', companyName: 'Scotsman Ice Systems', contacts: '', state: 'IL', type: 'OEM', stage: '', lastContact: '1/14', engagementNotes: '200+ people on Li', linkedIn: 'https://www.linkedin.com/company/scotsman-ice-systems/' },
  { id: '11', companyName: 'Ico-O-Matic', contacts: '', state: 'CO', type: 'OEM', stage: '', lastContact: '1/14', engagementNotes: '100+ people on Li', linkedIn: 'https://www.linkedin.com/company/mile-high-equipment-co/posts/?feedView=all' },
  { id: '12', companyName: 'Master Spas', contacts: '', state: 'IN', type: '', stage: '', lastContact: '1/13', engagementNotes: '', linkedIn: 'https://www.linkedin.com/company/master-spas-inc-/posts/?feedView=all' },
  { id: '13', companyName: 'The Water Clinic', contacts: '', state: 'Canada', type: 'Distributor', stage: '', lastContact: '1/13', engagementNotes: 'mention PureAqua systems next', linkedIn: '' },
  { id: '14', companyName: 'U-Line Corp', contacts: '', state: 'MI', type: 'OEM', stage: '', lastContact: '1/13', engagementNotes: 'Ice Machines. More contacts on LinkedIn', linkedIn: 'https://www.linkedin.com/company/u-line-corporation/' },
  { id: '15', companyName: 'Haws', contacts: '', state: 'NV', type: 'OEM', stage: '', lastContact: '1/13', engagementNotes: 'Fountains. More contacts on LinkedIn', linkedIn: 'https://www.linkedin.com/company/haws-corporation/people/' },
  { id: '16', companyName: 'Canature WaterGroup', contacts: '', state: 'Canada', type: 'OEM', stage: '', lastContact: '1/13', engagementNotes: 'More contacts on LinkedIn', linkedIn: 'https://www.linkedin.com/company/canature-watergroup/people/' },
  { id: '17', companyName: 'Natura Water', contacts: 'Brandon Wall', state: 'OH', type: '', stage: '', lastContact: '1/13', engagementNotes: 'Call next', linkedIn: 'https://www.linkedin.com/company/natura-water/posts/?feedView=all' },
  { id: '18', companyName: 'Hoshizaki America', contacts: '', state: 'GA', type: 'OEM', stage: '', lastContact: '1/13', engagementNotes: 'Ice Machines. More contacts on LinkedIn', linkedIn: 'https://www.linkedin.com/company/hoshizaki-america/' },
  { id: '19', companyName: 'Blake Equipment', contacts: 'Mark H.', state: 'CT', type: 'Distributor', stage: '', lastContact: '1/7', engagementNotes: 'Jesse Monette is water treatment prod manager so call him. Call diff locations', linkedIn: 'https://www.linkedin.com/company/blake-equipment-company/people/' },
  { id: '20', companyName: 'Performance Water Products', contacts: 'John M. & Mat M.', state: 'CA', type: 'Distributor', stage: 'Disco Call, Quotes', lastContact: '1/7', engagementNotes: 'Emailed quotes for 10 GPM and 2 GPM', linkedIn: 'https://www.linkedin.com/in/mat-mecca-48198870/' },
  { id: '21', companyName: 'HOPE Hydration', contacts: 'Jorge R. Douglas P.', state: 'NY', type: 'OEM', stage: '', lastContact: '1/7', engagementNotes: "Call next - Can't tell if they use UVs", linkedIn: 'https://www.linkedin.com/company/hope-hydration/people/' },
  { id: '22', companyName: 'OffGridBox', contacts: 'Emiliano C. Davide B.', state: 'MA', type: 'OEM', stage: '', lastContact: '1/7', engagementNotes: 'Call next - Pioneer unit has UVs', linkedIn: 'https://www.linkedin.com/company/offgridbox/people/' },
  { id: '23', companyName: 'Follett', contacts: '', state: 'PA', type: 'OEM', stage: '', lastContact: '1/7', engagementNotes: 'Calls next but more engineers on Li', linkedIn: 'https://www.linkedin.com/company/follett-corporation/about/' },
  { id: '24', companyName: 'Aquaria', contacts: 'Brian S. Neil M.', state: 'TX', type: 'OEM', stage: '', lastContact: '1/7', engagementNotes: 'Matt S. : +1 (424) 402-1915 - confirmed they have UVs in all systems', linkedIn: 'https://www.linkedin.com/company/aquariaawg/' },
  { id: '25', companyName: 'Cal Spas', contacts: 'Marcus O. Casey L.', state: 'CA', type: 'OEM', stage: 'Contact Made', lastContact: '1/7', engagementNotes: 'Spoke to Pedro - FD at 1800-CalSpas transfers to team members', linkedIn: 'https://www.linkedin.com/company/cal-spas/posts/?feedView=all' },
  { id: '26', companyName: 'Rayne Water', contacts: 'Art V. (Owner)', state: 'CA', type: 'OEM', stage: '', lastContact: '1/7', engagementNotes: 'Art V. is owner of Big Valley Pure Water', linkedIn: 'https://www.linkedin.com/company/rayne-water/posts/?feedView=all' },
  { id: '27', companyName: 'Water Chef', contacts: 'Lacey R. (COO)', state: 'NY', type: 'eCommerce', stage: 'Contact Made', lastContact: '1/6', engagementNotes: 'Spoke to Lacey and resent email (775) 6243011 Ext 107', linkedIn: 'https://www.linkedin.com/company/waterchef/posts/?feedView=all' },
  { id: '28', companyName: 'Aquaflow Pump & Supply', contacts: 'David Sr. & Paul C.', state: 'DE', type: 'Distributor', stage: 'Quotes', lastContact: '1/6', engagementNotes: 'Spoke to David Sr. (purchasing) and connected with Paul C. then emailed quotes and lab tests.', linkedIn: 'https://www.linkedin.com/company/aquaflow-pump-&-supply-co.-inc/posts/?feedView=all' },
  { id: '29', companyName: 'Canadian Water Warehouse', contacts: 'Chris P. & Jillian', state: 'Canada', type: 'eCommerce', stage: '', lastContact: '1/6', engagementNotes: 'No Li. Call next 905-853-0040', linkedIn: 'https://www.linkedin.com/in/chris-polanowski-02648a18/' },
  { id: '30', companyName: 'Preferred Pump', contacts: 'Sara C', state: 'USA', type: 'Distributor', stage: '', lastContact: '1/6', engagementNotes: 'Keep calling through team directory and Li contacts', linkedIn: 'https://www.linkedin.com/company/preferred-pump-&-equipment/posts/?feedView=all' },
  { id: '31', companyName: 'Nelsen Corporation', contacts: 'Dave N. John I.', state: 'OH', type: 'Distributor', stage: 'Contact Made', lastContact: '1/6', engagementNotes: 'FD transfers calls (except Dave N.) so keep hammering - (800) 362-9686', linkedIn: 'https://www.linkedin.com/company/nelsencorporation/posts/?feedView=all' },
  { id: '32', companyName: 'Atlantic Filter', contacts: 'James W. (CEO)', state: 'FL', type: 'Distributor', stage: '', lastContact: '1/6', engagementNotes: 'Amanda M (VP) Whit W (Purchasing) - Office: (561) 683-0100', linkedIn: '' },
  { id: '33', companyName: 'Polar Station', contacts: 'Heather and Terrance', state: 'MO', type: 'OEM', stage: 'No Current Interest, Quotes', lastContact: '1/22', engagementNotes: 'Terrance replied "it\'s all about price of 4 GPM"', linkedIn: '' },
  { id: '34', companyName: 'A.O. Smith', contacts: 'Doug Moser', state: 'USA', type: 'OEM', stage: 'Contact Made', lastContact: '12/18', engagementNotes: 'Jeff R said new PoC is Doug Moser at corporate.', linkedIn: '' },
  { id: '35', companyName: 'Franklin Water', contacts: 'Don L. Michael B.', state: 'IN', type: 'Distributor', stage: '', lastContact: '12/18', engagementNotes: 'Added Michael B(Vp) and Patrick M(Vp) to funnel', linkedIn: 'https://www.linkedin.com/company/franklin-electric' },
  { id: '36', companyName: 'Quench', contacts: 'James D.', state: 'USA', type: 'OEM', stage: '', lastContact: '12/17', engagementNotes: '', linkedIn: 'https://www.linkedin.com/company/quench-usa-inc/posts/' },
  { id: '37', companyName: 'ERE (Environmental Remediation Equipment)', contacts: 'Angelo D and Mary B.', state: 'Canada', type: 'Distributor', stage: '', lastContact: '12/17', engagementNotes: '', linkedIn: '' },
  { id: '38', companyName: 'Murdock Mfg (Morris Group Int.)', contacts: '', state: 'CA', type: 'OEM', stage: '', lastContact: '12/16', engagementNotes: 'Fountains. Find more engineers and product devs', linkedIn: 'https://www.linkedin.com/company/morrisgroupinternational/people/' },
  { id: '39', companyName: 'Miller Leaman', contacts: 'Marty S.', state: 'FL', type: 'OEM', stage: '', lastContact: '12/11', engagementNotes: 'Denis "sent to the team" but emailing others - Ask for others than Larry Call', linkedIn: 'https://www.linkedin.com/company/miller-leaman/posts/?feedView=all' },
  { id: '40', companyName: 'Kold Draft', contacts: '', state: 'PA', type: 'OEM', stage: '', lastContact: '', engagementNotes: '', linkedIn: 'https://www.linkedin.com/company/kold-draft/' },
];

export const getStageColor = (stage: string): { bg: string; text: string } => {
  const stageLower = stage.toLowerCase();
  if (stageLower.includes('quotes')) return { bg: 'bg-stage-quotes', text: 'text-stage-quotes-foreground' };
  if (stageLower.includes('contact made')) return { bg: 'bg-stage-contact', text: 'text-stage-contact-foreground' };
  if (stageLower.includes('no current interest')) return { bg: 'bg-stage-lost', text: 'text-stage-lost-foreground' };
  if (stageLower.includes('closed')) return { bg: 'bg-stage-closed', text: 'text-stage-closed-foreground' };
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
