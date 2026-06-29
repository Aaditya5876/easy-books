import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Home, UserMinus } from 'lucide-react';
import { hostelApi, studentsApi } from '@/api';

import { getActiveCompanyId } from '@/lib/companyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const EMPTY_ROOM = { roomNumber: '', floor: '', capacity: 4, monthlyFee: 0, facilities: '' };

function RoomDialog({ open, onClose, initial, companyId }) {
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(initial ? {
    roomNumber: initial.roomNumber, floor: initial.floor || '', capacity: initial.capacity,
    monthlyFee: initial.monthlyFee, facilities: initial.facilities || '',
  } : EMPTY_ROOM);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (data) => isEdit ? hostelApi.updateRoom(initial.id, data) : hostelApi.createRoom(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hostel-rooms'] }); toast.success(isEdit ? 'Updated' : 'Room added'); onClose(); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to save'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.roomNumber.trim()) { toast.error('Room number is required'); return; }
    save.mutate({ ...form, companyId, capacity: Number(form.capacity), monthlyFee: Number(form.monthlyFee) });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Room' : 'Add Room'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Room Number *</Label>
              <Input placeholder="e.g. 101, A-12" value={form.roomNumber} onChange={e => set('roomNumber', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Floor</Label>
              <Input placeholder="e.g. Ground, 1st" value={form.floor} onChange={e => set('floor', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input type="number" min="1" value={form.capacity} onChange={e => set('capacity', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly Fee (Rs.)</Label>
              <Input type="number" min="0" value={form.monthlyFee} onChange={e => set('monthlyFee', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Facilities</Label>
            <Input placeholder="e.g. Attached bathroom, AC" value={form.facilities} onChange={e => set('facilities', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Room'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AllocateDialog({ open, onClose, rooms, students, companyId }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ roomId: '', studentId: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const allocate = useMutation({
    mutationFn: (data) => hostelApi.allocate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hostel-rooms'] });
      qc.invalidateQueries({ queryKey: ['hostel-allocations'] });
      toast.success('Student allocated');
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to allocate'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.roomId) { toast.error('Select a room'); return; }
    if (!form.studentId) { toast.error('Select a student'); return; }
    allocate.mutate({ companyId, roomId: form.roomId, studentId: form.studentId });
  }

  const availableRooms = rooms.filter(r => (r._count?.allocations || 0) < r.capacity);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Allocate Student to Room</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Room *</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.roomId} onChange={e => set('roomId', e.target.value)}>
              <option value="">Select room…</option>
              {availableRooms.map(r => (
                <option key={r.id} value={r.id}>
                  Room {r.roomNumber}{r.floor ? ` — ${r.floor}` : ''} ({r._count?.allocations || 0}/{r.capacity} occupied)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Student *</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.studentId} onChange={e => set('studentId', e.target.value)}>
              <option value="">Select student…</option>
              {students.filter(s => s.status === 'ACTIVE').map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.rollNumber ? ` (${s.rollNumber})` : ''}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={allocate.isPending}>{allocate.isPending ? 'Allocating…' : 'Allocate'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Hostel() {
  const companyId = getActiveCompanyId();
  const qc = useQueryClient();
  const [tab, setTab] = useState('rooms');
  const [roomDialog, setRoomDialog] = useState(null);
  const [allocDialog, setAllocDialog] = useState(false);

  const { data: rooms = [], isLoading: loadingRooms } = useQuery({
    queryKey: ['hostel-rooms', companyId],
    queryFn: () => hostelApi.listRooms().then(r => r.data),
    enabled: !!companyId,
  });

  const { data: allocations = [], isLoading: loadingAllocs } = useQuery({
    queryKey: ['hostel-allocations', companyId],
    queryFn: () => hostelApi.listAllocations().then(r => r.data),
    enabled: !!companyId && tab === 'residents',
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ['school-students', companyId],
    queryFn: () => studentsApi.list().then(r => r.data),
    enabled: !!companyId,
  });

  const removeRoom = useMutation({
    mutationFn: (id) => hostelApi.removeRoom(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hostel-rooms'] }); toast.success('Room deleted'); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Cannot delete'),
  });

  const deallocate = useMutation({
    mutationFn: (id) => hostelApi.deallocate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hostel-rooms'] });
      qc.invalidateQueries({ queryKey: ['hostel-allocations'] });
      toast.success('Student removed from room');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-NP', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const fmtAmt = (n) => `Rs. ${Number(n).toLocaleString('en-NP')}`;

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hostel Management</h1>
          <p className="text-muted-foreground text-sm mt-1">{rooms.length} rooms configured</p>
        </div>
        <div className="flex gap-2">
          {tab === 'residents' && (
            <Button variant="outline" onClick={() => setAllocDialog(true)}>
              <Plus className="w-4 h-4 mr-2" /> Allocate Student
            </Button>
          )}
          {tab === 'rooms' && (
            <Button onClick={() => setRoomDialog({ mode: 'add' })}>
              <Plus className="w-4 h-4 mr-2" /> Add Room
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {[['rooms', 'Rooms'], ['residents', 'Current Residents']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'rooms' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingRooms ? (
            <div className="col-span-3 p-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : rooms.length === 0 ? (
            <div className="col-span-3 p-12 text-center">
              <Home className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No rooms yet. Add your first hostel room.</p>
            </div>
          ) : rooms.map(room => {
            const occupied = room._count?.allocations || 0;
            const pct = Math.round((occupied / room.capacity) * 100);
            const full = occupied >= room.capacity;
            return (
              <div key={room.id} className="bg-white border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">Room {room.roomNumber}</p>
                    {room.floor && <p className="text-xs text-muted-foreground">{room.floor} floor</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${full ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {full ? 'Full' : 'Available'}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{occupied}/{room.capacity} occupied</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${full ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {room.monthlyFee > 0 && <p className="text-xs text-muted-foreground">{fmtAmt(room.monthlyFee)}/month</p>}
                {room.facilities && <p className="text-xs text-muted-foreground truncate">{room.facilities}</p>}
                <div className="flex gap-2 pt-1 border-t border-border">
                  <button onClick={() => setRoomDialog({ mode: 'edit', room })} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { if (confirm(`Delete Room ${room.roomNumber}?`)) removeRoom.mutate(room.id); }}
                    className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'residents' && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {loadingAllocs ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : allocations.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">No residents currently allocated.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Class</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Room</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Since</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allocations.map(a => (
                  <tr key={a.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">{a.student?.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{a.student?.class ? `${a.student.class.name}${a.student.class.section ? ` (${a.student.class.section})` : ''}` : '—'}</td>
                    <td className="px-5 py-3">Room {a.room?.roomNumber}{a.room?.floor ? `, ${a.room.floor}` : ''}</td>
                    <td className="px-5 py-3 text-muted-foreground">{fmtDate(a.startDate)}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => { if (confirm(`Remove ${a.student?.name} from hostel?`)) deallocate.mutate(a.id); }}
                        className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors">
                        <UserMinus className="w-3.5 h-3.5" /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {roomDialog && (
        <RoomDialog open={!!roomDialog} onClose={() => setRoomDialog(null)} initial={roomDialog.mode === 'edit' ? roomDialog.room : null} companyId={companyId} />
      )}
      {allocDialog && (
        <AllocateDialog open={allocDialog} onClose={() => setAllocDialog(false)} rooms={rooms} students={allStudents} companyId={companyId} />
      )}
    </div>
  );
}
