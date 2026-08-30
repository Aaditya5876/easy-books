import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { feesApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScanLine, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

// Camera scanning is best-effort — html5-qrcode needs a live DOM node, and a
// desktop with no camera should still be able to verify a receipt by typing
// the code printed under its QR. Both paths call the same lookup.
export default function VerifyPaymentDialog({ open, onClose }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const scannerRef = useRef(null);
  const regionId = 'fee-payment-qr-scanner';

  async function lookup(rawCode) {
    const value = (rawCode || '').trim();
    if (!value) return;
    setChecking(true);
    try {
      const res = await feesApi.verifyByCode(value);
      if (!res.data) {
        toast.error(t('fees.verificationNotFound', { defaultValue: 'No confirmed payment matches this code' }));
        setResult(null);
      } else {
        setResult(res.data);
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || t('fees.verificationFailed', { defaultValue: 'Could not verify this code' }));
      setResult(null);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!open) return undefined;
    setResult(null);
    setCode('');
    let cancelled = false;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 220 },
          (decodedText) => {
            setCode(decodedText);
            lookup(decodedText);
          },
          () => {}, // per-frame "no QR found" — not an error, ignore
        )
        .catch(() => {
          // No camera available/permission denied — manual code entry still works.
        });
    });

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().then(() => scanner.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open]);

  const fmtAmt = (n) => `Rs. ${Number(n).toLocaleString('en-NP', { minimumFractionDigits: 2 })}`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('fees.scanReceiptQr', { defaultValue: 'Scan Receipt QR' })}</DialogTitle></DialogHeader>

        {!result && (
          <>
            <div id={regionId} className="w-full rounded-lg overflow-hidden bg-muted aspect-square" />
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1.5">
                <Input
                  placeholder={t('fees.orEnterCodeManually', { defaultValue: 'Or type the code printed on the receipt' })}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <Button disabled={checking || !code.trim()} onClick={() => lookup(code)}>
                <ScanLine className="w-4 h-4 mr-1.5" /> {t('fees.verify', { defaultValue: 'Verify' })}
              </Button>
            </div>
          </>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" /> {t('fees.verifiedPayment', { defaultValue: 'Payment verified — this is the record as stored' })}
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">{t('fees.receiptNoColon', { defaultValue: 'Receipt:' })}</span> <strong className="font-mono">{result.receiptNo}</strong></p>
              <p><span className="text-muted-foreground">{t('fees.studentColon', { defaultValue: 'Student:' })}</span> <strong>{result.invoice?.student?.name}</strong></p>
              <p><span className="text-muted-foreground">{t('fees.monthColon', { defaultValue: 'Month:' })}</span> {result.invoice?.month}</p>
              <p><span className="text-muted-foreground">{t('fees.amountColon', { defaultValue: 'Amount:' })}</span> <strong>{fmtAmt(result.amount)}</strong></p>
              <p><span className="text-muted-foreground">{t('fees.paymentMethod', { defaultValue: 'Method' })}:</span> {result.method}{result.bankAccount?.bankName ? ` · ${result.bankAccount.bankName}` : ''}</p>
              <p><span className="text-muted-foreground">{t('fees.paidAtColon', { defaultValue: 'Paid At:' })}</span> {new Date(result.paidAt).toLocaleString('en-NP')}</p>
            </div>
            {result.proofScreenshotUrl && (
              <p className="text-xs text-muted-foreground">{t('fees.compareScreenshotHint', { defaultValue: 'Compare against the physical receipt/screenshot in front of you.' })}</p>
            )}
            <Button variant="outline" className="w-full" onClick={() => setResult(null)}>
              {t('fees.scanAnother', { defaultValue: 'Scan Another' })}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
