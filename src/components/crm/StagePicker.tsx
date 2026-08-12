import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { getStageColor, RELATIONSHIP_STAGES, RETIRED_STAGES } from '@/data/prospects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStageOptions } from '@/hooks/useStageOptions';

interface StagePickerProps {
  /** Comma-separated stage string, as stored on the prospect. */
  value: string;
  onChange: (value: string) => void;
  /** Rendered under the control, e.g. a default-value hint. */
  hint?: string;
}

const ADD_NEW_VALUE = '__add_new_stage__';

const splitStages = (value: string) =>
  value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];

/**
 * Multi-select for pipeline stages: selected stages as removable badges plus a
 * dropdown of every known stage, with an escape hatch for a brand-new one.
 */
const StagePicker = ({ value, onChange, hint }: StagePickerProps) => {
  const { allStages, customStages, addStageOption } = useStageOptions();
  const [newStage, setNewStage] = useState('');
  const [showNewStageInput, setShowNewStageInput] = useState(false);
  const [newStageError, setNewStageError] = useState('');

  const selectedStages = splitStages(value);
  const isSelected = (stage: string) =>
    selectedStages.some(s => s.toLowerCase() === stage.toLowerCase());

  const addStage = (stage: string) => {
    if (!stage || isSelected(stage)) return;
    onChange([...selectedStages, stage].join(', '));
  };

  const removeStage = (stage: string) => {
    onChange(selectedStages.filter(s => s !== stage).join(', '));
  };

  const closeNewStageInput = () => {
    setShowNewStageInput(false);
    setNewStage('');
    setNewStageError('');
  };

  const handleAddNewStage = () => {
    // Retired stages must not come back in through the free-form escape hatch.
    if (RETIRED_STAGES.includes(newStage.trim().toLowerCase())) {
      setNewStageError(`"${newStage.trim()}" was removed from the pipeline and can't be re-added.`);
      return;
    }
    const trimmed = addStageOption(newStage);
    if (!trimmed) return;
    addStage(trimmed);
    closeNewStageInput();
  };

  const customSet = new Set(customStages.map(s => s.toLowerCase()));
  const relationshipSet = new Set(RELATIONSHIP_STAGES.map(s => s.toLowerCase()));
  const pipelineOptions = allStages.filter(
    s => !customSet.has(s.toLowerCase()) && !relationshipSet.has(s.toLowerCase()) && !isSelected(s)
  );
  const relationshipOptions = RELATIONSHIP_STAGES.filter(s => !isSelected(s));
  const customOptions = customStages.filter(s => !isSelected(s));
  const hasOptions =
    pipelineOptions.length > 0 || relationshipOptions.length > 0 || customOptions.length > 0;

  return (
    <div className="space-y-2">
      {selectedStages.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedStages.map((stage) => {
            const colors = getStageColor(stage);
            return (
              <span
                key={stage}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
              >
                {stage}
                <button
                  type="button"
                  onClick={() => removeStage(stage)}
                  aria-label={`Remove ${stage} stage`}
                  className="rounded-full hover:opacity-70 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {showNewStageInput ? (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Input
              value={newStage}
              onChange={(e) => {
                setNewStage(e.target.value);
                if (newStageError) setNewStageError('');
              }}
              placeholder="New stage name"
              aria-label="New stage name"
              aria-invalid={!!newStageError}
              aria-describedby={newStageError ? 'new-stage-error' : undefined}
              className="rounded-xl flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddNewStage();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  closeNewStageInput();
                }
              }}
              autoFocus
            />
            <Button size="sm" onClick={handleAddNewStage} disabled={!newStage.trim()} className="rounded-xl shrink-0">
              Add
            </Button>
          </div>
          {newStageError && (
            <p id="new-stage-error" role="alert" className="text-xs text-destructive">
              {newStageError}
            </p>
          )}
        </div>
      ) : (
        <Select
          value=""
          onValueChange={(val) => {
            if (val === ADD_NEW_VALUE) {
              setShowNewStageInput(true);
            } else if (val) {
              addStage(val);
            }
          }}
        >
          <SelectTrigger className="rounded-xl" aria-label="Add a pipeline stage">
            <SelectValue placeholder="Add a stage..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl bg-background">
            {!hasOptions ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                All stages added. Remove one above or create a new stage.
              </div>
            ) : (
              <>
                {pipelineOptions.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-xs text-muted-foreground">Pipeline</SelectLabel>
                    {pipelineOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {relationshipOptions.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-xs text-muted-foreground">Relationship</SelectLabel>
                    {relationshipOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {customOptions.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-xs text-muted-foreground">Custom</SelectLabel>
                    {customOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </>
            )}
            <SelectSeparator />
            <SelectItem value={ADD_NEW_VALUE} className="text-accent">
              <span className="flex items-center gap-2">
                <Plus className="w-3 h-3" />
                Add new stage...
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      )}

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
};

export default StagePicker;
