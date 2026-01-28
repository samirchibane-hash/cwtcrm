export interface PricingTier {
  name: string;
  price: number;
}

export interface ProductModel {
  id: string;
  name: string;
  description: string;
  pricingTiers: PricingTier[];
}

// Default tier names
export const defaultTierNames = [
  'Tier 1 (1-10 units)',
  'Tier 2 (11-25 units)',
  'Tier 3 (26-50 units)',
  'Tier 4 (51-100 units)',
  'Tier 5 (100+ units)',
];

// Initial product models based on orders data
export const productModels: ProductModel[] = [
  {
    id: '1',
    name: '2 GPM',
    description: '2 Gallons Per Minute model',
    pricingTiers: [
      { name: defaultTierNames[0], price: 2500 },
      { name: defaultTierNames[1], price: 2300 },
      { name: defaultTierNames[2], price: 2100 },
      { name: defaultTierNames[3], price: 1900 },
      { name: defaultTierNames[4], price: 1700 },
    ],
  },
  {
    id: '2',
    name: '6 GPM',
    description: '6 Gallons Per Minute model',
    pricingTiers: [
      { name: defaultTierNames[0], price: 4500 },
      { name: defaultTierNames[1], price: 4200 },
      { name: defaultTierNames[2], price: 3900 },
      { name: defaultTierNames[3], price: 3600 },
      { name: defaultTierNames[4], price: 3300 },
    ],
  },
  {
    id: '3',
    name: '10 GPM',
    description: '10 Gallons Per Minute model',
    pricingTiers: [
      { name: defaultTierNames[0], price: 6500 },
      { name: defaultTierNames[1], price: 6100 },
      { name: defaultTierNames[2], price: 5700 },
      { name: defaultTierNames[3], price: 5300 },
      { name: defaultTierNames[4], price: 4900 },
    ],
  },
];

export const createEmptyModel = (): ProductModel => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  pricingTiers: defaultTierNames.map(name => ({ name, price: 0 })),
});
