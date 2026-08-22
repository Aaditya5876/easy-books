import { ChevronDown } from 'lucide-react';

// Consistent dropdown-filter chrome reused across every portal list page
// (Attendance's month filter, Homework/Notices/Events/StudyMaterials filters).
export default function PortalFilterSelect({ value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none h-10 pl-4 pr-9 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}
