import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, onFocus, ...props }, ref) => {
  // Number fields that still hold the default 0: select it on focus so the
  // first keystroke replaces it — nobody has to delete the 0 by hand.
  // (Deferred: a mouse click would otherwise drop the selection on mouseup.)
  const handleFocus = (e) => {
    if (type === "number" && e.target.value === "0") {
      const el = e.target;
      setTimeout(() => { try { el.select(); } catch { /* not selectable */ } }, 0);
    }
    onFocus?.(e);
  };
  return (
    (<input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      onFocus={handleFocus}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }
