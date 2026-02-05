import { getLeadTierColor } from '@/data/prospects';

interface LeadTierBadgeProps {
  leadTier: string;
}

const LeadTierBadge = ({ leadTier }: LeadTierBadgeProps) => {
  if (!leadTier) return null;
  
  const colors = getLeadTierColor(leadTier);
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${colors.bg} ${colors.text}`}>
      {leadTier}
    </span>
  );
};

export default LeadTierBadge;
