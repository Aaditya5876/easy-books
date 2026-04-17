import { useState, useRef, useCallback } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export default function DataTable({ columns, data, onRowClick, emptyMessage = "No data yet", filterRow, selectedId }) {
  const [internalSelectedId, setInternalSelectedId] = useState(null);
  const [colWidths, setColWidths] = useState({});
  const resizingRef = useRef(null);

  const startResize = useCallback((key, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = resizingRef.current?.startWidth || e.currentTarget.parentElement.offsetWidth;
    resizingRef.current = { key, startX, startWidth };

    const onMove = (moveEvent) => {
      const diff = moveEvent.clientX - resizingRef.current.startX;
      const newWidth = Math.max(60, resizingRef.current.startWidth + diff);
      setColWidths(w => ({ ...w, [resizingRef.current.key]: newWidth }));
    };
    const onUp = () => {
      resizingRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);
  const activeId = selectedId !== undefined ? selectedId : internalSelectedId;
  const hasColumnFilters = columns.some(col => col.filterValue !== undefined);
  if (!data || data.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map(col => (
                <TableHead
                  key={col.key}
                  className={cn("text-xs font-semibold uppercase tracking-wider relative select-none", col.className)}
                  style={colWidths[col.key] ? { width: colWidths[col.key], minWidth: colWidths[col.key] } : {}}
                >
                  {col.label}
                  <span
                    onMouseDown={e => startResize(col.key, e)}
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize flex items-center justify-center group"
                  >
                    <span className="w-px h-4 bg-border group-hover:bg-primary transition-colors" />
                  </span>
                </TableHead>
              ))}
            </TableRow>
            {hasColumnFilters && (
              <TableRow className="hover:bg-transparent border-b">
                {columns.map(col => (
                  <td key={col.key} className="px-2 py-1">
                    {col.filterValue !== undefined ? (
                      <input
                        type={col.filterType || 'text'}
                        placeholder={col.filterPlaceholder || col.label}
                        value={col.filterValue}
                        onChange={e => col.onFilterChange?.(e.target.value)}
                        className="h-7 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    ) : null}
                  </td>
                ))}
              </TableRow>
            )}
            {filterRow && (
              <TableRow className="hover:bg-transparent border-b">
                {filterRow}
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow 
                key={row.id || idx}
                onClick={() => { setInternalSelectedId(row.id || idx); onRowClick?.(row); }}
                className={cn(onRowClick && "cursor-pointer", (row.id || idx) === activeId ? "bg-primary/10 border-l-2 border-primary hover:bg-primary/10" : "")}
              >
                {columns.map(col => (
                  <TableCell key={col.key} className={cn("text-sm", col.cellClassName)}>
                    {col.render ? col.render(row) : row[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}