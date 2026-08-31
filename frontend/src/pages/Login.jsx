import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Mail, Lock, User, Building2, Hash, ShieldCheck, KeyRound } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { authApi } from '@/api';
import { setActiveCompanyId } from '@/lib/companyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

function businessTypes(t) {
  return [
    { value: 'SCHOOL', label: t('auth.bizSchool', { defaultValue: 'School / Educational Institution' }) },
    { value: 'RETAIL', label: t('auth.bizRetail', { defaultValue: 'Retail / General Store' }) },
    { value: 'PHARMACY', label: t('auth.bizPharmacy', { defaultValue: 'Pharmacy / Medical' }) },
    { value: 'ELECTRONICS', label: t('auth.bizElectronics', { defaultValue: 'Electronics / Hardware' }) },
    { value: 'FOOD_BEVERAGE', label: t('auth.bizFoodBeverage', { defaultValue: 'Restaurant / Tea Shop / Bakery' }) },
    { value: 'SERVICES', label: t('auth.bizServices', { defaultValue: 'Services / Consulting / IT' }) },
    { value: 'MANUFACTURING', label: t('auth.bizManufacturing', { defaultValue: 'Manufacturing / Production' }) },
    { value: 'OTHER', label: t('auth.bizOther', { defaultValue: 'Other' }) },
  ];
}

function passwordStrength(pw, t) {
  if (!pw) return null;
  const checks = [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)];
  const passed = checks.filter(Boolean).length;
  if (passed <= 1) return { level: 'Weak', label: t('auth.strengthWeak', { defaultValue: 'Weak' }), color: 'bg-destructive', width: '25%' };
  if (passed === 2) return { level: 'Fair', label: t('auth.strengthFair', { defaultValue: 'Fair' }), color: 'bg-yellow-500', width: '50%' };
  if (passed === 3) return { level: 'Good', label: t('auth.strengthGood', { defaultValue: 'Good' }), color: 'bg-blue-500', width: '75%' };
  return { level: 'Strong', label: t('auth.strengthStrong', { defaultValue: 'Strong' }), color: 'bg-green-500', width: '100%' };
}

function StepDots({ step, total = 2 }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-4">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${step >= i + 1 ? 'bg-primary w-4' : 'bg-muted w-2'}`}
        />
      ))}
    </div>
  );
}

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

