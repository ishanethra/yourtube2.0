import * as React from "react"

const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>

const Tooltip = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative flex items-center group">
      {children}
    </div>
  )
}

const TooltipTrigger = ({ children, asChild }: { children: React.ReactNode, asChild?: boolean }) => {
  return <>{children}</>
}

const TooltipContent = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return (
    <div className={`
      absolute bottom-full left-1/2 -translate-x-1/2 mb-2 
      px-2 py-1 rounded shadow-xl 
      scale-0 group-hover:scale-100 
      transition-all duration-200 origin-bottom
      pointer-events-none z-[100]
      ${className}
    `}>
      {children}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
    </div>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
