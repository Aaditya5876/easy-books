import { useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import SidebarNav from './layout/SidebarNav';
import TopBar from './layout/TopBar';
import FloatingToolWindow from './layout/FloatingToolWindow';
import { cn } from "@/lib/utils";

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const location = useLocation();
  const currentOutlet = useOutlet();

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
            "fixed top-1/2 -translate-y-1/2 z-[70] flex h-12 w-5 items-center justify-center rounded-r-md border border-l-0 border-sidebar-border bg-sidebar text-sidebar-muted shadow-md hover:bg-sidebar-accent hover:text-sidebar-foreground transition-[left,color,background-color] duration-300",
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
    </div>
  );
}