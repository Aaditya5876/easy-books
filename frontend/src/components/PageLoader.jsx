import { Skeleton } from '@/components/ui/skeleton';

export default function PageLoader() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="glass-card rounded-xl p-4 space-y-3">
        <div className="flex gap-3 mb-4">
          <Skeleton className="h-8 w-52 rounded-lg" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
        <div className="flex gap-4 py-2 border-b border-border/30">
          {[40, 24, 16, 16, 12].map((w, i) => (
            <Skeleton key={i} className={`h-3 w-${w} rounded`} />
          ))}
        </div>
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2.5 border-b border-border/20">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-md ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
