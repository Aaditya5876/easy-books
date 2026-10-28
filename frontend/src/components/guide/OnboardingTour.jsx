import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { getTourSteps } from '@/lib/guideContent';
import { tourMode, hasSeenTour, markTourSeen, onStartTour } from '@/lib/tour';

const CARD_WIDTH = 340;
const GAP = 16;
const PAD = 6;

const findTarget = (target) => target && document.querySelector(`[data-tour="${target}"]`);

// Places the card beside the highlighted element: to its right when there's
// room (sidebar items), otherwise below or above it (top bar, page panels).
function cardPosition(rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect) return { left: (vw - CARD_WIDTH) / 2, top: Math.max(GAP, vh / 2 - 160) };
  const clampLeft = (x) => Math.min(Math.max(GAP, x), vw - CARD_WIDTH - GAP);
  const clampTop = (y) => Math.min(Math.max(GAP, y), vh - 300);
  if (rect.right + GAP + CARD_WIDTH < vw && rect.width < vw / 2) {
    return { left: rect.right + GAP, top: clampTop(rect.top + rect.height / 2 - 90) };
  }
  if (rect.bottom + 280 < vh) return { left: clampLeft(rect.left), top: rect.bottom + GAP };
  return { left: clampLeft(rect.left), top: clampTop(rect.top - 280) };
}

export default function OnboardingTour() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const mode = tourMode(user);
  const role = user?.role;
  const userKey = user?.id || user?.email;

  const [steps, setSteps] = useState(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);

  const start = useCallback(() => {
    // Drop steps whose target isn't on screen (module not in the package, or
    // hidden for this role) so the tour only shows what this user can click.
    const available = getTourSteps(mode, role).filter((s) => !s.target || findTarget(s.target));
    setIndex(0);
    setSteps(available);
  }, [mode, role]);

  const close = useCallback(() => {
    if (userKey) markTourSeen(userKey, mode);
    setSteps(null);
    setRect(null);
  }, [userKey, mode]);

  // First visit for this user + product: start automatically once the
  // sidebar and top bar have rendered.
  useEffect(() => {
    if (!userKey || hasSeenTour(userKey, mode)) return undefined;
    const id = setTimeout(start, 900);
    return () => clearTimeout(id);
  }, [userKey, mode, start]);

  useEffect(() => onStartTour(start), [start]);

  const step = steps?.[index];

  // Keep the spotlight glued to its target through scrolling and resizing.
  useLayoutEffect(() => {
    if (!step) return undefined;
    const el = findTarget(step.target);
    if (!el) { setRect(null); return undefined; }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  const next = useCallback(() => {
    if (!steps) return;
    if (index >= steps.length - 1) close();
    else setIndex(index + 1);
  }, [steps, index, close]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!step) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, next, back, close]);

  if (!step) return null;

  const tk = (field) => t(`guide.tour.${mode}.${step.id}.${field}`, { defaultValue: step[field] });
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  const pos = cardPosition(rect);

  return createPortal(
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true" aria-label={tk('title')}>
      {/* Blocks clicks on the page while the tour is open */}
      <div className="absolute inset-0" />

      {rect ? (
        <motion.div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary/80"
          style={{ boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.62)' }}
          initial={false}
          animate={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        >
          <motion.div
            className="absolute inset-0 rounded-xl ring-4 ring-primary/40"
            animate={{ opacity: [0.9, 0, 0.9], scale: [1, 1.08, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      ) : (
        <motion.div className="absolute inset-0 bg-slate-950/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          className="absolute rounded-2xl border bg-card text-card-foreground shadow-2xl"
          style={{ width: CARD_WIDTH, left: pos.left, top: pos.top }}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <div className="h-1.5 overflow-hidden rounded-t-2xl bg-muted">
            <motion.div
              className="h-full bg-primary"
              initial={false}
              animate={{ width: `${((index + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {step.emoji && (
                  <motion.span
                    className="text-2xl"
                    initial={{ rotate: -20, scale: 0.6 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                  >
                    {step.emoji}
                  </motion.span>
                )}
                <h3 className="text-base font-semibold leading-snug">{tk('title')}</h3>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t('guide.ui.skip', { defaultValue: 'Skip tour' })}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground">{tk('body')}</p>

            <div className="mt-5 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {t('guide.ui.stepOf', { defaultValue: '{{n}} of {{total}}', n: index + 1, total: steps.length })}
              </span>
              <div className="flex items-center gap-2">
                {isFirst ? (
                  <Button variant="ghost" size="sm" onClick={close}>
                    {t('guide.ui.skipForNow', { defaultValue: 'Skip for now' })}
                  </Button>
                ) : !isLast && (
                  <Button variant="ghost" size="sm" onClick={back}>
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" />{t('guide.ui.back', { defaultValue: 'Back' })}
                  </Button>
                )}
                {isLast ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => { close(); navigate('/help'); }}>
                      <BookOpen className="mr-1.5 h-3.5 w-3.5" />{t('guide.ui.openGuide', { defaultValue: 'Open the guide' })}
                    </Button>
                    <Button size="sm" onClick={close}>{t('guide.ui.finish', { defaultValue: 'Finish' })}</Button>
                  </>
                ) : (
                  <Button size="sm" onClick={next}>
                    {isFirst ? t('guide.ui.startTour', { defaultValue: 'Show me around' }) : t('guide.ui.next', { defaultValue: 'Next' })}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
