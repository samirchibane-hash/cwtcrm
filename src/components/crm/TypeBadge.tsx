import { getTypeColor } from '@/data/prospects';

interface TypeBadgeProps {
  type: string;
}

const TypeBadge = ({ type }: TypeBadgeProps) => {
  if (!type) return <span className="text-muted-foreground text-sm">—</span>;
  
  const colors = getTypeColor(type);
  
  return (
    <span className={`type-badge ${colors.bg} ${colors.text}`}>
      {type}
    </span>
  );
};

export default TypeBadge;
