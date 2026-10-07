import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { portalApi } from '@/api';
import { toast } from 'sonner';
import { ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PortalChangePassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm]       = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!localStorage.getItem('portal_token')) navigate('/portal/login', { replace: true });
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.currentPassword) { toast.error(t('portal.currentPasswordRequired', { defaultValue: 'Current password is required' })); return; }
    if (form.newPassword.length < 6) { toast.error(t('portal.passwordMinLength', { defaultValue: 'New password must be at least 6 characters' })); return; }
    if (form.newPassword !== form.confirmPassword) { toast.error(t('portal.passwordsDontMatch', { defaultValue: 'Passwords do not match' })); return; }
    setLoading(true);
    try {
      const res = await portalApi.changePassword(form);
      localStorage.setItem('portal_token', res.data.token);
      toast.success(t('portal.passwordChanged', { defaultValue: 'Password changed successfully' }));
      navigate('/portal', { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.message || t('portal.passwordChangeFailed', { defaultValue: 'Failed to change password' }));
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_student');
    navigate('/portal/login', { replace: true });
  }

  return (
    <div className="relative min-h-screen bg-slate-900 flex items-center justify-center p-4 overflow-hidden">

      <motion.div
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 380, height: 380, background: 'rgba(59,130,246,0.22)', top: '-8%', left: '-8%' }}
        animate={{ x: [0, 28, 0], y: [0, 18, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 320, height: 320, background: 'rgba(139,92,246,0.20)', top: '-5%', right: '-6%' }}
        animate={{ x: [0, -22, 0], y: [0, 24, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />

      <motion.div
        className="relative z-10 w-full max-w-sm"
        initial={{ opacity: 0, y: 32, scale: 0.95 }}
        animate={{ opacity: 1, y: 0,  scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.1 }}
      >
        <div className="text-center mb-7">
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500 mb-4 shadow-2xl shadow-blue-500/40"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.25 }}
          >
            <ShieldCheck className="w-8 h-8 text-white" />
          </motion.div>
          <motion.h1
            className="text-2xl font-bold text-white"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            {t('portal.changePassword', { defaultValue: 'Change Your Password' })}
          </motion.h1>
          <motion.p
            className="text-sm text-slate-400 mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
          >
            {t('portal.changePasswordSubtitle', { defaultValue: 'For your security, set a new password before continuing.' })}
          </motion.p>
        </div>

        <div className="bg-white rounded-3xl p-7 shadow-2xl border border-white/10">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">{t('portal.currentPassword', { defaultValue: 'Current Password' })}</label>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder={t('portal.currentPasswordPlaceholder', { defaultValue: 'The password you were given' })}
                value={form.currentPassword}
                onChange={e => set('currentPassword', e.target.value)}
                autoComplete="current-password"
                className="w-full h-12 px-4 rounded-xl border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">{t('portal.newPassword', { defaultValue: 'New Password' })}</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder={t('portal.passwordPlaceholder', { defaultValue: 'Min 6 characters' })}
                  value={form.newPassword}
                  onChange={e => set('newPassword', e.target.value)}
                  autoComplete="new-password"
                  className="w-full h-12 px-4 pr-11 rounded-xl border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">{t('portal.confirmPassword', { defaultValue: 'Confirm New Password' })}</label>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder={t('portal.confirmPasswordPlaceholder', { defaultValue: 'Re-enter new password' })}
                value={form.confirmPassword}
                onChange={e => set('confirmPassword', e.target.value)}
                autoComplete="new-password"
                className="w-full h-12 px-4 rounded-xl border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50"
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading
                ? t('portal.saving', { defaultValue: 'Saving…' })
                : t('portal.changePassword', { defaultValue: 'Change Password' })}
            </motion.button>

            <button
              type="button"
              onClick={logout}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              {t('portal.logout', { defaultValue: 'Log out' })}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
