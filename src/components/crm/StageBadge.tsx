import { getStageColor, getLeadTierColor } from '@/data/prospects';

interface StageBadgeProps {
  stage: string;
  leadTier?: string;
}

const StageBadge = ({ stage, leadTier }: StageBadgeProps) => {
  // Split by comma to handle multiple stages
  const stages = stage ? stage.split(',').map(s => s.trim()).filter(Boolean) : [];

  if (!leadTier && stages.length === 0) return <span className="text-muted-foreground text-sm">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {/* Lead Tier rides along as the first tag and keeps its own tier color */}
      {leadTier && (() => {
        const colors = getLeadTierColor(leadTier);
        return (
          <span className={`stage-badge ${colors.bg} ${colors.text}`}>
            {leadTier}
          </span>
        );
      })()}
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
