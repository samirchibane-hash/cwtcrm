import { LogOut, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NAV_GROUPS } from './nav-items';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onOpenSearch: () => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const Sidebar = ({ activeView, onViewChange, onOpenSearch }: SidebarProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const initials = (user?.email || '?').slice(0, 2).toUpperCase();

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Workspace */}
      <div className="flex items-center gap-2.5 px-4 h-14">
        <img src="/canopus-logo.png" alt="" className="w-7 h-7 rounded-md object-cover" />
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight tracking-tight">Canopus</p>
          <p className="text-[11px] text-muted-foreground leading-tight">Pipeline Manager</p>
        </div>
      </div>

      {/* Search / command palette trigger */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex w-full items-center gap-2 h-8 px-2.5 rounded-md border border-sidebar-border bg-background text-sm text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="text-[10px] font-medium border border-sidebar-border rounded px-1 py-px">
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 space-y-4">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <p className="px-2.5 pb-1 text-[11px] font-medium text-muted-foreground">{group.label}</p>
            <div className="space-y-px">
              {group.items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onViewChange(item.id)}
                  aria-current={activeView === item.id ? 'page' : undefined}
                  className={`sidebar-item w-full ${activeView === item.id ? 'active' : ''}`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Account */}
      <div className="flex items-center gap-2.5 p-3 border-t border-sidebar-border">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
          {initials}
        </div>
        <p className="flex-1 min-w-0 truncate text-xs text-muted-foreground">{user?.email}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Sign out</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
};

export default Sidebar;
