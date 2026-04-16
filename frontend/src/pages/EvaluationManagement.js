import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Plus, Edit, FileQuestion, Trophy, Clock, Users, Calendar, Search, ToggleLeft, UserPlus, X, Archive, RotateCcw, Trash2, MoreVertical } from 'lucide-react';

export default function EvaluationManagement() {
  const { api } = useAuth();
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editEval, setEditEval] = useState(null);
  const [form, setForm] = useState({
    eval_title: '', duration_minutes: 60, max_attempts: 1,
    start_time: '', end_time: '', visibility: 'INVITE_ONLY',
    passing_percentage: '', shuffle_categories: false, shuffle_questions: false,
    enable_proctoring: false, show_instant_results: false, allow_navigation: true
  });
  
  // Attendee Management State
  const [showAttendees, setShowAttendees] = useState(false);
  const [selectedEvalForAttendees, setSelectedEvalForAttendees] = useState(null);
  const [attendees, setAttendees] = useState({ registered: [], pre_registered: [] });
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [bulkText, setBulkText] = useState('');

  const fetchEvaluations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/evaluations');
      setEvaluations(res.data);
    } catch (err) {
      toast.error('Failed to load evaluations');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchEvaluations(); }, [fetchEvaluations]);
  
  // Fetch users and groups for attendee management
  const fetchUsersAndGroups = useCallback(async () => {
    try {
      const [usersRes, groupsRes] = await Promise.all([
        api.get('/auth/users'),
        api.get('/user-groups')
      ]);
      setUsers(usersRes.data.filter(u => u.role === 'STUDENT'));
      setGroups(groupsRes.data);
    } catch (e) {
      console.error(e);
    }
  }, [api]);

  const fetchAttendees = async (evalId) => {
    try {
      const res = await api.get(`/evaluations/${evalId}/attendees`);
      setAttendees(res.data);
    } catch (e) {
      toast.error('Failed to load attendees');
    }
  };

  const openAttendeeModal = (evaluation) => {
    setSelectedEvalForAttendees(evaluation);
    fetchAttendees(evaluation.eval_id);
    fetchUsersAndGroups();
    setShowAttendees(true);
  };

  const handleAddUser = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }
    try {
      await api.post(`/evaluations/${selectedEvalForAttendees.eval_id}/attendees/user`, {
        user_id: selectedUser
      });
      toast.success('User added as attendee');
      setSelectedUser('');
      fetchAttendees(selectedEvalForAttendees.eval_id);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add user');
    }
  };

  const handleAddGroup = async () => {
    if (!selectedGroup) {
      toast.error('Please select a group');
      return;
    }
    try {
      const res = await api.post(`/evaluations/${selectedEvalForAttendees.eval_id}/attendees/group`, {
        group_id: parseInt(selectedGroup)
      });
      toast.success(res.data.message);
      setSelectedGroup('');
      fetchAttendees(selectedEvalForAttendees.eval_id);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add group');
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) {
      toast.error('Please enter emails or VCDs');
      return;
    }
    try {
      const res = await api.post(`/evaluations/${selectedEvalForAttendees.eval_id}/attendees/bulk`, {
        entries: bulkText
      });
      toast.success(res.data.message);
      setBulkText('');
      fetchAttendees(selectedEvalForAttendees.eval_id);
    } catch (e) {
      toast.error('Failed to add attendees');
    }
  };

  const handleRemoveAttendee = async (userId) => {
    try {
      await api.delete(`/evaluations/${selectedEvalForAttendees.eval_id}/attendees/user/${userId}`);
      toast.success('Attendee removed');
      fetchAttendees(selectedEvalForAttendees.eval_id);
    } catch (e) {
      toast.error('Failed to remove attendee');
    }
  };

  const handleRemovePreRegistered = async (preregId) => {
    try {
      await api.delete(`/evaluations/${selectedEvalForAttendees.eval_id}/attendees/pre-registered/${preregId}`);
      toast.success('Pre-registered attendee removed');
      fetchAttendees(selectedEvalForAttendees.eval_id);
    } catch (e) {
      toast.error('Failed to remove');
    }
  };

  const handleArchiveEvaluation = async (evalId, evalTitle) => {
    if (!window.confirm(`Archive "${evalTitle}"? It will be moved to the Archive section.`)) return;
    try {
      await api.put(`/evaluations/${evalId}/archive`);
      toast.success('Evaluation archived');
      fetchEvaluations();
    } catch (e) {
      toast.error('Failed to archive evaluation');
    }
  };

  const handleDeleteAllAttempts = async (evalId, evalTitle) => {
    if (!window.confirm(`Delete ALL student attempts for "${evalTitle}"?\n\nThis will:\n- Remove all attempt records\n- Reset leaderboard\n- Allow students to retake\n\nThis action cannot be undone!`)) return;
    try {
      const res = await api.delete(`/evaluations/${evalId}/attempts`);
      toast.success(res.data.message);
    } catch (e) {
      toast.error('Failed to delete attempts');
    }
  };

  const resetForm = () => {
    setForm({ eval_title: '', duration_minutes: 60, max_attempts: 1, start_time: '', end_time: '', visibility: 'INVITE_ONLY', passing_percentage: '', shuffle_categories: false, shuffle_questions: false, enable_proctoring: false, show_instant_results: false, allow_navigation: true });
    setEditEval(null);
  };

  const openEdit = (ev) => {
    setEditEval(ev);
    setForm({
      eval_title: ev.eval_title, duration_minutes: ev.duration_minutes, max_attempts: ev.max_attempts,
      start_time: ev.start_time ? ev.start_time.slice(0, 16) : '',
      end_time: ev.end_time ? ev.end_time.slice(0, 16) : '',
      visibility: ev.visibility, passing_percentage: ev.passing_percentage || '',
      shuffle_categories: ev.shuffle_categories, shuffle_questions: ev.shuffle_questions,
      enable_proctoring: ev.enable_proctoring, show_instant_results: ev.show_instant_results,
      allow_navigation: ev.allow_navigation
    });
    setShowCreate(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        passing_percentage: form.passing_percentage ? parseFloat(form.passing_percentage) : null
      };
      if (editEval) {
        await api.put(`/evaluations/${editEval.eval_id}`, payload);
        toast.success('Evaluation updated!');
      } else {
        await api.post('/evaluations', payload);
        toast.success('Evaluation created!');
      }
      setShowCreate(false);
      resetForm();
      fetchEvaluations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Operation failed');
    }
  };

  const toggleActive = async (ev) => {
    try {
      await api.patch(`/evaluations/${ev.eval_id}/toggle`);
      toast.success(`Evaluation ${ev.is_active ? 'deactivated' : 'activated'}`);
      fetchEvaluations();
    } catch (err) {
      toast.error('Toggle failed');
    }
  };

  const deleteEval = async (ev) => {
    if (!window.confirm('Are you sure you want to delete this evaluation?')) return;
    try {
      await api.delete(`/evaluations/${ev.eval_id}`);
      toast.success('Evaluation deleted');
      fetchEvaluations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    }
  };

  const filtered = evaluations.filter(e =>
    e.eval_title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk', color: 'hsl(210, 52%, 25%)' }}>Evaluations</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage exam sessions</p>
        </div>
        <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="evaluation-create-button" style={{ background: 'hsl(210, 52%, 25%)' }}>
              <Plus size={16} className="mr-2" />Create Evaluation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editEval ? 'Edit Evaluation' : 'Create New Evaluation'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label>Evaluation Name</Label>
                  <Input value={form.eval_title} onChange={e => setForm({...form, eval_title: e.target.value})} placeholder="e.g., Midterm Exam 2026" required />
                </div>
                <div className="space-y-2">
                  <Label>Duration (minutes)</Label>
                  <Input type="number" min="1" value={form.duration_minutes} onChange={e => setForm({...form, duration_minutes: parseInt(e.target.value) || 60})} />
                </div>
                <div className="space-y-2">
                  <Label>Max Attempts</Label>
                  <Input type="number" min="1" value={form.max_attempts} onChange={e => setForm({...form, max_attempts: parseInt(e.target.value) || 1})} />
                </div>
                <div className="space-y-2">
                  <Label>Start Date & Time</Label>
                  <Input type="datetime-local" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>End Date & Time (Optional)</Label>
                  <Input type="datetime-local" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <Select value={form.visibility} onValueChange={v => setForm({...form, visibility: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC">Public</SelectItem>
                      <SelectItem value="INVITE_ONLY">Invite Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Passing Percentage (Optional)</Label>
                  <Input type="number" min="0" max="100" step="0.01" value={form.passing_percentage}
                    onChange={e => setForm({...form, passing_percentage: e.target.value})} placeholder="e.g., 50" />
                </div>
              </div>
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Settings</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[['shuffle_categories', 'Shuffle Categories'], ['shuffle_questions', 'Shuffle Questions'],
                    ['show_instant_results', 'Show Results'], ['allow_navigation', 'Question Navigation'],
                    ['enable_proctoring', 'Enable Proctoring']].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="text-sm">{label}</Label>
                      <Switch checked={form[key]} onCheckedChange={v => setForm({...form, [key]: v})} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
                <Button type="submit" style={{ background: 'hsl(210, 52%, 25%)' }}>{editEval ? 'Update' : 'Create'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input data-testid="evaluation-search-input" className="pl-9" placeholder="Search evaluations..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => (<Card key={i}><CardContent className="p-6 space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-8 w-full" /></CardContent></Card>))}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><ClipboardList size={48} className="mx-auto mb-4 opacity-30" /><p>No evaluations found. Create your first evaluation!</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(ev => (
            <Card key={ev.eval_id} data-testid="evaluation-card"
              className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-semibold leading-tight">{ev.eval_title}</CardTitle>
                  <Badge data-testid="evaluation-publish-toggle"
                    className={`cursor-pointer text-xs ${ev.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    onClick={() => toggleActive(ev)}>
                    {ev.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Calendar size={14} /><span>{ev.start_time ? new Date(ev.start_time).toLocaleDateString() : 'N/A'}</span></div>
                  <div className="flex items-center gap-1.5"><Clock size={14} /><span>{ev.duration_minutes} min</span></div>
                  <div className="flex items-center gap-1.5"><Users size={14} /><span>{ev.max_attempts} attempt{ev.max_attempts > 1 ? 's' : ''}</span></div>
                  <div className="flex items-center gap-1.5"><ToggleLeft size={14} /><span>{ev.visibility}</span></div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {ev.shuffle_questions && <Badge variant="secondary" className="text-xs">Shuffle Q</Badge>}
                  {ev.shuffle_categories && <Badge variant="secondary" className="text-xs">Shuffle Cat</Badge>}
                  {ev.enable_proctoring && <Badge variant="secondary" className="text-xs">Proctored</Badge>}
                  {ev.show_instant_results && <Badge variant="secondary" className="text-xs">Results</Badge>}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" data-testid="evaluation-card-edit-button" onClick={() => openEdit(ev)}>
                    <Edit size={14} className="mr-1" />Edit
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => window.location.href = `/questions?eval=${ev.eval_id}`}>
                    <FileQuestion size={14} className="mr-1" />Questions
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" data-testid="evaluation-card-more-button">
                        <MoreVertical size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => openAttendeeModal(ev)} data-testid="evaluation-card-attendees-menu">
                        <UserPlus size={14} className="mr-2" />
                        Manage Attendees
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.location.href = `/leaderboard?eval=${ev.eval_id}`} data-testid="evaluation-card-leaderboard-menu">
                        <Trophy size={14} className="mr-2" />
                        Leaderboard
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDeleteAllAttempts(ev.eval_id, ev.eval_title)}
                        className="text-orange-600 focus:text-orange-600"
                        data-testid="evaluation-card-delete-attempts-menu"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete All Attempts
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleArchiveEvaluation(ev.eval_id, ev.eval_title)}
                        className="text-amber-600 focus:text-amber-600"
                        data-testid="evaluation-card-archive-menu"
                      >
                        <Archive size={14} className="mr-2" />
                        Archive Evaluation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Attendee Management Modal */}
      <Dialog open={showAttendees} onOpenChange={setShowAttendees}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Attendees - {selectedEvalForAttendees?.eval_title}</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="individual" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="individual">Individual User</TabsTrigger>
              <TabsTrigger value="group">Group</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Entry</TabsTrigger>
            </TabsList>
            
            {/* Individual User Tab */}
            <TabsContent value="individual" className="space-y-4">
              <div className="flex gap-2">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(u => !attendees.registered?.some(a => a.user_id === u.user_id)).map(u => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name} ({u.unique_identifier})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddUser}>Add User</Button>
              </div>
            </TabsContent>
            
            {/* Group Tab */}
            <TabsContent value="group" className="space-y-4">
              <div className="flex gap-2">
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a group..." />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(g => (
                      <SelectItem key={g.group_id} value={g.group_id.toString()}>
                        {g.group_name} ({g.member_count} members)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddGroup}>Add Group</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                All users from the selected group will be added as attendees.
              </p>
            </TabsContent>
            
            {/* Bulk Entry Tab */}
            <TabsContent value="bulk" className="space-y-4">
              <div>
                <Label>Enter VCDs or Emails</Label>
                <Textarea 
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  rows={6}
                  placeholder="Paste VCDs or emails (comma, newline, or semicolon separated)&#10;&#10;Example:&#10;student001, student002&#10;john@example.com&#10;jane@example.com"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  • Registered users will be added immediately<br />
                  • Unregistered emails/VCDs will be pre-registered (auto-granted access when they sign up)
                </p>
              </div>
              <Button onClick={handleBulkAdd} className="w-full">Add Attendees</Button>
            </TabsContent>
          </Tabs>
          
          {/* Current Attendees List */}
          <div className="border-t pt-4 mt-4 space-y-4">
            <div>
              <Label className="text-base font-semibold">Registered Attendees ({attendees.registered?.length || 0})</Label>
              <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto">
                {(attendees.registered?.length || 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No registered attendees yet</p>
                ) : (
                  attendees.registered?.map(attendee => (
                    <div key={attendee.user_id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium text-sm">{attendee.full_name}</p>
                        <p className="text-xs text-muted-foreground">{attendee.unique_identifier} • {attendee.email}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveAttendee(attendee.user_id)}>
                        <X size={16} />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div>
              <Label className="text-base font-semibold">Pre-Registered ({attendees.pre_registered?.length || 0})</Label>
              <p className="text-xs text-muted-foreground mb-2">Users who will get auto-access when they register</p>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {(attendees.pre_registered?.length || 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No pre-registered attendees</p>
                ) : (
                  attendees.pre_registered?.map(prereg => (
                    <div key={prereg.id} className="flex items-center justify-between p-2 border rounded bg-amber-50">
                      <div>
                        <p className="font-medium text-sm">{prereg.email || prereg.unique_identifier}</p>
                        <Badge variant="secondary" className="text-xs">Pending Registration</Badge>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleRemovePreRegistered(prereg.id)}>
                        <X size={16} />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ClipboardList = ({ size, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>
  </svg>
);
