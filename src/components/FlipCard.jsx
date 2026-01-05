import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Phone, ChevronRight } from 'lucide-react';
import { useBranches } from '@/hooks/useBranches';

export const FlipCard = ({ organization }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const cardRef = useRef(null);
  const navigate = useNavigate();
  
  const { data: branches = [] } = useBranches(organization?.id);
  const hasSingleBranch = branches.length === 1;
  const mainBranch = branches.find(b => b.is_main_branch) || branches[0];

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calculate tilt (inverted for natural feel)
    const tiltX = ((y - centerY) / centerY) * -12;
    const tiltY = ((x - centerX) / centerX) * 12;
    
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseEnter = () => setIsHovering(true);
  
  const handleMouseLeave = () => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
  };

  const handleCardClick = (e) => {
    // Don't flip if clicking a button
    if (e.target.closest('[data-navigate-btn]') || e.target.closest('[data-branch-btn]')) {
      return;
    }
    setIsFlipped(!isFlipped);
  };

  const handleNavigate = (e) => {
    e.stopPropagation();
    navigate(`/client/${organization.slug}`);
  };

  const handleBranchSelect = (branch, e) => {
    e.stopPropagation();
    setSelectedBranch(branch);
  };

  const primaryColor = organization?.primary_color || '#3B82F6';

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <div 
      className="relative w-[280px] h-[380px] flex-shrink-0"
      style={{ perspective: '1500px' }}
    >
      {/* Glow effect - sits completely behind the card */}
      <div 
        className="absolute inset-0 rounded-3xl transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${primaryColor}60 0%, ${primaryColor}30 40%, transparent 70%)`,
          filter: 'blur(40px)',
          transform: 'translateZ(-100px) scale(1.2)',
          opacity: isHovering ? 0.9 : 0.6,
          zIndex: 0,
        }}
      />
      
      {/* Card container */}
      <div
        ref={cardRef}
        className="relative w-full h-full cursor-pointer"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${isHovering ? tilt.x : 0}deg) rotateY(${isFlipped ? 180 + (isHovering ? tilt.y : 0) : (isHovering ? tilt.y : 0)}deg)`,
          transition: isHovering ? 'transform 0.1s ease-out' : 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleCardClick}
      >
        {/* Front Face */}
        <div
          className="absolute inset-0 rounded-3xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {/* Glass background */}
          <div 
            className="absolute inset-0 bg-card/40 backdrop-blur-xl"
            style={{
              background: `linear-gradient(135deg, 
                hsl(var(--card) / 0.6) 0%, 
                hsl(var(--card) / 0.3) 50%, 
                hsl(var(--card) / 0.1) 100%)`,
            }}
          />
          
          {/* Border glow */}
          <div 
            className="absolute inset-0 rounded-3xl"
            style={{
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: `inset 0 0 30px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.3)`,
            }}
          />
          
          {/* Content */}
          <div className="relative h-full flex flex-col p-6 z-10">
            {/* Top accent bar */}
            <div 
              className="absolute top-0 left-0 right-0 h-1.5 rounded-t-3xl"
              style={{ backgroundColor: primaryColor }}
            />
            
            {/* Logo section */}
            <div className="flex-1 flex flex-col items-center justify-center">
              {organization?.logo_url ? (
                <img
                  src={organization.logo_url}
                  alt={organization.name}
                  className="w-24 h-24 object-contain mb-4 drop-shadow-lg"
                />
              ) : (
                <div 
                  className="w-24 h-24 rounded-2xl flex items-center justify-center mb-4"
                  style={{ 
                    backgroundColor: primaryColor,
                    boxShadow: `0 8px 24px ${primaryColor}40`,
                  }}
                >
                  <span className="text-white text-3xl font-bold">
                    {organization?.name?.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              
              <h3 className="text-xl font-bold text-foreground text-center mb-2">
                {organization?.name}
              </h3>
              
              <p className="text-sm text-muted-foreground text-center line-clamp-2 px-2">
                {organization?.description || 'Tap for more information'}
              </p>
            </div>
            
            {/* Bottom indicator */}
            <div className="flex items-center justify-center gap-2 text-muted-foreground/70">
              <div className="flex items-center gap-1">
                <div 
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: primaryColor }}
                />
                <span className="text-xs uppercase tracking-wider">Tap for more info</span>
              </div>
            </div>
          </div>
        </div>

        {/* Back Face */}
        <div
          className="absolute inset-0 rounded-3xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {/* Glass background */}
          <div 
            className="absolute inset-0 bg-card/40 backdrop-blur-xl"
            style={{
              background: `linear-gradient(135deg, 
                hsl(var(--card) / 0.6) 0%, 
                hsl(var(--card) / 0.3) 50%, 
                hsl(var(--card) / 0.1) 100%)`,
            }}
          />
          
          {/* Border */}
          <div 
            className="absolute inset-0 rounded-3xl"
            style={{
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: `inset 0 0 30px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.3)`,
            }}
          />
          
          {/* Content */}
          <div className="relative h-full flex flex-col z-10">
            {/* Header with color */}
            <div 
              className="p-4 flex items-center gap-3"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              {organization?.logo_url ? (
                <img
                  src={organization.logo_url}
                  alt={organization.name}
                  className="w-10 h-10 object-contain"
                />
              ) : (
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span className="text-white font-bold">
                    {organization?.name?.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <h3 className="font-semibold text-foreground truncate flex-1">
                {organization?.name}
              </h3>
            </div>
            
            {/* Branch info */}
            <div className="flex-1 p-4 overflow-y-auto">
              {branches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center">
                  Loading locations...
                </p>
              ) : hasSingleBranch ? (
                /* Single branch - show details directly */
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">{mainBranch?.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="text-sm">
                      <p className="text-foreground">Mon-Thu: {formatTime(mainBranch?.opening_time)} - {formatTime(mainBranch?.closing_time)}</p>
                      <p className="text-foreground">Fri: {formatTime(mainBranch?.opening_time)} - {formatTime(mainBranch?.friday_closing_time)}</p>
                      <p className="text-muted-foreground text-xs">Closed weekends & holidays</p>
                    </div>
                  </div>
                  {mainBranch?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-foreground">{mainBranch.phone}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Multiple branches - show list with selection */
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    {branches.length} locations available
                  </p>
                  {branches.map((branch) => (
                    <button
                      key={branch.id}
                      data-branch-btn
                      onClick={(e) => handleBranchSelect(branch, e)}
                      className={`w-full p-3 rounded-xl text-left transition-all ${
                        selectedBranch?.id === branch.id
                          ? 'bg-primary/20 border border-primary/50'
                          : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{branch.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{branch.address}</p>
                        </div>
                        {branch.is_main_branch && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                            Main
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                  
                  {selectedBranch && (
                    <div className="mt-3 p-3 bg-muted/20 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-foreground">
                          Mon-Thu: {formatTime(selectedBranch.opening_time)} - {formatTime(selectedBranch.closing_time)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-foreground">
                          Fri: {formatTime(selectedBranch.opening_time)} - {formatTime(selectedBranch.friday_closing_time)}
                        </span>
                      </div>
                      {selectedBranch.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-foreground">{selectedBranch.phone}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Navigate button */}
            <div className="p-4 pt-0">
              <button
                data-navigate-btn
                onClick={handleNavigate}
                className="w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ 
                  backgroundColor: primaryColor,
                  color: 'white',
                  boxShadow: `0 4px 20px ${primaryColor}40`,
                }}
              >
                See Services
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
