import { useState, useRef } from 'react';
import { X, Minus, Maximize2, RefreshCw, ExternalLink, Copy, Eye, EyeOff, Lock } from 'lucide-react';

export default function FloatingBankBrowser({ account, onClose }) {
  const [minimized, setMinimized] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const [pos, setPos] = useState({ x: 80, y: 80 });
  const [size, setSize] = useState({ w: 900, h: 600 });
  const dragRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({});

  const url = account.portal_url;

  function copyToClipboard(text, field) {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(''), 1500);
  }

  function onMouseDown(e) {
    isDragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, x: pos.x, y: pos.y };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    if (!isDragging.current) return;
    setPos({
      x: dragStart.current.x + (e.clientX - dragStart.current.mx),
      y: dragStart.current.y + (e.clientY - dragStart.current.my),
    });
  }

  function onMouseUp() {
    isDragging.current = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  return (
    <div
      ref={dragRef}
      style={{ left: pos.x, top: pos.y, width: minimized ? 320 : size.w, zIndex: 9999 }}
      className="fixed bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
    >
      {/* Title bar */}
      <div
        onMouseDown={onMouseDown}
        className="flex items-center gap-2 px-3 py-2 bg-muted/70 cursor-move select-none border-b border-border"
      >
        <div className="flex items-center gap-1.5">
          <button onClick={onClose} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors" />
          <button onClick={() => setMinimized(v => !v)} className="w-3 h-3 rounded-full bg-yellow-400 hover:bg-yellow-500 transition-colors" />
          <button onClick={() => setSize(s => s.w === 900 ? { w: 1200, h: 750 } : { w: 900, h: 600 })} className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors" />
        </div>
        <div className="flex-1 flex items-center gap-2 ml-2">
          <Lock className="w-3 h-3 text-green-500" />
          <span className="text-xs text-muted-foreground truncate flex-1">{url}</span>
        </div>
        <button onClick={() => setIframeKey(k => k + 1)} className="text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <a href={url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {!minimized && (
        <>
          {/* Credentials bar */}
          <div className="flex items-center gap-3 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900 text-xs">
            <span className="text-blue-600 font-medium">{account.bank_name}</span>
            {account.portal_username && (
              <button
                onClick={() => copyToClipboard(account.portal_username, 'user')}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Copy className="w-3 h-3" />
                {copied === 'user' ? <span className="text-green-600">Copied!</span> : <span>Copy Username</span>}
              </button>
            )}
            {account.portal_password && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>Password:</span>
                <span className="font-mono">{showPassword ? account.portal_password : '••••••••'}</span>
                <button onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => copyToClipboard(account.portal_password, 'pass')}
                  className="hover:text-foreground"
                >
                  <Copy className="w-3 h-3" />
                  {copied === 'pass' && <span className="text-green-600 ml-1">Copied!</span>}
                </button>
              </div>
            )}
          </div>

          {/* iframe */}
          <iframe
            key={iframeKey}
            src={url}
            style={{ height: size.h - 80 }}
            className="w-full border-0 bg-white"
            title="Bank Portal"
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
          />
        </>
      )}
    </div>
  );
}