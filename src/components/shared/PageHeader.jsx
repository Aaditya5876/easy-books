import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2, Tag } from 'lucide-react';
import { Input } from "@/components/ui/input";

export default function PageHeader({ title, subtitle, onAdd, addLabel, onDelete, deleteLabel, onUpdatePrice, updatePriceLabel, searchValue, onSearchChange, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {onSearchChange && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchValue || ''}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search..."
              className="pl-9 w-[200px] sm:w-[260px]"
            />
          </div>
        )}
        {children}
        {onAdd && (
          <Button onClick={onAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            {addLabel || 'Add New'}
          </Button>
        )}
        {onUpdatePrice && (
          <Button onClick={onUpdatePrice} variant="outline" className="gap-2">
            <Tag className="w-4 h-4" />
            {updatePriceLabel || 'Update Price'}
          </Button>
        )}
        {onDelete && (
          <Button onClick={onDelete} variant="destructive" className="gap-2">
            <Trash2 className="w-4 h-4" />
            {deleteLabel || 'Delete'}
          </Button>
        )}
      </div>
    </div>
  );
}