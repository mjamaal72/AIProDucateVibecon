import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useSearchParams } from 'react-router-dom';
import { evaluationStore } from '@/lib/evaluationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Plus, Trash2, FolderOpen, Sparkles, Save, X, GripVertical, ChevronDown, ChevronUp, Edit2, AlignLeft, AlignRight, TextCursorInput, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import UnderlineExt from '@tiptap/extension-underline';

const QUESTION_TYPES = [
  { value: 'SINGLE_SELECT', label: 'Single Select', icon: '1' },
  { value: 'MULTIPLE_SELECT', label: 'Multiple Select', icon: 'M' },
  { value: 'FILL_BLANK', label: 'Fill In The Blank', icon: 'F' },
  { value: 'MATCHING', label: 'Match The Following', icon: '=' },
  { value: 'SEQUENCING', label: 'Sequencing', icon: '#' },
  { value: 'TOGGLE_BINARY', label: 'Toggle (Binary)', icon: 'T' },
  { value: 'SUBJECTIVE_TYPING', label: 'Subjective Typing', icon: 'S' },
  { value: 'FILE_UPLOAD', label: 'File Upload', icon: 'U' },
  { value: 'AUDIO_RECORDING', label: 'Audio Recording', icon: 'A' },
];
const PENALTY_TYPES = [
  { value: 'NONE', label: 'None (All or Nothing)' },
  { value: 'A', label: 'Toggle A (Sniper - Any wrong = 0)' },
  { value: 'B', label: 'Toggle B (Offset - Correct minus Incorrect)' },
  { value: 'C', label: 'Toggle C (Pure Partial - Wrong = 0, no penalty)' },
];

