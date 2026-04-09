import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, User, Trash2 } from 'lucide-react';
import { Contact } from '@/data/prospects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

interface EditContactDialogProps {
  contact: Contact;
  onUpdateContact: (contact: Contact) => void;
  onDeleteContact: (contactId: string) => void;
  trigger?: React.ReactNode;
}

const EditContactDialog = ({ contact, onUpdateContact, onDeleteContact, trigger }: EditContactDialogProps) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: contact.name,
      role: contact.role || '',
      email: contact.email || '',
      phone: contact.phone || '',
      linkedIn: contact.linkedIn || '',
    },
  });

  // Reset form when contact changes or dialog opens
  useEffect(() => {
    if (open) {
      reset({
        name: contact.name,
        role: contact.role || '',
        email: contact.email || '',
        phone: contact.phone || '',
        linkedIn: contact.linkedIn || '',
      });
    }
  }, [contact, open, reset]);

  const onSubmit = (data: ContactFormData) => {
    const updatedContact: Contact = {
      id: contact.id,
      name: data.name,
      role: data.role || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      linkedIn: data.linkedIn || undefined,
    };
    
    onUpdateContact(updatedContact);
    toast({
      title: 'Contact updated',
      description: `${data.name} has been updated.`,
    });
    setOpen(false);
  };

  const handleDelete = () => {
    onDeleteContact(contact.id);
    toast({
      title: 'Contact deleted',
      description: `${contact.name} has been removed.`,
    });
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      reset({
        name: contact.name,
        role: contact.role || '',
        email: contact.email || '',
        phone: contact.phone || '',
        linkedIn: contact.linkedIn || '',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <Pencil className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            Edit Contact
          </DialogTitle>
          <DialogDescription>
            Update the contact details for {contact.name}.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="John Smith"
              className="rounded-xl"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Role / Title</Label>
            <Input
              id="role"
              placeholder="Director of Purchasing"
              className="rounded-xl"
              {...register('role')}
            />
            {errors.role && (
              <p className="text-xs text-destructive">{errors.role.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@company.com"
              className="rounded-xl"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(555) 123-4567"
              className="rounded-xl"
              {...register('phone')}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedIn">LinkedIn URL</Label>
            <Input
              id="linkedIn"
              type="url"
              placeholder="https://linkedin.com/in/johnsmith"
              className="rounded-xl"
              {...register('linkedIn')}
            />
            {errors.linkedIn && (
              <p className="text-xs text-destructive">{errors.linkedIn.message}</p>
            )}
          </div>

          <DialogFooter className="pt-4 flex justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm" className="rounded-xl">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {contact.name}? This action cannot be undone.
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
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl">
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditContactDialog;
