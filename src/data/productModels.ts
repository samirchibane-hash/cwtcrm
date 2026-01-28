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

// Default tier names based on volume pricing
export const defaultTierNames = [
  '10 units',
  '25 units',
  '50 units',
  '100 units',
  '250 units',
  '500+ units',
];

// Initial product models based on 2025-08-15 pricing chart
export const productModels: ProductModel[] = [
  {
    id: '1',
    name: '1 GPM',
    description: 'C-UV200f - 1 GPM (4LPM) UVC-LED Water Disinfection System',
    pricingTiers: [
      { name: defaultTierNames[0], price: 0 },
      { name: defaultTierNames[1], price: 0 },
      { name: defaultTierNames[2], price: 185 },
      { name: defaultTierNames[3], price: 167 },
      { name: defaultTierNames[4], price: 150 },
      { name: defaultTierNames[5], price: 137 },
    ],
  },
  {
    id: '2',
    name: '2 GPM',
    description: 'C-UV200P - 2 GPM (8LPM) UVC-LED Water Disinfection System',
    pricingTiers: [
      { name: defaultTierNames[0], price: 0 },
      { name: defaultTierNames[1], price: 0 },
      { name: defaultTierNames[2], price: 205 },
      { name: defaultTierNames[3], price: 187 },
      { name: defaultTierNames[4], price: 170 },
      { name: defaultTierNames[5], price: 157 },
    ],
  },
  {
    id: '3',
    name: '4 GPM',
    description: 'C-UV200PS - 4 GPM (8LPM) UVC-LED Water Disinfection System',
    pricingTiers: [
      { name: defaultTierNames[0], price: 0 },
      { name: defaultTierNames[1], price: 0 },
      { name: defaultTierNames[2], price: 335 },
      { name: defaultTierNames[3], price: 295 },
      { name: defaultTierNames[4], price: 269 },
      { name: defaultTierNames[5], price: 249 },
    ],
  },
  {
    id: '4',
    name: '6 GPM',
    description: 'C-UV200n - 6 GPM (24LPM) UVC-LED Water Disinfection System',
    pricingTiers: [
      { name: defaultTierNames[0], price: 0 },
      { name: defaultTierNames[1], price: 0 },
      { name: defaultTierNames[2], price: 663 },
      { name: defaultTierNames[3], price: 629 },
      { name: defaultTierNames[4], price: 599 },
      { name: defaultTierNames[5], price: 575 },
    ],
  },
  {
    id: '5',
    name: '10 GPM',
    description: 'C-UV200u - 10 GPM (40LPM) UVC-LED Water Disinfection System',
    pricingTiers: [
      { name: defaultTierNames[0], price: 1150 },
      { name: defaultTierNames[1], price: 1035 },
      { name: defaultTierNames[2], price: 955 },
      { name: defaultTierNames[3], price: 885 },
      { name: defaultTierNames[4], price: 810 },
      { name: defaultTierNames[5], price: 0 },
    ],
  },
  {
    id: '6',
    name: '20 GPM',
    description: 'C-UV200 - 20 GPM (80LPM) UVC-LED Water Disinfection System',
    pricingTiers: [
      { name: defaultTierNames[0], price: 1650 },
      { name: defaultTierNames[1], price: 1485 },
      { name: defaultTierNames[2], price: 1337 },
      { name: defaultTierNames[3], price: 1270 },
      { name: defaultTierNames[4], price: 1143 },
      { name: defaultTierNames[5], price: 0 },
    ],
  },
  {
    id: '7',
    name: '30 GPM',
    description: 'C-UV200+ - 30 GPM (80LPM) UVC-LED Water Disinfection System',
    pricingTiers: [
      { name: defaultTierNames[0], price: 1995 },
      { name: defaultTierNames[1], price: 1795 },
      { name: defaultTierNames[2], price: 1650 },
      { name: defaultTierNames[3], price: 1485 },
      { name: defaultTierNames[4], price: 1350 },
      { name: defaultTierNames[5], price: 0 },
    ],
  },
];

export const createEmptyModel = (): ProductModel => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  pricingTiers: defaultTierNames.map(name => ({ name, price: 0 })),
});

// MSRP prices for reference
export const msrpPrices: Record<string, number> = {
  '1 GPM': 370,
  '2 GPM': 429,
  '4 GPM': 650,
  '6 GPM': 1290,
  '10 GPM': 1900,
  '20 GPM': 2675,
  '30 GPM': 3200,
};
