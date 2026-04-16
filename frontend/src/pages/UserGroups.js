import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Users, Trash2, Edit2, UserPlus, X } from 'lucide-react';

export default function UserGroups() {
  const { api } = useAuth();
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetails, setGroupDetails] = useState(null);
  
  const [groupForm, setGroupForm] = useState({ group_name: '', description: '' });
  const [selectedUsers, setSelectedUsers] = useState([]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await api.get('/user-groups');
      setGroups(res.data);
    } catch (e) {
      toast.error('Failed to load groups');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data.filter(u => u.role === 'STUDENT'));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchGroupDetails = async (groupId) => {
    try {
      const res = await api.get(`/user-groups/${groupId}`);
      setGroupDetails(res.data);
    } catch (e) {
      toast.error('Failed to load group details');
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchUsers();
  }, []);

  const handleCreateGroup = async () => {
    if (!groupForm.group_name.trim()) {
      toast.error('Group name is required');
      return;
    }
    try {
      await api.post('/user-groups', groupForm);
      toast.success('Group created successfully');
      setShowCreateModal(false);
      setGroupForm({ group_name: '', description: '' });
      fetchGroups();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create group');
    }
  };

  const handleUpdateGroup = async () => {
    if (!groupForm.group_name.trim()) {
      toast.error('Group name is required');
      return;
    }
    try {
      await api.put(`/user-groups/${selectedGroup.group_id}`, groupForm);
      toast.success('Group updated successfully');
      setShowEditModal(false);
      setSelectedGroup(null);
      fetchGroups();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update group');
    }
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    if (!window.confirm(`Delete group "${groupName}"?`)) return;
    try {
      await api.delete(`/user-groups/${groupId}`);
      toast.success('Group deleted');
      fetchGroups();
    } catch (e) {
      toast.error('Failed to delete group');
    }
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Select at least one user');
      return;
    }
    try {
      await api.post(`/user-groups/${selectedGroup.group_id}/members`, {
        user_ids: selectedUsers
      });
      toast.success('Members added');
      setSelectedUsers([]);
      fetchGroupDetails(selectedGroup.group_id);
      fetchGroups();
    } catch (e) {
      toast.error('Failed to add members');
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await api.delete(`/user-groups/${selectedGroup.group_id}/members/${userId}`);
      toast.success('Member removed');
      fetchGroupDetails(selectedGroup.group_id);
      fetchGroups();
    } catch (e) {
      toast.error('Failed to remove member');
    }
  };

  const openEditModal = (group) => {
    setSelectedGroup(group);
    setGroupForm({ group_name: group.group_name, description: group.description || '' });
    setShowEditModal(true);
  };

  const openMembersModal = (group) => {
    setSelectedGroup(group);
    fetchGroupDetails(group.group_id);
    setShowMembersModal(true);
  };

  const availableUsers = users.filter(u => 
    !groupDetails?.members?.some(m => m.user_id === u.user_id)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Groups</h1>
          <p className="text-muted-foreground">Manage student groups for bulk assignment</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={18} className="mr-2" />Create Group
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading groups...</div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg mb-4">No groups yet</p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus size={18} className="mr-2" />Create First Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(group => (
            <Card key={group.group_id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users size={20} />
                    {group.group_name}
                  </span>
                  <Badge variant="secondary">{group.member_count}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {group.description && (
                  <p className="text-sm text-muted-foreground mb-4">{group.description}</p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openMembersModal(group)}>
                    <UserPlus size={16} className="mr-1" />Manage
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEditModal(group)}>
                    <Edit2 size={16} />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteGroup(group.group_id, group.group_name)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create User Group</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Group Name *</Label>
              <Input value={groupForm.group_name} onChange={e => setGroupForm({...groupForm, group_name: e.target.value})} placeholder="e.g., Grade 10 Section A" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={groupForm.description} onChange={e => setGroupForm({...groupForm, description: e.target.value})} rows={3} placeholder="Optional description" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button onClick={handleCreateGroup}>Create Group</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Group Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Group</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Group Name *</Label>
              <Input value={groupForm.group_name} onChange={e => setGroupForm({...groupForm, group_name: e.target.value})} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={groupForm.description} onChange={e => setGroupForm({...groupForm, description: e.target.value})} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
              <Button onClick={handleUpdateGroup}>Update Group</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Members Modal */}
      <Dialog open={showMembersModal} onOpenChange={setShowMembersModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Members - {selectedGroup?.group_name}</DialogTitle>
          </DialogHeader>
          
          {/* Add Members Section */}
          <div className="space-y-4 border-b pb-4">
            <Label>Add Members</Label>
            <div className="flex gap-2">
              <select 
                className="flex-1 border rounded px-3 py-2"
                value=""
                onChange={e => {
                  if (e.target.value && !selectedUsers.includes(e.target.value)) {
                    setSelectedUsers([...selectedUsers, e.target.value]);
                  }
                }}
              >
                <option value="">Select users to add...</option>
                {availableUsers.map(u => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name} ({u.unique_identifier})
                  </option>
                ))}
              </select>
              <Button onClick={handleAddMembers} disabled={selectedUsers.length === 0}>
                Add ({selectedUsers.length})
              </Button>
            </div>
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(uid => {
                  const user = users.find(u => u.user_id === uid);
                  return (
                    <Badge key={uid} variant="secondary">
                      {user?.full_name}
                      <X size={14} className="ml-1 cursor-pointer" onClick={() => setSelectedUsers(selectedUsers.filter(id => id !== uid))} />
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Current Members List */}
          <div className="space-y-2">
            <Label>Current Members ({groupDetails?.member_count || 0})</Label>
            {!groupDetails ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : groupDetails.members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet</p>
            ) : (
              <div className="space-y-2">
                {groupDetails.members.map(member => (
                  <div key={member.user_id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{member.full_name}</p>
                      <p className="text-xs text-muted-foreground">{member.unique_identifier} • {member.email}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleRemoveMember(member.user_id)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
