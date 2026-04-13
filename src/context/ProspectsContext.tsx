import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  prospects as initialProspects, 
  Prospect, 
  Contact, 
  Engagement, 
  CompanyType, 
  MarketType,
  LeadTier 
} from '@/data/prospects';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProspectsContextType {
  prospects: Prospect[];
  updateProspect: (prospect: Prospect) => void;
  deleteProspect: (id: string) => void;
  getProspectById: (id: string) => Prospect | undefined;
  addProspect: (prospect: Omit<Prospect, 'id'>) => Promise<Prospect | null>;
  isLoading: boolean;
}

const ProspectsContext = createContext<ProspectsContextType | undefined>(undefined);

const mapRowToProspect = (row: any): Prospect => ({
  id: row.id,
  companyName: row.company_name,
  street: row.street || '',
  city: row.city || '',
  state: row.state || '',
  country: row.country || '',
  zip: row.zip || '',
  type: (row.type as CompanyType) || '',
  marketType: (row.market_type as MarketType) || '',
  leadTier: (row.lead_tier as LeadTier) || '',
  stage: row.stage || '',
  lastContact: row.last_contact || '',
  engagementNotes: row.engagement_notes || '',
  linkedIn: row.linkedin || '',
  website: row.website || '',
  googleMapsUrl: row.google_maps_url || '',
  phone: row.phone || '',
  contacts: (row.contacts as unknown as Contact[]) || [],
  engagements: (row.engagements as unknown as Engagement[]) || [],
});

export const ProspectsProvider = ({ children }: { children: ReactNode }) => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load prospects from Supabase on mount
  useEffect(() => {
    const loadProspects = async () => {
      try {
        const { data, error } = await supabase
          .from('prospects')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          setProspects(data.map(mapRowToProspect));
        } else {
          await seedInitialProspects();
        }
      } catch (error) {
        console.error('Failed to load prospects:', error);
        toast({
          title: 'Error',
          description: 'Failed to load prospects from database.',
          variant: 'destructive',
        });
        setProspects(initialProspects);
      } finally {
        setIsLoading(false);
      }
    };

    loadProspects();
  }, []);

  const seedInitialProspects = async () => {
    try {
      const prospectsToInsert = initialProspects.map(prospect => ({
        id: prospect.id.length > 10 ? prospect.id : undefined,
        company_name: prospect.companyName,
        street: prospect.street || '',
        city: prospect.city || '',
        state: prospect.state,
        country: prospect.country || '',
        zip: prospect.zip || '',
        type: prospect.type,
        market_type: prospect.marketType,
        lead_tier: prospect.leadTier || '',
        stage: prospect.stage,
        last_contact: prospect.lastContact,
        engagement_notes: prospect.engagementNotes,
        linkedin: prospect.linkedIn,
        website: prospect.website || '',
        google_maps_url: prospect.googleMapsUrl || '',
        phone: prospect.phone || '',
        contacts: JSON.parse(JSON.stringify(prospect.contacts)),
        engagements: JSON.parse(JSON.stringify(prospect.engagements)),
      }));

      const { data, error } = await supabase
        .from('prospects')
        .insert(prospectsToInsert)
        .select();

      if (error) throw error;

      if (data) {
        setProspects(data.map(mapRowToProspect));
      }
    } catch (error) {
      console.error('Failed to seed initial prospects:', error);
      setProspects(initialProspects);
    }
  };

  const updateProspect = async (updatedProspect: Prospect) => {
    try {
      const { error } = await supabase
        .from('prospects')
        .update({
          company_name: updatedProspect.companyName,
          street: updatedProspect.street || '',
          city: updatedProspect.city || '',
          state: updatedProspect.state,
          country: updatedProspect.country || '',
          zip: updatedProspect.zip || '',
          type: updatedProspect.type,
          market_type: updatedProspect.marketType,
          lead_tier: updatedProspect.leadTier || '',
          stage: updatedProspect.stage,
          last_contact: updatedProspect.lastContact,
          engagement_notes: updatedProspect.engagementNotes,
          linkedin: updatedProspect.linkedIn,
          website: updatedProspect.website || '',
          google_maps_url: updatedProspect.googleMapsUrl || '',
          phone: updatedProspect.phone || '',
          contacts: JSON.parse(JSON.stringify(updatedProspect.contacts)),
          engagements: JSON.parse(JSON.stringify(updatedProspect.engagements)),
          starred: false,
        })
        .eq('id', updatedProspect.id);

      if (error) throw error;

      setProspects(prev => prev.map(p => p.id === updatedProspect.id ? updatedProspect : p));
    } catch (error) {
      console.error('Failed to update prospect:', error);
      toast({
        title: 'Error',
        description: 'Failed to update prospect.',
        variant: 'destructive',
      });
    }
  };

  const deleteProspect = async (id: string) => {
    try {
      const { error } = await supabase
        .from('prospects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProspects(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Failed to delete prospect:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete prospect.',
        variant: 'destructive',
      });
    }
  };

  const addProspect = async (prospectData: Omit<Prospect, 'id'>): Promise<Prospect | null> => {
    try {
      const { data, error } = await supabase
        .from('prospects')
        .insert({
          company_name: prospectData.companyName,
          street: prospectData.street || '',
          city: prospectData.city || '',
          state: prospectData.state,
          country: prospectData.country || '',
          zip: prospectData.zip || '',
          type: prospectData.type,
          market_type: prospectData.marketType,
          lead_tier: prospectData.leadTier || '',
          stage: prospectData.stage,
          last_contact: prospectData.lastContact,
          engagement_notes: prospectData.engagementNotes,
          linkedin: prospectData.linkedIn,
          website: prospectData.website || '',
          google_maps_url: prospectData.googleMapsUrl || '',
          phone: prospectData.phone || '',
          contacts: JSON.parse(JSON.stringify(prospectData.contacts)),
          engagements: JSON.parse(JSON.stringify(prospectData.engagements)),
        })
        .select()
        .single();

      if (error) throw error;

      const newProspect = mapRowToProspect(data);
      setProspects(prev => [newProspect, ...prev]);
      return newProspect;
    } catch (error) {
      console.error('Failed to add prospect:', error);
      toast({
        title: 'Error',
        description: 'Failed to add prospect.',
        variant: 'destructive',
      });
      return null;
    }
  };

  const getProspectById = (id: string): Prospect | undefined => {
    return prospects.find(p => p.id === id);
  };

  return (
    <ProspectsContext.Provider value={{ 
      prospects, 
      updateProspect, 
      deleteProspect, 
      getProspectById, 
      addProspect,
      isLoading 
    }}>
      {children}
    </ProspectsContext.Provider>
  );
};

export const useProspects = () => {
  const context = useContext(ProspectsContext);
  if (!context) {
    throw new Error('useProspects must be used within a ProspectsProvider');
  }
  return context;
};
