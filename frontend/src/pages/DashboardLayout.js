import { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ClipboardList, FileQuestion, PenTool, Trophy, GraduationCap, LogOut, Menu, X, ChevronLeft, ChevronRight, Users, Type, UsersRound, Archive } from 'lucide-react';
import EvaluationManagement from '@/pages/EvaluationManagement';
import QuestionBank from '@/pages/QuestionBank';
import StudentPortal from '@/pages/StudentPortal';
import LeaderBoard from '@/pages/LeaderBoard';
import ManualCorrection from '@/pages/ManualCorrection';
import UserManagement from '@/pages/UserManagement';
import FontManager from '@/pages/FontManager';
import UserGroups from '@/pages/UserGroups';
import ArchivedEvaluations from '@/pages/ArchivedEvaluations';

const ADMIN_TABS = [
  { path: '/', icon: ClipboardList, label: 'Evaluation Management', testId: 'sidebar-nav-evaluation-management' },
  { path: '/questions', icon: FileQuestion, label: 'Question Bank', testId: 'sidebar-nav-question-bank' },
  { path: '/correction', icon: PenTool, label: 'Manual Correction', testId: 'sidebar-nav-manual-correction' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaders Board', testId: 'sidebar-nav-leaderboard-item-analysis' },
  { path: '/student', icon: GraduationCap, label: 'Student Portal', testId: 'sidebar-nav-student-portal' },
  { path: '/users', icon: Users, label: 'User Management', testId: 'sidebar-nav-user-management' },
  { path: '/groups', icon: UsersRound, label: 'User Groups', testId: 'sidebar-nav-user-groups' },
  { path: '/archive', icon: Archive, label: 'Archive', testId: 'sidebar-nav-archive' },
  { path: '/fonts', icon: Type, label: 'Font Manager', testId: 'sidebar-nav-font-manager' },
];

const STUDENT_TABS = [
  { path: '/', icon: GraduationCap, label: 'Student Portal', testId: 'sidebar-nav-student-portal' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaders Board', testId: 'sidebar-nav-leaderboard-item-analysis' },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const tabs = user?.role === 'STUDENT' ? STUDENT_TABS : ADMIN_TABS;
  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'hsl(210, 33%, 98%)' }}>
      {/* Sidebar */}
      <aside
        data-testid="app-sidebar"
        className={`hidden lg:flex flex-col transition-all duration-300 border-r border-border/50 ${
          collapsed ? 'w-[76px]' : 'w-[280px]'
        }`}
        style={{ background: 'hsl(210, 52%, 18%)' }}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 p-4 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
          <img
            src="https://customer-assets.emergentagent.com/job_8fd771a9-94bf-48e9-839d-945bcffab523/artifacts/0npssl6s_AIProDucate%20Logo.jpeg"
            alt="Logo" className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
          />
          {!collapsed && <span className="text-white font-semibold text-lg" style={{ fontFamily: 'Space Grotesk' }}>AIProDucate</span>}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {tabs.map(tab => {
            const isActive = location.pathname === tab.path || (tab.path !== '/' && location.pathname.startsWith(tab.path));
            return (
              <button
                key={tab.path}
                data-testid={tab.testId}
                onClick={() => navigate(tab.path)}
                className={`group flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-[hsl(204,55%,92%)] text-[hsl(210,52%,18%)] shadow-sm'
                    : 'text-blue-100/80 hover:text-white hover:bg-white/5'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <tab.icon size={20} className={isActive ? 'text-[hsl(210,52%,25%)]' : 'text-blue-200/70 group-hover:text-white'} />
                {!collapsed && <span>{tab.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-white/10">
          <button onClick={() => setCollapsed(!collapsed)} className="flex items-center justify-center w-full py-2 rounded-lg text-blue-200/70 hover:text-white hover:bg-white/5 transition-colors">
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[280px] flex flex-col" style={{ background: 'hsl(210, 52%, 18%)' }}>
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <img src="https://customer-assets.emergentagent.com/job_8fd771a9-94bf-48e9-839d-945bcffab523/artifacts/0npssl6s_AIProDucate%20Logo.jpeg" alt="Logo" className="w-10 h-10 rounded-lg" />
                <span className="text-white font-semibold" style={{ fontFamily: 'Space Grotesk' }}>AIProDucate</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-white"><X size={20} /></button>
            </div>
            <nav className="flex-1 py-4 px-3 space-y-1">
              {tabs.map(tab => {
                const isActive = location.pathname === tab.path;
                return (
                  <button key={tab.path} data-testid={`mobile-${tab.testId}`}
                    onClick={() => { navigate(tab.path); setMobileOpen(false); }}
                    className={`group flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive ? 'bg-[hsl(204,55%,92%)] text-[hsl(210,52%,18%)]' : 'text-blue-100/80 hover:text-white hover:bg-white/5'
                    }`}>
                    <tab.icon size={20} /><span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header data-testid="app-topbar" className="h-16 flex items-center justify-between px-4 lg:px-6 border-b bg-white shadow-sm">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={24} /></button>
            <h2 className="text-lg font-semibold" style={{ fontFamily: 'Space Grotesk', color: 'hsl(210, 52%, 25%)' }}>
              {tabs.find(t => t.path === location.pathname || (t.path !== '/' && location.pathname.startsWith(t.path)))?.label || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.full_name}</span>
            <span className="text-xs px-2 py-1 rounded-full font-medium"
              style={{ background: 'hsl(204, 55%, 92%)', color: 'hsl(210, 52%, 25%)' }}>{user?.role}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
                  <Avatar className="h-9 w-9"><AvatarFallback style={{ background: 'hsl(210, 52%, 25%)', color: 'white' }}>{initials}</AvatarFallback></Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{user?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user?.unique_identifier}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive cursor-pointer">
                  <LogOut size={16} className="mr-2" />Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Routes>
            <Route path="/" element={user?.role === 'STUDENT' ? <StudentPortal /> : <EvaluationManagement />} />
            <Route path="/questions" element={<QuestionBank />} />
            <Route path="/correction" element={<ManualCorrection />} />
            <Route path="/leaderboard" element={<LeaderBoard />} />
            <Route path="/student" element={<StudentPortal />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/groups" element={<UserGroups />} />
            <Route path="/archive" element={<ArchivedEvaluations />} />
            <Route path="/fonts" element={<FontManager />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
