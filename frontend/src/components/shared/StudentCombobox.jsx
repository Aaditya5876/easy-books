import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search, Loader2 } from 'lucide-react';
import { studentsApi } from '@/api';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

const label = (s) => `${s.name}${s.rollNumber ? ` (Roll ${s.rollNumber})` : ''}`;

// Server-side searchable student picker — never fetches the full student list.
// Use in place of a plain <select> dumping every student, which doesn't scale
// past a few hundred students (schools can have 1000s).
export default function StudentCombobox({ value, onChange, classId, status = 'ACTIVE', placeholder = 'Search student by name or roll number…', disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['student-search', query, classId, status],
    queryFn: () => studentsApi.list({ search: query, classId, status: status || undefined }).then(r => r.data),
    enabled: open && query.trim().length > 0,
  });

  // Resolve the currently selected student's label even when it's not in the
  // active search results (e.g. re-opening an edit dialog)
  const { data: selected } = useQuery({
    queryKey: ['student-by-id', value],
    queryFn: () => studentsApi.get(value).then(r => r.data),
    enabled: !!value,
    staleTime: 60_000,
  });

  const options = useMemo(() => {
    if (selected && !results.some(s => s.id === selected.id)) return [selected, ...results];
    return results;
  }, [results, selected]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate text-left">
            {selected ? label(selected) : <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a name or roll number…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {query.trim().length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Search className="h-3.5 w-3.5" /> Start typing to search students…
              </div>
            ) : isFetching ? (
              <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
              </div>
            ) : (
              <>
                <CommandEmpty>No students found.</CommandEmpty>
                <CommandGroup>
                  {options.map(s => (
                    <CommandItem
                      key={s.id}
                      value={s.id}
                      onSelect={() => { onChange(s.id); setOpen(false); setQuery(''); }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', value === s.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex-1 truncate">{label(s)}</span>
                      {s.class && <span className="text-xs text-muted-foreground ml-2">{s.class.name}{s.class.section ? ` (${s.class.section})` : ''}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
