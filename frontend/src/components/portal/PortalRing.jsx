import { motion } from 'framer-motion';

// Shared radial gauge — used by Attendance (% present) and Results (% score).
export default function PortalRing({ percentage, size = 132, trackColor = '#EEF2F7', color, delay = 0.2, label, light = false }) {
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Number(percentage) / 100) * circ;
  const track = light ? 'rgba(255,255,255,0.25)' : trackColor;
  const ringColor = light ? '#FFFFFF' : color;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke={track} strokeWidth="9" />
        <motion.circle
          cx="50" cy="50" r={r}
          fill="none" stroke={ringColor} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: 'easeOut', delay }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-bold tabular-nums ${light ? 'text-white' : 'text-slate-900'}`}>{Math.round(percentage)}%</span>
        {label && (
          <span className={`text-[10px] font-semibold uppercase tracking-wide mt-0.5 ${light ? 'text-white/70' : 'text-slate-400'}`}>{label}</span>
        )}
      </div>
    </div>
  );
}
