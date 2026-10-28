import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Search, PlayCircle, Lightbulb, ArrowRight, BookOpen,
  Layers, Rocket, Shield, PanelTop, LayoutDashboard, School, GraduationCap,
  CalendarCheck2, CalendarDays, Trophy, ClipboardList, Megaphone, DollarSign,
  BarChart2, Receipt, ShoppingCart, FileText, UserCircle, Fingerprint, Banknote,
  Library, Settings, Clock, CreditCard, HelpCircle, Users, Package,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { GUIDE_GROUPS, getGuideSections } from '@/lib/guideContent';
import { tourMode, startTour } from '@/lib/tour';
import { cn } from '@/lib/utils';

const ICONS = {
  Layers, Rocket, Shield, PanelTop, LayoutDashboard, School, GraduationCap,
  CalendarCheck2, CalendarDays, Trophy, ClipboardList, Megaphone, DollarSign,
  BookOpen, BarChart2, Receipt, ShoppingCart, FileText, UserCircle, Fingerprint,
  Banknote, Library, Settings, Clock, CreditCard, HelpCircle,
};

// "Start here" shortcuts: the first-run setup order, as clickable tiles.
const QUICK_START = {
  school: [
    { path: '/employees', icon: UserCircle, label: 'Add staff' },
    { path: '/classes', icon: School, label: 'Create classes' },
    { path: '/subjects', icon: BookOpen, label: 'Add subjects' },
    { path: '/students', icon: GraduationCap, label: 'Enroll students' },
    { path: '/fees', icon: DollarSign, label: 'Set up fees' },
  ],
  business: [
    { path: '/clients', icon: Users, label: 'Add clients' },
    { path: '/vendors', icon: Users, label: 'Add vendors' },
    { path: '/inventory', icon: Package, label: 'Add products' },
    { path: '/sales', icon: Receipt, label: 'Make a sale' },
    { path: '/employees', icon: UserCircle, label: 'Add employees' },
  ],
  platform: [
    { path: '/settings', icon: Layers, label: 'Create a client' },
  ],
};

const blockText = (b) => [b.p, b.tip, ...(b.steps || []), ...(b.list || []), ...(b.table || []).flat()]
  .filter(Boolean).join(' ');

export default function HelpGuide() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const mode = tourMode(user);
  const [query, setQuery] = useState('');

  const sections = useMemo(() => getGuideSections({ mode, role: user?.role }), [mode, user?.role]);

  const tx = (key, text) => t(`guide.${key}`, { defaultValue: text });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) =>
      [s.title, s.summary, ...s.blocks.map(blockText)].join(' ').toLowerCase().includes(q));
  }, [sections, query]);

  const groups = GUIDE_GROUPS
    .map((g) => ({ ...g, sections: visible.filter((s) => s.group === g.id) }))
    .filter((g) => g.sections.length > 0);

  const jumpTo = (id) => document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-sky-500/10 p-6 sm:p-8"
      >
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <BookOpen className="h-3.5 w-3.5" />{tx('ui.helpBadge', 'Help & Guide')}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {tx('ui.helpTitle', 'How can we help?')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {tx('ui.helpSubtitle', 'Everything in OneBook, explained step by step. Search for a topic or browse below.')}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tx('ui.searchPlaceholder', 'Search, e.g. "fees", "attendance", "add student"')}
                className="h-11 bg-background pl-9"
              />
            </div>
            <Button size="lg" variant="outline" className="h-11 bg-background" onClick={startTour}>
              <PlayCircle className="mr-2 h-4 w-4" />{tx('ui.replayTour', 'Replay the tour')}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Start here */}
      {!query && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {tx('ui.startHere', 'Start here')}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {QUICK_START[mode].map((item, i) => (
              <motion.div
                key={item.path + item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <Link
                  to={item.path}
                  className="group flex h-full items-center gap-3 rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium">{tx(`ui.quick.${mode}.${i}`, item.label)}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Contents */}
        <nav className="hidden lg:block">
          <div className="sticky top-4 space-y-4 text-sm">
            {groups.map((g) => (
              <div key={g.id}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tx(`groups.${g.id}`, g.title)}
                </p>
                <ul className="space-y-0.5">
                  {g.sections.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => jumpTo(s.id)}
                        className="w-full rounded-md px-2 py-1 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {tx(`${s.id}.title`, s.title)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* Sections */}
        <div className="min-w-0 space-y-8">
          {groups.length === 0 && (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              {tx('ui.noResults', 'Nothing found. Try another word, like "fees" or "student".')}
            </div>
          )}
          {groups.map((g) => (
            <section key={g.id} className="space-y-4">
              <h2 className="text-lg font-semibold">{tx(`groups.${g.id}`, g.title)}</h2>
              {g.sections.map((s) => (
                <GuideSection key={s.id} section={s} tx={tx} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function GuideSection({ section: s, tx }) {
  const Icon = ICONS[s.icon] || HelpCircle;
  const k = (...parts) => [s.id, ...parts].join('.');

  return (
    <motion.article
      id={`guide-${s.id}`}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.3 }}
      className="scroll-mt-4 rounded-2xl border bg-card p-5 sm:p-6"
    >
      <header className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-base font-semibold">{tx(k('title'), s.title)}</h3>
          <p className="text-sm text-muted-foreground">{tx(k('summary'), s.summary)}</p>
        </div>
      </header>

      <div className="space-y-4 text-sm leading-relaxed">
        {s.blocks.map((b, bi) => {
          if (b.p) return <p key={bi}>{tx(k(bi), b.p)}</p>;
          if (b.tip) {
            return (
              <div key={bi} className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p>{tx(k(bi), b.tip)}</p>
              </div>
            );
          }
          if (b.steps) {
            return (
              <ol key={bi} className="space-y-2.5">
                {b.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{tx(k(bi, i), step)}</span>
                  </li>
                ))}
              </ol>
            );
          }
          if (b.list) {
            return (
              <ul key={bi} className="space-y-2">
                {b.list.map((item, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span>{tx(k(bi, i), item)}</span>
                  </li>
                ))}
              </ul>
            );
          }
          if (b.table) {
            return (
              <dl key={bi} className="divide-y rounded-xl border">
                {b.table.map(([term, desc], i) => (
                  <div key={i} className={cn('grid gap-1 p-3 sm:grid-cols-[180px_1fr] sm:gap-4')}>
                    <dt className="font-medium">{tx(k(bi, i, 'term'), term)}</dt>
                    <dd className="text-muted-foreground">{tx(k(bi, i, 'desc'), desc)}</dd>
                  </div>
                ))}
              </dl>
            );
          }
          return null;
        })}
      </div>
    </motion.article>
  );
}
