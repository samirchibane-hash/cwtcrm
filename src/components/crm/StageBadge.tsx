import { getStageColor } from '@/data/prospects';

interface StageBadgeProps {
  stage: string;
  /** Max number of tags to render before collapsing the rest into a "+N" chip. */
  maxVisible?: number;
}

const StageBadge = ({ stage, maxVisible = 2 }: StageBadgeProps) => {
  // Split by comma to handle multiple stages
  const stages = stage ? stage.split(',').map(s => s.trim()).filter(Boolean) : [];

  if (stages.length === 0) return <span className="text-muted-foreground text-sm">—</span>;

  const tags = stages.map(s => ({ label: s, colors: getStageColor(s) }));

  const visible = tags.slice(0, maxVisible);
  const overflow = tags.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((tag, index) => (
        <span key={index} className={`stage-badge ${tag.colors.bg} ${tag.colors.text}`}>
          {tag.label}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="stage-badge bg-muted text-muted-foreground"
          title={tags.slice(maxVisible).map(t => t.label).join(', ')}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
};

export default StageBadge;
