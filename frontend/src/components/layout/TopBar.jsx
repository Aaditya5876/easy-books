import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { api, apiAuth } from '@/api/adapter';
import { notificationsApi } from '@/api';
import {
  Search, Bell, Settings, LogOut, Building2, ChevronDown, Plus, Menu,
  Wrench, Calculator, RefreshCw, CalendarDays, UserCircle, CalendarCheck,
  UsersRound, Banknote, Sun, Moon, X, Package, Users, UserCheck, Globe,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toggleLanguage } from '@/i18n';
import { usePreferences } from '@/lib/PreferencesContext';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getActiveCompanyId, setActiveCompanyId } from '@/lib/companyContext';
import { getTodayBS } from '@/lib/nepaliDate';
import { useRole } from '@/lib/useRole';

export default function TopBar({ onMobileMenuToggle, onToolOpen }) {
  const navigate = useNavigate();
  const { isAdmin, isAccountant, canViewPayroll } = useRole();
  const { i18n } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();
  const { prefs } = usePreferences();
  const [user, setUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(null);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchData, setSearchData] = useState({ clients: [], vendors: [], inventory: [] });

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [autoDetail, setAutoDetail] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const me = await apiAuth.me();
    setUser(me);
    const companyList = await api.Company.list();
    setCompanies(companyList);
    const activeId = getActiveCompanyId();
    if (activeId) {
      const active = companyList.find(c => c.id === activeId);
      setActiveCompany(active || companyList[0] || null);
      // Pre-load search data in background — Clients/Vendors/Inventory are
      // business-ERP-only modules (don't exist for school companies) and are
      // also role-gated to STAFF/ACCOUNTANT/ADMIN, so skip entirely for school
      // companies or for TEACHER/LIBRARIAN to avoid pointless 403s.
      const company = active || companyList[0];
      const canSearchBusinessData = company?.business_type !== 'SCHOOL' && me?.role !== 'TEACHER' && me?.role !== 'LIBRARIAN';
      if (canSearchBusinessData) {
        Promise.all([
          api.Client.filter({ company_id: activeId }),
          api.Vendor.filter({ company_id: activeId }),
          api.InventoryItem.filter({ company_id: activeId }),
        ]).then(([cls, vens, inv]) => {
          setSearchData({ clients: cls, vendors: vens, inventory: inv });
        }).catch(() => {});
      }
    } else if (companyList.length > 0) {
      setActiveCompany(companyList[0]);
      setActiveCompanyId(companyList[0].id);
    }
    // Pre-load unread count so the badge is right before the dropdown ever opens
    if (import.meta.env.VITE_ENABLE_NOTIFICATIONS === 'true') {
      notificationsApi.unreadCount()
        .then(res => setUnreadCount(res?.data ?? 0))
        .catch(() => {});
    }
  }

  async function loadNotifications() {
    setNotifLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        notificationsApi.list({ pageSize: 10 }),
        notificationsApi.unreadCount(),
      ]);
      setNotifications(listRes?.data?.items ?? []);
      setUnreadCount(countRes?.data ?? 0);
    } catch {}
    setNotifLoading(false);
  }

  async function markNotificationRead(id) {
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    try { await notificationsApi.markRead(id); } catch {}
  }

  async function markAllNotificationsRead() {
    setNotifications(ns => ns.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try { await notificationsApi.markAllRead(); } catch {}
  }

  function handleNotificationClick(n) {
    if (!n.isRead) markNotificationRead(n.id);
    if (n.type === 'SYSTEM_AUTOMATION') {
      setAutoDetail(n);
      return;
    }
    if (n.link) navigate(n.link);
  }

  function switchCompany(company) {
    setActiveCompany(company);
    setActiveCompanyId(company.id);
    window.location.reload();
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery('');
  }

  // Live search results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results = [];
    searchData.clients
      .filter(c => c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(c => results.push({ label: c.name, sub: c.phone || c.email || '', type: 'Client', path: '/clients', Icon: UserCheck }));
    searchData.vendors
      .filter(v => v.name?.toLowerCase().includes(q) || v.phone?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(v => results.push({ label: v.name, sub: v.phone || v.email || '', type: 'Vendor', path: '/vendors', Icon: Users }));
    searchData.inventory
      .filter(i => i.description?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(i => results.push({ label: i.description, sub: `Qty: ${i.quantity ?? 0}`, type: 'Inventory', path: '/inventory', Icon: Package }));
    return results.slice(0, 8);
  }, [searchQuery, searchData]);

  const NOTIFICATION_ICONS = {
    LOW_STOCK: { Icon: Package, bg: 'bg-amber-50', color: 'text-amber-500' },
    FEE_PAYMENT: { Icon: Banknote, bg: 'bg-green-50', color: 'text-green-500' },
    LEAVE_REQUEST: { Icon: CalendarCheck, bg: 'bg-blue-50', color: 'text-blue-500' },
    PAYROLL_PAID: { Icon: Banknote, bg: 'bg-green-50', color: 'text-green-500' },
    SYSTEM_AUTOMATION: { Icon: Sparkles, bg: 'bg-violet-50', color: 'text-violet-500' },
  };

  function timeAgo(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  const todayBS = getTodayBS();

  return (
    <>
    <header
      className="h-16 backdrop-blur-xl bg-card/80 border-b border-border/60 flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-30"
      style={prefs.topbarColor ? { backgroundColor: prefs.topbarColor } : undefined}
    >
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
              {activeCompany?.logo_url ? (
                <img src={activeCompany.logo_url} alt={activeCompany.name} className="w-6 h-6 rounded-md object-cover" />
              ) : (
                <Building2 className="w-4 h-4 text-primary" />
              )}
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
                {c.isDefault && <span className="ml-auto text-[10px] text-muted-foreground">default</span>}
              </DropdownMenuItem>
            ))}
            {isAdmin && companies.length > 0 && <DropdownMenuSeparator />}
            {isAdmin && (
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Company
              </DropdownMenuItem>
            )}
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
              <Calculator className="w-4 h-4 mr-2" />Calculator
            </DropdownMenuItem>
            {/* Currency Converter and generic Calendar are business-only tools —
                schools have their own dedicated Calendar and Events module. */}
            {activeCompany?.business_type !== 'SCHOOL' && (
              <>
                <DropdownMenuItem onClick={() => onToolOpen?.('currency')}>
                  <RefreshCw className="w-4 h-4 mr-2" />Currency Converter
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToolOpen?.('calendar')}>
                  <CalendarDays className="w-4 h-4 mr-2" />Calendar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* HR — routes are ACCOUNTANT/ADMIN-only for restricted roles (see schoolRoutes in App.jsx) */}
        {canViewPayroll && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <UsersRound className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/employees')}>
                <UserCircle className="w-4 h-4 mr-2" />Employees
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/attendance')}>
                <CalendarCheck className="w-4 h-4 mr-2" />Attendance
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/payroll')}>
                <Banknote className="w-4 h-4 mr-2" />Payroll
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Settings shortcut — /settings is reachable by ADMIN/ACCOUNTANT (bank accounts,
            fiscal year, automation); unreachable for restricted roles (see schoolRoutes in App.jsx) */}
        {(isAdmin || isAccountant) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings')}
            className="text-muted-foreground hover:text-foreground"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        )}

        {/* ── Inline Search ── */}
        {searchOpen ? (
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none z-10" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && closeSearch()}
              placeholder="Search clients, vendors, items…"
              className="pl-8 h-8 w-56 text-sm"
            />
            {/* Results dropdown */}
            {searchQuery && (
              <div className="absolute top-full right-0 mt-1 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                {searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">No results for "{searchQuery}"</p>
                ) : (
                  searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => { navigate(r.path); closeSearch(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <r.Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.type}{r.sub ? ` · ${r.sub}` : ''}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
            <Button variant="ghost" size="icon" className="ml-1 h-8 w-8 shrink-0" onClick={closeSearch}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Search className="w-4 h-4" />
          </Button>
        )}

        {/* Language toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { toggleLanguage(); }}
          className="text-muted-foreground hover:text-foreground gap-1.5 px-2"
          title={i18n.language === 'ne' ? 'Switch to English' : 'नेपालीमा हेर्नुहोस्'}
        >
          <Globe className="w-4 h-4" />
          <span className="text-xs font-semibold">{i18n.language === 'ne' ? 'ने' : 'EN'}</span>
        </Button>

        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="text-muted-foreground hover:text-foreground"
        >
          {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* ── Notifications Bell ── */}
        {import.meta.env.VITE_ENABLE_NOTIFICATIONS === 'true' && (
        <DropdownMenu onOpenChange={open => { if (open) loadNotifications(); }}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground relative">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-semibold rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={markAllNotificationsRead}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>

            {notifLoading ? (
              <div className="px-4 py-5 text-center text-sm text-muted-foreground">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-2">
                  <Bell className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-sm font-medium text-foreground">All clear!</p>
                <p className="text-xs text-muted-foreground mt-0.5">No notifications yet.</p>
              </div>
            ) : (
              <div className="py-1 max-h-96 overflow-y-auto">
                {notifications.map(n => {
                  const { Icon, bg, color } = NOTIFICATION_ICONS[n.type] || { Icon: Bell, bg: 'bg-secondary', color: 'text-muted-foreground' };
                  return (
                    <DropdownMenuItem
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex items-start gap-3 px-3 py-3 cursor-pointer ${!n.isRead ? 'bg-primary/5' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                    </DropdownMenuItem>
                  );
                })}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        )}

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
            {(isAdmin || isAccountant) && (
              <>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => apiAuth.logout()}>
              <LogOut className="w-4 h-4 mr-2" />Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    {/* Nightly automation detail — shown when a SYSTEM_AUTOMATION notification is clicked */}
    <Dialog open={!!autoDetail} onOpenChange={(open) => !open && setAutoDetail(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            {autoDetail?.title || 'Nightly automation completed'}
          </DialogTitle>
        </DialogHeader>
        {autoDetail?.details?.runAt && (
          <p className="text-xs text-muted-foreground -mt-2">
            Ran {new Date(autoDetail.details.runAt).toLocaleString()}
            {autoDetail.details.month ? ` · Month: ${autoDetail.details.month}` : ''}
          </p>
        )}
        <div className="max-h-96 overflow-y-auto space-y-4 mt-1">
          {(autoDetail?.details?.updates ?? []).map((group, i) => (
            <div key={i}>
              <p className="text-sm font-semibold mb-1.5">{group.label}</p>
              <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                {group.items.map((item, j) => (
                  <div key={j} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <span className="text-foreground">{item.name}</span>
                    {item.amount != null && (
                      <span className="text-muted-foreground font-mono text-xs">NPR {Number(item.amount).toLocaleString()}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {(!autoDetail?.details?.updates || autoDetail.details.updates.length === 0) && (
            <p className="text-sm text-muted-foreground">{autoDetail?.message}</p>
          )}
        </div>
        {autoDetail?.link && (
          <DialogFooter>
            <Button onClick={() => { navigate(autoDetail.link); setAutoDetail(null); }}>
              Go to related page
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
