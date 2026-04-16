import { Card, CardContent } from '@/components/ui/card';
import { PenTool } from 'lucide-react';

export default function ManualCorrection() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk', color: 'hsl(210, 52%, 25%)' }}>Manual Correction</h1>
        <p className="text-sm text-muted-foreground mt-1">Distribute subjective answers to examiners for grading</p>
      </div>
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <PenTool size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Manual Correction Module</p>
          <p className="text-sm mt-2">This module will be available in Phase 4. It includes:</p>
          <ul className="text-sm mt-3 space-y-1">
            <li>Examiner allocation with round-robin distribution</li>
            <li>Workload transfer between examiners</li>
            <li>Manual scoring with remarks</li>
            <li>File attachment viewing and downloading</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
