import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityLogEntry {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  loggedBy: string;
  calls: number;
  emails: number;
  note?: string;
  createdAt: string;
}

const mapRow = (row: any): ActivityLogEntry => ({
  id: row.id,
  date: row.date,
  loggedBy: row.logged_by,
  calls: row.calls,
  emails: row.emails,
  note: row.note || undefined,
  createdAt: row.created_at,
});

export const useActivityLog = () => {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .order('date', { ascending: false });
    if (!error && data) setEntries(data.map(mapRow));
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addEntry = async (entry: Omit<ActivityLogEntry, 'id' | 'createdAt'>): Promise<ActivityLogEntry | null> => {
    const { data, error } = await supabase
      .from('activity_log')
      .insert({
        date: entry.date,
        logged_by: entry.loggedBy,
        calls: entry.calls,
        emails: entry.emails,
        note: entry.note || null,
      })
      .select()
      .single();
    if (error || !data) return null;
    const newEntry = mapRow(data);
    setEntries(prev => [newEntry, ...prev]);
    return newEntry;
  };

  const deleteEntry = async (id: string) => {
    await supabase.from('activity_log').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  return { entries, isLoading, addEntry, deleteEntry };
};
