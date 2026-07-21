import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AtSign, Save, Trash2, User } from 'lucide-react';
import { Contact } from '@/data/prospects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SheetDescription, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  role: z.string().trim().max(100, 'Role must be less than 100 characters').optional(),
  email: z.string().trim().email('Invalid email address').max(255, 'Email must be less than 255 characters').optional().or(z.literal('')),
  phone: z.string().trim().max(30, 'Phone must be less than 30 characters').optional(),
  linkedIn: z.string().trim().max(500, 'LinkedIn URL must be less than 500 characters').optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactDetailsPanelProps {
  /** Omit to add a new contact; pass a contact to edit it. */
  contact?: Contact;
  onSave: (contact: Contact) => void;
  onDelete?: (contactId: string) => void;
  onClose: () => void;
}

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();

const ContactDetailsPanel = ({ contact, onSave, onDelete, onClose }: ContactDetailsPanelProps) => {
  const isEditing = Boolean(contact);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: contact?.name ?? '',
      role: contact?.role ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      linkedIn: contact?.linkedIn ?? '',
    },
  });

  const watchedName = watch('name');
  const initials = getInitials(watchedName || '');

  const onSubmit = (data: ContactFormData) => {
    const saved: Contact = {
      ...contact,
      id: contact?.id ?? `contact-${Date.now()}`,
      name: data.name,
      role: data.role || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      linkedIn: data.linkedIn || undefined,
    };

    onSave(saved);
    toast({
      title: isEditing ? 'Contact updated' : 'Contact added',
      description: isEditing
        ? `${data.name} has been updated.`
        : `${data.name} has been added to contacts.`,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!contact || !onDelete) return;
    onDelete(contact.id);
    toast({
      title: 'Contact deleted',
      description: `${contact.name} has been removed.`,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 pb-5 border-b border-border pr-8">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
            {initials ? (
              <span className="text-sm font-semibold text-muted-foreground">{initials}</span>
            ) : (
              <User className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isEditing ? 'Edit Contact' : 'New Contact'}
            </p>
            <SheetTitle className="text-xl font-semibold tracking-tight truncate">
              {watchedName.trim() || (isEditing ? 'Contact' : 'Add a contact')}
            </SheetTitle>
          </div>
        </div>
        <SheetDescription className="sr-only">
          {isEditing
            ? 'Update this contact’s name, role, and contact details.'
            : 'Add a new contact for this company, including their direct contact details.'}
        </SheetDescription>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto -mx-6 px-6 pt-6 space-y-6">
        {/* Identity */}
        <section className="content-card p-6">
          <h2 className="section-header flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            Contact
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name *</Label>
              <Input
                id="contact-name"
                placeholder="John Smith"
                className="rounded-xl"
                autoFocus
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'contact-name-error' : undefined}
                {...register('name')}
              />
              {errors.name && (
                <p id="contact-name-error" className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-role">Role / Title</Label>
              <Input
                id="contact-role"
                placeholder="Director of Purchasing"
                className="rounded-xl"
                aria-invalid={Boolean(errors.role)}
                aria-describedby={errors.role ? 'contact-role-error' : undefined}
                {...register('role')}
              />
              {errors.role && (
                <p id="contact-role-error" className="text-xs text-destructive">{errors.role.message}</p>
              )}
            </div>
          </div>
        </section>

        {/* Reach */}
        <section className="content-card p-6">
          <h2 className="section-header flex items-center gap-2">
            <AtSign className="w-4 h-4 text-muted-foreground" />
            How to Reach Them
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="john@company.com"
                  className="rounded-xl"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'contact-email-error' : undefined}
                  {...register('email')}
                />
                {errors.email && (
                  <p id="contact-email-error" className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-phone">Phone</Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  className="rounded-xl"
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? 'contact-phone-error' : undefined}
                  {...register('phone')}
                />
                {errors.phone && (
                  <p id="contact-phone-error" className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-linkedin">LinkedIn URL</Label>
              <Input
                id="contact-linkedin"
                type="url"
                placeholder="https://linkedin.com/in/johnsmith"
                className="rounded-xl"
                aria-invalid={Boolean(errors.linkedIn)}
                aria-describedby={errors.linkedIn ? 'contact-linkedin-error' : undefined}
                {...register('linkedIn')}
              />
              {errors.linkedIn && (
                <p id="contact-linkedin-error" className="text-xs text-destructive">{errors.linkedIn.message}</p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 pt-4 border-t border-border flex items-center justify-between gap-2">
        {isEditing && onDelete ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" className="rounded-xl text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {contact?.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes {contact?.name} from this company’s contacts. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete contact
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="rounded-xl">
            <Save className="w-4 h-4 mr-2" />
            {isEditing ? 'Save Changes' : 'Add Contact'}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default ContactDetailsPanel;
