import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Minus, LayoutGrid, Save } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DEFAULT_COLUMNS = Array.from({ length: 10 }, (_, index) => (index === 0 ? '' : `Period ${index}`));

function buildInitialTable() {
  return [
    [...DEFAULT_COLUMNS],
    ...DEFAULT_DAYS.map(day => [day, ...Array(DEFAULT_COLUMNS.length - 1).fill('')]),
  ];
}

export default function Routine() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [table, setTable] = useState(buildInitialTable);

  const updateCell = (rowIndex, colIndex, value) => {
    setTable(prev => {
      const next = prev.map(r => [...r]);
      next[rowIndex][colIndex] = value;
      return next;
    });
  };

  const addRow = () => {
    setTable(prev => {
      const newRow = ['', ...Array(prev[0].length - 1).fill('')];
      return [...prev, newRow];
    });
  };

  const deleteRow = () => {
    setTable(prev => (prev.length > 2 ? prev.slice(0, -1) : prev));
  };

  const addColumn = () => {
    setTable(prev => prev.map((row, index) => [...row, index === 0 ? `Period ${row.length}` : '']));
  };

  const deleteColumn = () => {
    setTable(prev => (prev[0].length > 2 ? prev.map(row => row.slice(0, -1)) : prev));
  };

  const resetForm = () => {
    setClassName('');
    setSection('');
    setTable(buildInitialTable());
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    toast.success('Routine saved successfully');
    setIsDialogOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Routine</h1>
          <p className="text-sm text-muted-foreground">Create and edit class routines for your school.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Routine
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Routine</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Class</Label>
                <Input value={className} onChange={e => setClassName(e.target.value)} placeholder="e.g. 5th Standard" />
              </div>
              <div className="space-y-1">
                <Label>Section</Label>
                <Input value={section} onChange={e => setSection(e.target.value)} placeholder="e.g. A" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Routine Spreadsheet</p>
                  <p className="text-sm text-muted-foreground">Edit time slots and subjects directly in the table.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={addRow}>
                    <Plus className="mr-2 h-4 w-4" /> Add Row
                  </Button>
                  <Button type="button" variant="outline" onClick={deleteRow}>
                    <Minus className="mr-2 h-4 w-4" /> Delete Row
                  </Button>
                  <Button type="button" variant="outline" onClick={addColumn}>
                    <Plus className="mr-2 h-4 w-4" /> Add Column
                  </Button>
                  <Button type="button" variant="outline" onClick={deleteColumn}>
                    <Minus className="mr-2 h-4 w-4" /> Delete Column
                  </Button>
                </div>
              </div>

              <div className="overflow-auto rounded-lg border border-border">
                <table className="min-w-full border-collapse text-sm">
                  <tbody>
                    {table.map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex === 0 ? 'bg-slate-50' : 'bg-white'}>
                        {row.map((cell, colIndex) => (
                          <td key={colIndex} className="border border-border p-0">
                            <Input
                              className={colIndex === 0 ? 'h-10 w-36 border-none bg-slate-100 text-sm' : 'h-10 min-w-[140px] border-none text-sm'}
                              value={cell}
                              onChange={e => updateCell(rowIndex, colIndex, e.target.value)}
                              placeholder={rowIndex === 0 && colIndex > 0 ? 'From - To' : rowIndex > 0 && colIndex === 0 ? 'Day' : 'Subject'}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit">
                <Save className="mr-2 h-4 w-4" /> Save Routine
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
