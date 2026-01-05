import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Phone, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBranches } from '@/hooks/useBranches';
import type { Tables } from '@/integrations/supabase/types';

// Import logos as ES6 modules
import picaLogo from '@/assets/logos/pica-logo.png';
import nhtLogo from '@/assets/logos/nht-logo.png';
import tajLogo from '@/assets/logos/taj-logo.png';

type Organization = Tables<'organizations'>;
type Branch = Tables<'branches'>;

// Map slug to imported logo
const logoMap: Record<string, string> = {
  'pica': picaLogo,
  'nht': nhtLogo,
  'taj': tajLogo,
};

interface FlipCardProps {
  organization: Organization;
  onFlipChange?: (isFlipped: boolean) => void;
}

// Gradient presets for cards (like the Disney characters reference)
const gradientPresets = [
  'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)', // Red
  'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)', // Blue
  'linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)', // Green
  'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)', // Orange
  'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)', // Purple
  'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)', // Cyan
  'linear-gradient(135deg, #ec4899 0%, #db2777 50%, #be185d 100%)', // Pink
];

export const FlipCard = ({ organization, onFlipChange }: FlipCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data: branches } = useBranches(organization.id);

  const primaryColor = organization.primary_color || '#3B82F6';
  const hasSingleBranch = branches?.length === 1;
  const hasMultipleBranches = (branches?.length || 0) > 1;

  // Get logo from logoMap using slug, fallback to logo_url or initial
  const logoSrc = logoMap[organization.slug] || organization.logo_url;

  // Get a consistent gradient based on org id
  const gradientIndex = organization.id.charCodeAt(0) % gradientPresets.length;
  const cardGradient = gradientPresets[gradientIndex];

  // Notify parent when flip state changes
  useEffect(() => {
    onFlipChange?.(isFlipped);
  }, [isFlipped, onFlipChange]);

  // Click outside listener to flip back
  useEffect(() => {
    if (!isFlipped) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsFlipped(false);
        setSelectedBranch(null);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isFlipped]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Stronger tilt for more 3D effect
    const rotateX = ((y - centerY) / centerY) * 15;
    const rotateY = ((centerX - x) / centerX) * 15;
    
    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (!isFlipped) {
      e.stopPropagation();
      setIsFlipped(true);
    }
  };

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/client/${organization.slug}`);
  };

  const handleBranchSelect = (e: React.MouseEvent, branch: Branch) => {
    e.stopPropagation();
    setSelectedBranch(branch.id === selectedBranch?.id ? null : branch);
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const branch = hasSingleBranch ? branches?.[0] : selectedBranch;

  return (
    <div
      ref={cardRef}
      className="relative w-[280px] h-[380px] cursor-pointer flex-shrink-0"
      style={{ perspective: '1200px' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Backlit Glow - always visible, intensifies on hover */}
      <div 
        className="absolute inset-0 rounded-3xl pointer-events-none transition-all duration-500"
        style={{
          background: `radial-gradient(ellipse 100% 100% at 50% 100%, ${primaryColor}50 0%, ${primaryColor}25 30%, transparent 70%)`,
          filter: 'blur(40px)',
          transform: 'scale(1.3) translateY(20%)',
          zIndex: 0,
          opacity: isHovering ? 1 : 0.7,
        }}
      />
      
      {/* Secondary glow for more dramatic effect */}
      <div 
        className="absolute inset-0 rounded-3xl pointer-events-none transition-all duration-500"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${primaryColor}40 0%, transparent 60%)`,
          filter: 'blur(25px)',
          transform: 'scale(1.1)',
          zIndex: 0,
          opacity: isHovering ? 0.8 : 0.4,
        }}
      />

      {/* Card container with 3D transform */}
      <div
        className="relative w-full h-full transition-all duration-700 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped
            ? 'rotateY(180deg)'
            : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        }}
        onClick={handleCardClick}
      >
        {/* Front Face - Full gradient card like Disney reference */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {/* Gradient background covering the whole card */}
          <div 
            className="absolute inset-0"
            style={{ background: cardGradient }}
          />
          
          {/* Subtle overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/10" />
          
          {/* Content container */}
          <div className="relative w-full h-full p-6 flex flex-col items-center justify-end">
            {/* Logo - positioned to "pop" above the card like 3D characters */}
            <div 
              className="absolute top-6 left-1/2 -translate-x-1/2 transition-transform duration-300"
              style={{
                transform: `translateX(-50%) translateZ(60px) scale(${isHovering ? 1.1 : 1})`,
                filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.4))',
              }}
            >
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={organization.name}
                  className="w-32 h-32 object-contain"
                />
              ) : (
                <div
                  className="w-28 h-28 rounded-2xl flex items-center justify-center text-5xl font-bold text-white shadow-2xl"
                  style={{ 
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(10px)',
                    border: '2px solid rgba(255,255,255,0.3)',
                  }}
                >
                  {organization.name.charAt(0)}
                </div>
              )}
            </div>

            {/* Name and description at the bottom */}
            <div className="text-center space-y-2 mt-auto pb-4">
              <h3 className="text-2xl font-bold text-white drop-shadow-lg">
                {organization.name}
              </h3>
              <p className="text-sm text-white/80 line-clamp-2 drop-shadow">
                {organization.description}
              </p>
            </div>

            {/* Tap indicator */}
            <div className="flex items-center gap-2 text-xs text-white/70">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Tap for more info
            </div>
          </div>
        </div>

        {/* Back Face */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="w-full h-full glass rounded-2xl p-5 flex flex-col border border-white/20 dark:border-white/10">
            {/* Header with logo and name */}
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/50">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={organization.name}
                  className="w-10 h-10 object-contain"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  {organization.name.charAt(0)}
                </div>
              )}
              <h3 className="text-lg font-bold text-foreground">
                {organization.name}
              </h3>
            </div>

            {/* Location info */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {hasSingleBranch && branch ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">{branch.address}</span>
                  </div>
                  {(branch.opening_time || branch.closing_time) && (
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">
                        {formatTime(branch.opening_time)} - {formatTime(branch.closing_time)}
                      </span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">{branch.phone}</span>
                    </div>
                  )}
                </div>
              ) : hasMultipleBranches ? (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <p className="text-xs text-muted-foreground mb-2">Select a location:</p>
                  <div 
                    className="flex-1 overflow-y-auto space-y-2 pr-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {branches?.map((b) => (
                      <button
                        key={b.id}
                        onClick={(e) => handleBranchSelect(e, b)}
                        className={`w-full text-left p-2.5 rounded-lg transition-all border ${
                          selectedBranch?.id === b.id
                            ? 'bg-primary/10 border-primary/50'
                            : 'bg-muted/30 border-transparent hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm text-foreground">{b.name}</span>
                          {selectedBranch?.id === b.id && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {b.address}
                        </p>
                      </button>
                    ))}
                  </div>

                  {selectedBranch && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                      {(selectedBranch.opening_time || selectedBranch.closing_time) && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          {formatTime(selectedBranch.opening_time)} - {formatTime(selectedBranch.closing_time)}
                        </div>
                      )}
                      {selectedBranch.phone && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="w-3.5 h-3.5" />
                          {selectedBranch.phone}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No locations available</p>
              )}
            </div>

            {/* Action button */}
            <Button
              onClick={handleNavigate}
              className="w-full mt-4 group"
              style={{ 
                backgroundColor: hasMultipleBranches && !selectedBranch ? undefined : primaryColor,
              }}
              variant={hasMultipleBranches && !selectedBranch ? "outline" : "default"}
              disabled={hasMultipleBranches && !selectedBranch}
            >
              {hasMultipleBranches && !selectedBranch ? 'Select a Branch' : 'View Services'}
              <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlipCard;
