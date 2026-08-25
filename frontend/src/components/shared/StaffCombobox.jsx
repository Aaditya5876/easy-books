import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { employeeApi } from '@/api';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

// Searchable staff picker, same shape as StudentCombobox.jsx but backed by
// employeeApi.directory() (name-only listing, no salary/PAN/bank data) since
// there's no server-side staff search endpoint — school staff lists are small
// enough that fetching once and filtering client-side is fine.
//
// Deliberately does NOT filter by designation to guess who's "a driver":
// Employee.designation is free text with no reliable enum for that, so
// filtering risks silently hiding an actual driver phrased differently.
export default function StaffCombobox({ displayValue, onSelect, placeholder = 'Search staff by name…', disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data: staff = [], isFetching } = useQuery({
    queryKey: ['staff-directory'],
    queryFn: () => employeeApi.directory().then(r => r.data),
    enabled: open,
    staleTime: 60_000,
  });

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(e => e.name.toLowerCase().includes(q));
  }, [staff, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" disabled={disabled} className="w-full justify-between font-normal">
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
            {isFetching ? (
              <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading staff…
              </div>
            ) : (
              <>
                <CommandEmpty>No staff found.</CommandEmpty>
                <CommandGroup>
                  {matches.map(e => (
                    <CommandItem
                      key={e.id}
                      value={e.id}
                      onSelect={() => { onSelect(e.name); setOpen(false); setQuery(''); }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', displayValue === e.name ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex-1 truncate">{e.name}</span>
                      {e.designation && <span className="text-xs text-muted-foreground ml-2">{e.designation}</span>}
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
