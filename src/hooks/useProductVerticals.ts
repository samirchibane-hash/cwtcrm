import { useMemo, useState } from 'react';
import { useProspects } from '@/context/ProspectsContext';
import { MARKET_TYPES } from '@/data/prospects';

/**
 * Returns a deduplicated, sorted list of all product verticals:
 * - Static defaults from MARKET_TYPES
 * - Any custom verticals already saved to any prospect in the DB
 * - Any newly added verticals (session-level, saved to the company on submit)
 */
export const useProductVerticals = () => {
  const { prospects } = useProspects();
  const [sessionVerticals, setSessionVerticals] = useState<string[]>([]);

  const allVerticals = useMemo(() => {
    const fromData = prospects
      .map(p => p.marketType as string)
      .filter((v) => !!v && v.trim() !== '');

    const merged = Array.from(
      new Set([...MARKET_TYPES.filter(v => v !== ''), ...fromData, ...sessionVerticals])
    );
    return merged;
  }, [prospects, sessionVerticals]);

  const addVertical = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !allVerticals.includes(trimmed)) {
      setSessionVerticals(prev => [...prev, trimmed]);
    }
    return name.trim();
  };

  return { allVerticals, addVertical };
};
