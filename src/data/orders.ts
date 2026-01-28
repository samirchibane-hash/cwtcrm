export interface Order {
  id: string;
  customer: string;
  placed: string;
  units: number;
  modelType: string;
  invoice: string;
  status: 'Delivered' | 'Partially Shipped' | 'Paid' | 'PO/Invoice' | 'Loaner';
  tracking: string;
  orderUpdates: string;
}

// Parse total string like "(50) 2 GPM" or "(1) 20 GPM (1) 10 GPM"
const parseTotal = (totalStr: string): { units: number; modelType: string } => {
  const matches = totalStr.match(/\((\d+)\)\s*([^()]+)/g);
  if (!matches) return { units: 0, modelType: '' };
  
  let totalUnits = 0;
  const models: string[] = [];
  
  matches.forEach(match => {
    const parsed = match.match(/\((\d+)\)\s*(.+)/);
    if (parsed) {
      totalUnits += parseInt(parsed[1], 10);
      models.push(`${parsed[1]}x ${parsed[2].trim()}`);
    }
  });
  
  return { units: totalUnits, modelType: models.join(', ') };
};

export const orders: Order[] = [
  { id: '1', customer: 'US Water Systems', placed: '4/20/2025', ...parseTotal('(50) 2 GPM'), invoice: '', status: 'Delivered', tracking: '', orderUpdates: '6/24 Steve confirmed they received it' },
  { id: '2', customer: 'Next Gen Septic', placed: '4/25/2025', ...parseTotal('(1) 2 GPM'), invoice: '', status: 'Delivered', tracking: '', orderUpdates: '6/10: Rakesh said another 10-15 days to get a better idea on test results' },
  { id: '3', customer: 'Premier Pump', placed: '5/9/2025', ...parseTotal('(1) 20 GPM (1) 10 GPM'), invoice: '', status: 'Delivered', tracking: '', orderUpdates: '6/2: Told them 20 GPM will be shipped next week' },
  { id: '4', customer: 'H2O Care (Replacement)', placed: '5/19/2025', ...parseTotal('(3) 2 GPM'), invoice: '', status: 'Delivered', tracking: '', orderUpdates: 'Souheil said we should discuss before I call regarding 3 replacement units' },
  { id: '5', customer: 'Grande Ice', placed: '5/21/2025', ...parseTotal('(4) 3/4 GPM'), invoice: '', status: 'Delivered', tracking: 'https://www.fedex.com/wtrk/track/?trknbr=884103442200', orderUpdates: '' },
  { id: '6', customer: 'ColiMinder', placed: '5/28/2025', ...parseTotal('(1) 2 GPM'), invoice: '', status: 'Delivered', tracking: 'https://www.fedex.com/fedextrack/?trknbr=882101694126', orderUpdates: 'Paid. Souheil will ship it out. Shipped 6/17' },
  { id: '7', customer: 'Genesis', placed: '5/28/2025', ...parseTotal('(32) 2 GPM'), invoice: '', status: 'Delivered', tracking: 'https://www.fedex.com/fedextrack/?trknbr=882129087462', orderUpdates: 'Shipped 12 units on 6/18. The other 20 early next week from 6/30' },
  { id: '8', customer: 'Genesis', placed: '5/28/2025', ...parseTotal('(2) 10 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-fd02744536384be8819d6d32dfb24cf856270f4f82924d58ac58a4976ec213ad41f2cf01a69142af8f52d3012d408b61', status: 'Delivered', tracking: 'https://www.fedex.com/wtrk/track/?trknbr=882945109778', orderUpdates: 'Paid on 7/14' },
  { id: '9', customer: 'Ronnie', placed: '5/29/2025', ...parseTotal('(1) 10 GPM'), invoice: '', status: 'Delivered', tracking: '', orderUpdates: 'Paid invoice. Interested in a 20 GPM also.' },
  { id: '10', customer: 'Oasis', placed: '6/10/2025', ...parseTotal('(1) 2 GPM'), invoice: 'Loaner', status: 'Delivered', tracking: '', orderUpdates: '' },
  { id: '11', customer: 'Aqua Science', placed: '6/12/2025', ...parseTotal('(1) 10 GPM (1) 10 GPM-LED'), invoice: '', status: 'Delivered', tracking: 'https://www.fedex.com/fedextrack/?trknbr=882417792112', orderUpdates: 'Received updated PO but Souheil adjusted pricing. End of week, early next week 6/17' },
  { id: '12', customer: 'Futuramic Omaha Water', placed: '6/13/2025', ...parseTotal('(6) 3/4 GPM (2) 10 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-eb6bc97d3df9419e86b2ad3278e9ea3fdfdbd57ddd944165b2f045498a7db1d34116d735b8d44f8587abdd55cb1c8680', status: 'Delivered', tracking: 'https://www.fedex.com/fedextrack/?trknbr=883121825667', orderUpdates: 'Only one 10 GPM left.' },
  { id: '13', customer: 'Secondwind Water', placed: '6/16/2025', ...parseTotal('(1) 2 GPM (1) 10 GPM'), invoice: '', status: 'Delivered', tracking: '', orderUpdates: 'Paid but they want ASAP. Shipping both tomorrow 6/17.' },
  { id: '14', customer: 'Aquahaulics', placed: '6/16/2025', ...parseTotal('(1) 3/4 GPM'), invoice: '', status: 'Delivered', tracking: 'https://www.fedex.com/wtrk/track/?trknbr=882650017410', orderUpdates: 'Sent tracking link' },
  { id: '15', customer: 'Kinetico', placed: '6/24/2025', ...parseTotal('(1) 3/4 GPM'), invoice: '', status: 'Delivered', tracking: '', orderUpdates: 'Souheil confirmed to Mark it ships 6/25' },
  { id: '16', customer: 'Premier Pump', placed: '6/24/2025', ...parseTotal('(1) 2 GPM'), invoice: '', status: 'Delivered', tracking: '', orderUpdates: 'Placed by Tyler' },
  { id: '17', customer: 'Permatech', placed: '6/24/2025', ...parseTotal('(20) 2 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-fbf6156e02cb4196a002ccf2ae54aad6a3d8c0b3b6944f87979109295bb97441708878a064194e418537a7e9ab8f743c', status: 'Delivered', tracking: '', orderUpdates: 'Expect shipping on July 21st' },
  { id: '18', customer: 'Genesis', placed: '6/30/2025', ...parseTotal('(10) 2 GPM'), invoice: '', status: 'Delivered', tracking: '', orderUpdates: '' },
  { id: '19', customer: 'UV Water Treatment', placed: '8/14/2025', ...parseTotal('(2) 2 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-e22c14c3694a4111b27a8fc93afd43a6944d9b0492bd4b9383803622823f189435a600a8801541c1af0e852d0fb5c68c', status: 'Delivered', tracking: 'https://www.fedex.com/fedextrack/?trknbr=883572496400', orderUpdates: '' },
  { id: '20', customer: "O'Land Station", placed: '8/15/2025', ...parseTotal('(2) 4 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-a9f61ea76fe344af945700ac8609814dd8015c03205a4a379fd4182e3a5ebbcc4f7dd0bfa9574cec8481e43af7f162d3', status: 'Delivered', tracking: 'https://www.fedex.com/fedextrack/?trknbr=883790204912', orderUpdates: '' },
  { id: '21', customer: 'Jensen', placed: '8/20/2025', ...parseTotal('(1) 2 GPM (1) 10 GPM'), invoice: 'Loaner', status: 'Delivered', tracking: '', orderUpdates: 'Contract signed. Shipping loaners within the week' },
  { id: '22', customer: 'Genesis', placed: '8/29/2025', ...parseTotal('(10) 2 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-b7d09286fdea46dc850d6b1bc7a1bf3f63be23b5d40742819bacf0b3d678616f06172942c15e4bfe86f713fd9b3de945', status: 'Delivered', tracking: '', orderUpdates: '' },
  { id: '23', customer: 'Futuramic Omaha Water', placed: '9/1/2025', ...parseTotal('(6) 10 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-810f0e1f14024589a3da9edc56c3a9c462a8816dd0cb474ea0a113995f704be6f87f839a22ed4ee9ba8e897759a53fa7', status: 'Partially Shipped', tracking: '', orderUpdates: '4 total shipped as of 10/20' },
  { id: '24', customer: 'Genesis', placed: '9/16/2025', ...parseTotal('(25) 2 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-ccf7065dae1142e0a7c7b94aa11da0ceae7245468fa840bfb708884cb40941af1cf67686d4444925ba438fb51655be5f', status: 'Delivered', tracking: '', orderUpdates: '21 balance shipped on 10/27' },
  { id: '25', customer: 'US Water Systems', placed: '9/25/2025', ...parseTotal('(50) 2 GPM'), invoice: '', status: 'Delivered', tracking: 'https://www.fedex.com/fedextrack/?trknbr=885817381721', orderUpdates: 'Paid & Shipped 50/50' },
  { id: '26', customer: 'Premier Pump', placed: '10/1/2025', ...parseTotal('(1) 10 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-2677c2f8dbde46c792f1b6322b9a82dd798ba27b6bdf4d4ca2a87a860a4fe631c9c032f7045f476bb506c9b7c2c806ea', status: 'Delivered', tracking: '', orderUpdates: '' },
  { id: '27', customer: 'ADK Water Solutions', placed: '10/10/2025', ...parseTotal('(14) 2 GPM'), invoice: 'Replacements', status: 'Partially Shipped', tracking: '', orderUpdates: '7/7 sent fixed and shipped back on Jan 23rd.' },
  { id: '28', customer: 'Genesis', placed: '10/24/2025', ...parseTotal('(50) 2 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-63b3db63bc0a4e72adadb21467e4bb9cd3b8f62f00644cd7b12c71000b52760ebdcc557a375244ce9ee4dd425a37f2ce', status: 'Partially Shipped', tracking: 'https://www.fedex.com/wtrk/track/?trknbr=886784433491', orderUpdates: '30/50 as of Dec 18' },
  { id: '29', customer: 'US Water Systems', placed: '10/30/2025', ...parseTotal('(1) 10 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-bf05333dd3c14b46bb3dc16d33064ccff8921dde23ad4ddfa166d615784869f110194621f31948989f46fad7f1067e13', status: 'Delivered', tracking: '', orderUpdates: '' },
  { id: '30', customer: 'Chester Paul', placed: '11/5/2025', ...parseTotal('(1) 2 GPM'), invoice: 'Loaner', status: 'Delivered', tracking: '', orderUpdates: '' },
  { id: '31', customer: 'Jensen', placed: '11/7/2025', ...parseTotal('(1) 1 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-7535fa11dd7b455da2577f2158d8831c3e77e21620e44bc8b45485f18222f19ba0822ba09e9d4854920951e1732d6167', status: 'Delivered', tracking: 'https://www.fedex.com/fedextrack/?trknbr=885848218678', orderUpdates: '1st drop ship order - Check in mail' },
  { id: '32', customer: 'Ian Baikie', placed: '11/14/2025', ...parseTotal('(3) 20 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-d792d66642a048bcb6606bd6a28f5467ed92cf3b3a3a43a486ba4a669ec854849abe3e9cb1aa4eeabf95a38a4180ec5c', status: 'Paid', tracking: '', orderUpdates: '4-6 weeks ETA' },
  { id: '33', customer: 'ADK Water Solutions', placed: '12/11/2025', ...parseTotal('(4) 2 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-5f798393fdf143cbaa44c058b97aa92cdb5b7c66cb124be5bfccf749a8593d0b8d91f0d775f844b18eeaec4670267790', status: 'Delivered', tracking: 'https://www.fedex.com/wtrk/track/?trknbr=886989475109', orderUpdates: '' },
  { id: '34', customer: "O'Land Station", placed: '12/16/2025', ...parseTotal('(1) 2 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-154c89d401594611a1710c3c3d9d0e62f0587e55242e4efa98d9bcb671ddb42ee339b6b6d47a47d392eecee26bfdbb5c', status: 'Delivered', tracking: 'https://www.fedex.com/wtrk/track/?trknbr=887157982938', orderUpdates: 'To Belize but not paid as of 1/6/26' },
  { id: '35', customer: 'Futuramic Omaha Water', placed: '1/6/2026', ...parseTotal('(6) 10 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-4ab87712db8f448c811b97c6ddf8c8a1584e9accb2b6437595eb444755aac1ea00a7071d70a345e28da0857a07a5e0ef', status: 'Paid', tracking: '', orderUpdates: '' },
  { id: '36', customer: 'Grande Ice', placed: '12/11/2025', ...parseTotal('(10) 4 GPM'), invoice: 'https://connect.intuit.com/t/scs-v1-3cf8b5c3b15d414eb8e622df436852de0b78c34800c443c1ab5c50cf8f1efbd0e5e37cbdb23e403281389246721334ec', status: 'Paid', tracking: '', orderUpdates: '' },
  { id: '37', customer: 'US Water Systems', placed: '1/21/2026', ...parseTotal('(50) 2 GPM'), invoice: '', status: 'PO/Invoice', tracking: '', orderUpdates: '' },
];

export const getOrderStats = () => {
  const totalOrders = orders.length;
  const totalUnits = orders.reduce((sum, o) => sum + o.units, 0);
  const delivered = orders.filter(o => o.status === 'Delivered').length;
  const pending = orders.filter(o => o.status === 'Partially Shipped' || o.status === 'Paid' || o.status === 'PO/Invoice').length;
  
  return { totalOrders, totalUnits, delivered, pending };
};

export const getStatusColor = (status: Order['status']): { bg: string; text: string } => {
  switch (status) {
    case 'Delivered': return { bg: 'bg-green-500/10', text: 'text-green-600' };
    case 'Partially Shipped': return { bg: 'bg-yellow-500/10', text: 'text-yellow-600' };
    case 'Paid': return { bg: 'bg-blue-500/10', text: 'text-blue-600' };
    case 'PO/Invoice': return { bg: 'bg-orange-500/10', text: 'text-orange-600' };
    case 'Loaner': return { bg: 'bg-purple-500/10', text: 'text-purple-600' };
    default: return { bg: 'bg-muted', text: 'text-muted-foreground' };
  }
};
