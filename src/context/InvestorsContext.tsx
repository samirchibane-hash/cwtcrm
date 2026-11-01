import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Contact, Engagement } from '@/data/prospects';
import { Investor } from '@/data/investors';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { normalizeRecords } from '@/lib/prospect-records';
import { useToast } from '@/hooks/use-toast';

interface InvestorsContextType {
  investors: Investor[];
  isLoading: boolean;
  getInvestorById: (id: string) => Investor | undefined;
  addInvestor: (investor: Omit<Investor, 'id'>) => Promise<Investor | null>;
  updateInvestor: (investor: Investor) => Promise<boolean>;
  deleteInvestor: (id: string) => Promise<boolean>;
}

const InvestorsContext = createContext<InvestorsContextType | undefined>(undefined);

const mapRow = (row: Tables<'investors'>): Investor => ({
  id: row.id,
  name: row.name,
  investorType: row.investor_type || '',
  stage: row.stage || '',
  contacts: normalizeRecords<Contact>(row.contacts, 'contact', row.id),
  engagements: normalizeRecords<Engagement>(row.engagements, 'eng', row.id),
  website: row.website || '',
  linkedIn: row.linkedin || '',
  phone: row.phone || '',
  city: row.city || '',
  state: row.state || '',
  country: row.country || '',
  notes: row.notes || '',
  lastContact: row.last_contact || '',
});

const toRow = (i: Omit<Investor, 'id'>): TablesInsert<'investors'> => ({
  name: i.name,
  investor_type: i.investorType || null,
  stage: i.stage || null,
  contacts: JSON.parse(JSON.stringify(i.contacts)),
  engagements: JSON.parse(JSON.stringify(i.engagements)),
  website: i.website || null,
  linkedin: i.linkedIn || null,
  phone: i.phone || null,
  city: i.city || null,
  state: i.state || null,
  country: i.country || null,
  notes: i.notes || null,
  last_contact: i.lastContact || null,
});

export const InvestorsProvider = ({ children }: { children: ReactNode }) => {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('investors')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Failed to load investors:', error);
        toast({ title: 'Couldn’t load investors', description: 'Refresh to try again.', variant: 'destructive' });
      } else {
        setInvestors((data ?? []).map(mapRow));
      }
      setIsLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getInvestorById = (id: string) => investors.find(i => i.id === id);

  const addInvestor = async (investor: Omit<Investor, 'id'>) => {
    const { data, error } = await supabase.from('investors').insert(toRow(investor)).select().single();
    if (error || !data) {
      console.error('Failed to add investor:', error);
      toast({ title: 'Couldn’t add investor', description: 'Check your connection and try again.', variant: 'destructive' });
      return null;
    }
    const created = mapRow(data);
    setInvestors(prev => [created, ...prev]);
    return created;
  };

  // Optimistic: reflect the change immediately, roll back if the write fails
  const updateInvestor = async (investor: Investor) => {
    const previous = investors.find(i => i.id === investor.id);
    setInvestors(prev => prev.map(i => (i.id === investor.id ? investor : i)));
    const { id, ...rest } = investor;
    const { error } = await supabase
      .from('investors')
      .update({ ...toRow(rest), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('Failed to update investor:', error);
      if (previous) setInvestors(prev => prev.map(i => (i.id === id ? previous : i)));
      toast({ title: 'Couldn’t save changes', description: 'Your last change was undone.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const deleteInvestor = async (id: string) => {
    const { error } = await supabase.from('investors').delete().eq('id', id);
    if (error) {
      console.error('Failed to delete investor:', error);
      toast({ title: 'Couldn’t delete investor', description: 'Check your connection and try again.', variant: 'destructive' });
      return false;
    }
    setInvestors(prev => prev.filter(i => i.id !== id));
    return true;
  };

  return (
    <InvestorsContext.Provider value={{ investors, isLoading, getInvestorById, addInvestor, updateInvestor, deleteInvestor }}>
      {children}
    </InvestorsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useInvestors = () => {
  const ctx = useContext(InvestorsContext);
  if (!ctx) throw new Error('useInvestors must be used within an InvestorsProvider');
  return ctx;
};
