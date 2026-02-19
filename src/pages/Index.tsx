import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '@/components/crm/Sidebar';
import MobileNav from '@/components/crm/MobileNav';
import MobileHeader from '@/components/crm/MobileHeader';
import ProspectsTable from '@/components/crm/ProspectsTable';
import OrdersReportingDashboard from '@/components/crm/OrdersReportingDashboard';
import OrdersTable from '@/components/crm/OrdersTable';
import ActivityDashboard from '@/components/crm/ActivityDashboard';
import { Prospect } from '@/data/prospects';

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeView, setActiveView] = useState('pipeline');

  // Handle view query parameter (e.g., /?view=orders)
  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam && ['pipeline', 'orders', 'reports', 'activity'].includes(viewParam)) {
      setActiveView(viewParam);
    }
    // Support legacy params
    if (viewParam === 'prospects' || viewParam === 'customers' || viewParam === 'dashboard') {
      setActiveView('pipeline');
    }
  }, [searchParams]);

  const handleSelectProspect = (prospect: Prospect) => {
    navigate(`/company/${prospect.id}`);
  };

  const renderView = () => {
    switch (activeView) {
      case 'pipeline':
        return <ProspectsTable onSelectProspect={handleSelectProspect} />;
      case 'orders':
        return <OrdersTable />;
      case 'reports':
        return <OrdersReportingDashboard />;
      case 'activity':
        return <ActivityDashboard />;
      default:
        return <ProspectsTable onSelectProspect={handleSelectProspect} />;
    }
  };

  const getViewTitle = () => {
    switch (activeView) {
      case 'pipeline': return 'Pipeline';
      case 'orders': return 'Orders';
      case 'reports': return 'Reports';
      case 'activity': return 'Activity Tracker';
      default: return 'Pipeline';
    }
  };

  const getViewSubtitle = () => {
    switch (activeView) {
      case 'pipeline': return 'Manage and track all your prospects and customers';
      case 'orders': return 'Track all customer orders and shipments';
      case 'reports': return 'Revenue analytics and business insights';
      case 'activity': return 'Aggregate call and email activity across all companies';
      default: return 'Manage and track all your prospects and customers';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
      </div>
      
      {/* Mobile Header - Hidden on desktop */}
      <MobileHeader title={getViewTitle()} />
      
      {/* Main Content */}
      <main className="md:ml-64 px-4 py-4 md:p-8 mb-safe-nav md:mb-0">
        {/* Desktop Header - Hidden on mobile */}
        <header className="mb-6 md:mb-8 hidden md:block">
          <h1 className="text-3xl font-semibold tracking-tight">{getViewTitle()}</h1>
          <p className="text-muted-foreground mt-1">{getViewSubtitle()}</p>
        </header>

        {renderView()}
      </main>

      {/* Mobile Bottom Nav - Hidden on desktop */}
      <MobileNav activeView={activeView} onViewChange={setActiveView} />
    </div>
  );
};

export default Index;
