import { useQuery } from '@tanstack/react-query';
import { companyApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { defaultUnitsFor } from '@easy-books/shared';

// The active company's unit list (set by GeoInfosys at onboarding, editable by
// the company's admin in Settings). Every unit dropdown uses this.
export function useCompanyUnits() {
  const companyId = getActiveCompanyId();
  const { data } = useQuery({
    queryKey: ['company-units', companyId],
    queryFn: () => companyApi.getUnits(companyId).then((r) => r.data?.units ?? []),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
  return data?.length ? data : defaultUnitsFor('DEFAULT');
}

// Options for a unit <select>: the company's list, plus the current value if
// it isn't in the list (an older item saved with another unit stays visible).
export function unitOptions(units, current) {
  return current && !units.includes(current) ? [...units, current] : units;
}
