import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ExternalLink, Filter, ChevronDown, Loader2 } from 'lucide-react';
import { useProspects } from '@/context/ProspectsContext';
import { Prospect } from '@/data/prospects';
import StageBadge from './StageBadge';
import TypeBadge from './TypeBadge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface ProspectsTableProps {
  onSelectProspect: (prospect: Prospect) => void;
}

const ProspectsTable = ({ onSelectProspect }: ProspectsTableProps) => {
  const navigate = useNavigate();
  const { prospects, isLoading } = useProspects();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState<string[]>([]);

  const types = ['OEM', 'Distributor', 'eCommerce'];
  const stages = ['Quotes', 'Contact Made', 'No Current Interest'];

  const filteredProspects = prospects.filter((prospect) => {
    const matchesSearch = 
      prospect.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prospect.contacts.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      prospect.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prospect.engagementNotes.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter.length === 0 || typeFilter.includes(prospect.type);
    
    const matchesStage = stageFilter.length === 0 || 
      stageFilter.some(s => prospect.stage.toLowerCase().includes(s.toLowerCase()));

    return matchesSearch && matchesType && matchesStage;
  });

  const handleRowClick = (prospect: Prospect) => {
    navigate(`/company/${prospect.id}`);
  };

  if (isLoading) {
    return (
      <div className="content-card p-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="content-card overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search companies, contacts, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-11 border-0 bg-muted/50 rounded-xl"
          />
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl h-11 px-4">
                <Filter className="w-4 h-4" />
                Type
                {typeFilter.length > 0 && (
                  <span className="bg-accent text-accent-foreground text-xs px-1.5 rounded-full">
                    {typeFilter.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              {types.map((type) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={typeFilter.includes(type)}
                  onCheckedChange={(checked) => {
                    setTypeFilter(prev => 
                      checked ? [...prev, type] : prev.filter(t => t !== type)
                    );
                  }}
                >
                  {type}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl h-11 px-4">
                <Filter className="w-4 h-4" />
                Stage
                {stageFilter.length > 0 && (
                  <span className="bg-accent text-accent-foreground text-xs px-1.5 rounded-full">
                    {stageFilter.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              {stages.map((stage) => (
                <DropdownMenuCheckboxItem
                  key={stage}
                  checked={stageFilter.includes(stage)}
                  onCheckedChange={(checked) => {
                    setStageFilter(prev => 
                      checked ? [...prev, stage] : prev.filter(s => s !== stage)
                    );
                  }}
                >
                  {stage}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30">
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contacts</th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stage</th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Contact</th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">LinkedIn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredProspects.map((prospect) => (
              <tr 
                key={prospect.id} 
                className="table-row-hover cursor-pointer"
                onClick={() => handleRowClick(prospect)}
              >
                <td className="p-4">
                  <span className="font-medium">{prospect.companyName}</span>
                </td>
                <td className="p-4 text-sm text-muted-foreground">
                  {prospect.contacts.length > 0 
                    ? prospect.contacts.map(c => c.name).join(', ') 
                    : '—'}
                </td>
                <td className="p-4 text-sm font-mono text-muted-foreground">
                  {prospect.state || '—'}
                </td>
                <td className="p-4">
                  <TypeBadge type={prospect.type} />
                </td>
                <td className="p-4">
                  <StageBadge stage={prospect.stage} />
                </td>
                <td className="p-4 text-sm font-mono text-muted-foreground">
                  {prospect.lastContact || '—'}
                </td>
                <td className="p-4">
                  {prospect.linkedIn ? (
                    <a 
                      href={prospect.linkedIn} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-accent hover:text-accent/80 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border text-sm text-muted-foreground">
        Showing {filteredProspects.length} of {prospects.length} prospects
      </div>
    </div>
  );
};

export default ProspectsTable;
