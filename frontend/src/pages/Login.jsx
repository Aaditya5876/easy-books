import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('login');
  const [regForm, setRegForm] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    companyName: '',
    businessType: '',
    registrationNumber: '',
    defaultUnitType: '',
  });

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.login({ email: form.email, password: form.password });
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
    setLoading(true);
    try {
      await authApi.register(regForm);
      window.location.href = '/';
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-primary-foreground font-bold text-lg">E</span>
          </div>
          <CardTitle className="text-xl">Easy Books</CardTitle>
          <p className="text-sm text-muted-foreground">Nepal Accounting Software</p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex rounded-lg bg-secondary p-1 mb-6">
            <button
              className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === 'login' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
              onClick={() => setMode('login')}
            >Login</button>
            <button
              className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === 'register' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
              onClick={() => setMode('register')}
            >Register</button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="you@company.com" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" placeholder="••••••••" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })} required />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Your Name</Label>
                <Input placeholder="Ram Sharma" value={regForm.name}
                  onChange={e => setRegForm({ ...regForm, name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Company Name</Label>
                <Input placeholder="My Company Pvt. Ltd." value={regForm.companyName}
                  onChange={e => setRegForm({ ...regForm, companyName: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Business Type (Optional)</Label>
                <Input placeholder="e.g. pharmacy, tea-shop, clothes" value={regForm.businessType}
                  onChange={e => setRegForm({ ...regForm, businessType: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Registration Number (Optional)</Label>
                <Input placeholder="e.g. PAN/Company Reg No." value={regForm.registrationNumber}
                  onChange={e => setRegForm({ ...regForm, registrationNumber: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Default Unit Type (Optional)</Label>
                <Input placeholder="e.g. pcs, meter, tablet, strip" value={regForm.defaultUnitType}
                  onChange={e => setRegForm({ ...regForm, defaultUnitType: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="you@company.com" value={regForm.email}
                  onChange={e => setRegForm({ ...regForm, email: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" placeholder="••••••••" value={regForm.password}
                  onChange={e => setRegForm({ ...regForm, password: e.target.value })} required />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
