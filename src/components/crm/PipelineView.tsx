import { prospects, Prospect, getStageColor } from '@/data/prospects';
import TypeBadge from './TypeBadge';

interface PipelineViewProps {
  onSelectProspect: (prospect: Prospect) => void;
}

const PipelineView = ({ onSelectProspect }: PipelineViewProps) => {
  const stages = [
    { id: 'new', label: 'New Leads', filter: (p: Prospect) => !p.stage },
    { id: 'contact', label: 'Contact Made', filter: (p: Prospect) => p.stage.toLowerCase().includes('contact made') },
    { id: 'quotes', label: 'Quotes Sent', filter: (p: Prospect) => p.stage.toLowerCase().includes('quotes') },
    { id: 'lost', label: 'No Interest', filter: (p: Prospect) => p.stage.toLowerCase().includes('no current interest') },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
      {stages.map((stage) => {
        const stageProspects = prospects.filter(stage.filter);
        const colors = getStageColor(stage.label);
        
        return (
          <div key={stage.id} className="space-y-4">
            {/* Stage Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{stage.label}</h3>
              <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {stageProspects.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-3">
              {stageProspects.map((prospect, index) => (
                <div
                  key={prospect.id}
                  className="glass-card rounded-lg p-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => onSelectProspect(prospect)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium text-sm leading-tight">{prospect.companyName}</h4>
                    <TypeBadge type={prospect.type} />
                  </div>
                  {prospect.contacts && (
                    <p className="text-xs text-muted-foreground mb-2">{prospect.contacts}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono">{prospect.state || '—'}</span>
                    <span className="font-mono">{prospect.lastContact || '—'}</span>
                  </div>
                </div>
              ))}

              {stageProspects.length === 0 && (
                <div className="glass-card rounded-lg p-6 text-center text-muted-foreground text-sm">
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
