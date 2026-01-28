import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  accentColor?: string;
}

const MetricCard = ({ title, value, subtitle, icon: Icon, trend, accentColor }: MetricCardProps) => {
  return (
    <div className="metric-card animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-semibold mt-2 font-mono tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trend.positive ? 'text-stage-closed' : 'text-destructive'}`}>
              <span>{trend.positive ? '↑' : '↓'}</span>
              <span>{trend.value}%</span>
            </div>
          )}
        </div>
        <div 
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${accentColor || 'bg-primary/10'}`}
        >
          <Icon className={`w-6 h-6 ${accentColor ? 'text-white' : 'text-primary'}`} />
        </div>
      </div>
    </div>
  );
};

export default MetricCard;