// OTP Input — 6 individual boxes
function OtpInput({ value, onChange }) {
  const inputs = useRef([]);

  function handleChange(i, e) {
    const v = e.target.value.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[i] = v;
    const next = arr.join('');
    onChange(next);
    if (v && i < 5) inputs.current[i + 1]?.focus();
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted.padEnd(6, '').slice(0, 6));
      inputs.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  }

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={el => (inputs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="w-10 h-12 text-center text-lg font-mono font-semibold border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-all"
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}

export default function Login() {
  const { t } = useTranslation();
  const BUSINESS_TYPES = businessTypes(t);
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'otp' | 'change-password'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Login
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Register
  const [regStep, setRegStep] = useState(1);
  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    businessType: '',
    otherBusinessDesc: '',
    registrationNumber: '',
    defaultUnitType: '',
  });
  const [showRegPw, setShowRegPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // OTP
  const [otpEmail, setOtpEmail] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef(null);

  // Force-change-password
  const [cpForm, setCpForm] = useState({ current: '', next: '', confirm: '' });
  const [showCpCurrent, setShowCpCurrent] = useState(false);
  const [showCpNext, setShowCpNext] = useState(false);

  useEffect(() => {
    return () => clearInterval(cooldownRef.current);
  }, []);

  function startCooldown() {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(v => {
        if (v <= 1) { clearInterval(cooldownRef.current); return 0; }
        return v - 1;
      });
    }, 1000);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login({ email: loginForm.email, password: loginForm.password });
      if (res.data?.mustChangePassword) {
        setMode('change-password');
        return;
      }
      const meRes = await authApi.me();
      if (meRes.data?.defaultCompanyId) setActiveCompanyId(meRes.data.defaultCompanyId);
      window.location.href = '/';
    } catch (err) {
      setError(err?.response?.data?.message || t('auth.invalidCredentials', { defaultValue: 'Invalid email or password' }));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (regForm.password !== regForm.confirmPassword) { setError(t('auth.passwordsDontMatch', { defaultValue: 'Passwords do not match' })); return; }
    if (regForm.password.length < 8) { setError(t('auth.passwordMinLength', { defaultValue: 'Password must be at least 8 characters' })); return; }
    if (!agreedToTerms) { setError(t('auth.mustAgreeToTerms', { defaultValue: 'Please agree to the Terms and Agreement to continue' })); return; }
    setLoading(true);
    try {
      const { confirmPassword: _confirmPassword, otherBusinessDesc, ...payload } = regForm;
      if (payload.businessType === 'OTHER' && otherBusinessDesc.trim()) {
        payload.businessType = otherBusinessDesc.trim();
      }
      const res = await authApi.register(payload);
      if (res.data?.requiresVerification) {
        setOtpEmail(res.data.email);
        setOtpValue('');
        setMode('otp');
        startCooldown();
      }
    } catch (err) {
      setError(err?.response?.data?.message || t('auth.registrationFailed', { defaultValue: 'Registration failed' }));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (otpValue.length !== 6) { setError(t('auth.enter6DigitCode', { defaultValue: 'Please enter the 6-digit code' })); return; }
    setError('');
    setLoading(true);
    try {
      await authApi.verifyOtp(otpEmail, otpValue);
      const meRes = await authApi.me();
      if (meRes.data?.defaultCompanyId) setActiveCompanyId(meRes.data.defaultCompanyId);
      window.location.href = '/';
    } catch (err) {
      setError(err?.response?.data?.message || t('auth.invalidOrExpiredCode', { defaultValue: 'Invalid or expired verification code' }));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    setError('');
    try {
      await authApi.resendOtp(otpEmail);
      startCooldown();
    } catch (err) {
      setError(err?.response?.data?.message || t('auth.failedToResendCode', { defaultValue: 'Failed to resend code' }));
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setError('');
    if (cpForm.next !== cpForm.confirm) { setError(t('auth.passwordsDontMatch', { defaultValue: 'Passwords do not match' })); return; }
    if (cpForm.next.length < 8) { setError(t('auth.passwordMinLength', { defaultValue: 'Password must be at least 8 characters' })); return; }
    if (cpForm.next === cpForm.current) { setError(t('auth.newPasswordMustDiffer', { defaultValue: 'New password must be different from current password' })); return; }
    setLoading(true);
    try {
      await authApi.changePassword(cpForm.current, cpForm.next);
      const meRes = await authApi.me();
      if (meRes.data?.defaultCompanyId) setActiveCompanyId(meRes.data.defaultCompanyId);
      window.location.href = '/';
    } catch (err) {
      setError(err?.response?.data?.message || t('auth.failedToChangePassword', { defaultValue: 'Failed to change password' }));
    } finally {
      setLoading(false);
    }
  }

  function goNext() {
    setError('');
    if (!regForm.name.trim()) { setError(t('auth.fullNameRequired', { defaultValue: 'Full name is required' })); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regForm.email)) { setError(t('auth.validEmailRequired', { defaultValue: 'Please enter a valid email address' })); return; }
    if (regForm.password.length < 8) { setError(t('auth.passwordMinLength', { defaultValue: 'Password must be at least 8 characters' })); return; }
    if (regForm.password !== regForm.confirmPassword) { setError(t('auth.passwordsDontMatch', { defaultValue: 'Passwords do not match' })); return; }
    setRegStep(2);
  }

  const strength = passwordStrength(regForm.password, t);
  const cpStrength = passwordStrength(cpForm.next, t);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 65% 0%, hsl(217 71% 24% / 0.15) 0%, transparent 55%), radial-gradient(ellipse at 0% 100%, hsl(38 92% 50% / 0.08) 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, hsl(280 65% 60% / 0.06) 0%, transparent 45%), hsl(220 20% 97%)',
      }}
    >
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />

      <div className="w-full max-w-md flex flex-col items-center relative z-10">
      <Card className="w-full shadow-2xl glass-dialog border-border/40 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-blue-500 to-indigo-400" />

        <CardHeader className="text-center pb-2">
          <img src="/logo-icon.png" alt="OneBook" className="w-12 h-12 object-contain mx-auto mb-3 drop-shadow-lg" />
          <CardTitle className="text-xl">{t('auth.appName', { defaultValue: 'OneBook' })}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('auth.appTagline', { defaultValue: 'Nepal Accounting Software' })}</p>
        </CardHeader>

        <CardContent className="pt-4">
          {/* ── OTP SCREEN ── */}
          {mode === 'otp' && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-semibold text-base">{t('auth.verifyYourEmail', { defaultValue: 'Verify your email' })}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('auth.weSentACode', { defaultValue: 'We sent a 6-digit code to' })}<br />
                  <span className="font-medium text-foreground">{otpEmail}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <OtpInput value={otpValue} onChange={setOtpValue} />

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading || otpValue.length !== 6}>
                  {loading ? t('auth.verifying', { defaultValue: 'Verifying...' }) : t('auth.verifyEmail', { defaultValue: 'Verify Email' })}
                </Button>
              </form>

              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">{t('auth.didntReceiveCode', { defaultValue: "Didn't receive the code?" })}</p>
                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={handleResendOtp}
                  className="text-xs text-primary hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? t('auth.resendIn', { defaultValue: `Resend in ${resendCooldown}s`, seconds: resendCooldown }) : t('auth.resendCode', { defaultValue: 'Resend code' })}
                </button>
                <div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => { setMode('register'); setRegStep(2); setError(''); }}
                  >
                    {t('auth.backToRegistration', { defaultValue: '← Back to registration' })}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── FORCE CHANGE PASSWORD SCREEN ── */}
          {mode === 'change-password' && (
            <motion.div
              key="change-password"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                  <KeyRound className="w-7 h-7 text-amber-600" />
                </div>
                <h3 className="font-semibold text-base">{t('auth.setYourPassword', { defaultValue: 'Set your password' })}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('auth.mustChangePasswordHint', { defaultValue: 'Your account requires a password change before you can continue.' })}
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{t('auth.temporaryPassword', { defaultValue: 'Temporary Password' })}</Label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type={showCpCurrent ? 'text' : 'password'}
                      placeholder={t('auth.enterInvitePasswordPlaceholder', { defaultValue: 'Enter the password from your invite email' })}
                      className="pl-8 pr-10 h-9"
                      value={cpForm.current}
                      onChange={e => setCpForm({ ...cpForm, current: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowCpCurrent(v => !v)}
                    >
                      {showCpCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>{t('auth.newPassword', { defaultValue: 'New Password' })}</Label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type={showCpNext ? 'text' : 'password'}
                      placeholder={t('auth.min8CharsPlaceholder', { defaultValue: 'Min. 8 characters' })}
                      className="pl-8 pr-10 h-9"
                      value={cpForm.next}
                      onChange={e => setCpForm({ ...cpForm, next: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowCpNext(v => !v)}
                    >
                      {showCpNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {cpStrength && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${cpStrength.color}`}
                          style={{ width: cpStrength.width }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{cpStrength.label}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>{t('auth.confirmNewPassword', { defaultValue: 'Confirm New Password' })}</Label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="password"
                      placeholder={t('auth.reenterNewPasswordPlaceholder', { defaultValue: 'Re-enter new password' })}
                      className="pl-8 h-9"
                      value={cpForm.confirm}
                      onChange={e => setCpForm({ ...cpForm, confirm: e.target.value })}
                      required
                    />
                  </div>
                  {cpForm.confirm && cpForm.next !== cpForm.confirm && (
                    <p className="text-xs text-destructive">{t('auth.passwordsDontMatch', { defaultValue: 'Passwords do not match' })}</p>
                  )}
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('auth.saving', { defaultValue: 'Saving...' }) : t('auth.setPasswordAndContinue', { defaultValue: 'Set Password & Continue' })}
                </Button>
              </form>
            </motion.div>
          )}

          {/* ── LOGIN / REGISTER ── */}
          {(mode === 'login' || mode === 'register') && (
            <>
              {/* Tab switcher */}
              <div className="flex rounded-lg bg-secondary p-1 mb-6">
                <button
                  className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === 'login' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
                  onClick={() => { setMode('login'); setError(''); setRegStep(1); }}
                >
                  {t('auth.login', { defaultValue: 'Login' })}
                </button>
                <button
                  className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === 'register' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
                  onClick={() => { setMode('register'); setError(''); }}
                >
                  {t('auth.register', { defaultValue: 'Register' })}
                </button>
              </div>

              {/* ── LOGIN FORM ── */}
              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>{t('auth.email', { defaultValue: 'Email' })}</Label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        type="email"
                        placeholder="you@company.com"
                        className="pl-8 h-9"
                        value={loginForm.email}
                        onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t('auth.password', { defaultValue: 'Password' })}</Label>
                    <div className="relative">
                      <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        type={showLoginPw ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="pl-8 pr-10 h-9"
                        value={loginForm.password}
                        onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowLoginPw(v => !v)}
                      >
                        {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t('auth.signingIn', { defaultValue: 'Signing in...' }) : t('auth.signIn', { defaultValue: 'Sign In' })}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    {t('auth.parentOrStudent', { defaultValue: 'Parent or student?' })}{' '}
                    <Link to="/portal/login" className="text-primary hover:underline font-medium">
                      {t('auth.signInToPortal', { defaultValue: 'Sign in to the Portal' })}
                    </Link>
                  </p>
                </form>
              )}

              {/* ── REGISTER FORM ── */}
              {mode === 'register' && (
                <div className="overflow-hidden">
                  <StepDots step={regStep} total={2} />

                  <AnimatePresence mode="wait" custom={regStep}>
                    {/* STEP 1 — Personal */}
                    {regStep === 1 && (
                      <motion.div
                        key="s1"
                        custom={1}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="space-y-3"
                      >
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          {t('auth.personalDetails', { defaultValue: 'Personal Details' })}
                        </p>

                        <div className="space-y-1.5">
                          <Label>{t('auth.fullNameRequiredLabel', { defaultValue: 'Full Name *' })}</Label>
                          <div className="relative">
                            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                              placeholder="Ram Sharma"
                              className="pl-8 h-9"
                              value={regForm.name}
                              onChange={e => setRegForm({ ...regForm, name: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label>{t('auth.emailRequiredLabel', { defaultValue: 'Email *' })}</Label>
                          <div className="relative">
                            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                              type="email"
                              placeholder="you@company.com"
                              className="pl-8 h-9"
                              value={regForm.email}
                              onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label>{t('auth.passwordRequiredLabel', { defaultValue: 'Password *' })}</Label>
                          <div className="relative">
                            <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                              type={showRegPw ? 'text' : 'password'}
                              placeholder={t('auth.min8CharsPlaceholder', { defaultValue: 'Min. 8 characters' })}
                              className="pl-8 pr-10 h-9"
                              value={regForm.password}
                              onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                            />
                            <button
                              type="button"
                              tabIndex={-1}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowRegPw(v => !v)}
                            >
                              {showRegPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {strength && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${strength.color}`}
                                  style={{ width: strength.width }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{strength.label}</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label>{t('auth.confirmPasswordRequiredLabel', { defaultValue: 'Confirm Password *' })}</Label>
                          <div className="relative">
                            <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                              type={showConfirmPw ? 'text' : 'password'}
                              placeholder={t('auth.reenterPasswordPlaceholder', { defaultValue: 'Re-enter password' })}
                              className="pl-8 pr-10 h-9"
                              value={regForm.confirmPassword}
                              onChange={e => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                            />
                            <button
                              type="button"
                              tabIndex={-1}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowConfirmPw(v => !v)}
                            >
                              {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {regForm.confirmPassword && regForm.password !== regForm.confirmPassword && (
                            <p className="text-xs text-destructive">{t('auth.passwordsDontMatch', { defaultValue: 'Passwords do not match' })}</p>
                          )}
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}

                        <Button className="w-full" onClick={goNext}>
                          {t('auth.continueArrow', { defaultValue: 'Continue →' })}
                        </Button>
                      </motion.div>
                    )}

                    {/* STEP 2 — Company */}
                    {regStep === 2 && (
                      <motion.div
                        key="s2"
                        custom={2}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="space-y-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => { setError(''); setRegStep(1); }}
                          >
                            {t('auth.backArrow', { defaultValue: '← Back' })}
                          </button>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {t('auth.companyDetails', { defaultValue: 'Company Details' })}
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <Label>{t('auth.companyNameRequiredLabel', { defaultValue: 'Company Name *' })}</Label>
                          <div className="relative">
                            <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                              placeholder="My Company Pvt. Ltd."
                              className="pl-8 h-9"
                              value={regForm.companyName}
                              onChange={e => setRegForm({ ...regForm, companyName: e.target.value })}
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label>{t('auth.businessTypeRequiredLabel', { defaultValue: 'Business Type *' })}</Label>
                          <select
                            className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                            value={regForm.businessType}
                            onChange={e => setRegForm({ ...regForm, businessType: e.target.value, otherBusinessDesc: '' })}
                            required
                          >
                            <option value="">{t('auth.selectBusinessTypeEllipsis', { defaultValue: 'Select business type…' })}</option>
                            {BUSINESS_TYPES.map(bt => (
                              <option key={bt.value} value={bt.value}>{bt.label}</option>
                            ))}
                          </select>
                          {regForm.businessType === 'OTHER' && (
                            <Input
                              placeholder={t('auth.describeBusinessPlaceholder', { defaultValue: 'Describe your business (e.g. Tailoring Shop, Laundry)' })}
                              value={regForm.otherBusinessDesc}
                              onChange={e => setRegForm({ ...regForm, otherBusinessDesc: e.target.value })}
                              autoFocus
                            />
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label>
                            {t('auth.panRegNumber', { defaultValue: 'PAN / Registration Number' })}{' '}
                            <span className="text-muted-foreground">{t('auth.optionalParens', { defaultValue: '(Optional)' })}</span>
                          </Label>
                          <div className="relative">
                            <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                              placeholder={t('auth.regNumberPlaceholder', { defaultValue: 'e.g. 123456789 or Company Reg No.' })}
                              className="pl-8 h-9"
                              value={regForm.registrationNumber}
                              onChange={e => setRegForm({ ...regForm, registrationNumber: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Checkbox
                            id="agree-terms"
                            checked={agreedToTerms}
                            onCheckedChange={(v) => setAgreedToTerms(v === true)}
                            className="mt-0.5"
                          />
                          <Label htmlFor="agree-terms" className="text-xs font-normal text-muted-foreground leading-snug cursor-pointer">
                            {t('auth.agreeToTermsPrefix', { defaultValue: 'I agree to the' })}{' '}
                            <Link to="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                              {t('auth.termsAndAgreement', { defaultValue: 'Terms and Agreement' })}
                            </Link>
                          </Label>
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}

                        <Button type="submit" className="w-full" onClick={handleRegister} disabled={loading || !agreedToTerms}>
                          {loading ? t('auth.creatingAccount', { defaultValue: 'Creating account...' }) : t('auth.createAccount', { defaultValue: 'Create Account' })}
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground mt-4">
        <Link to="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
          {t('auth.termsAndAgreement', { defaultValue: 'Terms and Agreement' })}
        </Link>
      </p>
      </div>
    </div>
  );
}
