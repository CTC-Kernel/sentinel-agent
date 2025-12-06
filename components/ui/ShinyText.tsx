import React from 'react';

interface ShinyTextProps {
    children: React.ReactNode;
    disabled?: boolean;
    speed?: number;
    className?: string;
}

export const ShinyText: React.FC<ShinyTextProps> = ({
    children,
    disabled = false,
    speed = 5,
    className = ''
}) => {
    const animationDuration = `${speed}s`;

    return (
        <div
            className={`text-[#b5b5b5a4] bg-clip-text inline-block ${disabled ? '' : 'animate-shine'} ${className}`}
            style={{
                backgroundImage: 'linear-gradient(120deg, rgba(255, 255, 255, 0) 40%, rgba(255, 255, 255, 0.8) 50%, rgba(255, 255, 255, 0) 60%)',
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                animationDuration: animationDuration,
            }}
        >
            {children}
        </div>
    );
};

/*
Add this to your globals.css or tailwind config for the animation to work properly if not doing inline styles for keyframes:

@keyframes shine {
  0% {
    background-position: 100%;
  }
  100% {
    background-position: -100%;
  }
}
*/
