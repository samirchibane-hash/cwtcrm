import { X, ExternalLink, Phone, MapPin, Calendar, FileText } from 'lucide-react';
import { Prospect } from '@/data/prospects';
import StageBadge from './StageBadge';
import TypeBadge from './TypeBadge';
import { Button } from '@/components/ui/button';

interface ProspectDetailProps {
  prospect: Prospect;
  onClose: () => void;
}

const ProspectDetail = ({ prospect, onClose }: ProspectDetailProps) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{prospect.companyName}</h2>
            <div className="flex items-center gap-3 mt-2">
              <TypeBadge type={prospect.type} />
              <StageBadge stage={prospect.stage} />
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <MapPin className="w-5 h-5" />
              <span>{prospect.state || 'Location not specified'}</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Calendar className="w-5 h-5" />
              <span>Last contact: {prospect.lastContact || 'Never'}</span>
            </div>
          </div>

          {/* Contacts */}
          {prospect.contacts && (
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Contacts
              </h3>
              <p className="text-muted-foreground bg-muted/50 p-3 rounded-lg">
                {prospect.contacts}
              </p>
            </div>
          )}

          {/* Engagement Notes */}
          {prospect.engagementNotes && (
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Engagement Notes
              </h3>
              <p className="text-muted-foreground bg-muted/50 p-4 rounded-lg leading-relaxed">
                {prospect.engagementNotes}
              </p>
            </div>
          )}

          {/* LinkedIn */}
          {prospect.linkedIn && (
            <div>
              <a
                href={prospect.linkedIn}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:text-accent transition-colors font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                View on LinkedIn
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-muted/30 flex gap-3">
          <Button className="flex-1">Log Activity</Button>
          <Button variant="outline" className="flex-1">Edit Prospect</Button>
        </div>
      </div>
    </div>
  );
};

export default ProspectDetail;
