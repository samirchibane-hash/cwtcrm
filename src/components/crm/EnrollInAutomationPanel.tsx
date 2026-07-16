import { useMemo, useState } from 'react';
import { AlertCircle, BookmarkPlus, Send, Sparkles, User, Workflow, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Contact } from '@/data/prospects';
import {
  cloneSteps,
  emailSteps,
  newEmailStep,
  totalDays,
  validateSteps,
  type WorkflowStep,
} from '@/lib/workflow';
import {
  useEnrollments,
  useWorkflowTemplates,
  type WorkflowTemplate,
} from '@/hooks/useWorkflows';
import WorkflowStepEditor from '@/components/crm/WorkflowStepEditor';

interface EnrollInAutomationPanelProps {
  prospectId: string;
  prospectName: string;
  contacts: Contact[];
  initialContactId?: string;
  onClose: () => void;
  onEnrolled?: () => void;
}

const BLANK = '__blank__';

const EnrollInAutomationPanel = ({
  prospectId,
  prospectName,
  contacts,
  initialContactId,
  onClose,
  onEnrolled,
}: EnrollInAutomationPanelProps) => {
  const { toast } = useToast();
  const { templates, isLoading, createTemplate } = useWorkflowTemplates();
  const { enroll } = useEnrollments(prospectId);

  const emailable = contacts.filter(c => c.email);
  const [contactId, setContactId] = useState(
    initialContactId ?? emailable[0]?.id ?? '',
  );
  const [templateId, setTemplateId] = useState<string>('');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [exitOnReply, setExitOnReply] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  const contact = emailable.find(c => c.id === contactId);
  const selectedTemplate = templates.find(t => t.id === templateId);

  const previewVars = useMemo(
    () => ({
      firstName: contact?.name?.split(' ')[0] ?? '',
      contactName: contact?.name ?? '',
      companyName: prospectName,
    }),
    [contact, prospectName],
  );

  // Snapshot the template's steps onto this enrollment. From here the copy is
  // this contact's alone — editing never touches the template.
  const pickTemplate = (id: string) => {
    setTemplateId(id === BLANK ? '' : id);
    if (id === BLANK) {
      setSteps([newEmailStep({ sendAs: 'new' })]);
      setExitOnReply(true);
      return;
    }
    const t = templates.find(x => x.id === id);
    if (t) {
      setSteps(cloneSteps(t.steps));
      setExitOnReply(t.exitOnReply);
    }
  };

  // Compared against the template so we can tell the user their edits are local.
  const isEdited = useMemo(() => {
    if (!selectedTemplate) return steps.length > 0;
    const strip = (list: WorkflowStep[]) =>
      JSON.stringify(
        list.map(s =>
          s.type === 'email'
            ? { type: s.type, subject: s.subject, body: s.body, sendAs: s.sendAs }
            : { type: s.type, days: s.days },
        ),
      );
    return strip(steps) !== strip(selectedTemplate.steps);
  }, [steps, selectedTemplate]);

  const errors = validateSteps(steps);
  const canEnroll = Boolean(contact) && steps.length > 0 && errors.length === 0;

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim()) return;
    if (errors.length > 0) {
      toast({
        title: 'Fix the steps first',
        description: errors[0],
        variant: 'destructive',
      });
      return;
    }
    const created = await createTemplate({
      name: newTemplateName.trim(),
      description: selectedTemplate
        ? `Adapted from "${selectedTemplate.name}" for ${prospectName}`
        : `Created from ${prospectName}`,
      steps,
      exitOnReply,
    });
    if (!created) {
      toast({ title: 'Could not save template', variant: 'destructive' });
      return;
    }
    // Point at the new template so the enrollment records accurate provenance.
    setTemplateId(created.id);
    setShowSaveTemplate(false);
    setNewTemplateName('');
    toast({
      title: 'Template saved',
      description: `"${created.name}" is now reusable for other contacts and companies.`,
    });
  };

  const handleEnroll = async () => {
    if (!contact?.email) return;
    setSaving(true);
    const { enrollment, error } = await enroll({
      template: selectedTemplate,
      templateName: selectedTemplate?.name ?? 'Custom sequence',
      prospectId,
      prospectName,
      contactEmail: contact.email,
      contactName: contact.name,
      steps,
      exitOnReply,
    });
    setSaving(false);

    if (error || !enrollment) {
      toast({ title: 'Could not enroll', description: error, variant: 'destructive' });
      return;
    }

    const first = emailSteps(steps)[0];
    toast({
      title: `${contact.name} enrolled`,
      description: `"${first?.subject || 'First email'}" sends on the next run.`,
    });
    onEnrolled?.();
    onClose();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 pb-5 border-b border-border pr-8">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Add to automation
            </p>
            <h1 className="text-xl font-semibold tracking-tight truncate">{prospectName}</h1>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto -mx-6 px-6 pt-6 space-y-6">
        {emailable.length === 0 ? (
          <div className="content-card p-8 text-center">
            <User className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium">No contacts with an email address</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add an email to a contact before enrolling them in an automation.
            </p>
          </div>
        ) : (
          <>
            {/* Who + which workflow */}
            <section className="content-card p-6">
              <h2 className="section-header flex items-center gap-2">
                <Workflow className="w-4 h-4 text-muted-foreground" />
                Setup
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Contact</Label>
                  <Select value={contactId} onValueChange={setContactId}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Choose a contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {emailable.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} — {c.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Workflow</Label>
                  <Select value={templateId || BLANK} onValueChange={pickTemplate}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue
                        placeholder={isLoading ? 'Loading…' : 'Choose a workflow'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} — {emailSteps(t.steps).length} emails over {totalDays(t.steps)}d
                        </SelectItem>
                      ))}
                      <SelectItem value={BLANK}>Start from scratch</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedTemplate?.description && (
                    <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                  <div className="pr-4">
                    <p className="text-sm font-medium">Stop when they reply</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Remaining emails are cancelled as soon as {contact?.name?.split(' ')[0] || 'the contact'} responds.
                    </p>
                  </div>
                  <Switch checked={exitOnReply} onCheckedChange={setExitOnReply} />
                </div>
              </div>
            </section>

            {/* The editable snapshot */}
            {steps.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="section-header mb-1 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-muted-foreground" />
                      Emails for {contact?.name?.split(' ')[0] || 'this contact'}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Edit freely — changes apply to this enrollment only, never the workflow.
                    </p>
                  </div>
                  {isEdited && selectedTemplate && (
                    <span className="badge-soft bg-accent/10 text-accent shrink-0">Edited</span>
                  )}
                </div>

                <WorkflowStepEditor
                  steps={steps}
                  onChange={setSteps}
                  previewVars={previewVars}
                />

                {errors.length > 0 && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                    {errors.map(err => (
                      <p key={err} className="text-xs text-destructive flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                        {err}
                      </p>
                    ))}
                  </div>
                )}

                {/* Promote this edited copy into a reusable workflow */}
                <div className="content-card p-4">
                  {showSaveTemplate ? (
                    <div className="space-y-3">
                      <Label htmlFor="template-name" className="text-xs">
                        Save these emails as a reusable workflow
                      </Label>
                      <Input
                        id="template-name"
                        autoFocus
                        value={newTemplateName}
                        onChange={e => setNewTemplateName(e.target.value)}
                        placeholder={
                          selectedTemplate
                            ? `${selectedTemplate.name} — ${prospectName}`
                            : `${prospectName} sequence`
                        }
                        className="rounded-xl"
                        onKeyDown={e => e.key === 'Enter' && handleSaveAsTemplate()}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="rounded-xl"
                          onClick={handleSaveAsTemplate}
                          disabled={!newTemplateName.trim()}
                        >
                          Save workflow
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl"
                          onClick={() => setShowSaveTemplate(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSaveTemplate(true)}
                      className="w-full flex items-center gap-3 text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-accent/10 transition-colors">
                        <BookmarkPlus className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Save as a new workflow</p>
                        <p className="text-xs text-muted-foreground">
                          Reuse this version for other contacts here, or a similar company.
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 pt-4 border-t border-border flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {steps.length > 0 && (
            <>
              {emailSteps(steps).length} email{emailSteps(steps).length === 1 ? '' : 's'} over{' '}
              {totalDays(steps)} days
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={handleEnroll} disabled={!canEnroll || saving} className="rounded-xl">
            <Send className="w-4 h-4 mr-2" />
            {saving ? 'Enrolling…' : 'Enroll & start'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EnrollInAutomationPanel;
