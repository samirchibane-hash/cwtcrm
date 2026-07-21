import { useMemo, useState } from 'react';
import { useProspects } from '@/context/ProspectsContext';
import { PIPELINE_STAGES, HIDDEN_STAGES } from '@/data/prospects';

/**
 * Every pipeline stage a user can pick or filter by:
 * - The canonical PIPELINE_STAGES list
 * - Any custom stage already saved on a prospect (so nothing in the data is unselectable)
 * - Any stage added this session, before it has been persisted
 *
 * `customStages` is the subset that isn't canonical, so callers can group them
 * separately in a picker.
 */
export const useStageOptions = () => {
  const { prospects } = useProspects();
  const [sessionStages, setSessionStages] = useState<string[]>([]);

  const { allStages, customStages } = useMemo(() => {
    const fromData = prospects.flatMap(p =>
      p.stage ? p.stage.split(',').map(s => s.trim()).filter(Boolean) : []
    );

    const canonicalLower = new Set(PIPELINE_STAGES.map(s => s.toLowerCase()));
    const seen = new Set(PIPELINE_STAGES.map(s => s.toLowerCase()));
    const extras: string[] = [];

    [...fromData, ...sessionStages].forEach(stage => {
      const key = stage.toLowerCase();
      if (seen.has(key) || HIDDEN_STAGES.includes(key)) return;
      seen.add(key);
      extras.push(stage);
    });

    extras.sort((a, b) => a.localeCompare(b));

    return {
      allStages: [...PIPELINE_STAGES, ...extras],
      customStages: extras.filter(s => !canonicalLower.has(s.toLowerCase())),
    };
  }, [prospects, sessionStages]);

  /** Registers a free-form stage for this session and returns its trimmed value. */
  const addStageOption = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !allStages.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setSessionStages(prev => [...prev, trimmed]);
    }
    return trimmed;
  };

  return { allStages, customStages, addStageOption };
};
