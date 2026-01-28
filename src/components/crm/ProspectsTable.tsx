import { useState } from 'react';
import { Search, ExternalLink, Filter, ChevronDown } from 'lucide-react';
import { prospects, Prospect } from '@/data/prospects';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState<string[]>([]);

  const types = ['OEM', 'Distributor', 'eCommerce'];
  const stages = ['Quotes', 'Contact Made', 'No Current Interest'];

  const filteredProspects = prospects.filter((prospect) => {
    const matchesSearch = 
      prospect.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prospect.contacts.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prospect.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prospect.engagementNotes.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter.length === 0 || typeFilter.includes(prospect.type);
    
    const matchesStage = stageFilter.length === 0 || 
      stageFilter.some(s => prospect.stage.toLowerCase().includes(s.toLowerCase()));

    return matchesSearch && matchesType && matchesStage;
  });

  return (
    <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search companies, contacts, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Type
                {typeFilter.length > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs px-1.5 rounded-full">
                    {typeFilter.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Stage
                {stageFilter.length > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs px-1.5 rounded-full">
                    {stageFilter.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
            <tr className="bg-muted/50">
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Company</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Contacts</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Location</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Type</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Stage</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Last Contact</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">LinkedIn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredProspects.map((prospect) => (
              <tr 
                key={prospect.id} 
                className="table-row-hover cursor-pointer"
                onClick={() => onSelectProspect(prospect)}
              >
                <td className="p-4">
                  <span className="font-medium text-foreground">{prospect.companyName}</span>
                </td>
                <td className="p-4 text-sm text-muted-foreground">
                  {prospect.contacts || '—'}
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
                      className="text-primary hover:text-accent transition-colors"
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
