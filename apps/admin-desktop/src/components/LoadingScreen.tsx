import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#EFF2F7] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1b4b8f]/50 mx-auto mb-3" />
        <p className="text-[#5B6A83] text-sm">Loading Lyne…</p>
      </div>
    </div>
  );
}
