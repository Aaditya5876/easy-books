import { useState } from 'react';
import PageHeader from '../components/shared/PageHeader';
import { cn } from "@/lib/utils";

export default function Calculator() {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [history, setHistory] = useState([]);

  function handleNumber(num) {
    if (display === '0' && num !== '.') {
      setDisplay(String(num));
    } else {
      setDisplay(display + num);
    }
  }

  function handleOperator(op) {
    setExpression(display + ' ' + op + ' ');
    setDisplay('0');
  }

  function handleEquals() {
    const fullExpr = expression + display;
    try {
      const sanitized = fullExpr.replace(/[^0-9+\-*/.() ]/g, '');
      const result = Function('"use strict"; return (' + sanitized + ')')();
      const resultStr = String(Number(result.toFixed(10)));
      setHistory(prev => [...prev, { expr: fullExpr, result: resultStr }].slice(-10));
      setDisplay(resultStr);
      setExpression('');
    } catch {
      setDisplay('Error');
      setExpression('');
    }
  }

  function handleClear() {
    setDisplay('0');
    setExpression('');
  }

  function handleBackspace() {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  }

  function handlePercent() {
    setDisplay(String(parseFloat(display) / 100));
  }

  const buttons = [
    ['C', '⌫', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '±', '='],
  ];

  const operatorMap = { '÷': '/', '×': '*' };

  function handleButton(btn) {
    if (btn === 'C') return handleClear();
    if (btn === '⌫') return handleBackspace();
    if (btn === '%') return handlePercent();
    if (btn === '=') return handleEquals();
    if (btn === '±') return setDisplay(String(-parseFloat(display)));
    if (['+', '-', '×', '÷'].includes(btn)) return handleOperator(operatorMap[btn] || btn);
    handleNumber(btn);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Calculator" subtitle="Quick calculations" />

      <div className="max-w-sm mx-auto">
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-lg">
          {/* Display */}
          <div className="p-6 bg-primary text-primary-foreground">
            <p className="text-xs text-primary-foreground/60 h-5 text-right font-mono">{expression}</p>
            <p className="text-4xl font-light text-right font-mono tracking-tight truncate">{display}</p>
          </div>

          {/* Buttons */}
          <div className="p-3 grid grid-cols-4 gap-2">
            {buttons.flat().map((btn, idx) => {
              const isOperator = ['+', '-', '×', '÷', '='].includes(btn);
              const isAction = ['C', '⌫', '%'].includes(btn);
              return (
                <button
                  key={idx}
                  onClick={() => handleButton(btn)}
                  className={cn(
                    "h-14 rounded-xl text-lg font-medium transition-all active:scale-95",
                    btn === '=' && "bg-primary text-primary-foreground hover:bg-primary/90",
                    isOperator && btn !== '=' && "bg-accent text-accent-foreground hover:opacity-90",
                    isAction && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                    !isOperator && !isAction && "bg-card hover:bg-secondary border border-border",
                    btn === '0' && ""
                  )}
                >
                  {btn}
                </button>
              );
            })}
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="mt-6 bg-card rounded-xl border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">History</h3>
            <div className="space-y-2">
              {history.slice().reverse().map((h, i) => (
                <div key={i} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                  <span className="text-muted-foreground font-mono text-xs">{h.expr}</span>
                  <span className="font-semibold font-mono">= {h.result}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}