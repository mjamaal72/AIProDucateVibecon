import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { RefreshCw, Trophy, BarChart3, Medal, Clock } from 'lucide-react';

export default function LeaderBoard() {
  const { api } = useAuth();
  const [searchParams] = useSearchParams();
  const [evaluations, setEvaluations] = useState([]);
  const [selectedEval, setSelectedEval] = useState(searchParams.get('eval') || '');
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchEvals = useCallback(async () => {
    try { const res = await api.get('/evaluations'); setEvaluations(res.data); } catch (e) { console.error(e); }
  }, [api]);

  const fetchLeaderboard = useCallback(async () => {
    if (!selectedEval) return;
    setLoading(true);
    try {
      const res = await api.get(`/attempts/leaderboard/${selectedEval}`);
      setLeaderboard(res.data);
    } catch (err) {
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [api, selectedEval]);

  useEffect(() => { fetchEvals(); }, [fetchEvals]);
  useEffect(() => { if (selectedEval) fetchLeaderboard(); }, [selectedEval, fetchLeaderboard]);

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const getMedalColor = (rank) => {
    if (rank === 1) return 'bg-amber-100 text-amber-700 border-amber-300';
    if (rank === 2) return 'bg-gray-100 text-gray-600 border-gray-300';
    if (rank === 3) return 'bg-orange-100 text-orange-700 border-orange-300';
    return '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk', color: 'hsl(210, 52%, 25%)' }}>Leaders Board & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">View top performers and question analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedEval} onValueChange={setSelectedEval}>
            <SelectTrigger className="w-[250px]"><SelectValue placeholder="Select Evaluation" /></SelectTrigger>
            <SelectContent>{evaluations.map(e => <SelectItem key={e.eval_id} value={String(e.eval_id)}>{e.eval_title}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchLeaderboard} disabled={!selectedEval}>
            <RefreshCw size={16} className="mr-2" />Refresh
          </Button>
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
            <Card><CardContent className="p-12 text-center text-muted-foreground"><Trophy size={48} className="mx-auto mb-4 opacity-30" /><p>Select an evaluation to view the leaderboard</p></CardContent></Card>
          ) : leaderboard.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground"><p>No submissions yet for this evaluation.</p></CardContent></Card>
          ) : (
            <div data-testid="leaderboard-table" className="space-y-2">
              {leaderboard.map((entry) => (
                <Card key={entry.candidate_id} className={`transition-all hover:shadow-md ${entry.rank <= 3 ? 'border-2 ' + getMedalColor(entry.rank).split(' ').find(c => c.startsWith('border-')) : ''}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${getMedalColor(entry.rank) || 'bg-muted text-muted-foreground'}`}>
                      {entry.rank <= 3 ? <Medal size={24} /> : entry.rank}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{entry.full_name}</h4>
                      <p className="text-sm text-muted-foreground">{entry.unique_identifier}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-2xl font-bold" style={{ color: 'hsl(210, 52%, 25%)' }}>{entry.total_score}</p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock size={14} />{formatDuration(entry.time_taken_seconds)}
                        </div>
                      </div>
                      {entry.is_passed !== null && (
                        <Badge className={entry.is_passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                          {entry.is_passed ? 'Passed' : 'Failed'}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="mt-4" data-testid="item-analysis-chart">
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
            <p>Item Analysis will be available after more submissions are collected.</p>
            <p className="text-xs mt-2">This feature analyzes question difficulty, discrimination, and option distribution.</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
