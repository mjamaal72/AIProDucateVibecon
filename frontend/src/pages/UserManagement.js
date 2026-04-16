import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Users, Shield, ShieldCheck, GraduationCap, Search, UserCheck, UserX } from 'lucide-react';

export default function UserManagement() {
  const { api } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showPromote, setShowPromote] = useState(null);
  const [newRole, setNewRole] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/auth/users';
      const params = [];
      if (roleFilter) params.push(`role=${roleFilter}`);
      if (searchTerm) params.push(`search=${searchTerm}`);
      if (params.length > 0) url += '?' + params.join('&');
      const res = await api.get(url);
      setUsers(res.data);
    } catch (err) { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, [api, roleFilter, searchTerm]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handlePromote = async () => {
    if (!showPromote || !newRole) return;
    try {
      await api.put('/auth/promote', { user_id: showPromote.user_id, role: newRole });
      toast.success(`${showPromote.full_name} promoted to ${newRole}`);
      setShowPromote(null);
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.detail || 'Promotion failed'); }
  };

  const toggleActive = async (user) => {
    try {
      await api.put(`/auth/deactivate/${user.user_id}`);
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch (err) { toast.error('Failed'); }
  };

  const getRoleIcon = (role) => {
    if (role === 'ADMIN') return <ShieldCheck size={16} className="text-red-500" />;
    if (role === 'EXAMINER') return <Shield size={16} className="text-amber-500" />;
    return <GraduationCap size={16} className="text-blue-500" />;
  };

  const getRoleBadge = (role) => {
    if (role === 'ADMIN') return 'bg-red-100 text-red-700';
    if (role === 'EXAMINER') return 'bg-amber-100 text-amber-700';
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk', color: 'hsl(210, 52%, 25%)' }}>User Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage users and assign roles</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, ID, or email..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="EXAMINER">Examiner</SelectItem>
            <SelectItem value="STUDENT">Student</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : users.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><Users size={48} className="mx-auto mb-4 opacity-30" /><p>No users found</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{users.length} user{users.length !== 1 ? 's' : ''} found</p>
          {users.map(u => (
            <Card key={u.user_id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'hsl(204, 55%, 92%)' }}>
                  {getRoleIcon(u.role)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium truncate">{u.full_name}</h4>
                    <Badge className={`text-xs ${getRoleBadge(u.role)}`}>{u.role}</Badge>
                    {!u.is_active && <Badge className="text-xs bg-gray-100 text-gray-500">Inactive</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{u.unique_identifier} {u.email ? `| ${u.email}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setShowPromote(u); setNewRole(u.role); }}>
                    <Shield size={14} className="mr-1" />Change Role
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(u)} className={u.is_active ? 'text-red-500 hover:text-red-700' : 'text-emerald-500 hover:text-emerald-700'}>
                    {u.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Promote Modal */}
      <Dialog open={!!showPromote} onOpenChange={(open) => !open && setShowPromote(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change User Role</DialogTitle></DialogHeader>
          {showPromote && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{showPromote.full_name}</p>
                <p className="text-sm text-muted-foreground">{showPromote.unique_identifier} | Current: {showPromote.role}</p>
              </div>
              <div className="space-y-2">
                <Label>New Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STUDENT">Student</SelectItem>
                    <SelectItem value="EXAMINER">Examiner</SelectItem>
                    <SelectItem value="ADMIN">Admin / Teacher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handlePromote} className="w-full" style={{ background: 'hsl(210, 52%, 25%)' }}>Confirm Role Change</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
