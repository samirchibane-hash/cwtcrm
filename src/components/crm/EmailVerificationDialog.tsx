import { useState, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, CheckCircle2, XCircle, Loader2, HelpCircle, Search, AlertTriangle, ShieldQuestion } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface EmailVariation {
  email: string;
  status: 'pending' | 'checking' | 'valid' | 'invalid' | 'unknown' | 'rate_limited' | 'catch_all';
  result?: any;
}

interface EmailVerificationDialogProps {
  companyWebsite?: string;
  onEmailVerified?: (email: string) => void;
}

// Generate email variations (9 common patterns)
function generateEmailVariations(firstName: string, lastName: string, domain: string): string[] {
  const fn = firstName.toLowerCase().trim();
  const ln = lastName.toLowerCase().trim();
  const fi = fn.charAt(0);
  const li = ln.charAt(0);

  if (!fn || !ln || !domain) return [];

  return [
    `${fn}@${domain}`,             // jane@domain.com
    `${ln}@${domain}`,             // doe@domain.com
    `${fn}.${ln}@${domain}`,       // jane.doe@domain.com
    `${fi}.${ln}@${domain}`,       // j.doe@domain.com
    `${fn}.${li}@${domain}`,       // jane.d@domain.com
    `${fn}${ln}@${domain}`,        // janedoe@domain.com
    `${fi}${ln}@${domain}`,        // jdoe@domain.com
    `${fn}${li}@${domain}`,        // janed@domain.com
    `${fi}${li}@${domain}`,        // jd@domain.com
  ];
}

export function EmailVerificationDialog({ companyWebsite, onEmailVerified }: EmailVerificationDialogProps) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [domain, setDomain] = useState('');
  const [selectedVariations, setSelectedVariations] = useState<Set<string>>(new Set());
  const [isVerifying, setIsVerifying] = useState(false);
  const [results, setResults] = useState<EmailVariation[]>([]);
  const [validEmail, setValidEmail] = useState<string | null>(null);
  const { toast } = useToast();

  // Generate variations based on current inputs
  const allVariations = useMemo(() => {
    return generateEmailVariations(firstName, lastName, domain.replace('@', ''));
  }, [firstName, lastName, domain]);

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
      setSelectedVariations(new Set());
    }
  };

  const toggleVariation = (email: string) => {
    const newSet = new Set(selectedVariations);
    if (newSet.has(email)) {
      newSet.delete(email);
    } else {
      newSet.add(email);
    }
    setSelectedVariations(newSet);
  };

  const selectAll = () => {
    setSelectedVariations(new Set(allVariations));
  };

  const deselectAll = () => {
    setSelectedVariations(new Set());
  };

  const handleVerify = async () => {
    if (selectedVariations.size === 0) {
      toast({
        title: 'No Emails Selected',
        description: 'Please select at least one email variation to verify.',
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
          emails: Array.from(selectedVariations),
        },
      });

      if (error) throw error;

      if (data.success) {
        setResults(data.results);
        setValidEmail(data.validEmail);

        const rateLimited = (data.results || []).find((r: EmailVariation) => r.status === 'rate_limited');
        if (rateLimited) {
          const retryAfter = rateLimited.result?.retryAfter;
          toast({
            title: 'Rate limited by Clearout',
            description: retryAfter
              ? `Try again after ${new Date(retryAfter).toLocaleTimeString()}.`
              : 'Try again in a minute (or upgrade your Clearout plan limit).',
            variant: 'destructive',
          });
        }

        if (data.validEmail) {
          toast({
            title: 'Valid Email Found!',
            description: `Verified: ${data.validEmail}`,
          });
        } else if (!rateLimited) {
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
      case 'catch_all':
        return <ShieldQuestion className="h-4 w-4 text-orange-500" />;
      case 'rate_limited':
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
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
      case 'catch_all':
        return 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800';
      case 'rate_limited':
        return 'bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700';
      default:
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'valid':
        return 'Valid';
      case 'invalid':
        return 'Invalid';
      case 'catch_all':
        return 'Catch-All';
      case 'rate_limited':
        return 'Rate Limited';
      default:
        return 'Unknown';
    }
  };

  const hasInputs = firstName.trim() && lastName.trim() && domain.trim();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Search className="h-4 w-4" />
          Find Email
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Verification
          </DialogTitle>
          <DialogDescription>
            Enter a contact's name and domain, then select which email variations to verify.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name & Domain inputs */}
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

          {/* Variation selection */}
          {hasInputs && allVariations.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Select variations to verify ({selectedVariations.size}/{allVariations.length})
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={selectAll}
                    disabled={isVerifying}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={deselectAll}
                    disabled={isVerifying}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                {allVariations.map((email) => {
                  const result = results.find((r) => r.email === email);
                  return (
                    <div
                      key={email}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-md transition-colors',
                        result ? getStatusColor(result.status) : 'hover:bg-muted/50'
                      )}
                    >
                      <Checkbox
                        id={email}
                        checked={selectedVariations.has(email)}
                        onCheckedChange={() => toggleVariation(email)}
                        disabled={isVerifying}
                      />
                      <label
                        htmlFor={email}
                        className="flex-1 font-mono text-sm cursor-pointer"
                      >
                        {email}
                      </label>
                      {result && (
                        <div className="flex items-center gap-2">
                          {getStatusIcon(result.status)}
                          <span className="text-xs text-muted-foreground">
                            {getStatusLabel(result.status)}
                          </span>
                          {result.status === 'valid' && onEmailVerified && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => handleUseEmail(result.email)}
                            >
                              Use
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Button
            onClick={handleVerify}
            disabled={isVerifying || selectedVariations.size === 0}
            className="w-full"
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying {selectedVariations.size} Email(s)...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Verify Selected ({selectedVariations.size})
              </>
            )}
          </Button>

          {/* Summary of results */}
          {results.length > 0 && (
            <div className="text-sm text-muted-foreground text-center pt-2">
              Checked {results.length} variation(s)
              {validEmail && (
                <span className="text-green-600 font-medium ml-2">
                  ✓ Found valid: {validEmail}
                </span>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
