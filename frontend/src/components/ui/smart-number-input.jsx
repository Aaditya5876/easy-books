import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Behaves like <Input type="number"> but clears "0" when focused so user can type directly
const SmartNumberInput = React.forwardRef(({ className, onFocus, onBlur, onChange, value, ...props }, ref) => {
  const handleFocus = (e) => {
    if (String(value) === '0' || String(e.target.value) === '0') {
      // Simulate clearing — call onChange with empty string
      if (onChange) onChange({ ...e, target: { ...e.target, value: '' } });
    }
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e) => {
    // Restore 0 if left blank
    if (e.target.value === '' || e.target.value === undefined) {
      if (onChange) onChange({ ...e, target: { ...e.target, value: '0' } });
    }
    if (onBlur) onBlur(e);
  };

  return (
    <Input
      ref={ref}
      type="number"
      value={value}
      onChange={onChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cn("text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", className)}
      {...props}
    />
  );
});
SmartNumberInput.displayName = "SmartNumberInput";

export { SmartNumberInput };
