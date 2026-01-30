/**
 * Premium Card Example 1
 * Glass morphism card with glow effects
 */

export default function PremiumCard({ title, subtitle, value, change, icon }) {
  const isPositive = change >= 0;
  
  return (
    <div className="group relative">
      {/* Glow effect on hover */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Card */}
      <div className="relative bg-gradient-to-br from-[#18191b] to-[#0f1011] border border-[#2a2b2e] rounded-2xl p-6 transition-all duration-300 hover:border-[#3c4043] hover:translate-y-[-2px]">
        
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-sm font-medium text-gray-400 tracking-wide uppercase">{title}</h3>
            {subtitle && <p className="text-xs text-gray-600 mt-1">{subtitle}</p>}
          </div>
          
          {/* Icon with glow */}
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-md" />
            <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl flex items-center justify-center border border-blue-500/20">
              {icon}
            </div>
          </div>
        </div>
        
        {/* Value */}
        <div className="mb-4">
          <span className="text-4xl font-bold text-white tracking-tight">{value}</span>
        </div>
        
        {/* Change indicator */}
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          isPositive 
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          <svg className={`w-3 h-3 ${isPositive ? '' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          <span>{isPositive ? '+' : ''}{change}%</span>
        </div>
        
        {/* Subtle bottom gradient line */}
        <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
    </div>
  );
}
