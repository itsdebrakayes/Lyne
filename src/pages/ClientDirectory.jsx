import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { FlipCard } from '@/components/FlipCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useOrganizations } from '@/hooks/useOrganizations';
import { Skeleton } from '@/components/ui/skeleton';

const ClientDirectory = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { data: organizations, isLoading, error } = useOrganizations();

  const filteredOrgs = organizations?.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-background">
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
      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
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
              className="pl-10 bg-card/50 border-border/50"
            />
          </div>
        </div>

        {/* Organizations Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrgs.map((org) => (
              <FlipCard key={org.id} organization={org} />
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
    </div>
  );
};

export default ClientDirectory;
