import { Radar } from 'lucide-react';

export default function MarketIntelligence() {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center bg-[#0a0a0f] text-gray-400">
      <Radar className="mb-4 h-12 w-12 text-emerald-400/60" strokeWidth={1.2} />
      <h2 className="text-lg font-semibold text-white">Radar</h2>
      <p className="mt-2 text-sm text-gray-500">Market intelligence coming soon.</p>
    </div>
  );
}
