import { useState, useRef } from 'react';
import { bulkImportApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Upload, FileDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// Quote-aware parser for CSV / TSV (Excel paste is TSV)
function parseDelimited(text) {
  const clean = text.replace(/\r\n?/g, '\n').trim();
  if (!clean) return [];
  const delim = clean.split('\n')[0].includes('\t') ? '\t' : ',';
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field); field = '';
    } else if (ch === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Map header cells to field keys using key, label and aliases
function mapHeaders(headerRow, fields) {
  return headerRow.map(h => {
    const n = normalize(h);
    if (!n) return null;
    const match = fields.find(f =>
      normalize(f.key) === n ||
      normalize(f.label) === n ||
      (f.aliases || []).some(a => normalize(a) === n)
    );
    return match ? match.key : null;
  });
}

export default function BulkImportDialog({ open, onClose, entity, title, fields, onDone }) {
  const [rows, setRows] = useState([]);          // parsed objects
  const [headerMap, setHeaderMap] = useState([]); // mapped header keys (for preview cols)
  const [result, setResult] = useState(null);    // { created, skipped }
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const requiredKeys = fields.filter(f => f.required).map(f => f.key);
  const mappedKeys = fields.filter(f => headerMap.includes(f.key));
  const missingRequired = requiredKeys.filter(k => !headerMap.includes(k));

  function loadText(text) {
    const parsed = parseDelimited(text);
    if (parsed.length < 2) return toast.error('Need a header row plus at least one data row');
    const map = mapHeaders(parsed[0], fields);
    if (map.every(k => k === null)) {
      return toast.error('No recognizable columns found — download the template to see expected headers');
    }
    const objects = parsed.slice(1).map(cells => {
      const obj = {};
      map.forEach((key, idx) => { if (key) obj[key] = (cells[idx] ?? '').trim(); });
      return obj;
    });
    setHeaderMap(map);
    setRows(objects);
    setResult(null);
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadText(String(reader.result));
    reader.readAsText(file);
    e.target.value = '';
  }

  function handlePaste(e) {
    const text = e.clipboardData?.getData('text');
    if (text) { e.preventDefault(); loadText(text); }
  }

  function downloadTemplate() {
    const header = fields.map(f => f.label).join(',');
    const example = fields.map(f => f.example || '').join(',');
    const blob = new Blob([`${header}\n${example}\n`], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${entity}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const rowError = (r) => {
    const missing = requiredKeys.filter(k => !String(r[k] || '').trim());
    return missing.length ? `Missing: ${missing.map(k => fields.find(f => f.key === k)?.label || k).join(', ')}` : null;
  };
  const validRows = rows.filter(r => !rowError(r));

  async function handleImport() {
    if (!validRows.length) return toast.error('No valid rows to import');
    setImporting(true);
    try {
      const res = await bulkImportApi.import(entity, validRows);
      setResult(res.data);
      onDone?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setRows([]); setHeaderMap([]); setResult(null);
  }

  function close() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {result ? (
          /* ── Result ── */
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 rounded-lg border bg-green-50 border-green-200 p-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800">{result.created} imported successfully</p>
                {result.skipped.length > 0 && (
                  <p className="text-sm text-green-700">{result.skipped.length} skipped (details below)</p>
                )}
              </div>
            </div>
            {result.skipped.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <div className="px-3 py-2 bg-amber-50 border-b text-sm font-medium text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Skipped rows
                </div>
                <div className="max-h-48 overflow-y-auto divide-y text-sm">
                  {result.skipped.map((s, i) => (
                    <div key={i} className="px-3 py-1.5 flex gap-3">
                      <span className="text-muted-foreground shrink-0">Row {s.row}</span>
                      <span>{s.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Import More</Button>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </div>
        ) : rows.length === 0 ? (
          /* ── Input ── */
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              Upload a CSV file, or copy rows from Excel / Google Sheets (including the header row) and paste them below.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" /> Upload CSV
              </Button>
              <Button variant="ghost" onClick={downloadTemplate}>
                <FileDown className="w-4 h-4 mr-2" /> Download Template
              </Button>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFile} />
            </div>
            <textarea
              onPaste={handlePaste}
              readOnly
              placeholder="…or click here and paste (Ctrl+V) your spreadsheet rows"
              className="w-full h-36 rounded-md border border-dashed border-input bg-muted/30 p-3 text-sm resize-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="text-xs text-muted-foreground">
              Recognized columns: {fields.map(f => f.label + (f.required ? ' *' : '')).join(' · ')}
            </div>
          </div>
        ) : (
          /* ── Preview ── */
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">{rows.length}</span> rows parsed —{' '}
                <span className="text-green-700 font-medium">{validRows.length} valid</span>
                {rows.length - validRows.length > 0 && (
                  <span className="text-destructive"> · {rows.length - validRows.length} with errors (will be skipped)</span>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>Start over</Button>
            </div>

            {missingRequired.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                Required column{missingRequired.length > 1 ? 's' : ''} not found:{' '}
                {missingRequired.map(k => fields.find(f => f.key === k)?.label || k).join(', ')}
              </div>
            )}

            <div className="rounded-lg border overflow-auto max-h-72">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 w-8">#</th>
                    {mappedKeys.map(f => <th key={f.key} className="px-2 py-2 whitespace-nowrap">{f.label}</th>)}
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r, i) => {
                    const err = rowError(r);
                    return (
                      <tr key={i} className={`border-t ${err ? 'bg-destructive/5' : ''}`}>
                        <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                        {mappedKeys.map(f => (
                          <td key={f.key} className="px-2 py-1.5 max-w-[160px] truncate">{r[f.key] || '—'}</td>
                        ))}
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {err
                            ? <Badge variant="destructive" className="text-[10px]">{err}</Badge>
                            : <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">OK</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length > 100 && (
                <div className="px-3 py-2 text-xs text-muted-foreground border-t">…and {rows.length - 100} more rows</div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button onClick={handleImport} disabled={importing || validRows.length === 0}>
                {importing ? 'Importing…' : `Import ${validRows.length} Row${validRows.length === 1 ? '' : 's'}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
