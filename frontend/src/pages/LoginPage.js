import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { GraduationCap, LogIn, UserPlus } from 'lucide-react';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [loginForm, setLoginForm] = useState({ unique_identifier: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ unique_identifier: '', full_name: '', email: '', password: '', role: 'STUDENT' });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.unique_identifier, loginForm.password);
      toast.success('Welcome back!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(registerForm);
      toast.success('Account created successfully!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'hsl(210, 33%, 98%)' }}>
      {/* Left Panel - Brand */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative" style={{ background: 'linear-gradient(135deg, hsl(210, 52%, 18%) 0%, hsl(210, 52%, 30%) 100%)' }}>
        <div className="text-center p-12 relative z-10">
          <img
            src="https://customer-assets.emergentagent.com/job_8fd771a9-94bf-48e9-839d-945bcffab523/artifacts/0npssl6s_AIProDucate%20Logo.jpeg"
            alt="AIProDucate Logo"
            className="w-48 h-48 mx-auto mb-8 rounded-2xl shadow-2xl object-cover"
          />
          <h1 className="text-4xl font-bold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>AI ProDucate</h1>
          <p className="text-lg text-blue-200 mb-6">Professional & Progressive Educational System</p>
          <div className="space-y-3 text-left max-w-sm mx-auto">
            <div className="flex items-center gap-3 text-blue-100">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <GraduationCap size={16} />
              </div>
              <span className="text-sm">Advanced Evaluation Management</span>
            </div>
            <div className="flex items-center gap-3 text-blue-100">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-xs">AI</span>
              </div>
              <span className="text-sm">AI-Powered Question Generation</span>
            </div>
            <div className="flex items-center gap-3 text-blue-100">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-xs">9+</span>
              </div>
              <span className="text-sm">9 Question Types with Smart Grading</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <img
              src="https://customer-assets.emergentagent.com/job_8fd771a9-94bf-48e9-839d-945bcffab523/artifacts/0npssl6s_AIProDucate%20Logo.jpeg"
              alt="Logo" className="w-20 h-20 mx-auto mb-4 rounded-xl"
            />
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk', color: 'hsl(210, 52%, 25%)' }}>AI ProDucate</h1>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" data-testid="login-tab"><LogIn size={16} className="mr-2" />Sign In</TabsTrigger>
              <TabsTrigger value="register" data-testid="register-tab"><UserPlus size={16} className="mr-2" />Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <CardTitle>Welcome Back</CardTitle>
                  <CardDescription>Sign in to your AIProDucate account</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-id">User ID</Label>
                      <Input id="login-id" data-testid="login-email-input" placeholder="Enter your unique ID" value={loginForm.unique_identifier}
                        onChange={e => setLoginForm({...loginForm, unique_identifier: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input id="login-password" data-testid="login-password-input" type="password" placeholder="Enter your password"
                        value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit-button"
                      style={{ background: 'hsl(210, 52%, 25%)' }}>
                      {loading ? 'Signing in...' : 'Sign In'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <CardTitle>Create Account</CardTitle>
                  <CardDescription>Register for AIProDucate</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Unique ID</Label>
                      <Input data-testid="register-id-input" placeholder="e.g., STU001" value={registerForm.unique_identifier}
                        onChange={e => setRegisterForm({...registerForm, unique_identifier: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input data-testid="register-name-input" placeholder="Your full name" value={registerForm.full_name}
                        onChange={e => setRegisterForm({...registerForm, full_name: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Email (Optional)</Label>
                      <Input type="email" placeholder="your@email.com" value={registerForm.email}
                        onChange={e => setRegisterForm({...registerForm, email: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input data-testid="register-password-input" type="password" placeholder="Create a password"
                        value={registerForm.password} onChange={e => setRegisterForm({...registerForm, password: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={registerForm.role} onValueChange={v => setRegisterForm({...registerForm, role: v})}>
                        <SelectTrigger data-testid="register-role-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STUDENT">Student</SelectItem>
                          <SelectItem value="ADMIN">Admin / Teacher</SelectItem>
                          <SelectItem value="EXAMINER">Examiner</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading} data-testid="register-submit-button"
                      style={{ background: 'hsl(210, 52%, 25%)' }}>
                      {loading ? 'Creating...' : 'Create Account'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
