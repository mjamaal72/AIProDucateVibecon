import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RotateCcw, Clock, Users, Calendar, ToggleLeft, Archive } from 'lucide-react';

export default function ArchivedEvaluations() {
  const { api } = useAuth();
  const [archivedEvals, setArchivedEvals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchArchivedEvaluations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/evaluations?archived=true');
      setArchivedEvals(res.data);
    } catch (e) {
      toast.error('Failed to load archived evaluations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedEvaluations();
  }, []);

  const handleRestoreEvaluation = async (evalId, evalTitle) => {
    if (!window.confirm(`Restore "${evalTitle}"? It will return to the active evaluations list.`)) return;
    try {
      await api.put(`/evaluations/${evalId}/unarchive`);
      toast.success('Evaluation restored');
      fetchArchivedEvaluations();
    } catch (e) {
      toast.error('Failed to restore evaluation');
    }
  };

  const formatDate = (isoDate) => {
    if (!isoDate) return 'No date';
    const d = new Date(isoDate);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Archive size={32} />
            Archived Evaluations
          </h1>
          <p className="text-muted-foreground">Evaluations that have been archived</p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">{archivedEvals.length} Archived</Badge>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading archived evaluations...</div>
      ) : archivedEvals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Archive size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg mb-2">No archived evaluations</p>
            <p className="text-sm text-muted-foreground">Archived evaluations will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {archivedEvals.map(ev => (
            <Card key={ev.eval_id} className="border-amber-200 bg-amber-50/30">
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2">
                  <span className="text-lg">{ev.eval_title}</span>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">Archived</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5"><Clock size={14} /><span>{ev.duration_minutes} min</span></div>
                  <div className="flex items-center gap-1.5"><Users size={14} /><span>Max {ev.max_attempts} attempt(s)</span></div>
                  <div className="flex items-center gap-1.5"><Calendar size={14} /><span>{formatDate(ev.start_time)}</span></div>
                  <div className="flex items-center gap-1.5"><ToggleLeft size={14} /><span>{ev.visibility}</span></div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {ev.shuffle_questions && <Badge variant="secondary" className="text-xs">Shuffle Q</Badge>}
                  {ev.shuffle_categories && <Badge variant="secondary" className="text-xs">Shuffle Cat</Badge>}
                  {ev.enable_proctoring && <Badge variant="secondary" className="text-xs">Proctored</Badge>}
                  {ev.show_instant_results && <Badge variant="secondary" className="text-xs">Results</Badge>}
                </div>
                <Button 
                  size="sm" 
                  className="w-full" 
                  onClick={() => handleRestoreEvaluation(ev.eval_id, ev.eval_title)}
                >
                  <RotateCcw size={14} className="mr-2" />
                  Restore to Active
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
