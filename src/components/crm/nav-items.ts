import { Users, FileText, ShoppingCart, BarChart2, Bot, CheckSquare2, Zap, LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  subtitle: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Single source of truth for the main views: Sidebar, command palette and page headers read from here.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Sell',
    items: [
      { id: 'pipeline', label: 'Pipeline', icon: Users, subtitle: 'Every prospect and customer, filterable and shareable' },
      { id: 'tasks', label: 'Tasks', icon: CheckSquare2, subtitle: 'Follow-ups and to-dos linked to pipeline companies' },
    ],
  },
  {
    label: 'Outreach',
    items: [
      { id: 'agent', label: 'Claude Agent', icon: Bot, subtitle: 'Discover contacts, review, and launch outreach campaigns' },
      { id: 'automations', label: 'Automations', icon: Zap, subtitle: 'Email sequences that send themselves and stop when someone replies' },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { id: 'orders', label: 'Orders', icon: ShoppingCart, subtitle: 'Customer orders, invoices and shipments' },
      { id: 'reports', label: 'Reports', icon: FileText, subtitle: 'Revenue analytics and business insights' },
      { id: 'activity', label: 'Activity', icon: BarChart2, subtitle: 'Call and email activity across all companies' },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items);
