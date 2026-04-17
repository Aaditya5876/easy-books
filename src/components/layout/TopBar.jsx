import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { 
  Search, Bell, Settings, LogOut, Building2, ChevronDown, Plus, Menu, Wrench, Calculator, RefreshCw, CalendarDays, UserCircle, CalendarCheck, UsersRound, Banknote
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { getActiveCompanyId, setActiveCompanyId } from '@/lib/companyContext';
import { getTodayBS } from '@/lib/nepaliDate';

export default function TopBar({ onMobileMenuToggle, onToolOpen }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const me = await base44.auth.me();
    setUser(me);
    const companyList = await base44.entities.Company.list();
    setCompanies(companyList);
    const activeId = getActiveCompanyId();
    if (activeId) {
      const active = companyList.find(c => c.id === activeId);
      setActiveCompany(active || companyList[0] || null);
    } else if (companyList.length > 0) {
      setActiveCompany(companyList[0]);
      setActiveCompanyId(companyList[0].id);
    }
  }

  function switchCompany(company) {
    setActiveCompany(company);
    setActiveCompanyId(company.id);
    window.location.reload();
  }

  const todayBS = getTodayBS();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-30">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Company Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 font-medium">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="hidden sm:inline max-w-[160px] truncate">
                {activeCompany?.name || 'Select Company'}
              </span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {companies.map(c => (
              <DropdownMenuItem key={c.id} onClick={() => switchCompany(c)}>
                <Building2 className="w-4 h-4 mr-2" />
                {c.name}
              </DropdownMenuItem>
            ))}
            {companies.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Company
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* BS Date Display */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
          <span>{todayBS.formatted}</span>
          <span className="text-border">|</span>
          <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Tools */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Wrench className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onToolOpen?.('calculator')}>
              <Calculator className="w-4 h-4 mr-2" />
              Calculator
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToolOpen?.('currency')}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Currency Converter
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToolOpen?.('calendar')}>
              <CalendarDays className="w-4 h-4 mr-2" />
              Calendar
            </DropdownMenuItem>
            <DropdownMenuSeparator />

          </DropdownMenuContent>
        </DropdownMenu>

        {/* HR */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <UsersRound className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate('/employees')}>
              <UserCircle className="w-4 h-4 mr-2" />
              Employees
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/attendance')}>
              <CalendarCheck className="w-4 h-4 mr-2" />
              Attendance
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/payroll')}>
              <Banknote className="w-4 h-4 mr-2" />
              Payroll
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search */}
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/search')}
          className="text-muted-foreground hover:text-foreground"
        >
          <Search className="w-4 h-4" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground relative">
          <Bell className="w-4 h-4" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 ml-1">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                <span className="text-xs font-semibold text-primary-foreground">
                  {user?.full_name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <span className="hidden md:inline text-sm font-medium max-w-[120px] truncate">
                {user?.full_name || 'User'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => base44.auth.logout()}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}