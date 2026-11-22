import { useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import SidebarNav from './layout/SidebarNav';
import TopBar from './layout/TopBar';
import FloatingToolWindow from './layout/FloatingToolWindow';
import OnboardingTour from './guide/OnboardingTour';
import { cn } from "@/lib/utils";
import { usePreferences } from '@/lib/PreferencesContext';

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const location = useLocation();
  const currentOutlet = useOutlet();
  const { prefs } = usePreferences();

  return (
    <div className="min-h-screen bg-background">
      {/* One sidebar implementation at every viewport width. Keeping a single
          collapse state avoids switching to a different, non-collapsible
          drawer when the viewport crosses a responsive breakpoint. */}
      <div>
        <SidebarNav 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
        <button
          type="button"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setSidebarCollapsed(value => !value)}
          className={cn(
            "fixed top-1/2 -translate-y-1/2 z-[45] flex h-12 w-5 items-center justify-center rounded-r-md border border-l-0 border-sidebar-border bg-sidebar text-sidebar-muted shadow-md hover:bg-sidebar-accent hover:text-sidebar-foreground transition-[left,color,background-color] duration-300",
            sidebarCollapsed ? "left-[68px]" : "left-[240px]"
          )}
        >
          <span aria-hidden="true" className="text-xs font-bold">{sidebarCollapsed ? '›' : '‹'}</span>
        </button>
      </div>

      {/* Main content */}
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "ml-[68px]" : "ml-[240px]"
      )}>
        <TopBar onToolOpen={setActiveTool} />
        <main className="p-4 xl:p-6 max-w-[1600px] mx-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {currentOutlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <FloatingToolWindow activeTool={activeTool} onClose={() => setActiveTool(null)} />
      <OnboardingTour />
      {/* Once a company uploads its own logo (top-left), the OneBook logo
          moves here with the GeoInfosys credit. */}
      {prefs.companyLogoUrl && (
        <div className="pointer-events-none fixed bottom-3 right-4 z-30 flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-1 shadow-sm backdrop-blur">
          <img src="/logo-icon.png" alt="OneBook" className="h-5 w-5 object-contain" />
          <span className="text-[10px] font-medium text-muted-foreground">Powered by GeoInfosys</span>
        </div>
      )}
    </div>
  );
}