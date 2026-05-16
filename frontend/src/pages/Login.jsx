import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, Building2, Hash } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { authApi } from '@/api';
import { setActiveCompanyId } from '@/lib/companyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BUSINESS_TYPES = [
  { value: 'RETAIL', label: 'Retail / General Store' },
  { value: 'PHARMACY', label: 'Pharmacy / Medical' },
  { value: 'ELECTRONICS', label: 'Electronics / Hardware' },
  { value: 'FOOD_BEVERAGE', label: 'Restaurant / Tea Shop / Bakery' },
  { value: 'SERVICES', label: 'Services / Consulting / IT' },
  { value: 'MANUFACTURING', label: 'Manufacturing / Production' },
  { value: 'OTHER', label: 'Other' },
];

function passwordStrength(pw) {
  if (!pw) return null;
  const checks = [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)];
  const passed = checks.filter(Boolean).length;
  if (passed <= 1) return { label: 'Weak', color: 'bg-destructive' };
  if (passed === 2) return { label: 'Fair', color: 'bg-yellow-500' };
  if (passed === 3) return { label: 'Good', color: 'bg-blue-500' };
  return { label: 'Strong', color: 'bg-green-500' };
}

function StepDots({ step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-4">
      <div className={`h-2 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-primary w-4' : 'bg-muted w-2'}`} />
      <div className={`h-2 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-primary w-4' : 'bg-muted w-2'}`} />
    </div>
  );
}

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

export default function Login() {
  const [mode, setMode] = useState('login');
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

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.login({ email: loginForm.email, password: loginForm.password });
      window.location.href = '/';
    } catch (err) {
      setError(err?.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (regForm.password !== regForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (regForm.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const { confirmPassword, otherBusinessDesc, ...payload } = regForm;
      if (payload.businessType === 'OTHER' && otherBusinessDesc.trim()) {
        payload.businessType = otherBusinessDesc.trim();
      }
      await authApi.register(payload);
      const meRes = await authApi.me();
      if (meRes.data?.defaultCompanyId) {
        setActiveCompanyId(meRes.data.defaultCompanyId);
      }
      window.location.href = '/';
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  function goNext() {
    setError('');
    if (!regForm.name.trim()) {
      setError('Full name is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regForm.email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (regForm.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (regForm.password !== regForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setRegStep(2);
  }

  const strength = passwordStrength(regForm.password);

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

      <Card className="w-full max-w-md shadow-2xl glass-dialog border-border/40 relative z-10 overflow-hidden">
        {/* Gradient stripe */}
        <div className="h-1 bg-gradient-to-r from-primary via-blue-500 to-indigo-400" />

        <CardHeader className="text-center pb-2">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg"
            style={{ background: 'linear-gradient(135deg, hsl(217 71% 28%), hsl(217 71% 45%))' }}
          >
            <span className="text-white font-bold text-xl drop-shadow">E</span>
          </div>
          <CardTitle className="text-xl">Easy Books</CardTitle>
          <p className="text-sm text-muted-foreground">Nepal Accounting Software</p>
        </CardHeader>

        <CardContent className="pt-4">
          {/* Tab switcher */}
          <div className="flex rounded-lg bg-secondary p-1 mb-6">
            <button
              className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === 'login' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
              onClick={() => { setMode('login'); setError(''); setRegStep(1); }}
            >
              Login
            </button>
            <button
              className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === 'register' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
              onClick={() => { setMode('register'); setError(''); }}
            >
              Register
            </button>
          </div>

          {/* ── LOGIN FORM ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
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
                <Label>Password</Label>
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
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          )}

          {/* ── REGISTER FORM ── */}
          {mode === 'register' && (
            <div className="overflow-hidden">
              <StepDots step={regStep} />

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
                      Personal Details
                    </p>

                    <div className="space-y-1.5">
                      <Label>Full Name *</Label>
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
                      <Label>Email *</Label>
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
                      <Label>Password *</Label>
                      <div className="relative">
                        <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          type={showRegPw ? 'text' : 'password'}
                          placeholder="Min. 8 characters"
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
                              style={{
                                width:
                                  strength.label === 'Weak'
                                    ? '25%'
                                    : strength.label === 'Fair'
                                    ? '50%'
                                    : strength.label === 'Good'
                                    ? '75%'
                                    : '100%',
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{strength.label}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Confirm Password *</Label>
                      <div className="relative">
                        <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          type={showConfirmPw ? 'text' : 'password'}
                          placeholder="Re-enter password"
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
                        <p className="text-xs text-destructive">Passwords do not match</p>
                      )}
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <Button className="w-full" onClick={goNext}>
                      Continue →
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
                        ← Back
                      </button>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Company Details
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Company Name *</Label>
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
                      <Label>Business Type *</Label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        value={regForm.businessType}
                        onChange={e =>
                          setRegForm({ ...regForm, businessType: e.target.value, otherBusinessDesc: '' })
                        }
                        required
                      >
                        <option value="">Select business type…</option>
                        {BUSINESS_TYPES.map(bt => (
                          <option key={bt.value} value={bt.value}>
                            {bt.label}
                          </option>
                        ))}
                      </select>
                      {regForm.businessType === 'OTHER' && (
                        <Input
                          placeholder="Describe your business (e.g. Tailoring Shop, Laundry)"
                          value={regForm.otherBusinessDesc}
                          onChange={e => setRegForm({ ...regForm, otherBusinessDesc: e.target.value })}
                          autoFocus
                        />
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>
                        PAN / Registration Number{' '}
                        <span className="text-muted-foreground">(Optional)</span>
                      </Label>
                      <div className="relative">
                        <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="e.g. 123456789 or Company Reg No."
                          className="pl-8 h-9"
                          value={regForm.registrationNumber}
                          onChange={e => setRegForm({ ...regForm, registrationNumber: e.target.value })}
                        />
                      </div>
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <Button type="submit" className="w-full" onClick={handleRegister} disabled={loading}>
                      {loading ? 'Creating account...' : 'Create Account'}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
