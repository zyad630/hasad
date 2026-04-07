import React, { useEffect, useState } from 'react';

const VEGGIES = [
  { icon: '🍅', color: 'rgba(239, 68, 68, 0.8)', name: 'طماطم' }, // Red
  { icon: '🥒', color: 'rgba(34, 197, 94, 0.8)', name: 'خيار' },  // Green
  { icon: '🥕', color: 'rgba(249, 115, 22, 0.8)', name: 'جزر' },  // Orange
  { icon: '🍆', color: 'rgba(168, 85, 247, 0.8)', name: 'باذنجان' }, // Purple
  { icon: '🍋', color: 'rgba(234, 179, 8, 0.8)', name: 'ليمون' }, // Yellow
  { icon: '🧅', color: 'rgba(217, 119, 6, 0.8)', name: 'بصل' },   // Amber
  { icon: '🥬', color: 'rgba(74, 222, 128, 0.8)', name: 'خس' },   // Light Green
  { icon: '🌶️', color: 'rgba(225, 29, 72, 0.8)', name: 'فلفل' },  // Rose/Red
];

interface VegetableLoaderProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullScreen?: boolean;
}

export const VegetableLoader: React.FC<VegetableLoaderProps> = ({ 
  text = 'جاري التحميل...', 
  size = 'md',
  fullScreen = false 
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % VEGGIES.length);
      setRotation((prev) => prev - (360 / VEGGIES.length));
    }, 450); // Rotate roughly every half second
    return () => clearInterval(interval);
  }, []);

  const sizeClass = {
    sm: 'text-2xl w-24 h-24',
    md: 'text-4xl w-32 h-32',
    lg: 'text-6xl w-48 h-48',
    xl: 'text-8xl w-64 h-64'
  }[size];

  // Base icon size mapping roughly
  const iconSizeClass = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl',
    xl: 'text-8xl'
  }[size];

  const content = (
    <div className="flex flex-col items-center justify-center space-y-6">
      <div className={`relative flex items-center justify-center ${sizeClass} transition-transform duration-700 ease-spring`} style={{ transform: `rotate(${rotation}deg)` }}>
        {VEGGIES.map((veggie, idx) => {
          // Calculate angle for circular positioning
          const angle = (idx * 360) / VEGGIES.length;
          const isActive = idx === activeIndex;
          const isNext = idx === (activeIndex + 1) % VEGGIES.length;
          const isPrev = idx === (activeIndex - 1 + VEGGIES.length) % VEGGIES.length;
          
          let scale = 0.8;
          let opacity = 1; // Always fully opaque and colorful!
          let zIndex = 1;
          let yOffset = '-30px';

          if (isActive) { scale = 2.0; zIndex = 10; yOffset = '-50px'; }
          else if (isNext || isPrev) { scale = 1.1; zIndex = 5; yOffset = '-35px'; }

          return (
             <div
               key={veggie.name}
               className={`absolute transition-all duration-500 ease-spring ${iconSizeClass}`}
               style={{
                 transform: `rotate(${angle}deg) translateY(${yOffset}) rotate(-${angle + rotation}deg) scale(${scale})`,
                 opacity: opacity,
                 zIndex: zIndex,
                 fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
                 color: 'initial',
                 filter: isActive ? `drop-shadow(0px 15px 25px ${veggie.color}) drop-shadow(0 0 10px ${veggie.color}) saturate(2)` : 'drop-shadow(0 5px 5px rgba(0,0,0,0.1)) saturate(1)',
               }}
             >
               {veggie.icon}
             </div>
          );
        })}
        {/* Center element - Basket */}
        <div 
          className={`absolute z-0 transition-transform duration-700 ease-spring ${iconSizeClass}`} 
          style={{ 
             transform: `rotate(${-rotation}deg) scale(1.3)`, 
             fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
             color: 'initial',
             filter: `drop-shadow(0 20px 20px rgba(0,0,0,0.15))` 
          }}
        >
          🧺
        </div>
      </div>
      
      {text && (
        <div className="mt-8 relative">
           <div className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-lime-500 animate-pulse font-cairo tracking-wide">
             {text}
           </div>
           {/* Subtle reflection below text */}
           <div className="absolute top-full left-0 right-0 text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600/30 to-lime-500/30 blur-[2px] transform -scale-y-100 opacity-50 font-cairo tracking-wide">
             {text}
           </div>
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      {content}
    </div>
  );
};
