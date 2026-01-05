import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export const FlipCard = ({ organization, className }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const cardRef = useRef(null);
  const rafRef = useRef(null);
  const navigate = useNavigate();

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return;
    
    // Cancel any pending animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = requestAnimationFrame(() => {
      const rect = cardRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // More responsive tilt calculation
      const rotateX = ((e.clientY - centerY) / (rect.height / 2)) * -15;
      const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 15;
      
      setTilt({ rotateX, rotateY });
    });
  }, []);

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setTilt({ rotateX: 0, rotateY: 0 });
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  };

  const handleClick = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNavigate = (e) => {
    e.stopPropagation();
    navigate(`/client/${organization.slug}`);
  };

  // Use organization's primary color or default
  const primaryColor = organization.primary_color || '#3b82f6';
  
  // Calculate glow color with opacity
  const glowColor = `${primaryColor}60`;
  const glowColorStrong = `${primaryColor}80`;

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative w-[280px] h-[380px] flex-shrink-0 cursor-pointer",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{ 
        perspective: '1000px',
        transformStyle: 'preserve-3d'
      }}
    >
      {/* Glow effect behind card */}
      <div
        className="absolute inset-4 rounded-2xl blur-2xl transition-all duration-300"
        style={{
          background: `radial-gradient(ellipse at center, ${glowColorStrong} 0%, ${glowColor} 40%, transparent 70%)`,
          opacity: isHovering ? 1 : 0.6,
          transform: `scale(${isHovering ? 1.1 : 1})`,
        }}
      />
      
      <div
        className="relative w-full h-full transition-transform duration-100 ease-out"
        style={{
          transform: `rotateX(${tilt.rotateX}deg) rotateY(${isFlipped ? 180 + tilt.rotateY : tilt.rotateY}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Front Side */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {/* Background texture/pattern */}
          <div 
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse at 30% 20%, ${primaryColor}40 0%, transparent 50%),
                radial-gradient(ellipse at 70% 80%, ${primaryColor}30 0%, transparent 50%),
                linear-gradient(180deg, ${primaryColor}15 0%, transparent 40%),
                radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 100%)
              `,
              backgroundColor: 'hsl(var(--card))',
            }}
          />
          
          {/* Noise texture overlay */}
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
          
          {/* Glass border effect */}
          <div 
            className="absolute inset-0 rounded-2xl"
            style={{
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
            }}
          />
          
          {/* Content */}
          <div className="relative h-full flex flex-col p-6 z-10">
            {/* Badge */}
            <div 
              className="self-start px-3 py-1.5 rounded-lg text-xs font-semibold text-white mb-4"
              style={{ 
                backgroundColor: primaryColor,
                boxShadow: `0 0 20px ${glowColor}`,
              }}
            >
              OPEN
            </div>
            
            {/* Logo/Avatar */}
            <div className="flex-1 flex items-center justify-center">
              {organization.logo_url ? (
                <img
                  src={organization.logo_url}
                  alt={organization.name}
                  className="w-24 h-24 object-contain drop-shadow-lg"
                />
              ) : (
                <div 
                  className="w-20 h-20 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
                  style={{ 
                    backgroundColor: primaryColor,
                    boxShadow: `0 8px 30px ${glowColor}`,
                  }}
                >
                  {organization.name.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            
            {/* Title & Description */}
            <div className="mt-auto">
              <h3 className="text-xl font-bold text-foreground mb-2">
                {organization.name}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {organization.description || `Join ${organization.name}'s queue and skip the wait.`}
              </p>
            </div>
            
            {/* See More link */}
            <div 
              className="mt-4 text-sm font-semibold flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
              style={{ color: primaryColor }}
            >
              TAP TO FLIP
            </div>
          </div>
        </div>

        {/* Back Side */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={{
            transform: 'rotateY(180deg)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {/* Top section with brand color */}
          <div
            className="h-2/5 flex items-center justify-center p-6"
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`,
            }}
          >
            {organization.logo_url ? (
              <img
                src={organization.logo_url}
                alt={organization.name}
                className="w-16 h-16 object-contain drop-shadow-lg"
              />
            ) : (
              <h3 className="text-2xl font-bold text-white text-center">
                {organization.name}
              </h3>
            )}
          </div>
          
          {/* Bottom glassmorphic section */}
          <div 
            className="h-3/5 p-5 flex flex-col justify-between"
            style={{
              background: 'hsl(var(--card))',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div>
              <h4 className="text-lg font-bold text-foreground mb-2">
                {organization.name}
              </h4>
              <p className="text-sm text-muted-foreground line-clamp-4">
                {organization.description || `Visit ${organization.name} to join their queue and get served faster. Skip the physical line and track your position in real-time.`}
              </p>
            </div>
            
            <button
              onClick={handleNavigate}
              className="self-end p-3 rounded-full text-white transition-all duration-200 hover:scale-110 hover:shadow-lg"
              style={{ 
                backgroundColor: primaryColor,
                boxShadow: `0 4px 20px ${glowColor}`,
              }}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
