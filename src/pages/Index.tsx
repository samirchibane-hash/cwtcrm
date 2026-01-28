import { useState } from 'react';
import Sidebar from '@/components/crm/Sidebar';
import Dashboard from '@/components/crm/Dashboard';
import ProspectsTable from '@/components/crm/ProspectsTable';
import PipelineView from '@/components/crm/PipelineView';
import ProspectDetail from '@/components/crm/ProspectDetail';
import { Prospect } from '@/data/prospects';

const Index = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard onSelectProspect={setSelectedProspect} />;
      case 'prospects':
        return <ProspectsTable onSelectProspect={setSelectedProspect} />;
      case 'pipeline':
        return <PipelineView onSelectProspect={setSelectedProspect} />;
      default:
        return <Dashboard onSelectProspect={setSelectedProspect} />;
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
      default:
        return 'Dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      
      <main className="ml-64 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground">{getViewTitle()}</h1>
          <p className="text-muted-foreground mt-1">
            {activeView === 'dashboard' && 'Overview of your sales pipeline'}
            {activeView === 'prospects' && 'Manage and track all your prospects'}
            {activeView === 'pipeline' && 'Visual view of your sales stages'}
          </p>
        </header>

        {renderView()}
      </main>

      {selectedProspect && (
        <ProspectDetail 
          prospect={selectedProspect} 
          onClose={() => setSelectedProspect(null)} 
        />
      )}
    </div>
  );
};

export default Index;
