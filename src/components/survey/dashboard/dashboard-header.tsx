'use client';

import { AxiomMark } from '@/components/axiom-mark';
import { LayoutGrid, Search, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DashboardHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function DashboardHeader({ searchQuery, onSearchChange }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <AxiomMark size="md" />
          <span className="text-lg font-semibold text-foreground/80">Forms</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-lg mx-auto">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search forms"
              className="w-full h-11 pl-10 pr-4 rounded-full bg-muted/30 border border-border/40 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 focus:bg-muted/50 transition-all"
            />
          </div>
        </div>

        {/* Right: Settings + Profile */}
        <div className="flex items-center gap-3 shrink-0">
          <button className="p-2 rounded-lg hover:bg-muted/60 transition-colors" title="Settings">
            <Settings className="h-5 w-5 text-muted-foreground/60 hover:text-muted-foreground" />
          </button>

          <button className="p-2 rounded-lg hover:bg-muted/60 transition-colors" title="Axiom apps">
            <LayoutGrid className="h-5 w-5 text-muted-foreground/60 hover:text-muted-foreground" />
          </button>

          {/* Profile avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold cursor-pointer ring-2 ring-transparent hover:ring-border/40 transition-all">
                F
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2.5">
                <p className="text-sm font-medium">Fabian</p>
                <p className="text-xs text-muted-foreground">fabian@axiom-si.com</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>API Keys</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-muted-foreground">Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
