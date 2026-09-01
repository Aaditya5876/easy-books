import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, BookOpen, ArrowLeftRight, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BulkImportDialog from '@/components/shared/BulkImportDialog';
import BorrowerCombobox from '@/components/shared/BorrowerCombobox';
import { BOOK_FIELDS } from '@/components/shared/bulkImportFields';
import { libraryApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { useRole } from '@/lib/useRole';
import { confirm } from '@/lib/confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const EMPTY_BOOK = { title: '', author: '', isbn: '', category: '', totalCopies: 1, availableCopies: 1, shelfLocation: '' };

function BookDialog({ open, onClose, initial, companyId, existingTitles }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(initial ? {
    title: initial.title, author: initial.author || '', isbn: initial.isbn || '',
    category: initial.category || '', totalCopies: initial.totalCopies,
    availableCopies: initial.availableCopies, shelfLocation: initial.shelfLocation || '',
  } : EMPTY_BOOK);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (data) => isEdit ? libraryApi.updateBook(initial.id, data) : libraryApi.createBook(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['library-books'] }); toast.success(isEdit ? t('library.updated', { defaultValue: 'Updated' }) : t('library.bookAdded', { defaultValue: 'Book added' })); onClose(); },
    onError: (err) => toast.error(err?.response?.data?.message || t('library.failedToSave', { defaultValue: 'Failed to save' })),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      const msg = t('library.titleRequired', { defaultValue: 'Title is required' });
      setErrors({ title: msg });
      toast.error(msg);
      return;
    }
    setErrors({});
    save.mutate({ ...form, companyId, totalCopies: Number(form.totalCopies), availableCopies: Number(form.availableCopies) });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? t('library.editBook', { defaultValue: 'Edit Book' }) : t('library.addBook', { defaultValue: 'Add Book' })}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t('library.titleLabel', { defaultValue: 'Title *' })}</Label>
            <Input list="library-existing-titles" placeholder={t('library.titlePlaceholder', { defaultValue: 'Book title' })} value={form.title} onChange={e => { set('title', e.target.value); if (errors.title) setErrors({}); }} />
            <datalist id="library-existing-titles">
              {existingTitles?.map(title => <option key={title} value={title} />)}
            </datalist>
            {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('library.author', { defaultValue: 'Author' })}</Label>
              <Input placeholder={t('library.authorPlaceholder', { defaultValue: 'Author name' })} value={form.author} onChange={e => set('author', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('library.isbn', { defaultValue: 'ISBN' })}</Label>
              <Input placeholder={t('library.isbnPlaceholder', { defaultValue: 'ISBN number' })} value={form.isbn} onChange={e => set('isbn', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('library.category', { defaultValue: 'Category' })}</Label>
              <Input placeholder={t('library.categoryPlaceholder', { defaultValue: 'e.g. Science, Math' })} value={form.category} onChange={e => set('category', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('library.shelfLocation', { defaultValue: 'Shelf Location' })}</Label>
              <Input placeholder={t('library.shelfLocationPlaceholder', { defaultValue: 'e.g. A-12' })} value={form.shelfLocation} onChange={e => set('shelfLocation', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('library.totalCopies', { defaultValue: 'Total Copies' })}</Label>
              <Input type="number" min="1" value={form.totalCopies} onChange={e => set('totalCopies', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('library.availableCopies', { defaultValue: 'Available Copies' })}</Label>
              <Input type="number" min="0" value={form.availableCopies} onChange={e => set('availableCopies', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('library.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('library.saving', { defaultValue: 'Saving…' }) : isEdit ? t('library.saveChanges', { defaultValue: 'Save Changes' }) : t('library.addBook', { defaultValue: 'Add Book' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IssueDialog({ open, onClose, books, companyId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({ bookId: '', studentId: null, memberName: '', dueDate: '' });
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const issue = useMutation({
    mutationFn: (data) => libraryApi.issueBook(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library-books'] });
      qc.invalidateQueries({ queryKey: ['library-issues'] });
      toast.success(t('library.bookIssued', { defaultValue: 'Book issued' }));
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('library.failedToIssue', { defaultValue: 'Failed to issue' })),
  });

  function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.bookId) errs.bookId = t('library.selectABook', { defaultValue: 'Select a book' });
    if (!form.memberName.trim()) errs.memberName = t('library.memberNameRequired', { defaultValue: 'Member name is required' });
    if (!form.dueDate) errs.dueDate = t('library.dueDateRequired', { defaultValue: 'Due date is required' });
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error(Object.values(errs)[0]);
      return;
    }
    setErrors({});
    issue.mutate({ companyId, bookId: form.bookId, studentId: form.studentId, memberName: form.memberName, dueDate: new Date(form.dueDate) });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('library.issueBook', { defaultValue: 'Issue Book' })}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t('library.bookLabel', { defaultValue: 'Book *' })}</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.bookId} onChange={e => { set('bookId', e.target.value); if (errors.bookId) setErrors(er => ({ ...er, bookId: undefined })); }}>
              <option value="">{t('library.selectBook', { defaultValue: 'Select book…' })}</option>
              {books.filter(b => b.availableCopies > 0).map(b => (
                <option key={b.id} value={b.id}>{t('library.bookOption', { defaultValue: '{{title}} ({{count}} available)', title: b.title, count: b.availableCopies })}</option>
              ))}
            </select>
            {errors.bookId && <p className="text-xs text-red-600">{errors.bookId}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{t('library.issuedToLabel', { defaultValue: 'Issued To *' })}</Label>
            <BorrowerCombobox
              displayValue={form.memberName}
              onSelect={({ studentId, memberName }) => { setForm(f => ({ ...f, studentId, memberName })); if (errors.memberName) setErrors(er => ({ ...er, memberName: undefined })); }}
              placeholder={t('library.issuedToPlaceholder', { defaultValue: 'Search student or staff…' })}
            />
            {errors.memberName && <p className="text-xs text-red-600">{errors.memberName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{t('library.dueDateLabel', { defaultValue: 'Due Date *' })}</Label>
            <Input type="date" value={form.dueDate} onChange={e => { set('dueDate', e.target.value); if (errors.dueDate) setErrors(er => ({ ...er, dueDate: undefined })); }} />
            {errors.dueDate && <p className="text-xs text-red-600">{errors.dueDate}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('library.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={issue.isPending}>{issue.isPending ? t('library.issuing', { defaultValue: 'Issuing…' }) : t('library.issueBook', { defaultValue: 'Issue Book' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({ open, onClose, issue: issueRecord }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [fine, setFine] = useState(0);

  const ret = useMutation({
    mutationFn: () => libraryApi.returnBook(issueRecord.id, fine),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library-books'] });
      qc.invalidateQueries({ queryKey: ['library-issues'] });
      toast.success(t('library.bookReturned', { defaultValue: 'Book returned' }));
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('library.failed', { defaultValue: 'Failed' })),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('library.returnBook', { defaultValue: 'Return Book' })}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            {t('library.returning', { defaultValue: 'Returning' })} <strong>{issueRecord?.book?.title}</strong> {t('library.issuedTo', { defaultValue: 'issued to' })} <strong>{issueRecord?.memberName || issueRecord?.student?.name}</strong>
          </p>
          <div className="space-y-1.5">
            <Label>{t('library.fineLabel', { defaultValue: 'Fine (Rs.)' })}</Label>
            <Input type="number" min="0" value={fine} onChange={e => setFine(Number(e.target.value))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('library.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={() => ret.mutate()} disabled={ret.isPending}>{ret.isPending ? t('library.processing', { defaultValue: 'Processing…' }) : t('library.markReturned', { defaultValue: 'Mark Returned' })}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Library() {
  const { t } = useTranslation();
  const { isLibrarian } = useRole();
  const companyId = getActiveCompanyId();
  const qc = useQueryClient();
  const [tab, setTab] = useState('books');
  const [bookDialog, setBookDialog] = useState(null);
  const [issueDialog, setIssueDialog] = useState(false);
  const [returnDialog, setReturnDialog] = useState(null);
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['library-books'] }); toast.success(t('library.deleted', { defaultValue: 'Deleted' })); },
    onError: (err) => toast.error(err?.response?.data?.message || t('library.cannotDelete', { defaultValue: 'Cannot delete' })),
  });

  const filteredBooks = books.filter(b => !search || b.title.toLowerCase().includes(search.toLowerCase()));
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-NP', { day: 'numeric', month: 'short' }) : '—';

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('library.title', { defaultValue: 'Library' })}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('library.booksInCatalog', { defaultValue: '{{count}} books in catalog', count: books.length })}</p>
        </div>
        <div className="flex gap-2">
          {tab === 'books' && !isLibrarian && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" /> {t('library.import', { defaultValue: 'Import' })}
            </Button>
          )}
          {tab === 'books' && (
            <Button variant="outline" onClick={() => setIssueDialog(true)}>
              <ArrowLeftRight className="w-4 h-4 mr-2" /> {t('library.issueBook', { defaultValue: 'Issue Book' })}
            </Button>
          )}
          {tab === 'books' && (
            <Button onClick={() => setBookDialog({ mode: 'add' })}>
              <Plus className="w-4 h-4 mr-2" /> {t('library.addBook', { defaultValue: 'Add Book' })}
            </Button>
          )}
        </div>
      </div>

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="books"
        title={t('library.importBooks', { defaultValue: 'Import Books' })}
        fields={BOOK_FIELDS}
        onDone={() => qc.invalidateQueries({ queryKey: ['library-books'] })}
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {['books', 'issues'].map(tKey => (
          <button key={tKey} onClick={() => setTab(tKey)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === tKey ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {tKey === 'books' ? t('library.bookCatalog', { defaultValue: 'Book Catalog' }) : t('library.issuedBooks', { defaultValue: 'Issued Books' })}
          </button>
        ))}
      </div>

      {tab === 'books' && (
        <>
          <Input placeholder={t('library.searchBooks', { defaultValue: 'Search books…' })} value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            {loadingBooks ? (
              <div className="p-12 text-center text-muted-foreground text-sm">{t('library.loading', { defaultValue: 'Loading…' })}</div>
            ) : filteredBooks.length === 0 ? (
              <div className="p-12 text-center">
                <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">{t('library.noBooksYet', { defaultValue: 'No books yet. Add your first book.' })}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('library.titleHeader', { defaultValue: 'Title' })}</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('library.authorHeader', { defaultValue: 'Author' })}</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('library.categoryHeader', { defaultValue: 'Category' })}</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('library.shelfHeader', { defaultValue: 'Shelf' })}</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('library.availableHeader', { defaultValue: 'Available' })}</th>
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
                          <button onClick={async () => {
                            const ok = await confirm({ description: t('library.confirmDeleteBook', { defaultValue: 'Delete "{{title}}"?', title: b.title }), variant: 'destructive' });
                            if (!ok) return;
                            removeBook.mutate(b.id);
                          }}
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
            <div className="p-12 text-center text-muted-foreground text-sm">{t('library.loading', { defaultValue: 'Loading…' })}</div>
          ) : issues.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">{t('library.noActiveIssues', { defaultValue: 'No active issues.' })}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('library.bookHeader', { defaultValue: 'Book' })}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('library.issuedToHeader', { defaultValue: 'Issued To' })}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('library.issueDateHeader', { defaultValue: 'Issue Date' })}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('library.dueDateHeader', { defaultValue: 'Due Date' })}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('library.statusHeader', { defaultValue: 'Status' })}</th>
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
                          {overdue && iss.status !== 'RETURNED' ? t('library.status_OVERDUE', { defaultValue: 'OVERDUE' }) : t(`library.status_${iss.status}`, { defaultValue: iss.status })}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {iss.status === 'ISSUED' && (
                          <Button size="sm" variant="outline" onClick={() => setReturnDialog(iss)}>{t('library.return', { defaultValue: 'Return' })}</Button>
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
        <BookDialog
          open={!!bookDialog}
          onClose={() => setBookDialog(null)}
          initial={bookDialog.mode === 'edit' ? bookDialog.book : null}
          companyId={companyId}
          existingTitles={[...new Set(books.map(b => b.title))]}
        />
      )}
      {issueDialog && (
        <IssueDialog open={issueDialog} onClose={() => setIssueDialog(false)} books={books} companyId={companyId} />
      )}
      {returnDialog && (
        <ReturnDialog open={!!returnDialog} onClose={() => setReturnDialog(null)} issue={returnDialog} />
      )}
    </div>
  );
}
