import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <div
      className={`relative flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-900 overflow-x-hidden transition-bg ${className}`}
      {...props}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={`
            [--white-gradient:repeating-linear-gradient(100deg,var(--slate-50)_0%,var(--slate-50)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--slate-50)_16%)]
            [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)]
            [--aurora:repeating-linear-gradient(100deg,var(--blue-600)_10%,var(--indigo-500)_15%,var(--blue-500)_20%,var(--violet-500)_25%,var(--blue-600)_30%)]
            [background-image:var(--white-gradient),var(--aurora)]
            dark:[background-image:var(--dark-gradient),var(--aurora)]
            [background-size:300%,_200%]
            [background-position:50%_50%,50%_50%]
            filter blur-[10px] invert dark:invert-0
            after:content-[""] after:absolute after:inset-0 after:[background-image:var(--white-gradient),var(--aurora)] 
            after:dark:[background-image:var(--dark-gradient),var(--aurora)]
            after:[background-size:200%,_100%] 
            after:animate-aurora after:[background-attachment:fixed] after:mix-blend-difference
            pointer-events-none
            absolute -inset-[10px] opacity-50 dark:opacity-50 will-change-transform ${showRadialGradient ? '[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]' : ''}`
          }
        ></div>
      </div>
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
};

/*
Add this to tailwind.config.ts:
  
  extend: {
    animation: {
      aurora: "aurora 60s linear infinite",
    },
    keyframes: {
      aurora: {
        from: {
          backgroundPosition: "50% 50%, 50% 50%",
        },
        to: {
          backgroundPosition: "350% 50%, 350% 50%",
        },
      },
    }
  }
*/
