import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, BookOpen, ArrowLeftRight, Users, UserCheck, 
  Package, ShoppingCart, Receipt, FileText, MessageSquare, 
  FileSpreadsheet, UserCircle, CalendarCheck, Banknote,
  ChevronLeft, ChevronRight, Building2, ChevronDown
} from 'lucide-react';
import { cn } from "@/lib/utils";

const navSections = [
  {
    label: 'Main',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    ]
  },
  {
    label: 'Accounts',
    items: [
      { icon: BookOpen, label: 'Ledger', path: '/ledger' },
      { icon: ArrowLeftRight, label: 'Transactions', path: '/transactions' },
    ]
  },
  {
    label: 'Business',
    items: [
      { icon: Users, label: 'Vendors', path: '/vendors' },
      { icon: UserCheck, label: 'Clients', path: '/clients' },
      { icon: Package, label: 'Inventory', path: '/inventory' },
      { icon: ShoppingCart, label: 'Purchase', path: '/purchase' },
      { icon: Receipt, label: 'Sales', path: '/sales' },
    ]
  },

  {
    label: 'Records',
    items: [
      { icon: FileText, label: 'Memo', path: '/memo' },
      { icon: MessageSquare, label: 'Communication', path: '/communication' },
      { icon: FileSpreadsheet, label: 'Templates', path: '/templates' },
    ]
  },

];

export default function SidebarNav({ collapsed, onToggle }) {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState(
    navSections.map((_, i) => true)
  );

  const toggleSection = (index) => {
    setExpandedSections(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-40 flex flex-col transition-all duration-300",
      collapsed ? "w-[68px]" : "w-[240px]"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground">EasyBooks</h1>
            <p className="text-[10px] text-sidebar-muted leading-none">ERP · CRM · HRM</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {navSections.map((section, sIdx) => (
          <div key={section.label} className="mb-1">
            {!collapsed && (
              <button
                onClick={() => toggleSection(sIdx)}
                className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] uppercase tracking-widest text-sidebar-muted hover:text-sidebar-foreground transition-colors"
              >
                {section.label}
                <ChevronDown className={cn(
                  "w-3 h-3 transition-transform",
                  !expandedSections[sIdx] && "-rotate-90"
                )} />
              </button>
            )}
            {(collapsed || expandedSections[sIdx]) && (
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path || 
                    (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group relative",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && (
                        <span className="truncate text-[13px] font-medium">{item.label}</span>
                      )}
                      {collapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                          {item.label}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="shrink-0 p-2 border-t border-sidebar-border">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}