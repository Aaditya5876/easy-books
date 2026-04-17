import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import SidebarNav from './layout/SidebarNav';
import TopBar from './layout/TopBar';
import FloatingToolWindow from './layout/FloatingToolWindow';
import { cn } from "@/lib/utils";

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTool, setActiveTool] = useState(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - desktop */}
      <div className="hidden lg:block">
        <SidebarNav 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
      </div>

      {/* Sidebar - mobile */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-40 transition-transform duration-300",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarNav 
          collapsed={false} 
          onToggle={() => setMobileMenuOpen(false)} 
        />
      </div>

      {/* Main content */}
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-[240px]"
      )}>
        <TopBar onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} onToolOpen={setActiveTool} />
        <main className="p-4 lg:p-6 max-w-[1600px] mx-auto">
          <Outlet />
        </main>
      </div>
      <FloatingToolWindow activeTool={activeTool} onClose={() => setActiveTool(null)} />
    </div>
  );
}