import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Printer, Share2, Save, X, Minus } from 'lucide-react';
import DataTable from '../shared/DataTable';

export default function FloatingAccountDetail({ account, entries, onClose, onNewEntry, showNewEntry, setShowNewEntry, newEntry, setNewEntry, createEntry }) {
  const [pos, setPos] = useState({ x: window.innerWidth / 2 - 480, y: 60 });
  const [minimized, setMinimized] = useState(false);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const onDragStart = (e) => {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  const entryColumns = [
    { key: 'date_ad', label: 'Date (AD)', render: (row) => (
      <div>
        <div className="text-xs">{row.date_ad || '-'}</div>
        <div className="text-xs text-muted-foreground">{row.date_bs || ''}</div>
      </div>
    )},
    { key: 'description', label: 'Description' },
    { key: 'reference_id', label: 'Ref No.', render: (row) => (
      row.reference_id ? <span className="text-xs font-mono text-muted-foreground">{row.reference_id}</span> : null
    )},
    { key: 'debit', label: 'Debit', render: (row) => (
      row.debit ? <span className="text-red-600 font-mono text-xs">NPR {row.debit.toLocaleString()}</span> : null
    )},
    { key: 'credit', label: 'Credit', render: (row) => (
      row.credit ? <span className="text-green-600 font-mono text-xs">NPR {row.credit.toLocaleString()}</span> : null
    )},
    { key: 'balance', label: 'Balance', render: (row) => (
      <span className="font-mono text-xs font-medium">NPR {Math.abs(row.balance || 0).toLocaleString()}</span>
    )},
  ];

  return (
    <div
      className="fixed z-50 bg-background border border-border rounded-xl shadow-2xl flex flex-col"
      style={{ left: pos.x, top: pos.y, width: 900, maxHeight: minimized ? 'auto' : '85vh' }}
    >
      {/* Title Bar */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground rounded-t-xl cursor-move select-none"
        onMouseDown={onDragStart}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">{account.account_name}</span>
          {account.contact_name && (
            <span className="text-xs opacity-70">{account.contact_name} · {account.contact_phone}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => setMinimized(m => !m)}>
            <Minus className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {!minimized && (
        <div className="flex flex-col overflow-hidden flex-1">
          {/* Action Buttons */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div className="flex gap-2">
              <Button variant="outline" size="sm"><Save className="w-3 h-3 mr-1" />Save</Button>
              <Button variant="outline" size="sm"><Share2 className="w-3 h-3 mr-1" />Share</Button>
              <Button variant="outline" size="sm"><Printer className="w-3 h-3 mr-1" />Print</Button>
            </div>
            <Button size="sm" onClick={() => setShowNewEntry(true)}><Plus className="w-3 h-3 mr-1" />New Entry</Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 px-4 py-3 border-b border-border">
            <div className="bg-secondary rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Opening Balance</p>
              <p className="text-lg font-bold">NPR {(account.opening_balance || 0).toLocaleString()}</p>
            </div>
            <div className="bg-secondary rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Current Balance</p>
              <p className="text-lg font-bold">NPR {Math.abs(account.current_balance || 0).toLocaleString()}</p>
              <p className={`text-xs font-medium mt-0.5 ${(account.current_balance || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {(account.current_balance || 0) >= 0 ? 'Receivable' : 'Payable'}
              </p>
            </div>
            <div className="bg-secondary rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Transactions</p>
              <p className="text-lg font-bold">{entries.length}</p>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <DataTable columns={entryColumns} data={entries} emptyMessage="No entries yet" />

            {/* New Entry Form */}
            {showNewEntry && (
              <div className="mt-4 p-4 border border-border rounded-lg bg-secondary/50">
                <h4 className="text-sm font-semibold mb-3">New Entry</h4>
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <Label>Date *</Label>
                    <Input type="date" value={newEntry.date_ad} onChange={e => setNewEntry({ ...newEntry, date_ad: e.target.value })} />
                  </div>
                  <div>
                    <Label>Description *</Label>
                    <Input value={newEntry.description} onChange={e => setNewEntry({ ...newEntry, description: e.target.value })} />
                  </div>
                  <div>
                    <Label>Reference No.</Label>
                    <Input value={newEntry.reference_id} onChange={e => setNewEntry({ ...newEntry, reference_id: e.target.value })} placeholder="e.g. INV-001" />
                  </div>
                  <div>
                    <Label>Debit (NPR)</Label>
                    <Input type="number" value={newEntry.debit} onChange={e => setNewEntry({ ...newEntry, debit: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>Credit (NPR)</Label>
                    <Input type="number" value={newEntry.credit} onChange={e => setNewEntry({ ...newEntry, credit: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={createEntry} disabled={!newEntry.description}>Save Entry</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowNewEntry(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}