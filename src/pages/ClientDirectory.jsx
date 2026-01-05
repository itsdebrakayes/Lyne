import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { FlipCard } from '@/components/FlipCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useOrganizations } from '@/hooks/useOrganizations';
import { Skeleton } from '@/components/ui/skeleton';

const ClientDirectory = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const scrollContainerRef = useRef(null);
  const { data: organizations, isLoading, error } = useOrganizations();

  const filteredOrgs = organizations?.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320; // Card width + gap
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold gradient-text">QmeNow</h1>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/about')}
              className="text-muted-foreground hover:text-foreground"
            >
              About
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-full"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-12">
        {/* Hero Section */}
        <div className="container mx-auto px-4 text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Skip the Wait,{' '}
            <span className="gradient-text">Join the Queue</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Select an organization below to view their services and join their queue remotely.
          </p>

          {/* Search Bar */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search organizations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card/50 border-border/50 backdrop-blur-sm"
            />
          </div>
        </div>

        {/* Section Title */}
        <div className="container mx-auto px-4 mb-8">
          <h3 className="text-2xl md:text-3xl font-bold text-center gradient-text">
            Clients and Organizations
          </h3>
        </div>

        {/* Horizontal Scrollable Cards */}
        <div className="relative">
          {/* Navigation Arrows */}
          {filteredOrgs.length > 3 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-card/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-card hidden md:flex"
                onClick={() => scroll('left')}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-card/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-card hidden md:flex"
                onClick={() => scroll('right')}
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </>
          )}

          {/* Scrollable Container */}
          {isLoading ? (
            <div className="flex gap-8 px-8 overflow-x-auto scrollbar-hide py-8 justify-center">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="w-[280px] h-[380px] rounded-2xl flex-shrink-0" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Failed to load organizations. Please try again.</p>
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchQuery ? 'No organizations found matching your search.' : 'No organizations available.'}
              </p>
            </div>
          ) : (
            <div
              ref={scrollContainerRef}
              className="flex gap-8 px-8 overflow-x-auto scrollbar-hide py-8 snap-x snap-mandatory"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {/* Spacer for centering */}
              <div className="flex-shrink-0 w-[calc(50vw-160px)] hidden lg:block" />
              
              {filteredOrgs.map((org) => (
                <div key={org.id} className="snap-center">
                  <FlipCard organization={org} />
                </div>
              ))}
              
              {/* Spacer for centering */}
              <div className="flex-shrink-0 w-[calc(50vw-160px)] hidden lg:block" />
            </div>
          )}
        </div>

        {/* Scroll indicator dots for mobile */}
        {filteredOrgs.length > 1 && (
          <div className="flex justify-center gap-2 mt-6 md:hidden">
            {filteredOrgs.map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-muted-foreground/30"
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} QmeNow. All rights reserved.
        </div>
      </footer>

      {/* Hide scrollbar styles */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default ClientDirectory;
