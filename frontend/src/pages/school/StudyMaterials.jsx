import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Download, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { studyMaterialsApi, classesApi, subjectsApi, uploadApi } from '@/api';
import apiClient from '@/api/client';
import { getActiveCompanyId } from '@/lib/companyContext';
import { filterSubjectsByClass } from '@/lib/subjectFilter';
import { useRole } from '@/lib/useRole';
import { confirm } from '@/lib/confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const FILE_TYPE_ICONS = { pdf: '📄', doc: '📝', docx: '📝', image: '🖼️', other: '📎' };

function resolveFileUrl(url = '') {
  return url.startsWith('http') ? url : `${apiClient.defaults.baseURL}${url}`;
}

function getFileType(url = '') {
  const ext = url.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  return 'other';
}

function UploadDialog({ open, onClose, classes, subjects, companyId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', classId: '', subjectId: '', description: '', uploadedBy: '' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (data) => studyMaterialsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study-materials'] });
      toast.success(t('materials.uploaded', { defaultValue: 'Study material uploaded' }));
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('materials.failedToUpload', { defaultValue: 'Failed to upload' })),
  });

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.title.trim()) errs.title = t('materials.titleRequired', { defaultValue: 'Title is required' });
    if (!file) errs.file = t('materials.selectFile', { defaultValue: 'Please select a file' });
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error(Object.values(errs)[0]);
      return;
    }
    setErrors({});
    setUploading(true);
    try {
      const res = await uploadApi.upload(file);
      const fileUrl = res.data?.url || res.data?.fileUrl || res.data?.path;
      if (!fileUrl) throw new Error('No URL returned from upload');
      save.mutate({ ...form, companyId, fileUrl, fileType: getFileType(fileUrl) });
    } catch {
      toast.error(t('materials.fileUploadFailed', { defaultValue: 'File upload failed' }));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('materials.uploadStudyMaterial', { defaultValue: 'Upload Study Material' })}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t('materials.title', { defaultValue: 'Title *' })}</Label>
            <Input placeholder={t('materials.titlePlaceholder', { defaultValue: 'e.g. Chapter 3 Notes' })} value={form.title} onChange={e => { set('title', e.target.value); if (errors.title) setErrors(er => ({ ...er, title: undefined })); }} />
            {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('materials.class', { defaultValue: 'Class' })}</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.classId} onChange={e => set('classId', e.target.value)}>
                <option value="">{t('materials.allClasses', { defaultValue: 'All Classes' })}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('materials.subject', { defaultValue: 'Subject' })}</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.subjectId} onChange={e => set('subjectId', e.target.value)}>
                <option value="">{t('materials.allSubjects', { defaultValue: 'All Subjects' })}</option>
                {filterSubjectsByClass(subjects, form.classId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('materials.description', { defaultValue: 'Description' })}</Label>
            <Input placeholder={t('materials.descriptionPlaceholder', { defaultValue: 'Optional notes about this material' })} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('materials.uploadedBy', { defaultValue: 'Uploaded By' })}</Label>
            <Input placeholder={t('materials.uploadedByPlaceholder', { defaultValue: 'Teacher name' })} value={form.uploadedBy} onChange={e => set('uploadedBy', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('materials.file', { defaultValue: 'File *' })}</Label>
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => { setFile(e.target.files[0]); if (errors.file) setErrors(er => ({ ...er, file: undefined })); }} className="w-full text-sm border rounded-md px-3 py-2 cursor-pointer" />
            {errors.file && <p className="text-xs text-red-600">{errors.file}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('materials.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={uploading || save.isPending}>
              {uploading ? t('materials.uploading', { defaultValue: 'Uploading…' }) : save.isPending ? t('materials.saving', { defaultValue: 'Saving…' }) : t('materials.upload', { defaultValue: 'Upload' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function StudyMaterials() {
  const { t } = useTranslation();
  const companyId = getActiveCompanyId();
  const { canManageAcademicContent } = useRole();
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-materials'] }); toast.success(t('materials.deleted', { defaultValue: 'Deleted' })); },
    onError: () => toast.error(t('materials.failedToDelete', { defaultValue: 'Failed to delete' })),
  });

  const filtered = materials.filter(m => !search || m.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('materials.pageTitle', { defaultValue: 'Study Materials' })}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('materials.filesUploaded', { defaultValue: '{{count}} files uploaded', count: materials.length })}</p>
        </div>
        {canManageAcademicContent && (
          <Button onClick={() => setShowUpload(true)}>
            <Plus className="w-4 h-4 mr-2" /> {t('materials.uploadMaterial', { defaultValue: 'Upload Material' })}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Input placeholder={t('materials.searchPlaceholder', { defaultValue: 'Search by title…' })} value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="">{t('materials.allClasses', { defaultValue: 'All Classes' })}</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>)}
        </select>
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
          <option value="">{t('materials.allSubjects', { defaultValue: 'All Subjects' })}</option>
          {filterSubjectsByClass(subjects, filterClass).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground text-sm">{t('materials.loading', { defaultValue: 'Loading…' })}</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center">
          <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t('materials.noMaterials', { defaultValue: 'No study materials yet. Upload your first file.' })}</p>
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
              {mat.uploadedBy && <p className="text-xs text-muted-foreground">{t('materials.byUploader', { defaultValue: 'By: {{name}}', name: mat.uploadedBy })}</p>}
              <div className="flex gap-2 mt-auto pt-2 border-t border-border">
                <a href={resolveFileUrl(mat.fileUrl)} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Download className="w-3.5 h-3.5 mr-1.5" /> {t('materials.download', { defaultValue: 'Download' })}
                  </Button>
                </a>
                {canManageAcademicContent && (
                  <button
                    onClick={async () => {
                      const ok = await confirm({ description: t('materials.deleteConfirm', { defaultValue: 'Delete this material?' }), variant: 'destructive' });
                      if (!ok) return;
                      remove.mutate(mat.id);
                    }}
                    className="p-2 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
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
