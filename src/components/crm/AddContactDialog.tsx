import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, User } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  role: z.string().trim().max(100, 'Role must be less than 100 characters').optional(),
  email: z.string().trim().email('Invalid email address').max(255, 'Email must be less than 255 characters').optional().or(z.literal('')),
  phone: z.string().trim().max(30, 'Phone must be less than 30 characters').optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface AddContactDialogProps {
  onAddContact: (contact: Contact) => void;
  trigger?: React.ReactNode;
}

const AddContactDialog = ({ onAddContact, trigger }: AddContactDialogProps) => {
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
      name: '',
      role: '',
      email: '',
      phone: '',
    },
  });

  const onSubmit = (data: ContactFormData) => {
    const newContact: Contact = {
      id: `contact-${Date.now()}`,
      name: data.name,
      role: data.role || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
    };
    
    onAddContact(newContact);
    toast({
      title: 'Contact added',
      description: `${data.name} has been added to contacts.`,
    });
    reset();
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            Add Contact
          </DialogTitle>
          <DialogDescription>
            Add a new contact for this company. Include their direct contact details.
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
          
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl">
              {isSubmitting ? 'Adding...' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddContactDialog;
