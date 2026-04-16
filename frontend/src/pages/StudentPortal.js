import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Play, Clock, Calendar, Users, Trophy, CheckCircle, AlertCircle } from 'lucide-react';

export default function StudentPortal() {
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const [evaluations, setEvaluations] = useState([]);
  const [attempts, setAttempts] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/evaluations');
      setEvaluations(res.data);
      // Fetch attempts for each evaluation
      const attemptsMap = {};
      for (const ev of res.data) {
        try {
          const attRes = await api.get(`/attempts/my/${ev.eval_id}`);
          attemptsMap[ev.eval_id] = attRes.data;
        } catch (e) { attemptsMap[ev.eval_id] = []; }
      }
      setAttempts(attemptsMap);
    } catch (err) {
      toast.error('Failed to load evaluations');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startAttempt = async (evalId) => {
    try {
      const res = await api.post(`/attempts/start?eval_id=${evalId}`);
      toast.success('Exam started!');
      navigate(`/exam/${res.data.attempt.attempt_id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start exam');
    }
  };

  const resumeAttempt = (attemptId) => {
    navigate(`/exam/${attemptId}`);
  };

  const upcoming = evaluations.filter(e => e.is_active);
  const completed = evaluations.filter(e => {
    const myAttempts = attempts[e.eval_id] || [];
    return myAttempts.some(a => a.status === 'SUBMITTED');
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Card key={i}><CardContent className="p-6 space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-10 w-full" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk', color: 'hsl(210, 52%, 25%)' }}>Student Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back, {user?.full_name}! Discover and take your evaluations.</p>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming" data-testid="student-upcoming-exams">Available Exams ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {upcoming.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground"><Calendar size={48} className="mx-auto mb-4 opacity-30" /><p>No available evaluations at this time.</p></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="student-upcoming-exams">
              {upcoming.map(ev => {
                const myAttempts = attempts[ev.eval_id] || [];
                const inProgress = myAttempts.find(a => a.status === 'IN_PROGRESS');
                const completedCount = myAttempts.filter(a => a.status === 'SUBMITTED').length;
                const canAttempt = completedCount < ev.max_attempts;

                return (
                  <Card key={ev.eval_id} className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{ev.eval_title}</CardTitle>
                        <Badge className={ev.visibility === 'PUBLIC' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}>
                          {ev.visibility === 'PUBLIC' ? 'Public' : 'Invited'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5"><Clock size={14} /><span>{ev.duration_minutes} minutes</span></div>
                        <div className="flex items-center gap-1.5"><Users size={14} /><span>{ev.max_attempts} attempt{ev.max_attempts > 1 ? 's' : ''}</span></div>
                        <div className="flex items-center gap-1.5"><Calendar size={14} /><span>{new Date(ev.start_time).toLocaleDateString()}</span></div>
                        {ev.passing_percentage && <div className="flex items-center gap-1.5"><Trophy size={14} /><span>Pass: {ev.passing_percentage}%</span></div>}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {ev.shuffle_questions && <Badge variant="secondary" className="text-xs">Shuffled</Badge>}
                        {ev.enable_proctoring && <Badge variant="secondary" className="text-xs">Proctored</Badge>}
                        {!ev.allow_navigation && <Badge variant="secondary" className="text-xs">Linear</Badge>}
                      </div>

                      {completedCount > 0 && (
                        <div className="text-sm text-muted-foreground">
                          <CheckCircle size={14} className="inline mr-1 text-emerald-500" />
                          {completedCount}/{ev.max_attempts} attempts used
                        </div>
                      )}

                      {inProgress ? (
                        <Button className="w-full bg-amber-500 hover:bg-amber-600" data-testid="student-exam-start-button"
                          onClick={() => resumeAttempt(inProgress.attempt_id)}>
                          <Play size={16} className="mr-2" />Resume Exam
                        </Button>
                      ) : canAttempt ? (
                        <Button className="w-full" data-testid="student-exam-start-button"
                          style={{ background: 'hsl(210, 52%, 25%)' }}
                          onClick={() => startAttempt(ev.eval_id)}>
                          <Play size={16} className="mr-2" />Start Exam
                        </Button>
                      ) : (
                        <Button className="w-full" disabled variant="secondary">
                          <AlertCircle size={16} className="mr-2" />All Attempts Used
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4" data-testid="student-past-attempts-table">
          {completed.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground"><p>No completed evaluations yet.</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {completed.map(ev => {
                const myAttempts = (attempts[ev.eval_id] || []).filter(a => a.status === 'SUBMITTED');
                return myAttempts.map(att => (
                  <Card key={att.attempt_id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{ev.eval_title}</h4>
                        <p className="text-sm text-muted-foreground">Submitted: {new Date(att.submitted_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-bold" style={{ color: 'hsl(210, 52%, 25%)' }}>{att.total_score ?? '-'}</p>
                          <p className="text-xs text-muted-foreground">Score</p>
                        </div>
                        {att.is_passed !== null && (
                          <Badge className={att.is_passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                            {att.is_passed ? 'Passed' : 'Failed'}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ));
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
