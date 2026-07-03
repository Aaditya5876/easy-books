import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { portalApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { BookOpen, Eye, EyeOff } from 'lucide-react';

export default function PortalLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ phone: '', password: '', companyId: params.get('company') || '' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (localStorage.getItem('portal_token')) navigate('/portal', { replace: true });
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.phone.trim()) { toast.error('Phone number is required'); return; }
    if (!form.password) { toast.error('Password is required'); return; }
    if (!form.companyId.trim()) { toast.error('School ID is required'); return; }
    setLoading(true);
    try {
      const res = await portalApi.login(form);
      localStorage.setItem('portal_token', res.data.token);
      localStorage.setItem('portal_student', JSON.stringify(res.data.student));
      localStorage.setItem('portal_type', res.data.portalType);
      navigate('/portal', { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-600 rounded-2xl mb-4 shadow-lg">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Student / Parent Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to view your academic details</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <Input
                type="tel"
                placeholder="98XXXXXXXX"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>School ID</Label>
              <Input
                placeholder="Provided by your school admin"
                value={form.companyId}
                onChange={e => set('companyId', e.target.value)}
              />
              <p className="text-xs text-gray-400">Ask your school administrator for this ID</p>
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">EasyBooks School Management System</p>
      </div>
    </div>
  );
}
