import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from 'lucide-react';

export default function DeleteConfirmationDialog({ open, onOpenChange, document, onConfirm }) {
  const [step, setStep] = useState(1); // 1: password, 2: final confirmation
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handlePasswordSubmit = () => {
    if (!password.trim()) {
      setError('Password is required');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleDelete = async () => {
    try {
      await onConfirm();
      setStep(1);
      setPassword('');
      onOpenChange(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setStep(1);
    setPassword('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-sm">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Enter Password to Delete</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your password to proceed with deleting this document.
              </p>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter password"
                  onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                />
                {error && <p className="text-xs text-destructive mt-1">{error}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
              <Button onClick={handlePasswordSubmit}>Continue</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                Confirm Deletion
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete this document? This action cannot be undone.
              </p>
              <div className="bg-secondary p-3 rounded-md text-sm">
                <p><strong>Client:</strong> {document?.client_name}</p>
                <p><strong>Date:</strong> {document?.date_ad}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button variant="destructive" onClick={handleDelete}>Yes, Delete</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}