import { useState } from 'react';
import PageHeader from '../components/shared/PageHeader';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { ArrowLeftRight } from 'lucide-react';

// Approximate exchange rates against NPR (Nepal Rupee)
const RATES = {
  NPR: 1,
  INR: 0.625,      // 1 NPR ≈ 0.625 INR
  USD: 0.0075,     // 1 NPR ≈ 0.0075 USD
  EUR: 0.0069,
  GBP: 0.006,
  AUD: 0.0116,
  CAD: 0.0102,
  CNY: 0.054,
  JPY: 1.12,
  AED: 0.0275,
  SAR: 0.028,
  QAR: 0.027,
  MYR: 0.035,
  KRW: 9.95,
};

const CURRENCY_NAMES = {
  NPR: 'Nepalese Rupee',
  INR: 'Indian Rupee',
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  AUD: 'Australian Dollar',
  CAD: 'Canadian Dollar',
  CNY: 'Chinese Yuan',
  JPY: 'Japanese Yen',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
  QAR: 'Qatari Riyal',
  MYR: 'Malaysian Ringgit',
  KRW: 'Korean Won',
};

export default function CurrencyConverter() {
  const [amount, setAmount] = useState(1000);
  const [from, setFrom] = useState('NPR');
  const [to, setTo] = useState('USD');

  const convert = (amt, fromCur, toCur) => {
    if (!RATES[fromCur] || !RATES[toCur]) return 0;
    // Convert to NPR first, then to target
    const inNpr = amt / RATES[fromCur];
    return inNpr * RATES[toCur];
  };

  const result = convert(amount, from, to);

  function swap() {
    setFrom(to);
    setTo(from);
  }

  const currencies = Object.keys(RATES);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Currency Converter" subtitle="Convert between major currencies" />

      <div className="max-w-lg mx-auto">
        <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
          {/* From */}
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <div className="flex gap-3 mt-1">
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map(c => (
                    <SelectItem key={c} value={c}>{c} - {CURRENCY_NAMES[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                className="flex-1 text-xl font-mono"
              />
            </div>
          </div>

          {/* Swap */}
          <div className="flex justify-center">
            <Button variant="outline" size="icon" onClick={swap} className="rounded-full">
              <ArrowLeftRight className="w-4 h-4" />
            </Button>
          </div>

          {/* To */}
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <div className="flex gap-3 mt-1">
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map(c => (
                    <SelectItem key={c} value={c}>{c} - {CURRENCY_NAMES[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex-1 px-4 py-2 bg-secondary rounded-lg flex items-center">
                <span className="text-xl font-mono font-semibold">{result.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Rate Display */}
          <div className="text-center pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              1 {from} = {convert(1, from, to).toFixed(4)} {to}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Approximate rates · For reference only
            </p>
          </div>
        </div>

        {/* Quick NPR Reference */}
        <div className="mt-6 bg-card rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-3">NPR Exchange Rates</h3>
          <div className="grid grid-cols-2 gap-2">
            {currencies.filter(c => c !== 'NPR').map(c => (
              <div key={c} className="flex justify-between text-sm py-1.5 px-3 bg-secondary rounded-lg">
                <span className="text-muted-foreground">{c}</span>
                <span className="font-mono font-medium">{(1 / RATES[c]).toFixed(2)} NPR</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}