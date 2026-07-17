import { useMemo, useState } from 'react';
import { AlertCircle, BookmarkPlus, Send, Sparkles, User, Workflow, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  const [contactIds, setContactIds] = useState<string[]>(() => {
    const seed = initialContactId ?? emailable[0]?.id;
    return seed ? [seed] : [];
  });
  const [templateId, setTemplateId] = useState<string>('');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [exitOnReply, setExitOnReply] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  const selectedContacts = emailable.filter(c => contactIds.includes(c.id));
  // The first pick drives the live preview and the section heading.
  const contact = selectedContacts[0];
  const selectedTemplate = templates.find(t => t.id === templateId);

  const toggleContact = (id: string) =>
    setContactIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );

  const allSelected = emailable.length > 0 && contactIds.length === emailable.length;
  const toggleAll = () =>
    setContactIds(allSelected ? [] : emailable.map(c => c.id));

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
  const canEnroll =
    selectedContacts.length > 0 && steps.length > 0 && errors.length === 0;

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
    const targets = selectedContacts.filter(c => c.email);
    if (targets.length === 0) return;
    setSaving(true);

    const enrolled: string[] = [];
    const failures: { name: string; error?: string }[] = [];
    for (const c of targets) {
      const { enrollment, error } = await enroll({
        template: selectedTemplate,
        templateName: selectedTemplate?.name ?? 'Custom sequence',
        prospectId,
        prospectName,
        contactEmail: c.email!,
        contactName: c.name,
        // Same snapshot for everyone; per-contact variables resolve at send time.
        steps,
        exitOnReply,
      });
      if (error || !enrollment) failures.push({ name: c.name, error });
      else enrolled.push(c.name);
    }

    setSaving(false);

    if (enrolled.length === 0) {
      toast({
        title: 'Could not enroll',
        description: failures[0]?.error ?? 'No contacts were enrolled.',
        variant: 'destructive',
      });
      return;
    }

    const first = emailSteps(steps)[0];
    const summary =
      enrolled.length === 1
        ? `${enrolled[0]} enrolled`
        : `${enrolled.length} contacts enrolled`;
    const description = failures.length
      ? `${failures.length} skipped — ${failures[0].error ?? 'already enrolled'}.`
      : `"${first?.subject || 'First email'}" sends on the next run.`;
    toast({ title: summary, description });

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
                  <div className="flex items-center justify-between">
                    <Label>
                      Contacts
                      {contactIds.length > 0 && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          {contactIds.length} selected
                        </span>
                      )}
                    </Label>
                    {emailable.length > 1 && (
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        {allSelected ? 'Clear all' : 'Select all'}
                      </button>
                    )}
                  </div>
                  <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                    {emailable.map(c => {
                      const checked = contactIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                            checked ? 'bg-accent/5' : 'hover:bg-muted/40'
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleContact(c.id)}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {c.name}
                              {c.role && (
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                  {c.role}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
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
                      Remaining emails are cancelled for a contact as soon as they respond.
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
                      {selectedContacts.length > 1
                        ? `Emails for ${selectedContacts.length} contacts`
                        : `Emails for ${contact?.name?.split(' ')[0] || 'this contact'}`}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {selectedContacts.length > 1 ? (
                        <>
                          Personalized per contact with{' '}
                          <code className="text-[11px]">{'{{firstName}}'}</code>. Changes apply to
                          these enrollments only, never the workflow.
                        </>
                      ) : (
                        'Edit freely — changes apply to this enrollment only, never the workflow.'
                      )}
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
              {selectedContacts.length > 1 && ` · ${selectedContacts.length} contacts`}
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={handleEnroll} disabled={!canEnroll || saving} className="rounded-xl">
            <Send className="w-4 h-4 mr-2" />
            {saving
              ? 'Enrolling…'
              : selectedContacts.length > 1
                ? `Enroll ${selectedContacts.length} & start`
                : 'Enroll & start'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EnrollInAutomationPanel;
