import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { noticesApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Megaphone, Plus, Pencil, Trash2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const AUDIENCES = ['ALL', 'TEACHERS', 'STUDENTS', 'PARENTS'];
const AUDIENCE_LABELS = { ALL: 'Everyone', TEACHERS: 'Teachers', STUDENTS: 'Students', PARENTS: 'Parents' };
const companyId = () => localStorage.getItem('easybooks_active_company') || '';

function NoticeDialog({ open, onClose, notice }) {
  const qc = useQueryClient();
  const isEdit = !!notice;
  const [form, setForm] = useState({
    title: notice?.title || '',
    content: notice?.content || '',
    targetAudience: notice?.targetAudience || 'ALL',
    expiresAt: notice?.expiresAt ? notice.expiresAt.split('T')[0] : '',
  });

  const save = useMutation({
    mutationFn: (d) =>
      isEdit
        ? noticesApi.update(notice.id, d)
        : noticesApi.create({ ...d, companyId: companyId() }),
    onSuccess: () => {
      qc.invalidateQueries(['school-notices']);
      toast.success(isEdit ? 'Notice updated' : 'Notice posted');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return toast.error('Title and content are required');
    save.mutate({ ...form, expiresAt: form.expiresAt || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Notice' : 'Post Notice'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Annual Sports Day 2081" />
          </div>
          <div className="space-y-1">
            <Label>Content *</Label>
            <Textarea
              value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              placeholder="Write your notice here…"
              rows={6}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Audience</Label>
              <Select value={form.targetAudience} onValueChange={v => setForm(p => ({ ...p, targetAudience: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map(a => <SelectItem key={a} value={a}>{AUDIENCE_LABELS[a]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Expires On</Label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Posting…' : isEdit ? 'Update' : 'Post Notice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function printNotice(n) {
  const w = window.open('', '_blank');
  w.document.write(`
    <html><head><title>Notice</title>
    <style>body{font-family:serif;max-width:700px;margin:40px auto;padding:0 20px}
    h2{text-align:center;border-bottom:2px solid #000;padding-bottom:8px}
    .meta{display:flex;justify-content:space-between;margin:12px 0;font-size:13px;color:#555}
    .content{white-space:pre-wrap;line-height:1.8;margin-top:20px;font-size:15px}
    .footer{margin-top:60px;text-align:right;font-size:13px}
    @media print{button{display:none}}
    </style></head>
    <body>
    <h2>${n.title}</h2>
    <div class="meta">
      <span>Date: ${format(new Date(n.createdAt), 'MMMM d, yyyy')}</span>
      <span>For: ${AUDIENCE_LABELS[n.targetAudience] || 'Everyone'}</span>
    </div>
    <div class="content">${n.content}</div>
    <div class="footer">
      <p>_______________________</p>
      <p>Principal / Administration</p>
    </div>
    <br><button onclick="window.print()">Print</button>
    </body></html>
  `);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

export default function Notices() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState({ open: false, notice: null });
  const [search, setSearch] = useState('');

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['school-notices'],
    queryFn: () => noticesApi.list().then(r => r.data),
  });

  const remove = useMutation({
    mutationFn: (id) => noticesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries(['school-notices']); toast.success('Notice deleted'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Cannot delete'),
  });

  const filtered = notices.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  const isExpired = (n) => n.expiresAt && new Date(n.expiresAt) < new Date();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Notice Board</h1>
        </div>
        <Button onClick={() => setDialog({ open: true, notice: null })}>
          <Plus className="h-4 w-4 mr-1" /> Post Notice
        </Button>
      </div>

      <Input
        placeholder="Search notices…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No notices yet. Post your first notice.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(n => (
            <div key={n.id} className={`rounded-lg border p-4 bg-card ${isExpired(n) ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base">{n.title}</h3>
                    <Badge variant="outline" className="text-xs">{AUDIENCE_LABELS[n.targetAudience]}</Badge>
                    {isExpired(n) && <Badge variant="secondary" className="text-xs">Expired</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Posted: {format(new Date(n.createdAt), 'dd MMM yyyy')}
                    {n.expiresAt && ` · Expires: ${format(new Date(n.expiresAt), 'dd MMM yyyy')}`}
                  </p>
                  <p className="mt-2 text-sm whitespace-pre-wrap line-clamp-3">{n.content}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => printNotice(n)} title="Print">
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDialog({ open: true, notice: n })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (window.confirm('Delete this notice?')) remove.mutate(n.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialog.open && (
        <NoticeDialog
          open={dialog.open}
          onClose={() => setDialog({ open: false, notice: null })}
          notice={dialog.notice}
        />
      )}
    </div>
  );
}
