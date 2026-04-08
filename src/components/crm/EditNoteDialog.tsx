import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Trash2, Phone, Mail } from 'lucide-react';
import { Engagement, REPS, getRepConfig } from '@/data/prospects';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

const noteSchema = z.object({
  details: z.string().trim().min(1, 'Note cannot be empty').max(2000, 'Note must be less than 2000 characters'),
});

type NoteFormData = z.infer<typeof noteSchema>;

interface EditNoteDialogProps {
  engagement: Engagement;
  onSave: (id: string, details: string, activity?: { calls?: number; emails?: number }, loggedBy?: string) => void;
  onDelete: (id: string) => void;
}

const EditNoteDialog = ({ engagement, onSave, onDelete }: EditNoteDialogProps) => {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [calls, setCalls] = useState<number>(engagement.activity?.calls || 0);
  const [emails, setEmails] = useState<number>(engagement.activity?.emails || 0);
  const [loggedBy, setLoggedBy] = useState<string>(engagement.loggedBy || 'Samir');
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      details: engagement.details || engagement.summary,
    },
  });

  const onSubmit = (data: NoteFormData) => {
    const activity: { calls?: number; emails?: number } = {};
    if (calls > 0) activity.calls = calls;
    if (emails > 0) activity.emails = emails;
    onSave(engagement.id, data.details, Object.keys(activity).length > 0 ? activity : undefined, loggedBy);
    toast({
      title: 'Note updated',
      description: 'Your note has been saved.',
    });
    setEditOpen(false);
  };

  const handleDelete = () => {
    onDelete(engagement.id);
    toast({
      title: 'Note deleted',
      description: 'The note has been removed.',
    });
    setDeleteOpen(false);
  };

  const handleEditOpen = (open: boolean) => {
    setEditOpen(open);
    if (open) {
      reset({ details: engagement.details || engagement.summary });
      setCalls(engagement.activity?.calls || 0);
      setEmails(engagement.activity?.emails || 0);
      setLoggedBy(engagement.loggedBy || 'Samir');
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => handleEditOpen(true)}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={handleEditOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>
              Update your engagement note for this company.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="details">Note</Label>
              <Textarea
                id="details"
                placeholder="Enter your note..."
                className="min-h-[150px] rounded-xl"
                {...register('details')}
              />
              {errors.details && (
                <p className="text-xs text-destructive">{errors.details.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-xs">
                  <Phone className="w-3 h-3" /> Calls made
                </Label>
                <input
                  type="number"
                  min={0}
                  value={calls || ''}
                  onChange={(e) => setCalls(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-xs">
                  <Mail className="w-3 h-3" /> Emails sent
                </Label>
                <input
                  type="number"
                  min={0}
                  value={emails || ''}
                  onChange={(e) => setEmails(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Logged by</Label>
              <div className="flex gap-2">
                {REPS.map(rep => (
                  <button
                    key={rep.name}
                    type="button"
                    onClick={() => setLoggedBy(rep.name)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      loggedBy === rep.name
                        ? `${rep.activeClass} border-current`
                        : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${rep.avatarClass}`}>
                      {rep.initials}
                    </span>
                    {rep.name}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EditNoteDialog;
