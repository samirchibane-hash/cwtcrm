import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  prospects as initialProspects, 
  Prospect, 
  Contact, 
  Engagement, 
  CompanyType, 
  MarketType 
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
          // Map database format to app format
          const mappedProspects: Prospect[] = data.map(row => ({
            id: row.id,
            companyName: row.company_name,
            state: row.state || '',
            type: (row.type as CompanyType) || '',
            marketType: (row.market_type as MarketType) || '',
            stage: row.stage || '',
            lastContact: row.last_contact || '',
            engagementNotes: row.engagement_notes || '',
            linkedIn: row.linkedin || '',
            website: (row as any).website || '',
            contacts: (row.contacts as unknown as Contact[]) || [],
            engagements: (row.engagements as unknown as Engagement[]) || [],
            starred: (row as any).starred || false,
          }));
          setProspects(mappedProspects);
        } else {
          // Seed initial prospects if database is empty
          await seedInitialProspects();
        }
      } catch (error) {
        console.error('Failed to load prospects:', error);
        toast({
          title: 'Error',
          description: 'Failed to load prospects from database.',
          variant: 'destructive',
        });
        // Fallback to initial prospects
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
        id: prospect.id.length > 10 ? prospect.id : undefined, // Only use UUID-like IDs
        company_name: prospect.companyName,
        state: prospect.state,
        type: prospect.type,
        market_type: prospect.marketType,
        stage: prospect.stage,
        last_contact: prospect.lastContact,
        engagement_notes: prospect.engagementNotes,
        linkedin: prospect.linkedIn,
        website: prospect.website || '',
        contacts: JSON.parse(JSON.stringify(prospect.contacts)),
        engagements: JSON.parse(JSON.stringify(prospect.engagements)),
      }));

      const { data, error } = await supabase
        .from('prospects')
        .insert(prospectsToInsert)
        .select();

      if (error) throw error;

      if (data) {
        // Map the inserted data back to app format
        const mappedProspects: Prospect[] = data.map(row => ({
          id: row.id,
          companyName: row.company_name,
          state: row.state || '',
          type: (row.type as CompanyType) || '',
          marketType: (row.market_type as MarketType) || '',
          stage: row.stage || '',
          lastContact: row.last_contact || '',
          engagementNotes: row.engagement_notes || '',
          linkedIn: row.linkedin || '',
          website: (row as any).website || '',
          contacts: (row.contacts as unknown as Contact[]) || [],
          engagements: (row.engagements as unknown as Engagement[]) || [],
          starred: (row as any).starred || false,
        }));
        setProspects(mappedProspects);
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
          state: updatedProspect.state,
          type: updatedProspect.type,
          market_type: updatedProspect.marketType,
          stage: updatedProspect.stage,
          last_contact: updatedProspect.lastContact,
          engagement_notes: updatedProspect.engagementNotes,
          linkedin: updatedProspect.linkedIn,
          website: updatedProspect.website || '',
          contacts: JSON.parse(JSON.stringify(updatedProspect.contacts)),
          engagements: JSON.parse(JSON.stringify(updatedProspect.engagements)),
          starred: updatedProspect.starred || false,
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
          state: prospectData.state,
          type: prospectData.type,
          market_type: prospectData.marketType,
          stage: prospectData.stage,
          last_contact: prospectData.lastContact,
          engagement_notes: prospectData.engagementNotes,
          linkedin: prospectData.linkedIn,
          website: prospectData.website || '',
          contacts: JSON.parse(JSON.stringify(prospectData.contacts)),
          engagements: JSON.parse(JSON.stringify(prospectData.engagements)),
        })
        .select()
        .single();

      if (error) throw error;

      const newProspect: Prospect = {
        id: data.id,
        companyName: data.company_name,
        state: data.state || '',
        type: (data.type as CompanyType) || '',
        marketType: (data.market_type as MarketType) || '',
        stage: data.stage || '',
        lastContact: data.last_contact || '',
        engagementNotes: data.engagement_notes || '',
        linkedIn: data.linkedin || '',
        website: (data as any).website || '',
        contacts: (data.contacts as unknown as Contact[]) || [],
        engagements: (data.engagements as unknown as Engagement[]) || [],
        starred: (data as any).starred || false,
      };

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
