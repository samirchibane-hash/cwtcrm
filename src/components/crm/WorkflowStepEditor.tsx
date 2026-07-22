import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  CornerDownRight,
  Eye,
  EyeOff,
  Mail,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  MERGE_FIELDS,
  newEmailStep,
  newWaitStep,
  renderPreview,
  schedulePreview,
  threadSubjectFor,
  willReply,
  type EmailStep,
  type WaitStep,
  type WorkflowStep,
} from '@/lib/workflow';

interface WorkflowStepEditorProps {
  steps: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
  /** Values used to render merge-field previews (contact/company being edited). */
  previewVars?: Record<string, string>;
}

const dayLabel = (offset: number) => (offset === 0 ? 'Immediately' : `Day ${offset}`);

const WorkflowStepEditor = ({ steps, onChange, previewVars }: WorkflowStepEditorProps) => {
  const [openId, setOpenId] = useState<string | null>(null);
  // Previews stay collapsed until asked for — the editor is what people came for.
  // Kept per step id so reopening a step remembers the choice for this session.
  const [previewIds, setPreviewIds] = useState<string[]>([]);

  const togglePreview = (id: string) =>
    setPreviewIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const schedule = schedulePreview(steps);
  const offsetForIndex = (index: number) =>
    schedule.find(s => s.index === index)?.dayOffset ?? 0;

  const replaceStep = (id: string, patch: Partial<EmailStep> & Partial<WaitStep>) =>
    onChange(steps.map(s => (s.id === id ? ({ ...s, ...patch } as WorkflowStep) : s)));

  const removeStep = (id: string) => onChange(steps.filter(s => s.id !== id));

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const insertAt = (index: number, step: WorkflowStep) => {
    const next = [...steps];
    next.splice(index, 0, step);
    onChange(next);
    if (step.type === 'email') setOpenId(step.id);
  };

  const emailNumber = (index: number) =>
    steps.slice(0, index + 1).filter(s => s.type === 'email').length;

  return (
    <div className="space-y-2">
      {steps.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Mail className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No steps yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Start with an email, then add waits between touches.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 rounded-xl"
            onClick={() => insertAt(0, newEmailStep({ sendAs: 'new' }))}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add first email
          </Button>
        </div>
      )}

      {steps.map((step, index) => {
        const isOpen = openId === step.id;

        if (step.type === 'wait') {
          return (
            <div key={step.id} className="flex items-center gap-3 pl-4">
              <div className="w-px h-8 bg-border shrink-0" aria-hidden />
              <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 flex-1">
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">Wait</span>
                <Input
                  type="number"
                  min={1}
                  value={step.days}
                  onChange={e => replaceStep(step.id, { days: Math.max(1, Number(e.target.value) || 1) })}
                  className="h-8 w-16 rounded-lg text-center"
                  aria-label="Wait days"
                />
                <span className="text-sm text-muted-foreground">
                  {step.days === 1 ? 'day' : 'days'}
                </span>
                <div className="ml-auto flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveStep(index, -1)}
                    disabled={index === 0}
                    aria-label="Move step up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveStep(index, 1)}
                    disabled={index === steps.length - 1}
                    aria-label="Move step down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeStep(step.id)}
                    aria-label="Delete wait step"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        }

        const replies = willReply(steps, index);
        const inheritedSubject = threadSubjectFor(steps, index);
        const showsPreview = previewIds.includes(step.id);

        return (
          <div key={step.id} className="content-card">
            {/* Collapsed header */}
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : step.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
              aria-expanded={isOpen}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  replies ? 'bg-muted text-muted-foreground' : 'bg-accent/10 text-accent',
                )}
              >
                {replies ? <CornerDownRight className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Email {emailNumber(index)}</span>
                  <span className="badge-soft bg-muted text-muted-foreground">
                    {dayLabel(offsetForIndex(index))}
                  </span>
                  <span
                    className={cn(
                      'badge-soft',
                      replies
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-accent/10 text-accent',
                    )}
                  >
                    {replies ? 'Reply in thread' : 'New thread'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {replies
                    ? `Re: ${inheritedSubject || 'previous email'}`
                    : step.subject || 'No subject yet'}
                </p>
              </div>

              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                {/* Thread behaviour */}
                <div className="space-y-2">
                  <Label className="text-xs">How should this send?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['reply', 'new'] as const).map(mode => {
                      const isFirstEmail = !steps.slice(0, index).some(s => s.type === 'email');
                      const disabled = mode === 'reply' && isFirstEmail;
                      return (
                        <button
                          key={mode}
                          type="button"
                          disabled={disabled}
                          onClick={() => replaceStep(step.id, { sendAs: mode })}
                          className={cn(
                            'rounded-xl border p-3 text-left transition-all',
                            step.sendAs === mode && !disabled
                              ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                              : 'border-border hover:bg-muted/40',
                            disabled && 'opacity-40 cursor-not-allowed',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {mode === 'reply' ? (
                              <CornerDownRight className="w-3.5 h-3.5" />
                            ) : (
                              <Mail className="w-3.5 h-3.5" />
                            )}
                            <span className="text-sm font-medium">
                              {mode === 'reply' ? 'Reply to previous' : 'New thread'}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                            {mode === 'reply'
                              ? 'Threads under the last email sent.'
                              : 'Starts a fresh conversation with its own subject.'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  {replies && (
                    <p className="text-[11px] text-muted-foreground">
                      Gmail keeps the subject of the thread it replies to, so this one inherits{' '}
                      <span className="font-medium">Re: {inheritedSubject || '…'}</span>.
                    </p>
                  )}
                </div>

                {/* Subject — only meaningful when starting a thread */}
                {!replies && (
                  <div className="space-y-2">
                    <Label htmlFor={`subject-${step.id}`} className="text-xs">
                      Subject
                    </Label>
                    <Input
                      id={`subject-${step.id}`}
                      value={step.subject}
                      onChange={e => replaceStep(step.id, { subject: e.target.value })}
                      placeholder="Cutting UV lamp replacements at {companyName}"
                      className="rounded-xl"
                    />
                  </div>
                )}

                {/* Body */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`body-${step.id}`} className="text-xs">
                      Body
                    </Label>
                    <div className="flex items-center gap-1">
                      {MERGE_FIELDS.map(f => (
                        <button
                          key={f.token}
                          type="button"
                          title={`Insert ${f.label}`}
                          onClick={() =>
                            replaceStep(step.id, { body: `${step.body}${f.token}` })
                          }
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground hover:bg-accent/10 hover:text-accent transition-colors"
                        >
                          {f.token}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Textarea
                    id={`body-${step.id}`}
                    value={step.body}
                    onChange={e => replaceStep(step.id, { body: e.target.value })}
                    placeholder={'Hi {firstName},\n\n…'}
                    className="min-h-[180px] rounded-xl font-normal leading-relaxed"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Your signature is appended automatically on send.
                  </p>
                </div>

                {/* Merge preview — opt-in, so the editor stays the default view */}
                {previewVars && step.body.trim() !== '' && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => togglePreview(step.id)}
                      aria-expanded={showsPreview}
                      aria-controls={`preview-${step.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {showsPreview ? (
                        <EyeOff className="w-3.5 h-3.5" aria-hidden />
                      ) : (
                        <Eye className="w-3.5 h-3.5" aria-hidden />
                      )}
                      {showsPreview
                        ? 'Hide preview'
                        : `Preview for ${previewVars.firstName || previewVars.contactName || 'this contact'}`}
                    </button>
                    {showsPreview && (
                      <div id={`preview-${step.id}`} className="rounded-xl bg-muted/40 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Preview for {previewVars.contactName || 'this contact'}
                        </p>
                        {!replies && step.subject.trim() !== '' && (
                          <p className="text-xs font-medium mb-1.5">
                            {renderPreview(step.subject, previewVars)}
                          </p>
                        )}
                        <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/80">
                          {renderPreview(step.body, previewVars)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => moveStep(index, -1)}
                      disabled={index === 0}
                    >
                      <ChevronUp className="w-3.5 h-3.5 mr-1" />
                      Up
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => moveStep(index, 1)}
                      disabled={index === steps.length - 1}
                    >
                      <ChevronDown className="w-3.5 h-3.5 mr-1" />
                      Down
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-lg text-muted-foreground hover:text-destructive"
                    onClick={() => removeStep(step.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {steps.length > 0 && (
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => insertAt(steps.length, newWaitStep())}
          >
            <Clock className="w-3.5 h-3.5 mr-2" />
            Add wait
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => insertAt(steps.length, newEmailStep())}
          >
            <Plus className="w-3.5 h-3.5 mr-2" />
            Add email
          </Button>
        </div>
      )}
    </div>
  );
};

export default WorkflowStepEditor;
