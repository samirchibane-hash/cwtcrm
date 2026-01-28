import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '@/components/crm/Sidebar';
import Dashboard from '@/components/crm/Dashboard';
import ProspectsTable from '@/components/crm/ProspectsTable';
import PipelineView from '@/components/crm/PipelineView';
import OrdersTable from '@/components/crm/OrdersTable';
import { Prospect } from '@/data/prospects';

const Index = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('dashboard');

  const handleSelectProspect = (prospect: Prospect) => {
    navigate(`/company/${prospect.id}`);
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard onSelectProspect={handleSelectProspect} />;
      case 'prospects':
        return <ProspectsTable onSelectProspect={handleSelectProspect} />;
      case 'pipeline':
        return <PipelineView onSelectProspect={handleSelectProspect} />;
      case 'orders':
        return <OrdersTable />;
      default:
        return <Dashboard onSelectProspect={handleSelectProspect} />;
    }
  };

  const getViewTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Dashboard';
      case 'prospects':
        return 'All Prospects';
      case 'pipeline':
        return 'Sales Pipeline';
      case 'orders':
        return 'Orders';
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
      case 'pipeline':
        return 'Visual view of your sales stages';
      case 'orders':
        return 'Track all customer orders and shipments';
      default:
        return 'Overview of your sales pipeline';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      
      <main className="ml-64 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">{getViewTitle()}</h1>
          <p className="text-muted-foreground mt-1">{getViewSubtitle()}</p>
        </header>

        {renderView()}
      </main>
    </div>
  );
};

export default Index;
