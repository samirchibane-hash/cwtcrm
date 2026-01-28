import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useProspects } from '@/context/ProspectsContext';
import { Prospect } from '@/data/prospects';
import TypeBadge from './TypeBadge';

interface PipelineViewProps {
  onSelectProspect: (prospect: Prospect) => void;
}

const PipelineView = ({ onSelectProspect }: PipelineViewProps) => {
  const navigate = useNavigate();
  const { prospects, isLoading } = useProspects();
  
  const stages = [
    { id: 'new', label: 'New Leads', filter: (p: Prospect) => !p.stage },
    { id: 'contact', label: 'Contact Made', filter: (p: Prospect) => p.stage.toLowerCase().includes('contact made') },
    { id: 'quotes', label: 'Quotes Sent', filter: (p: Prospect) => p.stage.toLowerCase().includes('quotes') },
    { id: 'lost', label: 'No Interest', filter: (p: Prospect) => p.stage.toLowerCase().includes('no current interest') },
  ];

  const handleCardClick = (prospect: Prospect) => {
    navigate(`/company/${prospect.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
      {stages.map((stage) => {
        const stageProspects = prospects.filter(stage.filter);
        
        return (
          <div key={stage.id} className="space-y-4">
            {/* Stage Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{stage.label}</h3>
              <span className="text-sm font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                {stageProspects.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-3">
              {stageProspects.map((prospect, index) => (
                <div
                  key={prospect.id}
                  className="content-card p-4 cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => handleCardClick(prospect)}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h4 className="font-medium text-sm leading-tight">{prospect.companyName}</h4>
                    <TypeBadge type={prospect.type} />
                  </div>
                  {prospect.contacts.length > 0 && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {prospect.contacts.map(c => c.name).join(', ')}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono">{prospect.state || '—'}</span>
                    <span className="font-mono">{prospect.lastContact || '—'}</span>
                  </div>
                </div>
              ))}

              {stageProspects.length === 0 && (
                <div className="content-card p-8 text-center text-muted-foreground text-sm">
                  No prospects in this stage
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PipelineView;
