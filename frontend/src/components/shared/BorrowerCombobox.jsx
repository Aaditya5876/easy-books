import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search, Loader2, GraduationCap, Briefcase } from 'lucide-react';
import { studentsApi, employeeApi } from '@/api';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

// Searchable student-or-staff picker, so a "who has this?" field can only ever
// be filled with a real person — never arbitrary typed text (unlike a plain
// <Input>, which happily accepts a name that matches nobody in the school).
// Mirrors StudentCombobox.jsx's pattern but merges two sources: students via
// server-side search, staff via the directory endpoint (client-filtered —
// employeeApi.directory() has no search param, but staff lists are small).
export default function BorrowerCombobox({ displayValue, onSelect, placeholder = 'Search student or staff by name…', disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data: students = [], isFetching: fetchingStudents } = useQuery({
    queryKey: ['borrower-student-search', query],
    queryFn: () => studentsApi.list({ search: query }).then(r => r.data),
    enabled: open && query.trim().length > 0,
  });

  const { data: staffDirectory = [] } = useQuery({
    queryKey: ['borrower-staff-directory'],
    queryFn: () => employeeApi.directory().then(r => r.data),
    enabled: open,
    staleTime: 60_000,
  });

  const staffMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return staffDirectory.filter(e => e.name.toLowerCase().includes(q));
  }, [staffDirectory, query]);

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
            {displayValue ? displayValue : <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Type a name…" value={query} onValueChange={setQuery} />
          <CommandList>
            {query.trim().length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Search className="h-3.5 w-3.5" /> Start typing to search students &amp; staff…
              </div>
            ) : fetchingStudents ? (
              <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
              </div>
            ) : (
              <>
                <CommandEmpty>No matching student or staff found.</CommandEmpty>
                {students.length > 0 && (
                  <CommandGroup heading="Students">
                    {students.map(s => (
                      <CommandItem
                        key={`s-${s.id}`}
                        value={`s-${s.id}`}
                        onSelect={() => { onSelect({ studentId: s.id, memberName: s.name }); setOpen(false); setQuery(''); }}
                      >
                        <GraduationCap className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate">{s.name}{s.rollNumber ? ` (Roll ${s.rollNumber})` : ''}</span>
                        {s.class && <span className="text-xs text-muted-foreground ml-2">{s.class.name}{s.class.section ? ` (${s.class.section})` : ''}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {staffMatches.length > 0 && (
                  <CommandGroup heading="Staff">
                    {staffMatches.map(e => (
                      <CommandItem
                        key={`e-${e.id}`}
                        value={`e-${e.id}`}
                        onSelect={() => { onSelect({ studentId: null, memberName: e.name }); setOpen(false); setQuery(''); }}
                      >
                        <Briefcase className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate">{e.name}</span>
                        {e.designation && <span className="text-xs text-muted-foreground ml-2">{e.designation}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
