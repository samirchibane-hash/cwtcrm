import { getStageColor } from '@/data/prospects';

interface StageBadgeProps {
  stage: string;
}

const StageBadge = ({ stage }: StageBadgeProps) => {
  if (!stage) return <span className="text-muted-foreground text-sm">—</span>;
  
  const colors = getStageColor(stage);
  
  return (
    <span className={`stage-badge ${colors.bg} ${colors.text}`}>
      {stage}
    </span>
  );
};

export default StageBadge;
