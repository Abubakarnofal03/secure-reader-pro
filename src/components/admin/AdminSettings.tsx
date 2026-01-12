import { useState, useEffect } from 'react';
import { Settings, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function AdminSettings() {
  const { toast } = useToast();
  const [bankDetails, setBankDetails] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'bank_details')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error);
      toast({ title: 'Error', description: 'Failed to load settings', variant: 'destructive' });
    } else {
      setBankDetails(data?.value || '');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert(
          { key: 'bank_details', value: bankDetails, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) throw error;

      toast({ title: 'Success', description: 'Bank details saved successfully' });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-card p-4 border border-border">
        <h3 className="flex items-center gap-2 font-semibold mb-4">
          <Settings className="h-5 w-5" />
          Payment Settings
        </h3>

        <div className="space-y-4">
          <div>
            <Label htmlFor="bank-details">Bank Account Details</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Enter your bank account details that users will see when making a purchase.
              Include account name, number, IFSC code, and any other relevant information.
            </p>
            <Textarea
              id="bank-details"
              value={bankDetails}
              onChange={(e) => setBankDetails(e.target.value)}
              placeholder={`Account Name: Your Name
Bank Name: Your Bank
Account Number: XXXXXXXXXXXX
IFSC Code: XXXXXXXXXX
UPI ID: yourname@bank (optional)`}
              rows={6}
              className="font-mono text-sm"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Bank Details
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
