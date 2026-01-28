import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
}

const MetricCard = ({ title, value, subtitle, icon: Icon, trend }: MetricCardProps) => {
  return (
    <div className="metric-card animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-4xl font-semibold mt-3 tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trend.positive ? 'text-stage-closed' : 'text-destructive'}`}>
              <span>{trend.positive ? '↑' : '↓'}</span>
              <span>{trend.value}%</span>
            </div>
          )}
        </div>
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
};

export default MetricCard;
