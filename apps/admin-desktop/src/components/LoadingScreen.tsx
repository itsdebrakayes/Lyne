import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-white/40 mx-auto mb-3" />
        <p className="text-white/30 text-sm">Loading Q ME NOW…</p>
      </div>
    </div>
  );
}
