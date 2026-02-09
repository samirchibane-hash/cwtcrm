import { useNavigate, useLocation } from 'react-router-dom';
import { Building2, Users, FileCheck, MessageSquare, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { useProspects } from '@/context/ProspectsContext';
import { Prospect } from '@/data/prospects';
import MetricCard from './MetricCard';
import TypeBadge from './TypeBadge';
import StageBadge from './StageBadge';

interface DashboardProps {
  onSelectProspect: (prospect: Prospect) => void;
}

const Dashboard = ({ onSelectProspect }: DashboardProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { prospects, isLoading } = useProspects();

  // Calculate stats from prospects
  const stats = {
    total: prospects.length,
    withQuotes: prospects.filter(p => p.stage.toLowerCase().includes('quotes')).length,
    contactMade: prospects.filter(p => p.stage.toLowerCase().includes('contact made')).length,
    byType: {
      OEM: prospects.filter(p => p.type === 'OEM').length,
      Distributor: prospects.filter(p => p.type === 'Distributor').length,
      eCommerce: prospects.filter(p => p.type === 'eCommerce').length,
    },
  };
  
  // Get recent activities (sorted by last contact)
  const recentProspects = [...prospects]
    .filter(p => p.lastContact)
    .sort((a, b) => {
      const dateA = new Date(`${a.lastContact}/2025`);
      const dateB = new Date(`${b.lastContact}/2025`);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 5);

  // Get prospects needing follow-up (older last contact)
  const needsFollowUp = [...prospects]
    .filter(p => p.lastContact && p.lastContact.startsWith('12'))
    .slice(0, 5);

  const handleProspectClick = (prospect: Prospect) => {
    navigate(`/company/${prospect.id}`, {
      state: { from: '/?view=dashboard' },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Prospects"
          value={stats.total}
          subtitle="In your pipeline"
          icon={Building2}
        />
        <MetricCard
          title="Quotes Sent"
          value={stats.withQuotes}
          subtitle={`${stats.total > 0 ? ((stats.withQuotes / stats.total) * 100).toFixed(0) : 0}% of pipeline`}
          icon={FileCheck}
        />
        <MetricCard
          title="Contacts Made"
          value={stats.contactMade}
          subtitle="Warm leads"
          icon={MessageSquare}
        />
        <MetricCard
          title="OEM Partners"
          value={stats.byType.OEM}
          subtitle={`${stats.byType.Distributor} distributors`}
          icon={Users}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="content-card overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              Recent Activity
            </h3>
          </div>
          <div className="divide-y divide-border">
            {recentProspects.map((prospect) => (
              <div 
                key={prospect.id}
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => handleProspectClick(prospect)}
              >
                <div>
                  <p className="font-medium text-sm">{prospect.companyName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {prospect.engagementNotes?.slice(0, 50)}...
                  </p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-xs font-mono text-muted-foreground">{prospect.lastContact}</p>
                  <div className="mt-1">
                    <StageBadge stage={prospect.stage} />
                  </div>
                </div>
              </div>
            ))}
            {recentProspects.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No recent activity</p>
            )}
          </div>
        </div>

        {/* Needs Follow-up */}
        <div className="content-card overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Needs Follow-up
            </h3>
          </div>
          <div className="divide-y divide-border">
            {needsFollowUp.map((prospect) => (
              <div 
                key={prospect.id}
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => handleProspectClick(prospect)}
              >
                <div>
                  <p className="font-medium text-sm">{prospect.companyName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <TypeBadge type={prospect.type} />
                    <span className="text-xs text-muted-foreground">{prospect.state}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-xs font-mono text-destructive">{prospect.lastContact}</p>
                </div>
              </div>
            ))}
            {needsFollowUp.length === 0 && (
              <p className="text-center text-muted-foreground py-8">All caught up! 🎉</p>
            )}
          </div>
        </div>
      </div>

      {/* Type Distribution */}
      <div className="content-card p-6">
        <h3 className="font-semibold mb-6">Prospect Distribution</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-6 rounded-2xl bg-muted/50">
            <p className="text-4xl font-semibold tracking-tight">{stats.byType.OEM}</p>
            <p className="text-sm text-muted-foreground mt-2">OEM Partners</p>
          </div>
          <div className="text-center p-6 rounded-2xl bg-muted/50">
            <p className="text-4xl font-semibold tracking-tight">{stats.byType.Distributor}</p>
            <p className="text-sm text-muted-foreground mt-2">Distributors</p>
          </div>
          <div className="text-center p-6 rounded-2xl bg-muted/50">
            <p className="text-4xl font-semibold tracking-tight">{stats.byType.eCommerce}</p>
            <p className="text-sm text-muted-foreground mt-2">eCommerce</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
