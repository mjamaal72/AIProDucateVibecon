import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Type, Upload, Trash2, Plus } from 'lucide-react';

export default function FontManager() {
  const { api } = useAuth();
  const [fonts, setFonts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fontName, setFontName] = useState('');
  const [fontFile, setFontFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fetchFonts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/fonts');
      setFonts(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { fetchFonts(); }, [fetchFonts]);

  const handleUpload = async () => {
    if (!fontName.trim() || !fontFile) {
      toast.error('Please provide a font name and file');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('font_name', fontName);
      formData.append('file', fontFile);
      await api.post('/fonts', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Font "${fontName}" registered!`);
      setFontName('');
      setFontFile(null);
      fetchFonts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally { setUploading(false); }
  };

  const deleteFont = async (fontId, name) => {
    if (!window.confirm(`Delete font "${name}"?`)) return;
    try {
      await api.delete(`/fonts/${fontId}`);
      toast.success(`Font "${name}" deleted`);
      fetchFonts();
    } catch (err) { toast.error('Delete failed'); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk', color: 'hsl(210, 52%, 25%)' }}>Font Manager</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload and manage custom fonts for questions and exams</p>
      </div>

      {/* Upload Form */}
      <Card>
        <CardHeader><CardTitle className="text-base"><Upload size={18} className="inline mr-2" />Upload New Font</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label>Font Name (as it will appear in the editor)</Label>
              <Input placeholder="e.g., Arabic Naskh, Devanagari, Custom Serif" value={fontName} onChange={e => setFontName(e.target.value)} />
            </div>
            <div className="flex-1 space-y-2">
              <Label>Font File (.ttf, .otf, .woff, .woff2)</Label>
              <Input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={e => setFontFile(e.target.files?.[0] || null)} />
            </div>
            <Button onClick={handleUpload} disabled={uploading} style={{ background: 'hsl(210, 52%, 25%)' }}>
              <Plus size={16} className="mr-2" />{uploading ? 'Uploading...' : 'Register Font'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Font List */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : fonts.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <Type size={48} className="mx-auto mb-4 opacity-30" />
          <p>No custom fonts registered yet. Upload a font to get started.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {fonts.map(f => (
            <Card key={f.font_id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-base">{f.font_name}</h3>
                    <Badge variant="secondary" className="text-xs mt-1">{f.font_format}</Badge>
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteFont(f.font_id, f.font_name)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
                <div className="mt-3 p-3 rounded-lg bg-muted/50 text-center">
                  <p style={{ fontFamily: f.font_name, fontSize: '1.25rem' }}>The quick brown fox jumps over the lazy dog</p>
                  <p style={{ fontFamily: f.font_name, fontSize: '1rem' }} dir="rtl">بسم الله الرحمن الرحيم</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Registered: {new Date(f.created_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
