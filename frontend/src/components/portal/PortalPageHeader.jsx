import { motion } from 'framer-motion';

// Shared gradient hero header — same blue→indigo brand as the Dashboard hero
// and the sidebar's blue accent, reused everywhere instead of a plain <h1> so
// every portal page reads as one consistent product instead of a patchwork.
export default function PortalPageHeader({ icon: Icon, title, badge, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 px-5 py-5 md:px-7 md:py-6 shadow-lg shadow-blue-900/10"
    >
      <div className="absolute -right-8 -top-14 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
      <div className="relative z-10 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white leading-tight">{title}</h1>
            {badge && <p className="text-xs text-blue-100 mt-0.5">{badge}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </motion.div>
  );
}
