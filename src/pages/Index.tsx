import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '@/components/crm/Sidebar';
import MobileNav from '@/components/crm/MobileNav';
import MobileHeader from '@/components/crm/MobileHeader';
import CommandPalette from '@/components/crm/CommandPalette';
import { NAV_ITEMS } from '@/components/crm/nav-items';
import ProspectsTable from '@/components/crm/ProspectsTable';
import OrdersReportingDashboard from '@/components/crm/OrdersReportingDashboard';
import OrdersTable from '@/components/crm/OrdersTable';
import ActivityDashboard from '@/components/crm/ActivityDashboard';
import { AIRecommendationsPage } from '@/components/crm/AIRecommendationsPage';
import { OutreachAgentPage } from '@/components/crm/OutreachAgentPage';
import { TasksPage } from '@/components/crm/TasksPage';
import AutomationsPage from '@/components/crm/AutomationsPage';
import { Prospect } from '@/data/prospects';

const VIEWS = ['pipeline', 'prospects', 'agent', 'automations', 'orders', 'reports', 'activity', 'tasks'];
// Legacy params (briefing = retired Daily Briefing tab) all land on the pipeline
const LEGACY_PIPELINE_VIEWS = ['prospects', 'customers', 'dashboard', 'briefing'];

const resolveView = (param: string | null) => {
  if (!param || LEGACY_PIPELINE_VIEWS.includes(param) || !VIEWS.includes(param)) return 'pipeline';
  return param;
};

const Index = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchOpen, setSearchOpen] = useState(false);
  // The view lives in the URL so it survives refresh and can be shared
  const activeView = resolveView(searchParams.get('view'));
  // Pipeline filters live in the URL too; remember them while the user visits other views
  const pipelineSearch = useRef<string>(activeView === 'pipeline' ? searchParams.toString() : '');
  if (activeView === 'pipeline') pipelineSearch.current = searchParams.toString();

  const setActiveView = (view: string) => {
    if (view === activeView) return;
    if (view === 'pipeline') {
      const params = new URLSearchParams(pipelineSearch.current);
      params.set('view', 'pipeline');
      setSearchParams(params);
    } else {
      setSearchParams({ view });
    }
  };

  const handleSelectProspect = (prospect: Prospect) => {
    navigate(`/company/${prospect.id}`);
  };

  const renderView = () => {
    switch (activeView) {
      case 'pipeline':
        return <ProspectsTable onSelectProspect={handleSelectProspect} />;
      case 'prospects':
        return <AIRecommendationsPage />;
      case 'agent':
        return <OutreachAgentPage />;
      case 'automations':
        return <AutomationsPage />;
      case 'orders':
        return <OrdersTable />;
      case 'reports':
        return <OrdersReportingDashboard />;
      case 'activity':
        return <ActivityDashboard />;
      case 'tasks':
        return <TasksPage />;
      default:
        return <ProspectsTable onSelectProspect={handleSelectProspect} />;
    }
  };

  const current = NAV_ITEMS.find(item => item.id === activeView) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar activeView={activeView} onViewChange={setActiveView} onOpenSearch={() => setSearchOpen(true)} />
      </div>

      {/* Mobile Header - Hidden on desktop */}
      <MobileHeader title={current.label} onOpenSearch={() => setSearchOpen(true)} />

      {/* Main Content */}
      <main className="md:ml-60 px-4 py-4 md:px-8 md:py-6 mb-safe-nav md:mb-0">
        {/* Desktop Header - Hidden on mobile */}
        <header className="mb-5 hidden md:block">
          <h1 className="text-xl font-semibold tracking-tight">{current.label}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{current.subtitle}</p>
        </header>

        {renderView()}
      </main>

      {/* Mobile Bottom Nav - Hidden on desktop */}
      <MobileNav activeView={activeView} onViewChange={setActiveView} />

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} onNavigate={setActiveView} />
    </div>
  );
};

export default Index;
