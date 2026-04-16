import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { PenTool, Users, ArrowRightLeft, CheckCircle, Clock, FileText, Plus, Send, RefreshCw, AlertTriangle, FileQuestion } from 'lucide-react';

export default function ManualCorrection() {
  const { api, user } = useAuth();
  const [evaluations, setEvaluations] = useState([]);
  const [selectedEval, setSelectedEval] = useState('');
  const [allocations, setAllocations] = useState([]);
  const [pendingResponses, setPendingResponses] = useState([]);
  const [myResponses, setMyResponses] = useState([]);
  const [examiners, setExaminers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [allocForm, setAllocForm] = useState({ examiner_id: '', max_assignment_limit: 50, section_filter_id: null });
  const [transferForm, setTransferForm] = useState({ source_examiner_id: '', destination_examiner_id: '', only_uncorrected: true });
  const [gradeForm, setGradeForm] = useState({ response_id: null, manual_marks: 0, examiner_remarks: '', response: null });

  const isAdmin = user?.role === 'ADMIN';
  const isExaminer = user?.role === 'EXAMINER' || user?.role === 'ADMIN';

  const fetchEvals = useCallback(async () => {
    try {
      // Examiners see only evaluations they're allocated to
      if (user?.role === 'EXAMINER') {
        const res = await api.get('/correction/my-evaluations');
        setEvaluations(res.data);
      } else {
        // Admin sees all evaluations
        const res = await api.get('/evaluations');
        setEvaluations(res.data);
      }
    } catch (e) { console.error(e); }
  }, [api, user?.role]);

  const fetchAllocations = useCallback(async () => {
    if (!selectedEval) return;
    setLoading(true);
    try {
      const [allocRes, pendingRes, examinerRes, adminRes] = await Promise.all([
        api.get(`/correction/${selectedEval}/allocations`),
        api.get(`/correction/${selectedEval}/pending`),
        api.get('/auth/users?role=EXAMINER'),
        api.get('/auth/users?role=ADMIN')
      ]);
      setAllocations(allocRes.data);
      setPendingResponses(pendingRes.data);
      // Combine examiners and admins
      const allExaminers = [...examinerRes.data, ...adminRes.data];
      setExaminers(allExaminers);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }, [api, selectedEval]);

  const fetchMyResponses = useCallback(async () => {
    if (!selectedEval) return;
    try {
      const res = await api.get(`/correction/${selectedEval}/my-responses`);
      setMyResponses(res.data);
    } catch (e) { console.error(e); }
  }, [api, selectedEval]);

  useEffect(() => { fetchEvals(); }, [fetchEvals]);
  useEffect(() => { if (selectedEval) { fetchAllocations(); fetchMyResponses(); } }, [selectedEval, fetchAllocations, fetchMyResponses]);

  const handleAllocate = async () => {
    try {
      await api.post(`/correction/${selectedEval}/allocate`, allocForm);
      toast.success('Examiner allocated');
      setShowAllocModal(false);
      fetchAllocations();
    } catch (err) { toast.error(err.response?.data?.detail || 'Allocation failed'); }
  };

  const handleDistribute = async () => {
    try {
      const res = await api.post(`/correction/${selectedEval}/distribute`);
      toast.success(res.data.message);
      fetchAllocations();
      fetchMyResponses();
    } catch (err) { toast.error(err.response?.data?.detail || 'Distribution failed'); }
  };

  const handleTransfer = async () => {
    try {
      const res = await api.post(`/correction/${selectedEval}/transfer`, transferForm);
      toast.success(res.data.message);
      setShowTransferModal(false);
      fetchAllocations();
      fetchMyResponses();
    } catch (err) { toast.error(err.response?.data?.detail || 'Transfer failed'); }
  };

  const handleGrade = async () => {
    try {
      await api.put(`/correction/responses/${gradeForm.response_id}/grade`, {
        manual_marks: gradeForm.manual_marks,
        examiner_remarks: gradeForm.examiner_remarks
      });
      toast.success('Marks saved');
      setShowGradeModal(false);
      fetchMyResponses();
      fetchAllocations();
    } catch (err) { toast.error(err.response?.data?.detail || 'Grading failed'); }
  };

  const openGradeModal = (resp) => {
    setGradeForm({
      response_id: resp.response_id,
      manual_marks: resp.manual_marks || 0,
      examiner_remarks: resp.examiner_remarks || '',
      response: resp
    });
    setShowGradeModal(true);
  };

  const uncorrectedCount = pendingResponses.filter(r => !r.corrected_at).length;
  const unassignedCount = pendingResponses.filter(r => !r.assigned_examiner_id).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk', color: 'hsl(210, 52%, 25%)' }}>Manual Correction</h1>
          <p className="text-sm text-muted-foreground mt-1">Allocate and grade subjective responses</p>
        </div>
        <Select value={selectedEval} onValueChange={setSelectedEval}>
          <SelectTrigger className="w-[250px]"><SelectValue placeholder="Select Evaluation" /></SelectTrigger>
          <SelectContent>{evaluations.map(e => <SelectItem key={e.eval_id} value={String(e.eval_id)}>{e.eval_title}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!selectedEval ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><PenTool size={48} className="mx-auto mb-4 opacity-30" /><p>Select an evaluation to manage corrections</p></CardContent></Card>
      ) : (
        <Tabs defaultValue={isAdmin ? 'overview' : 'my-assignments'}>
          <TabsList>
            {isAdmin && <TabsTrigger value="overview"><Users size={16} className="mr-2" />Overview & Allocations</TabsTrigger>}
            {isAdmin && <TabsTrigger value="pending"><FileQuestion size={16} className="mr-2" />Pending Responses ({uncorrectedCount})</TabsTrigger>}
            <TabsTrigger value="my-assignments" data-testid="examiner-correction-tab"><PenTool size={16} className="mr-2" />My Assignments {myResponses.length > 0 && `(${myResponses.length})`}</TabsTrigger>
          </TabsList>

          {/* Admin Overview Tab */}
          {isAdmin && (
            <TabsContent value="overview" className="mt-4 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card><CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold" style={{ color: 'hsl(210, 52%, 25%)' }}>{pendingResponses.length}</p>
                  <p className="text-sm text-muted-foreground">Total Subjective</p>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-amber-600">{unassignedCount}</p>
                  <p className="text-sm text-muted-foreground">Unassigned</p>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-red-600">{uncorrectedCount}</p>
                  <p className="text-sm text-muted-foreground">Uncorrected</p>
                </CardContent></Card>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => setShowAllocModal(true)} style={{ background: 'hsl(210, 52%, 25%)' }}>
                  <Plus size={16} className="mr-2" />Add Examiner
                </Button>
                <Button data-testid="admin-distribute-button" variant="outline" onClick={handleDistribute} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                  <Send size={16} className="mr-2" />Round-Robin Distribute
                </Button>
                <Button variant="outline" onClick={() => setShowTransferModal(true)} className="border-amber-300 text-amber-700 hover:bg-amber-50">
                  <ArrowRightLeft size={16} className="mr-2" />Transfer Workload
                </Button>
                <Button variant="outline" onClick={fetchAllocations}><RefreshCw size={16} className="mr-2" />Refresh</Button>
              </div>

              {/* Allocations table */}
              <Card>
                <CardHeader><CardTitle className="text-base">Examiner Allocations</CardTitle></CardHeader>
                <CardContent>
                  {allocations.length === 0 ? (
                    <p className="text-muted-foreground text-center py-6">No examiners allocated yet. Add examiners first.</p>
                  ) : (
                    <div className="space-y-2">
                      {allocations.map(a => (
                        <div key={a.allocation_id} className="flex items-center justify-between p-3 rounded-lg border bg-white hover:shadow-sm transition-shadow">
                          <div>
                            <p className="font-medium">{a.examiner_name}</p>
                            <p className="text-xs text-muted-foreground">{a.examiner_uid}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-lg font-semibold" style={{ color: 'hsl(210, 52%, 25%)' }}>{a.assigned_count}</p>
                              <p className="text-xs text-muted-foreground">Assigned</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-semibold text-emerald-600">{a.corrected_count}</p>
                              <p className="text-xs text-muted-foreground">Corrected</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-semibold">{a.max_assignment_limit}</p>
                              <p className="text-xs text-muted-foreground">Limit</p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {a.assigned_count > 0 ? Math.round((a.corrected_count / a.assigned_count) * 100) : 0}% done
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Pending Responses Tab (Admin only - all uncorrected) */}
          {isAdmin && (
            <TabsContent value="pending" className="mt-4">
              {loading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>
              ) : pendingResponses.filter(r => !r.corrected_at).length === 0 ? (
                <Card><CardContent className="p-12 text-center text-muted-foreground"><CheckCircle size={48} className="mx-auto mb-4 opacity-30 text-emerald-500" /><p>All responses have been graded!</p></CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {pendingResponses.filter(r => !r.corrected_at).map(r => (
                    <Card key={r.response_id} className="border-amber-200 bg-amber-50/30">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">{r.question_type}</Badge>
                              <Badge className="text-xs bg-blue-50 text-blue-700">{r.question_marks} marks</Badge>
                              <span className="text-xs text-muted-foreground">Student: {r.student_name} ({r.student_uid})</span>
                              {r.assigned_examiner_name && <Badge className="text-xs bg-purple-50 text-purple-700">Assigned to: {r.assigned_examiner_name}</Badge>}
                            </div>
                            <div className="text-sm" dangerouslySetInnerHTML={{ __html: r.question_content_html?.substring(0, 150) + '...' }} />
                            {r.candidate_response_payload && (
                              <div className="mt-2 p-2 bg-white border rounded text-sm">
                                <span className="text-xs text-muted-foreground block mb-1">Student Answer:</span>
                                {r.candidate_response_payload.substring(0, 300)}
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <Button size="sm" onClick={() => openGradeModal(r)} style={{ background: 'hsl(210, 52%, 25%)' }}>
                              <PenTool size={14} className="mr-1" />Grade Now
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* My Assignments Tab (Examiner view or Admin's assigned responses) */}
          <TabsContent value="my-assignments" className="mt-4">
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>
            ) : myResponses.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground"><PenTool size={48} className="mx-auto mb-4 opacity-30" /><p>No responses assigned to you for this evaluation.</p></CardContent></Card>
            ) : (
              <div className="space-y-3">
                {myResponses.map(r => (
                  <Card key={r.response_id} className={`transition-all hover:shadow-md ${r.corrected_at ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">{r.question_type}</Badge>
                            <Badge className="text-xs bg-blue-50 text-blue-700">{r.question_marks} marks</Badge>
                            <span className="text-xs text-muted-foreground">Student: {r.student_name} ({r.student_uid})</span>
                          </div>
                          <div className="text-sm" dangerouslySetInnerHTML={{ __html: r.question_content_html?.substring(0, 150) + '...' }} />
                          {r.candidate_response_payload && (
                            <div className="mt-2 p-2 bg-white border rounded text-sm">
                              <span className="text-xs text-muted-foreground block mb-1">Student Answer:</span>
                              {r.candidate_response_payload.substring(0, 300)}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          {r.corrected_at ? (
                            <div>
                              <p className="text-lg font-bold text-emerald-600">{r.manual_marks}</p>
                              <p className="text-xs text-muted-foreground">Graded</p>
                              <Button size="sm" variant="outline" className="mt-1" onClick={() => openGradeModal(r)}>Re-grade</Button>
                            </div>
                          ) : (
                            <Button size="sm" data-testid="grade-response-button" onClick={() => openGradeModal(r)} style={{ background: 'hsl(210, 52%, 25%)' }}>
                              <PenTool size={14} className="mr-1" />Grade
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Allocate Examiner Modal */}
      <Dialog open={showAllocModal} onOpenChange={setShowAllocModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Allocate Examiner</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Examiner</Label>
              <Select value={allocForm.examiner_id} onValueChange={v => setAllocForm({...allocForm, examiner_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select Examiner" /></SelectTrigger>
                <SelectContent>{examiners.map(e => <SelectItem key={e.user_id} value={e.user_id}>{e.full_name} ({e.unique_identifier})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Max Assignment Limit</Label>
              <Input type="number" min="1" value={allocForm.max_assignment_limit} onChange={e => setAllocForm({...allocForm, max_assignment_limit: parseInt(e.target.value) || 50})} />
            </div>
            <Button onClick={handleAllocate} className="w-full" style={{ background: 'hsl(210, 52%, 25%)' }}>Allocate</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent>
          <DialogHeader><DialogTitle><ArrowRightLeft size={20} className="inline mr-2" />Workload Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>From Examiner</Label>
              <Select value={transferForm.source_examiner_id} onValueChange={v => setTransferForm({...transferForm, source_examiner_id: v})}>
                <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>{allocations.map(a => <SelectItem key={a.examiner_id} value={a.examiner_id}>{a.examiner_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To Examiner</Label>
              <Select value={transferForm.destination_examiner_id} onValueChange={v => setTransferForm({...transferForm, destination_examiner_id: v})}>
                <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
                <SelectContent>{allocations.map(a => <SelectItem key={a.examiner_id} value={a.examiner_id}>{a.examiner_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={transferForm.only_uncorrected} onChange={e => setTransferForm({...transferForm, only_uncorrected: e.target.checked})} />
              <Label>Only uncorrected responses</Label>
            </div>
            <Button onClick={handleTransfer} className="w-full" style={{ background: 'hsl(210, 52%, 25%)' }}>Transfer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grade Modal */}
      <Dialog open={showGradeModal} onOpenChange={setShowGradeModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Grade Response</DialogTitle></DialogHeader>
          {gradeForm.response && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Question ({gradeForm.response.question_marks} marks):</p>
                <div className="text-sm" dangerouslySetInnerHTML={{ __html: gradeForm.response.question_content_html }} />
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Student Answer ({gradeForm.response.student_name}):</p>
                <p className="text-sm">{gradeForm.response.candidate_response_payload || 'No answer provided'}</p>
              </div>
              <div className="space-y-2">
                <Label>Marks (max: {gradeForm.response.question_marks})</Label>
                <Input type="number" step="0.5" min="0" max={gradeForm.response.question_marks}
                  value={gradeForm.manual_marks} onChange={e => setGradeForm({...gradeForm, manual_marks: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label>Remarks (Optional)</Label>
                <Textarea value={gradeForm.examiner_remarks} onChange={e => setGradeForm({...gradeForm, examiner_remarks: e.target.value})} rows={3} placeholder="Add feedback for the student..." />
              </div>
              <Button onClick={handleGrade} className="w-full" style={{ background: 'hsl(210, 52%, 25%)' }}>
                <CheckCircle size={16} className="mr-2" />Save Marks
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
