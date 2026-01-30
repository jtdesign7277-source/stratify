/**
 * Premium Button Example 2
 * Multiple button styles with micro-animations
 */

// Primary button with glow
export function PrimaryButton({ children, onClick, loading, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="group relative px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {/* Glow layer */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl blur-md opacity-50 group-hover:opacity-75 transition-opacity duration-300 group-disabled:opacity-25" />
      
      {/* Button surface */}
      <div className="relative bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl px-6 py-3 flex items-center justify-center gap-2 transition-all duration-200 group-hover:from-blue-500 group-hover:to-blue-400 group-active:scale-[0.98]">
        {loading ? (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <span className="text-white font-semibold tracking-wide">{children}</span>
        )}
      </div>
    </button>
  );
}

// Ghost button with border glow
export function GhostButton({ children, onClick, icon }) {
  return (
    <button
      onClick={onClick}
      className="group relative px-5 py-2.5 rounded-xl border border-[#3c4043] bg-transparent hover:bg-white/5 transition-all duration-200"
    >
      {/* Hover glow */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative flex items-center gap-2">
        {icon && <span className="text-gray-400 group-hover:text-blue-400 transition-colors duration-200">{icon}</span>}
        <span className="text-gray-300 group-hover:text-white font-medium transition-colors duration-200">{children}</span>
      </div>
    </button>
  );
}

// Icon button with pulse effect
export function IconButton({ icon, onClick, active, badge }) {
  return (
    <button
      onClick={onClick}
      className={`group relative p-3 rounded-xl transition-all duration-200 ${
        active 
          ? 'bg-blue-500/10 border border-blue-500/30' 
          : 'bg-[#1e1f22] border border-[#2a2b2e] hover:border-[#3c4043]'
      }`}
    >
      {/* Active glow */}
      {active && (
        <div className="absolute inset-0 rounded-xl bg-blue-500/10 blur-md" />
      )}
      
      <div className={`relative transition-colors duration-200 ${
        active ? 'text-blue-400' : 'text-gray-400 group-hover:text-white'
      }`}>
        {icon}
      </div>
      
      {/* Badge */}
      {badge && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-red-500/30">
          {badge}
        </div>
      )}
    </button>
  );
}

// Success action button
export function SuccessButton({ children, onClick, completed }) {
  return (
    <button
      onClick={onClick}
      className={`group relative px-5 py-2.5 rounded-xl transition-all duration-300 ${
        completed
          ? 'bg-emerald-500/10 border border-emerald-500/30'
          : 'bg-gradient-to-r from-emerald-600/10 to-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40'
      }`}
    >
      <div className="flex items-center gap-2">
        {completed ? (
          <>
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-emerald-400 font-medium">Complete</span>
          </>
        ) : (
          <>
            <span className="text-emerald-400 font-medium group-hover:text-emerald-300 transition-colors">{children}</span>
            <svg className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </>
        )}
      </div>
    </button>
  );
}
