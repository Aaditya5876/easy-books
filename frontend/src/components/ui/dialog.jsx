"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// Every dialog is capped to the viewport (with a 1rem gutter) and scrolls when
// its content is taller. Callers sometimes pass `overflow-hidden` (to clip a
// decorative top bar); that clipped tall forms with no scrollbar, so it is
// stripped here — `overflow-y-auto` clips the bar to the rounded corners too.
const VIEWPORT_GUTTER = 32;
const stripOverflowHidden = (cls) =>
  typeof cls === 'string' ? cls.replace(/(^|\s)overflow-hidden(?=\s|$)/g, ' ') : cls;

const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const [size, setSize] = React.useState({ width: null, height: null });
  const [isResizing, setIsResizing] = React.useState(false);
  const resizeStartRef = React.useRef(null);
  const contentRef = React.useRef(null);

  // Merge external ref with internal contentRef
  const combinedRef = React.useCallback((node) => {
    contentRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return;
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: rect.height,
    };
    setIsResizing(true);
  }

  React.useEffect(() => {
    if (!isResizing) return;
    function onMove(e) {
      if (!resizeStartRef.current) return;
      const { startX, startY, startW, startH } = resizeStartRef.current;
      // The dialog is centred, so it grows in both directions — clamp to the
      // viewport so it can never slide under the sidebar or off-screen.
      const maxW = window.innerWidth - VIEWPORT_GUTTER;
      const maxH = window.innerHeight - VIEWPORT_GUTTER;
      setSize({
        width: Math.min(maxW, Math.max(380, startW + (e.clientX - startX))),
        height: Math.min(maxH, Math.max(280, startH + (e.clientY - startY))),
      });
    }
    function onUp() {
      resizeStartRef.current = null;
      setIsResizing(false);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizing]);

  const customStyle = size.width
    ? {
        width: size.width,
        height: size.height,
        maxWidth: `calc(100vw - ${VIEWPORT_GUTTER}px)`,
        maxHeight: `calc(100dvh - ${VIEWPORT_GUTTER}px)`,
      }
    : undefined;

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={combinedRef}
        style={customStyle}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          stripOverflowHidden(className)
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
        {/* Drag-to-resize handle */}
        <div
          onMouseDown={startResize}
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize select-none opacity-0 hover:opacity-50 transition-opacity"
          title="Drag to resize"
        >
          <svg viewBox="0 0 10 10" className="w-full h-full text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 8L8 2M5 8L8 5" />
          </svg>
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, ...props }) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
