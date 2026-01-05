import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export const FlipCard = ({ organization, className }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const cardRef = useRef(null);
  const navigate = useNavigate();

  const handleMouseMove = (e) => {
    if (!cardRef.current || isFlipped) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const rotateX = ((e.clientY - centerY) / (rect.height / 2)) * -10;
    const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 10;
    
    setTilt({ rotateX, rotateY });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0 });
  };

  const handleClick = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNavigate = (e) => {
    e.stopPropagation();
    navigate(`/client/${organization.slug}`);
  };

  const primaryColor = organization.primary_color || 'hsl(var(--primary))';

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative w-full h-72 cursor-pointer perspective-1000",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{ perspective: '1000px' }}
    >
      <div
        className="relative w-full h-full transition-all duration-500 preserve-3d"
        style={{
          transform: `rotateX(${tilt.rotateX}deg) rotateY(${isFlipped ? 180 + tilt.rotateY : tilt.rotateY}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Front Side */}
        <div
          className="absolute inset-0 rounded-2xl backface-hidden flex flex-col items-center justify-center p-6 shadow-xl"
          style={{
            backgroundColor: primaryColor,
            backfaceVisibility: 'hidden',
            boxShadow: `0 0 40px ${primaryColor}40`,
          }}
        >
          {organization.logo_url ? (
            <img
              src={organization.logo_url}
              alt={organization.name}
              className="w-24 h-24 object-contain mb-4"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-4">
              <span className="text-4xl font-bold text-white">
                {organization.name.substring(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <h3 className="text-2xl font-bold text-white text-center">
            {organization.name}
          </h3>
        </div>

        {/* Back Side */}
        <div
          className="absolute inset-0 rounded-2xl backface-hidden overflow-hidden"
          style={{
            transform: 'rotateY(180deg)',
            backfaceVisibility: 'hidden',
          }}
        >
          {/* Top brand color section */}
          <div
            className="h-1/3 flex items-center justify-center"
            style={{ backgroundColor: primaryColor }}
          >
            <h3 className="text-xl font-bold text-white">
              {organization.name}
            </h3>
          </div>
          
          {/* Bottom glassmorphic section */}
          <div className="h-2/3 bg-card/90 backdrop-blur-xl p-4 flex flex-col justify-between border-t border-border/20">
            <p className="text-sm text-muted-foreground line-clamp-3">
              {organization.description || `Visit ${organization.name} to join their queue and get served faster.`}
            </p>
            
            <button
              onClick={handleNavigate}
              className="self-end p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
