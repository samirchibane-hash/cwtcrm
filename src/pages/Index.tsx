import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '@/components/crm/Sidebar';
import MobileNav from '@/components/crm/MobileNav';
import MobileHeader from '@/components/crm/MobileHeader';
import Dashboard from '@/components/crm/Dashboard';
import ProspectsTable from '@/components/crm/ProspectsTable';
import CustomersTable from '@/components/crm/CustomersTable';
import OrdersReportingDashboard from '@/components/crm/OrdersReportingDashboard';
import OrdersTable from '@/components/crm/OrdersTable';
import { Prospect } from '@/data/prospects';

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeView, setActiveView] = useState('dashboard');

  // Handle view query parameter (e.g., /?view=orders)
  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam && ['dashboard', 'prospects', 'customers', 'orders', 'reports'].includes(viewParam)) {
      setActiveView(viewParam);
    }
  }, [searchParams]);

  const handleSelectProspect = (prospect: Prospect) => {
    navigate(`/company/${prospect.id}`);
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard onSelectProspect={handleSelectProspect} />;
      case 'prospects':
        return <ProspectsTable onSelectProspect={handleSelectProspect} />;
      case 'customers':
        return <CustomersTable onSelectProspect={handleSelectProspect} />;
      case 'orders':
        return <OrdersTable />;
      case 'reports':
        return <OrdersReportingDashboard />;
      default:
        return <Dashboard onSelectProspect={handleSelectProspect} />;
    }
  };

  const getViewTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Dashboard';
      case 'prospects':
        return 'Prospects';
      case 'customers':
        return 'Customers';
      case 'orders':
        return 'Orders';
      case 'reports':
        return 'Reports';
      default:
        return 'Dashboard';
    }
  };

  const getViewSubtitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Overview of your sales pipeline';
      case 'prospects':
        return 'Manage and track all your prospects';
      case 'customers':
        return 'Manage your VIP customer relationships';
      case 'orders':
        return 'Track all customer orders and shipments';
      case 'reports':
        return 'Revenue analytics and business insights';
      default:
        return 'Overview of your sales pipeline';
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
