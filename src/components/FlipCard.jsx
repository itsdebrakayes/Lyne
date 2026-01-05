import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Phone, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBranches } from '@/hooks/useBranches';

export const FlipCard = ({ organization, onFlipChange }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [isHovering, setIsHovering] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef(null);
  const navigate = useNavigate();
  const { data: branches } = useBranches(organization.id);

  const primaryColor = organization.primary_color || '#3B82F6';
  const hasSingleBranch = branches?.length === 1;
  const hasMultipleBranches = branches?.length > 1;

  // Notify parent when flip state changes
  useEffect(() => {
    onFlipChange?.(isFlipped);
  }, [isFlipped, onFlipChange]);

  // Click outside listener to flip back
  useEffect(() => {
    if (!isFlipped) return;

    const handleClickOutside = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        setIsFlipped(false);
        setSelectedBranch(null);
      }
    };

    // Delay adding listener to prevent immediate trigger
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isFlipped]);

  const handleMouseMove = (e) => {
    if (!cardRef.current || isFlipped) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = (y - centerY) / 20;
    const rotateY = (centerX - x) / 20;
    
    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
  };

  const handleCardClick = (e) => {
    // Only flip from front to back
    if (!isFlipped) {
      e.stopPropagation();
      setIsFlipped(true);
    }
    // When on back side, don't flip - let buttons and scroll work
  };

  const handleNavigate = (e) => {
    e.stopPropagation();
    navigate(`/client/${organization.slug}`);
  };

  const handleBranchSelect = (e, branch) => {
    e.stopPropagation();
    setSelectedBranch(branch.id === selectedBranch?.id ? null : branch);
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const branch = hasSingleBranch ? branches[0] : selectedBranch;

  return (
    <div
      ref={cardRef}
      className="relative w-[280px] h-[380px] cursor-pointer flex-shrink-0"
      style={{ perspective: '1000px' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Static glow behind the card */}
      <div 
        className="absolute inset-0 rounded-3xl pointer-events-none transition-opacity duration-500"
        style={{
          background: `radial-gradient(ellipse 80% 80% at 50% 50%, ${primaryColor}30 0%, ${primaryColor}15 40%, transparent 70%)`,
          filter: 'blur(30px)',
          transform: 'scale(1.2)',
          zIndex: 0,
          opacity: isHovering || isFlipped ? 1 : 0.6,
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
        {/* Front Face */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          <div className="w-full h-full glass rounded-2xl p-6 flex flex-col items-center justify-between border border-white/20 dark:border-white/10">
            {/* Logo */}
            <div className="flex-1 flex items-center justify-center">
              {organization.logo_url ? (
                <img
                  src={organization.logo_url}
                  alt={organization.name}
                  className="w-28 h-28 object-contain drop-shadow-lg"
                />
              ) : (
                <div
                  className="w-28 h-28 rounded-2xl flex items-center justify-center text-4xl font-bold text-white shadow-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  {organization.name.charAt(0)}
                </div>
              )}
            </div>

            {/* Name and description */}
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-foreground">
                {organization.name}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {organization.description}
              </p>
            </div>

            {/* Tap indicator */}
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Tap for more info
            </div>
          </div>
        </div>

        {/* Back Face */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="w-full h-full glass rounded-2xl p-5 flex flex-col border border-white/20 dark:border-white/10">
            {/* Header with logo and name */}
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/50">
              {organization.logo_url ? (
                <img
                  src={organization.logo_url}
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
                // Single branch - show details directly
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
                // Multiple branches - show list
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

                  {/* Selected branch details */}
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
