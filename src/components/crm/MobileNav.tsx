import { Users, ShoppingCart, FileText, BarChart2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const navItems = [
  { id: 'pipeline', label: 'Pipeline', icon: Users },
  { id: 'prospects', label: 'Prospects', icon: Sparkles },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'activity', label: 'Activity', icon: BarChart2 },
];

const MobileNav = ({ activeView, onViewChange }: MobileNavProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* iOS-style blur background */}
      <div className="absolute inset-0 bg-card/80 backdrop-blur-xl border-t border-border" />
      
      {/* Safe area padding for iPhone home indicator */}
      <div className="relative flex items-center justify-around px-2 pt-2 pb-safe">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 px-3 min-w-[64px] transition-colors",
                isActive ? "text-accent" : "text-muted-foreground"
              )}
            >
              <item.icon 
                className={cn(
                  "w-6 h-6 transition-transform",
                  isActive && "scale-110"
                )} 
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={cn(
                "text-[10px] font-medium",
                isActive && "font-semibold"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
