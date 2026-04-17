import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, ArrowLeftRight, Users, UserCheck, Package, 
  ShoppingCart, Receipt, FileText, MessageSquare, FileSpreadsheet,
  Calculator, Calendar
} from 'lucide-react';
import { cn } from "@/lib/utils";

const actions = [
  { icon: BookOpen, label: 'Ledger', path: '/ledger', color: 'bg-blue-500' },
  { icon: ArrowLeftRight, label: 'Transactions', path: '/transactions', color: 'bg-emerald-500' },
  { icon: Users, label: 'Vendors', path: '/vendors', color: 'bg-violet-500' },
  { icon: UserCheck, label: 'Clients', path: '/clients', color: 'bg-orange-500' },
  { icon: Package, label: 'Inventory', path: '/inventory', color: 'bg-cyan-500' },
  { icon: ShoppingCart, label: 'Purchase', path: '/purchase', color: 'bg-pink-500' },
  { icon: Receipt, label: 'Sales', path: '/sales', color: 'bg-amber-500' },
  { icon: FileText, label: 'Memo', path: '/memo', color: 'bg-teal-500' },
  { icon: MessageSquare, label: 'Communication', path: '/communication', color: 'bg-indigo-500' },
  { icon: FileSpreadsheet, label: 'Templates', path: '/templates', color: 'bg-rose-500' },
  { icon: Calculator, label: 'Calculator', path: '/calculator', color: 'bg-slate-500' },
  { icon: Calendar, label: 'Calendar', path: '/calendar', color: 'bg-lime-600' },
];

export default function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {actions.map(action => {
        const Icon = action.icon;
        return (
          <button
            key={action.path}
            onClick={() => navigate(action.path)}
            className="flex flex-col items-center gap-2 p-4 bg-card rounded-xl border border-border hover:shadow-md hover:-translate-y-0.5 transition-all group"
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-white transition-transform group-hover:scale-110",
              action.color
            )}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-foreground">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}