export default function QuestionBank() {
  const { api } = useAuth();
  const [searchParams] = useSearchParams();
  const [evaluations, setEvaluations] = useState([]);
  
  // Initialize from shared store or URL param
  const [selectedEval, setSelectedEval] = useState(() => {
    const urlParam = searchParams.get('eval');
    const stored = evaluationStore.getSelectedEvaluation();
    return urlParam || (stored ? stored.toString() : '');
  });
  const [sections, setSections] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [sectionForm, setSectionForm] = useState({ section_name: '', target_question_count: 0, target_total_marks: 0, instructions: '' });
  const [editSection, setEditSection] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    eval_id: 0, section_id: null, question_type: 'SINGLE_SELECT', content_html: '',
    marks: 1, negative_marks: 0, time_limit_seconds: null, word_limit: null,
    penalty_logic_type: 'NONE', options: []
  });
  const [editQuestion, setEditQuestion] = useState(null);
  const [direction, setDirection] = useState('ltr');
  const [aiForm, setAiForm] = useState({ context: '', question_type: 'SINGLE_SELECT', count: 5, difficulty: 'medium' });
  const [aiResults, setAiResults] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSelected, setAiSelected] = useState(new Set());
  const [aiSelectedSection, setAiSelectedSection] = useState(null);
  const [expandedQ, setExpandedQ] = useState(null);
  const [customFonts, setCustomFonts] = useState([]);
  const [selectedFont, setSelectedFont] = useState('Inter');
  const [aiFile, setAiFile] = useState(null);
  const [openSections, setOpenSections] = useState(new Set());
  
  // Group questions by section
  const questionsBySection = useMemo(() => {
    const grouped = {};
    sections.forEach(s => {
      grouped[s.section_id] = {
        section: s,
        questions: questions.filter(q => q.section_id === s.section_id),
        totalMarks: questions.filter(q => q.section_id === s.section_id).reduce((sum, q) => sum + (q.marks || 0), 0)
      };
    });
    // Unsectioned questions
    grouped['null'] = {
      section: { section_id: null, section_name: 'Unsectioned Questions' },
      questions: questions.filter(q => !q.section_id),
      totalMarks: questions.filter(q => !q.section_id).reduce((sum, q) => sum + (q.marks || 0), 0)
    };
    return grouped;
  }, [sections, questions]);
  
  const toggleSection = (sectionId) => {
    const newOpen = new Set(openSections);
    if (newOpen.has(sectionId)) {
      newOpen.delete(sectionId);
    } else {
      newOpen.add(sectionId);
    }
    setOpenSections(newOpen);
  };
  
  // Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      FontFamily
    ],
    content: questionForm.content_html,
    onUpdate: ({ editor }) => {
      setQuestionForm(prev => ({ ...prev, content_html: editor.getHTML() }));
    }
  });

  // Update editor content when questionForm changes externally
  useEffect(() => {
    if (editor && questionForm.content_html !== editor.getHTML()) {
      editor.commands.setContent(questionForm.content_html);
    }
  }, [questionForm.content_html, editor]);

  const fetchEvals = useCallback(async () => {
    try { const res = await api.get('/evaluations'); setEvaluations(res.data); } catch (e) { console.error(e); }
  }, [api]);
  const fetchSections = useCallback(async () => {
    if (!selectedEval) return;
    try { const res = await api.get(`/evaluations/${selectedEval}/sections`); setSections(res.data); } catch (e) { console.error(e); }
  }, [api, selectedEval]);
  const fetchQuestions = useCallback(async () => {
    if (!selectedEval) return;
    setLoading(true);
    try { const res = await api.get(`/questions/by-eval/${selectedEval}`); setQuestions(res.data); } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [api, selectedEval]);
  const fetchFonts = useCallback(async () => {
    try { const res = await api.get('/fonts'); setCustomFonts(res.data); } catch (e) { console.error(e); }
  }, [api]);

  useEffect(() => { fetchEvals(); fetchFonts(); }, [fetchEvals, fetchFonts]);
  useEffect(() => { if (selectedEval) { fetchSections(); fetchQuestions(); } }, [selectedEval, fetchSections, fetchQuestions]);

  // Inject @font-face CSS and Tiptap styles
  useEffect(() => {
    if (customFonts.length === 0) return;
    
    let style = document.getElementById('custom-fonts-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'custom-fonts-style';
      document.head.appendChild(style);
    }
    
    // Fetch fresh font URLs and create @font-face rules
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    const fontCss = customFonts.map(f => {
      const fontUrl = f.font_file_url.startsWith('http') ? f.font_file_url : `${backendUrl}${f.font_file_url}`;
      return `
        @font-face {
          font-family: '${f.font_name}';
          src: url('${fontUrl}') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: block;
        }
      `;
    }).join('\n');
    
    const tiptapCustomCss = `
      .ProseMirror { 
        min-height: 200px; 
        outline: none; 
        padding: 8px; 
      }
      .ProseMirror p { margin: 0.5em 0; }
      .ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; }
      .ProseMirror h1 { font-size: 2em; font-weight: bold; }
      .ProseMirror h2 { font-size: 1.5em; font-weight: bold; }
      .ProseMirror h3 { font-size: 1.17em; font-weight: bold; }
      
      /* Force custom fonts with maximum specificity */
      ${customFonts.map(f => `
        .ProseMirror *[style*="${f.font_name}"] {
          font-family: '${f.font_name}' !important;
        }
        div[style*="${f.font_name}"],
        p[style*="${f.font_name}"],
        span[style*="${f.font_name}"] {
          font-family: '${f.font_name}' !important;
        }
      `).join('\n')}
    `;
    
    style.textContent = fontCss + '\n' + tiptapCustomCss;
    
    // Log font loading for debugging
    customFonts.forEach(f => {
      console.log('Loading font:', f.font_name, 'from', f.font_file_url.substring(0, 100));
    });
  }, [customFonts]);
  
  // Refresh fonts every 60 seconds to get fresh URLs
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFonts();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchFonts]);
  
  // Save selected evaluation to shared store
  useEffect(() => {
    if (selectedEval) {
      evaluationStore.setSelectedEvaluation(parseInt(selectedEval, 10));
    }
  }, [selectedEval]);

  const handleSectionSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editSection) {
        await api.put(`/evaluations/${selectedEval}/sections/${editSection.section_id}`, sectionForm);
        toast.success('Section updated');
      } else {
        await api.post(`/evaluations/${selectedEval}/sections`, sectionForm);
        toast.success('Section created');
      }
      setShowSectionModal(false); setSectionForm({ section_name: '', target_question_count: 0, target_total_marks: 0, instructions: '' }); setEditSection(null);
      fetchSections();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const deleteSection = async (sid) => {
    if (!window.confirm('Delete this section?')) return;
    try { await api.delete(`/evaluations/${selectedEval}/sections/${sid}`); toast.success('Section deleted'); fetchSections(); } catch (e) { toast.error('Failed'); }
  };

  const initNewQuestion = () => {
    setEditQuestion(null);
    setQuestionForm({
      eval_id: parseInt(selectedEval), section_id: sections.length > 0 ? sections[0].section_id : null,
      question_type: 'SINGLE_SELECT', content_html: '', marks: 1, negative_marks: 0,
      time_limit_seconds: null, word_limit: null, penalty_logic_type: 'NONE',
      options: [
        { content_left: '', content_right: '', is_correct: false, display_sequence: 0 },
        { content_left: '', content_right: '', is_correct: false, display_sequence: 1 },
        { content_left: '', content_right: '', is_correct: false, display_sequence: 2 },
        { content_left: '', content_right: '', is_correct: false, display_sequence: 3 }
      ]
    });
    setShowQuestionModal(true);
  };

  const openEditQuestion = (q) => {
    setEditQuestion(q);
    setQuestionForm({
      eval_id: q.eval_id, section_id: q.section_id, question_type: q.question_type,
      content_html: q.content_html, marks: q.marks, negative_marks: q.negative_marks,
      time_limit_seconds: q.time_limit_seconds, word_limit: q.word_limit,
      penalty_logic_type: q.penalty_logic_type || 'NONE',
      options: q.options.map(o => ({ ...o }))
    });
    setShowQuestionModal(true);
  };

  const addOption = () => {
    setQuestionForm({ ...questionForm, options: [...questionForm.options, { content_left: '', content_right: '', is_correct: false, display_sequence: questionForm.options.length }] });
  };
  const removeOption = (idx) => {
    const newOpts = questionForm.options.filter((_, i) => i !== idx).map((o, i) => ({ ...o, display_sequence: i }));
    setQuestionForm({ ...questionForm, options: newOpts });
  };
  const updateOption = (idx, field, value) => {
    const newOpts = [...questionForm.options];
    newOpts[idx] = { ...newOpts[idx], [field]: value };
    if (field === 'is_correct' && questionForm.question_type === 'SINGLE_SELECT' && value) {
      newOpts.forEach((o, i) => { if (i !== idx) o.is_correct = false; });
    }
    setQuestionForm({ ...questionForm, options: newOpts });
  };

  const insertBlank = () => {
    if (editor) {
      editor.chain().focus().insertContent(' _blank_ ').run();
    } else {
      setQuestionForm({ ...questionForm, content_html: questionForm.content_html + ' _blank_ ' });
    }
  };

  // Font families for dropdown
  const fontFamilies = useMemo(() => [
    { label: 'Inter', value: 'Inter' },
    { label: 'Arial', value: 'Arial' },
    { label: 'Georgia', value: 'Georgia' },
    { label: 'Times New Roman', value: 'Times New Roman' },
    { label: 'Courier New', value: 'Courier New' },
    { label: 'Verdana', value: 'Verdana' },
    ...customFonts.map(f => ({ label: f.font_name, value: f.font_name }))
  ], [customFonts]);

  const applyFont = (font) => {
    setSelectedFont(font);
    if (editor) {
      // Apply font to current selection or entire editor
      editor.chain().focus().setFontFamily(font).run();
      
      // Also set the font on the editor container for fallback
      const editorElement = document.querySelector('.ProseMirror');
      if (editorElement) {
        editorElement.style.fontFamily = `'${font}'`;
      }
    }
  };

  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...questionForm, eval_id: parseInt(selectedEval) };
      if (editQuestion) {
        await api.put(`/questions/${editQuestion.question_id}`, payload);
        toast.success('Question updated');
      } else {
        await api.post('/questions', payload);
        toast.success('Question created');
      }
      setShowQuestionModal(false); fetchQuestions();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const deleteQuestion = async (qid) => {
    if (!window.confirm('Delete this question?')) return;
    try { await api.delete(`/questions/${qid}`); toast.success('Question deleted'); fetchQuestions(); } catch (e) { toast.error('Failed'); }
  };

  const handleAIGenerate = async () => {
    if (!aiForm.context.trim()) { toast.error('Please provide context'); return; }
    setAiLoading(true);
    try {
      const res = await api.post('/ai/generate', {
        eval_id: parseInt(selectedEval), section_id: sections.length > 0 ? sections[0].section_id : null,
        ...aiForm
      });
      setAiResults(res.data.questions);
      setAiSelected(new Set(res.data.questions.map((_, i) => i)));
      toast.success(`Generated ${res.data.count} questions!`);
    } catch (err) { toast.error(err.response?.data?.detail || 'AI generation failed'); } finally { setAiLoading(false); }
  };

  const saveAIQuestions = async () => {
    const selected = aiResults.filter((_, i) => aiSelected.has(i));
    if (selected.length === 0) { toast.error('No questions selected'); return; }
    if (!aiSelectedSection) { toast.error('Please select a section'); return; }
    try {
      const payload = selected.map(q => ({
        eval_id: parseInt(selectedEval),
        section_id: aiSelectedSection,
        question_type: q.question_type || 'SINGLE_SELECT',
        content_html: q.content_html || q.content || '',
        marks: q.marks || 1, negative_marks: q.negative_marks || 0,
        penalty_logic_type: q.penalty_logic_type || 'NONE',
        options: (q.options || []).map((o, i) => ({
          content_left: o.content_left || o.text || '', content_right: o.content_right || '',
          is_correct: o.is_correct || false, display_sequence: o.display_sequence || i
        }))
      }));
      await api.post('/questions/bulk', payload);
      toast.success(`Saved ${selected.length} questions to ${sections.find(s => s.section_id === aiSelectedSection)?.section_name}!`);
      setShowAIModal(false); setAiResults([]); fetchQuestions();
    } catch (err) { toast.error('Failed to save questions'); }
  };

  const getTypeLabel = (t) => QUESTION_TYPES.find(q => q.value === t)?.label || t;
  const getTypeIcon = (t) => QUESTION_TYPES.find(q => q.value === t)?.icon || '?';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk', color: 'hsl(210, 52%, 25%)' }}>Question Bank</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage sections and create questions with rich text</p>
        </div>
        <Select value={selectedEval} onValueChange={setSelectedEval}>
          <SelectTrigger className="w-[250px]"><SelectValue placeholder="Select Evaluation" /></SelectTrigger>
          <SelectContent>{evaluations.map(e => <SelectItem key={e.eval_id} value={String(e.eval_id)}>{e.eval_title}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {selectedEval && (
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { setEditSection(null); setSectionForm({ section_name: '', target_question_count: 0, target_total_marks: 0, instructions: '' }); setShowSectionModal(true); }}>
            <FolderOpen size={16} className="mr-2" />Manage Sections
          </Button>
          <Button onClick={initNewQuestion} style={{ background: 'hsl(210, 52%, 25%)' }}>
            <Plus size={16} className="mr-2" />Create Question
          </Button>
          <Button data-testid="question-bank-ai-generate-button" variant="outline" onClick={() => { setAiResults([]); setShowAIModal(true); }}
            className="border-purple-200 text-purple-700 hover:bg-purple-50">
            <Sparkles size={16} className="mr-2" />AI Question Bank
          </Button>
        </div>
      )}

      {/* Sections display */}
      {selectedEval && sections.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {sections.map(s => (
            <Badge key={s.section_id} variant="secondary" className="px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-100"
              onClick={() => { setEditSection(s); setSectionForm({ section_name: s.section_name, target_question_count: s.target_question_count, target_total_marks: s.target_total_marks, instructions: s.instructions || '' }); setShowSectionModal(true); }}>
              {s.section_name} ({s.target_question_count}Q / {s.target_total_marks}M)
            </Badge>
          ))}
        </div>
      )}

      {/* Questions List by Section */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-4 w-1/2" /></CardContent></Card>)}</div>
      ) : !selectedEval ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><p>Select an evaluation to manage questions</p></CardContent></Card>
      ) : questions.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><p>No questions yet. Create one or use AI to generate!</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(questionsBySection).map(([sectionId, data]) => {
            if (data.questions.length === 0) return null;
            const isOpen = openSections.has(sectionId);
            
            return (
              <Collapsible key={sectionId} open={isOpen} onOpenChange={() => toggleSection(sectionId)}>
                <Card className="border-2">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isOpen ? <ChevronDown size={20} /> : <ChevronUp size={20} className="rotate-180" />}
                          <div className="text-left">
                            <CardTitle className="text-lg">{data.section.section_name}</CardTitle>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{data.questions.length} Questions</Badge>
                              <Badge className="text-xs bg-emerald-50 text-emerald-700">{data.totalMarks} Marks</Badge>
                            </div>
                          </div>
                        </div>
                        {sectionId !== 'null' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setEditSection(data.section); 
                              setSectionForm({ 
                                section_name: data.section.section_name, 
                                target_question_count: data.section.target_question_count, 
                                target_total_marks: data.section.target_total_marks, 
                                instructions: data.section.instructions || '' 
                              }); 
                              setShowSectionModal(true); 
                            }}
                          >
                            <Edit2 size={14} className="mr-1" />Edit Section
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-3">
                      {data.questions.map((q, idx) => (
                        <Card key={q.question_id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                                style={{ background: 'hsl(204, 55%, 92%)', color: 'hsl(210, 52%, 25%)' }}>
                                {getTypeIcon(q.question_type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-sm font-medium">Q{idx + 1}</span>
                                  <Badge variant="outline" className="text-xs">{getTypeLabel(q.question_type)}</Badge>
                                  <Badge className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">{q.marks} marks</Badge>
                                  {q.negative_marks > 0 && <Badge className="text-xs bg-red-50 text-red-600 border-red-200">-{q.negative_marks}</Badge>}
                                  {q.penalty_logic_type && q.penalty_logic_type !== 'NONE' && <Badge variant="secondary" className="text-xs">Toggle {q.penalty_logic_type}</Badge>}
                                </div>
                                <div className="text-sm text-foreground" dangerouslySetInnerHTML={{ __html: q.content_html.substring(0, 200) + (q.content_html.length > 200 ? '...' : '') }} />
                                {expandedQ === q.question_id && q.options.length > 0 && (
                                  <div className="mt-3 space-y-1 pl-2 border-l-2 border-border">
                                    {q.options.map((o, oi) => (
                                      <div key={oi} className={`text-sm py-1 px-2 rounded ${o.is_correct ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-muted-foreground'}`}>
                                        {q.question_type === 'MATCHING' ? `${o.content_left} → ${o.content_right}` : o.content_left}
                                        {o.is_correct && ' ✓'}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setExpandedQ(expandedQ === q.question_id ? null : q.question_id)}>
                                  {expandedQ === q.question_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => openEditQuestion(q)}><Edit2 size={16} /></Button>
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteQuestion(q.question_id)}><Trash2 size={16} /></Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Section Modal */}
      <Dialog open={showSectionModal} onOpenChange={setShowSectionModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editSection ? 'Edit Section' : 'Create Section'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSectionSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Section Name</Label><Input value={sectionForm.section_name} onChange={e => setSectionForm({...sectionForm, section_name: e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Question Count Limit</Label><Input type="number" min="0" value={sectionForm.target_question_count} onChange={e => setSectionForm({...sectionForm, target_question_count: parseInt(e.target.value) || 0})} /></div>
              <div className="space-y-2"><Label>Max Marks Limit</Label><Input type="number" min="0" step="0.01" value={sectionForm.target_total_marks} onChange={e => setSectionForm({...sectionForm, target_total_marks: parseFloat(e.target.value) || 0})} /></div>
            </div>
            <div className="space-y-2"><Label>Instructions</Label><Textarea value={sectionForm.instructions} onChange={e => setSectionForm({...sectionForm, instructions: e.target.value})} /></div>
            <div className="flex justify-between">
              {editSection && <Button type="button" variant="destructive" size="sm" onClick={() => { deleteSection(editSection.section_id); setShowSectionModal(false); }}>Delete</Button>}
              <div className="flex gap-2 ml-auto"><Button type="button" variant="outline" onClick={() => setShowSectionModal(false)}>Cancel</Button><Button type="submit" style={{ background: 'hsl(210, 52%, 25%)' }}>Save</Button></div>
            </div>
          </form>
          {sections.length > 0 && <div className="border-t pt-4 mt-4"><h4 className="text-sm font-semibold mb-2">Existing Sections</h4><div className="space-y-1">{sections.map(s => (<div key={s.section_id} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm"><span>{s.section_name}</span><span className="text-muted-foreground">{s.target_question_count}Q / {s.target_total_marks}M</span></div>))}</div></div>}
        </DialogContent>
      </Dialog>

      {/* Question Modal with TinyMCE */}
      <Dialog open={showQuestionModal} onOpenChange={setShowQuestionModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle data-testid="question-type-select">{editQuestion ? 'Edit Question' : 'Create Question'}</DialogTitle></DialogHeader>
          <form onSubmit={handleQuestionSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Section</Label>
                <Select value={String(questionForm.section_id || '')} onValueChange={v => setQuestionForm({...questionForm, section_id: v ? parseInt(v) : null})}>
                  <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
                  <SelectContent>{sections.map(s => <SelectItem key={s.section_id} value={String(s.section_id)}>{s.section_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select value={questionForm.question_type} onValueChange={v => setQuestionForm({...questionForm, question_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Rich Text Editor with RTL/LTR + Insert Blank */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Question Content (Rich Text)</Label>
                <div className="flex items-center gap-2">
                  {questionForm.question_type === 'FILL_BLANK' && (
                    <Button type="button" size="sm" variant="outline" onClick={insertBlank} className="text-blue-600 border-blue-200">
                      <TextCursorInput size={14} className="mr-1" />Insert Blank
                    </Button>
                  )}
                  <Button type="button" size="sm" variant={direction === 'ltr' ? 'default' : 'outline'} onClick={() => setDirection('ltr')}>
                    <AlignLeft size={14} className="mr-1" />LTR
                  </Button>
                  <Button type="button" size="sm" variant={direction === 'rtl' ? 'default' : 'outline'} onClick={() => setDirection('rtl')}>
                    <AlignRight size={14} className="mr-1" />RTL
                  </Button>
                </div>
              </div>
              {/* Toolbar */}
              {editor && (
                <div className="border rounded-md p-2 flex flex-wrap gap-1 items-center" style={{ background: '#f5f5f5' }}>
                  <Select value={selectedFont} onValueChange={applyFont}>
                    <SelectTrigger className="w-[180px] h-8 text-xs" style={{ fontFamily: selectedFont }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontFamilies.map(font => (
                        <SelectItem 
                          key={font.value} 
                          value={font.value} 
                          style={{ fontFamily: `'${font.value}'`, fontSize: '14px', padding: '8px' }}
                        >
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  <Button type="button" size="sm" variant={editor.isActive('bold') ? 'default' : 'outline'} onClick={() => editor.chain().focus().toggleBold().run()}>
                    <Bold size={16} />
                  </Button>
                  <Button type="button" size="sm" variant={editor.isActive('italic') ? 'default' : 'outline'} onClick={() => editor.chain().focus().toggleItalic().run()}>
                    <Italic size={16} />
                  </Button>
                  <Button type="button" size="sm" variant={editor.isActive('underline') ? 'default' : 'outline'} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                    <UnderlineIcon size={16} />
                  </Button>
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  <Button type="button" size="sm" variant={editor.isActive('bulletList') ? 'default' : 'outline'} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                    <List size={16} />
                  </Button>
                  <Button type="button" size="sm" variant={editor.isActive('orderedList') ? 'default' : 'outline'} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                    <ListOrdered size={16} />
                  </Button>
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  <Button type="button" size="sm" variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'outline'} onClick={() => editor.chain().focus().setTextAlign('left').run()}>Left</Button>
                  <Button type="button" size="sm" variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'outline'} onClick={() => editor.chain().focus().setTextAlign('center').run()}>Center</Button>
                  <Button type="button" size="sm" variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'outline'} onClick={() => editor.chain().focus().setTextAlign('right').run()}>Right</Button>
                </div>
              )}
              {/* Editor */}
              <div 
                dir={direction} 
                className="border rounded-md p-3 min-h-[250px] bg-white" 
                style={{ 
                  direction: direction,
                  fontFamily: selectedFont ? `'${selectedFont}'` : 'Inter'
                }}
              >
                <EditorContent editor={editor} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2"><Label>Marks</Label><Input type="number" step="0.01" min="0" value={questionForm.marks} onChange={e => setQuestionForm({...questionForm, marks: parseFloat(e.target.value) || 0})} /></div>
              <div className="space-y-2"><Label>Negative Marks</Label><Input type="number" step="0.01" min="0" value={questionForm.negative_marks} onChange={e => setQuestionForm({...questionForm, negative_marks: parseFloat(e.target.value) || 0})} /></div>
              <div className="space-y-2"><Label>Time Limit (sec)</Label><Input type="number" min="0" value={questionForm.time_limit_seconds || ''} onChange={e => setQuestionForm({...questionForm, time_limit_seconds: parseInt(e.target.value) || null})} /></div>
              <div className="space-y-2">
                <Label>Penalty Logic</Label>
                <Select value={questionForm.penalty_logic_type} onValueChange={v => setQuestionForm({...questionForm, penalty_logic_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PENALTY_TYPES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Options */}
            {['SINGLE_SELECT', 'MULTIPLE_SELECT', 'FILL_BLANK', 'MATCHING', 'SEQUENCING', 'TOGGLE_BINARY'].includes(questionForm.question_type) && (
              <div className="space-y-3 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Options {direction === 'rtl' && <span className="text-xs text-muted-foreground">(RTL aligned)</span>}</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addOption}><Plus size={14} className="mr-1" />Add Option</Button>
                </div>
                {questionForm.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30" dir={direction}>
                    <GripVertical size={14} className="text-muted-foreground flex-shrink-0" />
                    <Input className="flex-1" placeholder={questionForm.question_type === 'TOGGLE_BINARY' ? 'Statement text' : 'Option text'}
                      value={opt.content_left || ''} onChange={e => updateOption(idx, 'content_left', e.target.value)} dir={direction} />
                    {questionForm.question_type === 'MATCHING' && (
                      <Input className="flex-1" placeholder="Match with..."
                        value={opt.content_right || ''} onChange={e => updateOption(idx, 'content_right', e.target.value)} dir={direction} />
                    )}
                    <div className="flex items-center gap-1.5">
                      <Switch checked={opt.is_correct} onCheckedChange={v => updateOption(idx, 'is_correct', v)} />
                      <span className="text-xs text-muted-foreground w-12">{opt.is_correct ? 'Correct' : 'Wrong'}</span>
                    </div>
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeOption(idx)}><X size={14} /></Button>
                  </div>
                ))}
              </div>
            )}
            {questionForm.question_type === 'SUBJECTIVE_TYPING' && (
              <div className="space-y-2"><Label>Word Limit</Label><Input type="number" value={questionForm.word_limit || ''} onChange={e => setQuestionForm({...questionForm, word_limit: parseInt(e.target.value) || null})} /></div>
            )}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowQuestionModal(false)}>Cancel</Button>
              <Button type="submit" data-testid="question-editor-save-button" style={{ background: 'hsl(210, 52%, 25%)' }}><Save size={16} className="mr-2" />Save Question</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* AI Generation Modal */}
      <Dialog open={showAIModal} onOpenChange={(open) => { setShowAIModal(open); if (!open) { setAiSelectedSection(null); setAiResults([]); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle><Sparkles size={20} className="inline mr-2 text-purple-600" />AI Question Generator</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Section <span className="text-red-500">*</span></Label>
              <Select value={aiSelectedSection ? String(aiSelectedSection) : ''} onValueChange={v => setAiSelectedSection(parseInt(v))}>
                <SelectTrigger data-testid="ai-section-select">
                  <SelectValue placeholder="Choose a section for generated questions" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map(s => (
                    <SelectItem key={s.section_id} value={String(s.section_id)}>
                      {s.section_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sections.length === 0 && (
                <p className="text-xs text-amber-600">No sections available. Create a section first.</p>
              )}
            </div>
            <Tabs defaultValue="text" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text">Text Input</TabsTrigger>
                <TabsTrigger value="file">File Upload</TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="space-y-4 pt-4">
                <div className="space-y-2"><Label>Context / Topic</Label><Textarea value={aiForm.context} onChange={e => setAiForm({...aiForm, context: e.target.value})} rows={5} placeholder="Enter the topic or content..." /></div>
              </TabsContent>
              <TabsContent value="file" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Upload Document</Label>
                  <Input type="file" accept=".txt,.pdf,.doc,.docx" onChange={e => setAiFile(e.target.files[0])} />
                  {aiFile && <p className="text-xs text-muted-foreground">Selected: {aiFile.name}</p>}
                </div>
              </TabsContent>
            </Tabs>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Question Type</Label>
                <Select value={aiForm.question_type} onValueChange={v => setAiForm({...aiForm, question_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{QUESTION_TYPES.slice(0, 6).map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Count</Label><Input type="number" min="1" max="20" value={aiForm.count} onChange={e => setAiForm({...aiForm, count: parseInt(e.target.value) || 5})} /></div>
              <div className="space-y-2"><Label>Difficulty</Label>
                <Select value={aiForm.difficulty} onValueChange={v => setAiForm({...aiForm, difficulty: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleAIGenerate} disabled={aiLoading || !aiSelectedSection} className="w-full" style={{ background: 'hsl(270, 60%, 50%)' }} data-testid="ai-generate-button">
              {aiLoading ? 'Generating...' : <><Sparkles size={16} className="mr-2" />Generate Questions</>}
            </Button>
          </div>
          {aiResults.length > 0 && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Generated Questions ({aiResults.length})</h4>
                <Button size="sm" onClick={saveAIQuestions} style={{ background: 'hsl(210, 52%, 25%)' }}><Save size={14} className="mr-1" />Save Selected ({aiSelected.size})</Button>
              </div>
              {aiResults.map((q, idx) => (
                <Card key={idx} className={`cursor-pointer transition-colors ${aiSelected.has(idx) ? 'border-blue-300 bg-blue-50/50' : 'hover:bg-muted/50'}`}
                  onClick={() => { const ns = new Set(aiSelected); ns.has(idx) ? ns.delete(idx) : ns.add(idx); setAiSelected(ns); }}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <input type="checkbox" checked={aiSelected.has(idx)} readOnly className="mt-1" />
                      <div className="flex-1">
                        <div className="text-sm" dangerouslySetInnerHTML={{ __html: q.content_html || q.content || '' }} />
                        {q.options && <div className="mt-2 space-y-1">{q.options.map((o, oi) => (
                          <div key={oi} className={`text-xs py-0.5 px-2 rounded ${o.is_correct ? 'bg-emerald-50 text-emerald-700' : 'text-muted-foreground'}`}>
                            {o.content_left || o.text} {o.is_correct && '✓'}
                          </div>
                        ))}</div>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
