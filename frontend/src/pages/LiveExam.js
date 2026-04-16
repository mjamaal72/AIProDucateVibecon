import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Bookmark, BookmarkCheck, Clock, Send, Check, Circle, AlertTriangle } from 'lucide-react';

// Fill-In-The-Blank Component with Drag & Drop
function FillBlankQuestion({ content, options, currentAnswer, onChange }) {
  const [draggedOption, setDraggedOption] = useState(null);
  const answer = typeof currentAnswer === 'object' ? currentAnswer : {};
  
  // Parse content and replace _blank_ with drop zones
  const renderContent = () => {
    const parts = content.split('_blank_');
    const elements = [];
    
    parts.forEach((part, idx) => {
      elements.push(<span key={`text-${idx}`} dangerouslySetInnerHTML={{ __html: part }} />);
      
      if (idx < parts.length - 1) {
        const blankId = idx;
        const filledValue = answer[blankId];
        
        elements.push(
          <span
            key={`blank-${idx}`}
            className={`inline-block min-w-[120px] px-3 py-2 mx-1 border-2 rounded ${
              filledValue ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-dashed border-gray-400'
            }`}
            style={{ minHeight: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedOption) {
                onChange({ ...answer, [blankId]: draggedOption });
                setDraggedOption(null);
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => {
              // Allow clearing by clicking
              if (filledValue) {
                const newAnswer = { ...answer };
                delete newAnswer[blankId];
                onChange(newAnswer);
              }
            }}
          >
            {filledValue ? (
              <span className="font-medium text-blue-700">{filledValue}</span>
            ) : (
              <span className="text-gray-400 text-sm">Drop here</span>
            )}
          </span>
        );
      }
    });
    
    return <div className="prose prose-sm max-w-none mb-6 text-lg leading-relaxed">{elements}</div>;
  };
  
  // Get available options (not text-based, only correct options or all options)
  const availableOptions = options.filter(opt => opt.content_left && opt.content_left.trim());
  
  return (
    <div className="space-y-6">
      {renderContent()}
      
      {/* Draggable Options */}
      <div className="border-t pt-4">
        <p className="text-sm font-medium mb-3 text-muted-foreground">Drag options to the blanks above:</p>
        <div className="flex flex-wrap gap-3">
          {availableOptions.map((opt, idx) => (
            <div
              key={opt.option_id}
              draggable
              onDragStart={() => setDraggedOption(opt.content_left)}
              onDragEnd={() => setDraggedOption(null)}
              className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg cursor-move hover:border-blue-400 hover:shadow-md transition-all"
              style={{ userSelect: 'none' }}
            >
              <span className="font-medium">{opt.content_left}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          💡 Tip: Drag an option to a blank space, or click a filled blank to clear it
        </p>
      </div>
    </div>
  );
}

export default function LiveExam() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [bookmarks, setBookmarks] = useState(new Set());
  const [answered, setAnswered] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [evalData, setEvalData] = useState(null);
  const [violations, setViolations] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Proctoring: Tab-switch & visibility detection
  useEffect(() => {
    if (!attempt || !evalData?.enable_proctoring) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setViolations(v => v + 1);
        toast.warning('Tab switch detected! This will be reported.');
        api.post(`/proctoring/${attemptId}/event`, {
          event_type: 'TAB_SWITCH',
          description: 'Student switched to another tab'
        }).catch(() => {});
      }
    };

    const handleBlur = () => {
      setViolations(v => v + 1);
      toast.warning('Window focus lost! This is being recorded.');
      api.post(`/proctoring/${attemptId}/event`, {
        event_type: 'WINDOW_BLUR',
        description: 'Browser window lost focus'
      }).catch(() => {});
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [attempt, evalData, api, attemptId]);

  const fetchAttempt = useCallback(async () => {
    try {
      setLoading(true);
      const attRes = await api.get(`/attempts/${attemptId}`);
      setAttempt(attRes.data);
      if (attRes.data.status !== 'IN_PROGRESS') {
        toast.info('This exam has already been submitted');
        navigate('/');
        return;
      }
      const evalRes = await api.get(`/evaluations/${attRes.data.eval_id}`);
      setEvalData(evalRes.data);
      // Get questions via start (returns existing if in progress)
      const startRes = await api.post(`/attempts/start?eval_id=${attRes.data.eval_id}`);
      setQuestions(startRes.data.questions || []);
      // Restore answers from responses
      const respRes = await api.get(`/attempts/${attemptId}/responses`);
      const ansMap = {};
      const bmarks = new Set();
      const answeredSet = new Set();
      respRes.data.forEach(r => {
        if (r.candidate_response_payload) {
          try {
            ansMap[r.question_id] = JSON.parse(r.candidate_response_payload);
            answeredSet.add(r.question_id);
          } catch { ansMap[r.question_id] = r.candidate_response_payload; answeredSet.add(r.question_id); }
        }
        if (r.is_bookmarked) bmarks.add(r.question_id);
      });
      setAnswers(ansMap);
      setBookmarks(bmarks);
      setAnswered(answeredSet);
      // Calculate time left
      const startedAt = new Date(attRes.data.started_at);
      startTimeRef.current = startedAt;
      const durationMs = evalRes.data.duration_minutes * 60 * 1000;
      const elapsed = Date.now() - startedAt.getTime();
      const remaining = Math.max(0, Math.floor((durationMs - elapsed) / 1000));
      setTimeLeft(remaining);
    } catch (err) {
      toast.error('Failed to load exam');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [api, attemptId, navigate]);

  useEffect(() => { fetchAttempt(); }, [fetchAttempt]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0 || !attempt) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [attempt]);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const currentQ = questions[currentIdx];

  const saveAnswer = async (questionId, payload, bookmark = false) => {
    try {
      await api.post(`/attempts/${attemptId}/answer`, {
        question_id: questionId,
        response_payload: payload,
        is_bookmarked: bookmark || bookmarks.has(questionId),
        time_spent_seconds: 0
      });
      const newAnswered = new Set(answered);
      if (payload !== null && payload !== '' && payload !== undefined) {
        newAnswered.add(questionId);
      }
      setAnswered(newAnswered);
    } catch (err) {
      if (err.response?.data?.detail === 'Time has expired') {
        toast.error('Time has expired! Submitting exam...');
        handleAutoSubmit();
      }
    }
  };

  const handleAnswer = (questionId, value) => {
    setAnswers({ ...answers, [questionId]: value });
    saveAnswer(questionId, value);
  };

  const toggleBookmark = (qid) => {
    const newBookmarks = new Set(bookmarks);
    if (newBookmarks.has(qid)) newBookmarks.delete(qid);
    else newBookmarks.add(qid);
    setBookmarks(newBookmarks);
    saveAnswer(qid, answers[qid] || null, newBookmarks.has(qid));
  };

  const handleAutoSubmit = async () => {
    try {
      await api.post(`/attempts/${attemptId}/submit`);
      toast.success('Exam submitted (time expired)');
      navigate('/');
    } catch (e) {
      navigate('/');
    }
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await api.post(`/attempts/${attemptId}/submit`);
      toast.success('Exam submitted successfully!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const goTo = (idx) => setCurrentIdx(idx);
  const goNext = () => setCurrentIdx(Math.min(currentIdx + 1, questions.length - 1));
  const goPrev = () => setCurrentIdx(Math.max(currentIdx - 1, 0));

  const getQuestionStatus = (q) => {
    if (answered.has(q.question_id)) return 'answered';
    if (bookmarks.has(q.question_id)) return 'bookmarked';
    return 'unattended';
  };

  const unansweredCount = questions.filter(q => !answered.has(q.question_id)).length;

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-white"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800 mx-auto mb-4" /><p className="text-muted-foreground">Loading exam...</p></div></div>;
  }

  return (
    <div className="min-h-screen" style={{ background: 'hsl(210, 33%, 98%)' }}>
      {/* Timer Bar */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://customer-assets.emergentagent.com/job_8fd771a9-94bf-48e9-839d-945bcffab523/artifacts/0npssl6s_AIProDucate%20Logo.jpeg" alt="Logo" className="w-8 h-8 rounded" />
            <h1 className="text-sm font-semibold" style={{ fontFamily: 'Space Grotesk', color: 'hsl(210, 52%, 25%)' }}>{evalData?.eval_title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <div data-testid="exam-timer" className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-lg font-bold ${
              timeLeft < 300 ? 'bg-red-100 text-red-700 animate-pulse' : timeLeft < 600 ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-800'
            }`}>
              <Clock size={18} />{formatTime(timeLeft)}
            </div>
            {evalData?.enable_proctoring && violations > 0 && (
              <Badge className="bg-red-100 text-red-700 border-red-300" data-testid="proctoring-violation-badge">
                <AlertTriangle size={14} className="mr-1" />{violations} violation{violations > 1 ? 's' : ''}
              </Badge>
            )}
            <Progress value={((questions.length - unansweredCount) / questions.length) * 100} className="w-32 hidden sm:block" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Question Panel */}
          <div className="col-span-12 lg:col-span-8">
            {currentQ && (
              <Card className="shadow-md">
                <CardContent className="p-6 lg:p-8">
                  {/* Question Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-sm">Question {currentIdx + 1} of {questions.length}</Badge>
                      <Badge className="text-xs bg-emerald-50 text-emerald-700">{currentQ.marks} marks</Badge>
                    </div>
                    <Button variant="ghost" size="sm" data-testid="exam-bookmark-toggle" onClick={() => toggleBookmark(currentQ.question_id)}
                      className={bookmarks.has(currentQ.question_id) ? 'text-amber-500' : 'text-muted-foreground'}>
                      {bookmarks.has(currentQ.question_id) ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
                    </Button>
                  </div>

                  {/* Question Content */}
                  {currentQ.question_type === 'FILL_BLANK' ? (
                    <FillBlankQuestion 
                      content={currentQ.content_html}
                      options={currentQ.options}
                      currentAnswer={answers[currentQ.question_id]}
                      onChange={v => handleAnswerChange(currentQ.question_id, v)}
                    />
                  ) : (
                    <div data-testid="exam-question-stem" className="prose prose-sm max-w-none mb-8 text-lg leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: currentQ.content_html }} />
                  )}

                  {/* Answer Input */}
                  <div data-testid="exam-answer-input" className="space-y-3">
                    {renderAnswerInput(currentQ, answers[currentQ.question_id], (val) => handleAnswer(currentQ.question_id, val))}
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between mt-8 pt-6 border-t">
                    <Button variant="outline" onClick={goPrev} disabled={currentIdx === 0}>
                      <ChevronLeft size={16} className="mr-1" />Previous
                    </Button>
                    {currentIdx < questions.length - 1 ? (
                      <Button data-testid="exam-save-next-button" onClick={goNext} style={{ background: 'hsl(210, 52%, 25%)' }}>
                        Save & Next<ChevronRight size={16} className="ml-1" />
                      </Button>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button data-testid="exam-submit-button" className="bg-emerald-600 hover:bg-emerald-700">
                            <Send size={16} className="mr-2" />Submit Exam
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {unansweredCount > 0 && (
                                <div className="flex items-center gap-2 text-amber-600 mb-3">
                                  <AlertTriangle size={16} />
                                  You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}!
                                </div>
                              )}
                              Once submitted, you cannot change your answers. Are you sure?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Go Back</AlertDialogCancel>
                            <AlertDialogAction onClick={handleFinalSubmit} disabled={submitting} className="bg-emerald-600">
                              {submitting ? 'Submitting...' : 'Confirm Submit'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Navigation Grid */}
          <div className="col-span-12 lg:col-span-4">
            <Card className="sticky top-24 shadow-md">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'Space Grotesk' }}>Question Navigation</h3>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-4 text-xs">
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-emerald-500" /><Check size={10} />Answered</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-amber-400" /><Bookmark size={10} />Bookmarked</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-gray-300" /><Circle size={10} />Unattended</div>
                </div>
                {/* Grid */}
                <div data-testid="exam-nav-grid" className="grid grid-cols-6 gap-2">
                  {questions.map((q, idx) => {
                    const status = getQuestionStatus(q);
                    return (
                      <button
                        key={q.question_id}
                        data-testid="exam-nav-grid-item"
                        onClick={() => goTo(idx)}
                        className={`w-full aspect-square rounded-lg text-sm font-medium flex items-center justify-center transition-all duration-150 border-2 ${
                          idx === currentIdx ? 'ring-2 ring-offset-1 ring-blue-500 ' : ''
                        }${
                          status === 'answered' ? 'bg-emerald-100 border-emerald-300 text-emerald-800' :
                          status === 'bookmarked' ? 'bg-amber-100 border-amber-300 text-amber-800' :
                          'bg-gray-100 border-gray-200 text-gray-500'
                        } hover:shadow-md hover:-translate-y-0.5`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                {/* Submit Button */}
                <div className="mt-4 pt-4 border-t">
                  <div className="text-xs text-muted-foreground mb-2">
                    Answered: {answered.size}/{questions.length} | Bookmarked: {bookmarks.size}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button data-testid="exam-submit-button" className="w-full bg-emerald-600 hover:bg-emerald-700">
                        <Send size={16} className="mr-2" />Submit Exam
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {unansweredCount > 0 && <div className="text-amber-600 mb-2"><AlertTriangle size={16} className="inline mr-1" />{unansweredCount} unanswered questions</div>}
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Go Back</AlertDialogCancel>
                        <AlertDialogAction onClick={handleFinalSubmit} disabled={submitting} className="bg-emerald-600">Confirm Submit</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderAnswerInput(question, currentAnswer, onChange) {
  const qtype = question.question_type;
  const options = question.options || [];

  if (qtype === 'SINGLE_SELECT') {
    return (
      <RadioGroup value={currentAnswer ? String(currentAnswer) : ''} onValueChange={v => onChange(v)}>
        {options.map((opt) => (
          <div key={opt.option_id} className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-colors cursor-pointer ${
            String(currentAnswer) === String(opt.option_id) ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}>
            <RadioGroupItem value={String(opt.option_id)} id={`opt-${opt.option_id}`} />
            <Label htmlFor={`opt-${opt.option_id}`} className="flex-1 cursor-pointer text-base">{opt.content_left}</Label>
          </div>
        ))}
      </RadioGroup>
    );
  }

  if (qtype === 'MULTIPLE_SELECT') {
    const selected = Array.isArray(currentAnswer) ? currentAnswer.map(String) : [];
    return options.map((opt) => (
      <div key={opt.option_id} className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-colors cursor-pointer ${
        selected.includes(String(opt.option_id)) ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}>
        <Checkbox checked={selected.includes(String(opt.option_id))}
          onCheckedChange={(checked) => {
            const newSel = checked ? [...selected, String(opt.option_id)] : selected.filter(s => s !== String(opt.option_id));
            onChange(newSel);
          }} id={`opt-${opt.option_id}`} />
        <Label htmlFor={`opt-${opt.option_id}`} className="flex-1 cursor-pointer text-base">{opt.content_left}</Label>
      </div>
    ));
  }

  if (qtype === 'FILL_BLANK') {
    // FIB is handled separately in the question content area with drag & drop
    return null;
  }

  if (qtype === 'MATCHING') {
    const ans = typeof currentAnswer === 'object' ? currentAnswer : {};
    const rightOptions = [...new Set(options.map(o => o.content_right).filter(Boolean))];
    return options.map((opt) => (
      <div key={opt.option_id} className="flex items-center gap-3 p-3 border rounded-lg">
        <span className="font-medium min-w-[120px]">{opt.content_left}</span>
        <span className="text-muted-foreground">→</span>
        <Select value={ans[String(opt.option_id)] || ''} onValueChange={v => onChange({...ans, [String(opt.option_id)]: v})}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Match with..." /></SelectTrigger>
          <SelectContent>{rightOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    ));
  }

  if (qtype === 'SEQUENCING') {
    const order = Array.isArray(currentAnswer) ? currentAnswer : options.map(o => String(o.option_id));
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground mb-2">Drag to reorder (or use arrows):</p>
        {order.map((id, idx) => {
          const opt = options.find(o => String(o.option_id) === String(id));
          return (
            <div key={id} className="flex items-center gap-2 p-3 border rounded-lg bg-white">
              <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-sm font-medium">{idx + 1}</span>
              <span className="flex-1">{opt?.content_left || id}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={idx === 0}
                  onClick={() => { const newOrder = [...order]; [newOrder[idx-1], newOrder[idx]] = [newOrder[idx], newOrder[idx-1]]; onChange(newOrder); }}>↑</Button>
                <Button size="sm" variant="ghost" disabled={idx === order.length - 1}
                  onClick={() => { const newOrder = [...order]; [newOrder[idx], newOrder[idx+1]] = [newOrder[idx+1], newOrder[idx]]; onChange(newOrder); }}>↓</Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (qtype === 'TOGGLE_BINARY') {
    const ans = typeof currentAnswer === 'object' ? currentAnswer : {};
    return options.map((opt) => (
      <div key={opt.option_id} className="flex items-center justify-between p-4 border rounded-lg">
        <span className="flex-1">{opt.content_left}</span>
        <div className="flex gap-2">
          <Button size="sm" variant={ans[String(opt.option_id)] === 'true' ? 'default' : 'outline'}
            onClick={() => onChange({...ans, [String(opt.option_id)]: 'true'})} className={ans[String(opt.option_id)] === 'true' ? 'bg-emerald-600' : ''}>
            True
          </Button>
          <Button size="sm" variant={ans[String(opt.option_id)] === 'false' ? 'default' : 'outline'}
            onClick={() => onChange({...ans, [String(opt.option_id)]: 'false'})} className={ans[String(opt.option_id)] === 'false' ? 'bg-red-500' : ''}>
            False
          </Button>
        </div>
      </div>
    ));
  }

  if (qtype === 'SUBJECTIVE_TYPING') {
    return (
      <div className="space-y-2">
        <Textarea rows={8} placeholder="Type your answer here..."
          value={currentAnswer || ''} onChange={e => onChange(e.target.value)}
          className="text-base" />
        {question.word_limit && (
          <p className="text-sm text-muted-foreground">
            Word limit: {(currentAnswer || '').split(/\s+/).filter(Boolean).length} / {question.word_limit}
          </p>
        )}
      </div>
    );
  }

  return <p className="text-muted-foreground">This question type ({qtype}) requires special input not yet supported in the web interface.</p>;
}
