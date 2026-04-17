import { ShoppingCart, Receipt, ArrowLeftRight, FileText } from 'lucide-react';
import { cn } from "@/lib/utils";

const iconMap = {
  purchase: ShoppingCart,
  sales: Receipt,
  transaction: ArrowLeftRight,
  memo: FileText,
};

const colorMap = {
  purchase: 'bg-pink-100 text-pink-600',
  sales: 'bg-amber-100 text-amber-600',
  transaction: 'bg-emerald-100 text-emerald-600',
  memo: 'bg-blue-100 text-blue-600',
};

export default function RecentActivity({ activities = [] }) {
  if (activities.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h3>
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <ArrowLeftRight className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">No recent activity</p>
          <p className="text-xs mt-1">Start by creating entries in any section</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {activities.slice(0, 8).map((activity, idx) => {
          const Icon = iconMap[activity.type] || FileText;
          const colors = colorMap[activity.type] || 'bg-gray-100 text-gray-600';
          return (
            <div key={idx} className="flex items-center gap-3 py-2">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", colors)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{activity.title}</p>
                <p className="text-xs text-muted-foreground">{activity.subtitle}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{activity.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}