import { getInvestorStageColor } from '@/data/investors';

const InvestorStageBadge = ({ stage }: { stage: string }) => {
  if (!stage) return <span className="text-muted-foreground text-sm">—</span>;
  const colors = getInvestorStageColor(stage);
  return <span className={`stage-badge ${colors.bg} ${colors.text}`}>{stage}</span>;
};

export default InvestorStageBadge;
