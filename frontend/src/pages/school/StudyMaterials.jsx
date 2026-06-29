import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, FileText, Download, BookOpen, Filter } from 'lucide-react';
import { studyMaterialsApi, classesApi, subjectsApi, uploadApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const FILE_TYPE_ICONS = { pdf: '📄', doc: '📝', docx: '📝', image: '🖼️', other: '📎' };

function getFileType(url = '') {
  const ext = url.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  return 'other';
}

function UploadDialog({ open, onClose, classes, subjects, companyId }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', classId: '', subjectId: '', description: '', uploadedBy: '' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (data) => studyMaterialsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study-materials'] });
      toast.success('Study material uploaded');
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to upload'),
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!file) { toast.error('Please select a file'); return; }
    setUploading(true);
    try {
      const res = await uploadApi.upload(file);
      const fileUrl = res.data?.url || res.data?.fileUrl || res.data?.path;
      if (!fileUrl) throw new Error('No URL returned from upload');
      save.mutate({ ...form, companyId, fileUrl, fileType: getFileType(fileUrl) });
    } catch (err) {
      toast.error('File upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Upload Study Material</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input placeholder="e.g. Chapter 3 Notes" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Class</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.classId} onChange={e => set('classId', e.target.value)}>
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.subjectId} onChange={e => set('subjectId', e.target.value)}>
                <option value="">All Subjects</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input placeholder="Optional notes about this material" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Uploaded By</Label>
            <Input placeholder="Teacher name" value={form.uploadedBy} onChange={e => set('uploadedBy', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>File *</Label>
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0])} className="w-full text-sm border rounded-md px-3 py-2 cursor-pointer" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={uploading || save.isPending}>
              {uploading ? 'Uploading…' : save.isPending ? 'Saving…' : 'Upload'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function StudyMaterials() {
  const companyId = getActiveCompanyId();
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [search, setSearch] = useState('');

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['study-materials', companyId, filterClass, filterSubject],
    queryFn: () => studyMaterialsApi.list(filterClass || undefined, filterSubject || undefined).then(r => r.data),
    enabled: !!companyId,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['school-classes', companyId],
    queryFn: () => classesApi.list().then(r => r.data),
    enabled: !!companyId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', companyId],
    queryFn: () => subjectsApi.list().then(r => r.data),
    enabled: !!companyId,
  });

  const remove = useMutation({
    mutationFn: (id) => studyMaterialsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-materials'] }); toast.success('Deleted'); },
    onError: () => toast.error('Failed to delete'),
  });

  const filtered = materials.filter(m => !search || m.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Study Materials</h1>
          <p className="text-muted-foreground text-sm mt-1">{materials.length} files uploaded</p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Plus className="w-4 h-4 mr-2" /> Upload Material
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Input placeholder="Search by title…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>)}
        </select>
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
          <option value="">All Subjects</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center">
          <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No study materials yet. Upload your first file.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(mat => (
            <div key={mat.id} className="bg-white border border-border rounded-xl p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{FILE_TYPE_ICONS[mat.fileType] || FILE_TYPE_ICONS.other}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{mat.title}</p>
                  {mat.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{mat.description}</p>}
                </div>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                {mat.class && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{mat.class.name}{mat.class.section ? ` (${mat.class.section})` : ''}</span>}
                {mat.subject && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{mat.subject.name}</span>}
              </div>
              {mat.uploadedBy && <p className="text-xs text-muted-foreground">By: {mat.uploadedBy}</p>}
              <div className="flex gap-2 mt-auto pt-2 border-t border-border">
                <a href={mat.fileUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                  </Button>
                </a>
                <button
                  onClick={() => { if (confirm('Delete this material?')) remove.mutate(mat.id); }}
                  className="p-2 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <UploadDialog
          open={showUpload}
          onClose={() => setShowUpload(false)}
          classes={classes}
          subjects={subjects}
          companyId={companyId}
        />
      )}
    </div>
  );
}
