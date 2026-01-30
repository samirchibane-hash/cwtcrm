import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, CheckCircle2, XCircle, Loader2, HelpCircle, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface EmailVariation {
  email: string;
  status: 'pending' | 'checking' | 'valid' | 'invalid' | 'unknown';
  result?: any;
}

interface EmailVerificationDialogProps {
  companyWebsite?: string;
  onEmailVerified?: (email: string) => void;
}

export function EmailVerificationDialog({ companyWebsite, onEmailVerified }: EmailVerificationDialogProps) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [domain, setDomain] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [results, setResults] = useState<EmailVariation[]>([]);
  const [validEmail, setValidEmail] = useState<string | null>(null);
  const { toast } = useToast();

  // Extract domain from company website if available
  const extractDomainFromWebsite = (website: string): string => {
    try {
      const url = new URL(website.startsWith('http') ? website : `https://${website}`);
      return url.hostname.replace('www.', '');
    } catch {
      return website.replace('www.', '').replace('https://', '').replace('http://', '').split('/')[0];
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Pre-fill domain from company website
      if (companyWebsite) {
        setDomain(extractDomainFromWebsite(companyWebsite));
      }
      // Reset state
      setResults([]);
      setValidEmail(null);
    }
  };

  const handleVerify = async () => {
    if (!firstName.trim() || !lastName.trim() || !domain.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter first name, last name, and email domain.',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);
    setResults([]);
    setValidEmail(null);

    try {
      const { data, error } = await supabase.functions.invoke('verify-email', {
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          domain: domain.trim(),
        },
      });

      if (error) throw error;

      if (data.success) {
        setResults(data.results);
        setValidEmail(data.validEmail);

        if (data.validEmail) {
          toast({
            title: 'Valid Email Found!',
            description: `Verified: ${data.validEmail}`,
          });
        } else {
          toast({
            title: 'No Valid Email Found',
            description: `Checked ${data.totalChecked} variations, none were valid.`,
            variant: 'destructive',
          });
        }
      } else {
        throw new Error(data.error || 'Verification failed');
      }
    } catch (error) {
      console.error('Email verification error:', error);
      toast({
        title: 'Verification Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUseEmail = (email: string) => {
    onEmailVerified?.(email);
    toast({
      title: 'Email Selected',
      description: `${email} has been selected.`,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'invalid':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'checking':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <HelpCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800';
      case 'invalid':
        return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
      default:
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Search className="h-4 w-4" />
          Find Email
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Verification
          </DialogTitle>
          <DialogDescription>
            Enter a contact's name and email domain to find and verify their email address using Clearout.io
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isVerifying}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isVerifying}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain">Email Domain</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">@</span>
              <Input
                id="domain"
                placeholder="proaqua.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value.replace('@', ''))}
                disabled={isVerifying}
              />
            </div>
          </div>

          <Button
            onClick={handleVerify}
            disabled={isVerifying || !firstName || !lastName || !domain}
            className="w-full"
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying Emails...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Verify Email Variations
              </>
            )}
          </Button>

          {results.length > 0 && (
            <div className="space-y-3 mt-4">
              <h4 className="font-medium text-sm">
                Results ({results.length} checked)
                {validEmail && (
                  <span className="text-green-600 ml-2">✓ Valid email found</span>
                )}
              </h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border',
                      getStatusColor(result.status)
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <span className="font-mono text-sm">{result.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs capitalize text-muted-foreground">
                        {result.status}
                      </span>
                      {result.status === 'valid' && onEmailVerified && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUseEmail(result.email)}
                        >
                          Use
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
