import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, BookOpen, ArrowLeftRight } from 'lucide-react';
import { libraryApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const EMPTY_BOOK = { title: '', author: '', isbn: '', category: '', totalCopies: 1, availableCopies: 1, shelfLocation: '' };

function BookDialog({ open, onClose, initial, companyId }) {
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(initial ? {
    title: initial.title, author: initial.author || '', isbn: initial.isbn || '',
    category: initial.category || '', totalCopies: initial.totalCopies,
    availableCopies: initial.availableCopies, shelfLocation: initial.shelfLocation || '',
  } : EMPTY_BOOK);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (data) => isEdit ? libraryApi.updateBook(initial.id, data) : libraryApi.createBook(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['library-books'] }); toast.success(isEdit ? 'Updated' : 'Book added'); onClose(); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to save'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    save.mutate({ ...form, companyId, totalCopies: Number(form.totalCopies), availableCopies: Number(form.availableCopies) });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Book' : 'Add Book'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input placeholder="Book title" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Author</Label>
              <Input placeholder="Author name" value={form.author} onChange={e => set('author', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>ISBN</Label>
              <Input placeholder="ISBN number" value={form.isbn} onChange={e => set('isbn', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input placeholder="e.g. Science, Math" value={form.category} onChange={e => set('category', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Shelf Location</Label>
              <Input placeholder="e.g. A-12" value={form.shelfLocation} onChange={e => set('shelfLocation', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Total Copies</Label>
              <Input type="number" min="1" value={form.totalCopies} onChange={e => set('totalCopies', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Available Copies</Label>
              <Input type="number" min="0" value={form.availableCopies} onChange={e => set('availableCopies', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Book'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IssueDialog({ open, onClose, books, companyId }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ bookId: '', memberName: '', dueDate: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const issue = useMutation({
    mutationFn: (data) => libraryApi.issueBook(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library-books'] });
      qc.invalidateQueries({ queryKey: ['library-issues'] });
      toast.success('Book issued');
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to issue'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.bookId) { toast.error('Select a book'); return; }
    if (!form.memberName.trim()) { toast.error('Member name is required'); return; }
    if (!form.dueDate) { toast.error('Due date is required'); return; }
    issue.mutate({ companyId, bookId: form.bookId, memberName: form.memberName, dueDate: new Date(form.dueDate) });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Issue Book</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Book *</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.bookId} onChange={e => set('bookId', e.target.value)}>
              <option value="">Select book…</option>
              {books.filter(b => b.availableCopies > 0).map(b => (
                <option key={b.id} value={b.id}>{b.title} ({b.availableCopies} available)</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Issued To *</Label>
            <Input placeholder="Student or staff name" value={form.memberName} onChange={e => set('memberName', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Due Date *</Label>
            <Input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={issue.isPending}>{issue.isPending ? 'Issuing…' : 'Issue Book'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({ open, onClose, issue: issueRecord, companyId }) {
  const qc = useQueryClient();
  const [fine, setFine] = useState(0);

  const ret = useMutation({
    mutationFn: () => libraryApi.returnBook(issueRecord.id, fine),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library-books'] });
      qc.invalidateQueries({ queryKey: ['library-issues'] });
      toast.success('Book returned');
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Return Book</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Returning <strong>{issueRecord?.book?.title}</strong> issued to <strong>{issueRecord?.memberName || issueRecord?.student?.name}</strong>
          </p>
          <div className="space-y-1.5">
            <Label>Fine (Rs.)</Label>
            <Input type="number" min="0" value={fine} onChange={e => setFine(Number(e.target.value))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => ret.mutate()} disabled={ret.isPending}>{ret.isPending ? 'Processing…' : 'Mark Returned'}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Library() {
  const companyId = getActiveCompanyId();
  const qc = useQueryClient();
  const [tab, setTab] = useState('books');
  const [bookDialog, setBookDialog] = useState(null);
  const [issueDialog, setIssueDialog] = useState(false);
  const [returnDialog, setReturnDialog] = useState(null);
  const [search, setSearch] = useState('');

  const { data: books = [], isLoading: loadingBooks } = useQuery({
    queryKey: ['library-books', companyId],
    queryFn: () => libraryApi.listBooks().then(r => r.data),
    enabled: !!companyId,
  });

  const { data: issues = [], isLoading: loadingIssues } = useQuery({
    queryKey: ['library-issues', companyId],
    queryFn: () => libraryApi.listIssues().then(r => r.data),
    enabled: !!companyId && tab === 'issues',
  });

  const removeBook = useMutation({
    mutationFn: (id) => libraryApi.removeBook(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['library-books'] }); toast.success('Deleted'); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Cannot delete'),
  });

  const filteredBooks = books.filter(b => !search || b.title.toLowerCase().includes(search.toLowerCase()));
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-NP', { day: 'numeric', month: 'short' }) : '—';

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Library</h1>
          <p className="text-muted-foreground text-sm mt-1">{books.length} books in catalog</p>
        </div>
        <div className="flex gap-2">
          {tab === 'books' && (
            <Button variant="outline" onClick={() => setIssueDialog(true)}>
              <ArrowLeftRight className="w-4 h-4 mr-2" /> Issue Book
            </Button>
          )}
          {tab === 'books' && (
            <Button onClick={() => setBookDialog({ mode: 'add' })}>
              <Plus className="w-4 h-4 mr-2" /> Add Book
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {['books', 'issues'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {t === 'books' ? 'Book Catalog' : 'Issued Books'}
          </button>
        ))}
      </div>

      {tab === 'books' && (
        <>
          <Input placeholder="Search books…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            {loadingBooks ? (
              <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
            ) : filteredBooks.length === 0 ? (
              <div className="p-12 text-center">
                <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No books yet. Add your first book.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Title</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Author</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Shelf</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Available</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredBooks.map(b => (
                    <tr key={b.id} className="hover:bg-muted/20">
                      <td className="px-5 py-3 font-medium">{b.title}</td>
                      <td className="px-5 py-3 text-muted-foreground">{b.author || '—'}</td>
                      <td className="px-5 py-3 text-muted-foreground">{b.category || '—'}</td>
                      <td className="px-5 py-3 text-muted-foreground">{b.shelfLocation || '—'}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.availableCopies > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {b.availableCopies}/{b.totalCopies}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setBookDialog({ mode: 'edit', book: b })} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { if (confirm(`Delete "${b.title}"?`)) removeBook.mutate(b.id); }}
                            className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'issues' && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {loadingIssues ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : issues.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">No active issues.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Book</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Issued To</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Issue Date</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {issues.map(iss => {
                  const overdue = iss.status === 'ISSUED' && new Date(iss.dueDate) < new Date();
                  return (
                    <tr key={iss.id} className="hover:bg-muted/20">
                      <td className="px-5 py-3 font-medium">{iss.book?.title}</td>
                      <td className="px-5 py-3">{iss.memberName || iss.student?.name || '—'}</td>
                      <td className="px-5 py-3 text-muted-foreground">{fmtDate(iss.issueDate)}</td>
                      <td className="px-5 py-3 text-muted-foreground">{fmtDate(iss.dueDate)}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          iss.status === 'RETURNED' ? 'bg-emerald-50 text-emerald-700' :
                          overdue ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {overdue && iss.status !== 'RETURNED' ? 'OVERDUE' : iss.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {iss.status === 'ISSUED' && (
                          <Button size="sm" variant="outline" onClick={() => setReturnDialog(iss)}>Return</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {bookDialog && (
        <BookDialog open={!!bookDialog} onClose={() => setBookDialog(null)} initial={bookDialog.mode === 'edit' ? bookDialog.book : null} companyId={companyId} />
      )}
      {issueDialog && (
        <IssueDialog open={issueDialog} onClose={() => setIssueDialog(false)} books={books} companyId={companyId} />
      )}
      {returnDialog && (
        <ReturnDialog open={!!returnDialog} onClose={() => setReturnDialog(null)} issue={returnDialog} companyId={companyId} />
      )}
    </div>
  );
}
