import { Building2, Users, FileCheck, MessageSquare, TrendingUp, AlertCircle } from 'lucide-react';
import { getStats, prospects, Prospect } from '@/data/prospects';
import MetricCard from './MetricCard';
import TypeBadge from './TypeBadge';
import StageBadge from './StageBadge';

interface DashboardProps {
  onSelectProspect: (prospect: Prospect) => void;
}

const Dashboard = ({ onSelectProspect }: DashboardProps) => {
  const stats = getStats();
  
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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Prospects"
          value={stats.total}
          subtitle="In your pipeline"
          icon={Building2}
          accentColor="bg-primary"
        />
        <MetricCard
          title="Quotes Sent"
          value={stats.withQuotes}
          subtitle={`${((stats.withQuotes / stats.total) * 100).toFixed(0)}% of pipeline`}
          icon={FileCheck}
          accentColor="bg-stage-quotes"
        />
        <MetricCard
          title="Contacts Made"
          value={stats.contactMade}
          subtitle="Warm leads"
          icon={MessageSquare}
          accentColor="bg-stage-contact"
        />
        <MetricCard
          title="OEM Partners"
          value={stats.byType.OEM}
          subtitle={`${stats.byType.Distributor} distributors`}
          icon={Users}
          accentColor="bg-type-oem"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              Recent Activity
            </h3>
          </div>
          <div className="space-y-3">
            {recentProspects.map((prospect) => (
              <div 
                key={prospect.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onSelectProspect(prospect)}
              >
                <div>
                  <p className="font-medium text-sm">{prospect.companyName}</p>
                  <p className="text-xs text-muted-foreground">{prospect.engagementNotes?.slice(0, 50)}...</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-muted-foreground">{prospect.lastContact}</p>
                  <StageBadge stage={prospect.stage} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Needs Follow-up */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Needs Follow-up
            </h3>
          </div>
          <div className="space-y-3">
            {needsFollowUp.map((prospect) => (
              <div 
                key={prospect.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onSelectProspect(prospect)}
              >
                <div>
                  <p className="font-medium text-sm">{prospect.companyName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <TypeBadge type={prospect.type} />
                    <span className="text-xs text-muted-foreground">{prospect.state}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-destructive">{prospect.lastContact}</p>
                </div>
              </div>
            ))}
            {needsFollowUp.length === 0 && (
              <p className="text-center text-muted-foreground py-4">All caught up! 🎉</p>
            )}
          </div>
        </div>
      </div>

      {/* Type Distribution */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="font-semibold mb-4">Prospect Distribution by Type</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-type-oem/10">
            <p className="text-3xl font-bold font-mono text-type-oem">{stats.byType.OEM}</p>
            <p className="text-sm text-muted-foreground mt-1">OEM Partners</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-type-distributor/10">
            <p className="text-3xl font-bold font-mono text-type-distributor">{stats.byType.Distributor}</p>
            <p className="text-sm text-muted-foreground mt-1">Distributors</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-type-ecommerce/10">
            <p className="text-3xl font-bold font-mono text-type-ecommerce">{stats.byType.eCommerce}</p>
            <p className="text-sm text-muted-foreground mt-1">eCommerce</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
