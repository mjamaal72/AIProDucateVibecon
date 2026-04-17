import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useSearchParams } from 'react-router-dom';
import { evaluationStore } from '@/lib/evaluationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { RefreshCw, Trophy, BarChart3, Medal, Clock, CheckCircle, XCircle, MinusCircle } from 'lucide-react';

export default function LeaderBoard() {
  const { api } = useAuth();
  const [searchParams] = useSearchParams();
  const [evaluations, setEvaluations] = useState([]);
  
  // Initialize from shared store or URL param
  const [selectedEval, setSelectedEval] = useState(() => {
    const urlParam = searchParams.get('eval');
    const stored = evaluationStore.getSelectedEvaluation();
    return urlParam || (stored ? stored.toString() : '');
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const fetchEvals = useCallback(async () => {
    try { const res = await api.get('/evaluations'); setEvaluations(res.data); } catch (e) { console.error(e); }
  }, [api]);

  const fetchLeaderboard = useCallback(async () => {
    if (!selectedEval) return;
    setLoading(true);
    try { const res = await api.get(`/attempts/leaderboard/${selectedEval}`); setLeaderboard(res.data); } catch (err) { toast.error('Failed to load leaderboard'); } finally { setLoading(false); }
  }, [api, selectedEval]);

  const fetchAnalysis = useCallback(async () => {
    if (!selectedEval) return;
    setAnalysisLoading(true);
    try { const res = await api.get(`/analytics/item-analysis/${selectedEval}`); setAnalysis(res.data); } catch (err) { toast.error('Failed to load analysis'); } finally { setAnalysisLoading(false); }
  }, [api, selectedEval]);

  useEffect(() => { fetchEvals(); }, [fetchEvals]);
  useEffect(() => { if (selectedEval) { fetchLeaderboard(); fetchAnalysis(); } }, [selectedEval, fetchLeaderboard, fetchAnalysis]);
  
  // Save selected evaluation to shared store
  useEffect(() => {
    if (selectedEval) {
      evaluationStore.setSelectedEvaluation(parseInt(selectedEval, 10));
    }
  }, [selectedEval]);

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const getMedalStyle = (rank) => {
    if (rank === 1) return 'bg-gradient-to-br from-amber-100 to-amber-50 border-amber-300 text-amber-700';
    if (rank === 2) return 'bg-gradient-to-br from-slate-100 to-slate-50 border-slate-300 text-slate-600';
    if (rank === 3) return 'bg-gradient-to-br from-orange-100 to-orange-50 border-orange-300 text-orange-700';
    return 'bg-muted text-muted-foreground';
  };

  const getDifficultyColor = (rate) => {
    if (rate >= 80) return 'text-emerald-600';
    if (rate >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getDifficultyLabel = (idx) => {
    if (idx >= 0.8) return { label: 'Easy', color: 'bg-emerald-100 text-emerald-700' };
    if (idx >= 0.5) return { label: 'Medium', color: 'bg-amber-100 text-amber-700' };
    if (idx >= 0.3) return { label: 'Hard', color: 'bg-orange-100 text-orange-700' };
    return { label: 'Very Hard', color: 'bg-red-100 text-red-700' };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk', color: 'hsl(210, 52%, 25%)' }}>Leaders Board & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Performance rankings and question analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedEval} onValueChange={setSelectedEval}>
            <SelectTrigger className="w-[250px]"><SelectValue placeholder="Select Evaluation" /></SelectTrigger>
            <SelectContent>{evaluations.map(e => <SelectItem key={e.eval_id} value={String(e.eval_id)}>{e.eval_title}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => { fetchLeaderboard(); fetchAnalysis(); }} disabled={!selectedEval}><RefreshCw size={16} /></Button>
        </div>
      </div>

      <Tabs defaultValue="leaderboard">
        <TabsList>
          <TabsTrigger value="leaderboard"><Trophy size={16} className="mr-2" />Leaderboard</TabsTrigger>
          <TabsTrigger value="analysis" data-testid="item-analysis-tab"><BarChart3 size={16} className="mr-2" />Item Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="mt-4">
          {loading ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16" />)}</div>
          ) : !selectedEval ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground"><Trophy size={48} className="mx-auto mb-4 opacity-30" /><p>Select an evaluation to view rankings</p></CardContent></Card>
          ) : leaderboard.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground"><p>No submissions yet.</p></CardContent></Card>
          ) : (
            <div data-testid="leaderboard-table" className="space-y-2">
              {/* Top 3 podium */}
              {leaderboard.length >= 3 && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[1, 0, 2].map(idx => {
                    const entry = leaderboard[idx];
                    if (!entry) return <div key={idx} />;
                    return (
                      <Card key={entry.candidate_id} className={`${idx === 0 ? 'col-start-2 -mt-4' : ''} text-center border-2 ${getMedalStyle(entry.rank).split(' ').filter(c => c.startsWith('border-')).join(' ')}`}>
                        <CardContent className="p-4">
                          <div className={`w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center text-xl font-bold ${getMedalStyle(entry.rank)}`}>
                            <Medal size={24} />
                          </div>
                          <p className="font-semibold text-sm">{entry.full_name}</p>
                          <p className="text-2xl font-bold mt-1" style={{ color: 'hsl(210, 52%, 25%)' }}>{entry.total_score}/{entry.max_marks}</p>
                          <p className="text-sm font-medium text-muted-foreground">{entry.percentage}%</p>
                          <p className="text-xs text-muted-foreground">{formatDuration(entry.time_taken_seconds)}</p>
                          {entry.is_passed !== null && (
                            <Badge className={`mt-2 text-xs ${entry.is_passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {entry.is_passed ? 'Passed' : 'Failed'}
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Rest of leaderboard */}
              {leaderboard.slice(leaderboard.length >= 3 ? 3 : 0).map(entry => (
                <Card key={entry.candidate_id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getMedalStyle(entry.rank)}`}>
                      {entry.rank}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{entry.full_name}</h4>
                      <p className="text-xs text-muted-foreground">{entry.unique_identifier}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xl font-bold" style={{ color: 'hsl(210, 52%, 25%)' }}>{entry.total_score}/{entry.max_marks}</p>
                        <p className="text-xs text-muted-foreground">{entry.percentage}% Score</p>
                      </div>
                      <div className="text-right"><div className="flex items-center gap-1 text-sm text-muted-foreground"><Clock size={14} />{formatDuration(entry.time_taken_seconds)}</div></div>
                      {entry.is_passed !== null && <Badge className={entry.is_passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{entry.is_passed ? 'Passed' : 'Failed'}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="mt-4" data-testid="item-analysis-chart">
          {analysisLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>
          ) : !selectedEval ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground"><p>Select an evaluation</p></CardContent></Card>
          ) : !analysis || analysis.total_attempts === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground"><BarChart3 size={48} className="mx-auto mb-4 opacity-30" /><p>No submissions yet for analysis.</p></CardContent></Card>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div><p className="text-2xl font-bold" style={{ color: 'hsl(210, 52%, 25%)' }}>{analysis.total_attempts}</p><p className="text-xs text-muted-foreground">Total Submissions</p></div>
                    <div><p className="text-2xl font-bold">{analysis.questions.length}</p><p className="text-xs text-muted-foreground">Questions</p></div>
                    <div><p className={`text-2xl font-bold ${getDifficultyColor(analysis.questions.reduce((s, q) => s + q.correct_rate, 0) / Math.max(1, analysis.questions.length))}`}>{(analysis.questions.reduce((s, q) => s + q.correct_rate, 0) / Math.max(1, analysis.questions.length)).toFixed(1)}%</p><p className="text-xs text-muted-foreground">Avg Correct Rate</p></div>
                    <div><p className="text-2xl font-bold">{(analysis.questions.reduce((s, q) => s + q.skip_rate, 0) / Math.max(1, analysis.questions.length)).toFixed(1)}%</p><p className="text-xs text-muted-foreground">Avg Skip Rate</p></div>
                  </div>
                </CardContent>
              </Card>

              {/* Per-question analysis */}
              {analysis.questions.map((q, idx) => {
                const diff = getDifficultyLabel(q.difficulty_index);
                return (
                  <Card key={q.question_id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: 'hsl(204, 55%, 92%)', color: 'hsl(210, 52%, 25%)' }}>Q{idx + 1}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{q.question_type}</Badge>
                            <Badge className={`text-xs ${diff.color}`}>{diff.label}</Badge>
                            <Badge className="text-xs bg-blue-50 text-blue-700">{q.marks}M</Badge>
                          </div>
                          <div className="text-sm mb-3" dangerouslySetInnerHTML={{ __html: q.content_html }} />
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="text-center p-2 rounded-lg bg-muted/50">
                              <div className="flex items-center justify-center gap-1">
                                <CheckCircle size={14} className="text-emerald-500" />
                                <span className={`text-lg font-bold ${getDifficultyColor(q.correct_rate)}`}>{q.correct_rate}%</span>
                              </div>
                              <p className="text-xs text-muted-foreground">Correct Rate</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-muted/50">
                              <div className="flex items-center justify-center gap-1">
                                <MinusCircle size={14} className="text-amber-500" />
                                <span className="text-lg font-bold">{q.skip_rate}%</span>
                              </div>
                              <p className="text-xs text-muted-foreground">Skip Rate</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-muted/50">
                              <div className="flex items-center justify-center gap-1">
                                <Clock size={14} className="text-blue-500" />
                                <span className="text-lg font-bold">{q.avg_time_seconds}s</span>
                              </div>
                              <p className="text-xs text-muted-foreground">Avg Time</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-muted/50">
                              <span className="text-lg font-bold">{q.answered_count}/{q.total_responses}</span>
                              <p className="text-xs text-muted-foreground">Attempted</p>
                            </div>
                          </div>
                          {/* Option distribution bar */}
                          {Object.keys(q.option_distribution).length > 0 && (
                            <div className="mt-3 space-y-1.5">
                              <p className="text-xs text-muted-foreground font-medium">Option Distribution</p>
                              {Object.entries(q.option_distribution).map(([id, opt]) => (
                                <div key={id} className="flex items-center gap-2">
                                  <span className="text-xs w-28 truncate">{opt.content}</span>
                                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${opt.is_correct ? 'bg-emerald-400' : 'bg-red-300'}`}
                                      style={{ width: `${q.answered_count > 0 ? (opt.selected_count / q.answered_count) * 100 : 0}%` }} />
                                  </div>
                                  <span className="text-xs w-8 text-right">{opt.selected_count}</span>
                                  {opt.is_correct && <CheckCircle size={12} className="text-emerald-500" />}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
