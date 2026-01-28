import { getStageColor } from '@/data/prospects';

interface StageBadgeProps {
  stage: string;
}

const StageBadge = ({ stage }: StageBadgeProps) => {
  if (!stage) return <span className="text-muted-foreground text-sm">—</span>;
  
  // Split by comma to handle multiple stages
  const stages = stage.split(',').map(s => s.trim()).filter(Boolean);
  
  if (stages.length === 0) return <span className="text-muted-foreground text-sm">—</span>;
  
  return (
    <div className="flex flex-wrap gap-1">
      {stages.map((s, index) => {
        const colors = getStageColor(s);
        return (
          <span key={index} className={`stage-badge ${colors.bg} ${colors.text}`}>
            {s}
          </span>
        );
      })}
    </div>
  );
};

export default StageBadge;
