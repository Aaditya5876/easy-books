import { useState } from 'react';
import { X, Minus, Calculator, RefreshCw, CalendarDays } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CalculatorPage from '@/pages/Calculator';
import CurrencyConverterPage from '@/pages/CurrencyConverter';
import CalendarPageComp from '@/pages/CalendarPage';

const TOOLS = [
  { id: 'calculator', label: 'Calculator', icon: Calculator, component: CalculatorPage },
  { id: 'currency', label: 'Currency Converter', icon: RefreshCw, component: CurrencyConverterPage },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, component: CalendarPageComp },
];

export default function FloatingToolWindow({ activeTool, onClose }) {
  const [minimized, setMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState(activeTool || 'calculator');

  if (!activeTool) return null;

  const ActiveComponent = TOOLS.find(t => t.id === activeTab)?.component;

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 bg-card border border-border rounded-xl shadow-2xl flex flex-col transition-all duration-200",
      minimized ? "w-72 h-12" : "w-[420px] max-h-[80vh]"
    )}>
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              onClick={() => { setActiveTab(tool.id); setMinimized(false); }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                activeTab === tool.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              )}
            >
              <tool.icon className="w-3 h-3" />
              {tool.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button
            onClick={() => setMinimized(m => !m)}
            className="p-1 rounded hover:bg-secondary text-muted-foreground"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-secondary text-muted-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      {!minimized && (
        <div className="overflow-y-auto flex-1 p-3">
          {ActiveComponent && <ActiveComponent />}
        </div>
      )}
    </div>
  );
}