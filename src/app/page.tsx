import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Sparkles, Zap, BarChart3 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold">Survai</h1>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto text-center py-24 px-4">
        <h2 className="text-5xl font-bold tracking-tight mb-6">
          Build surveys with AI.
          <br />
          <span className="text-muted-foreground">Not forms.</span>
        </h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto">
          Describe your survey in plain English. Our AI creates professional,
          shareable surveys in seconds. Drag, drop, and customize with ease.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="text-base px-8">
              Start Building
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="text-base px-8">
              Sign In
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto py-16 px-4">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">AI-Powered</h3>
            <p className="text-sm text-muted-foreground">
              Describe what you need in natural language. The AI generates complete,
              professional surveys instantly.
            </p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-4">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Drag & Drop</h3>
            <p className="text-sm text-muted-foreground">
              Full visual editor with drag-and-drop reordering,
              inline editing, and real-time preview.
            </p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-4">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Collect & Analyze</h3>
            <p className="text-sm text-muted-foreground">
              Share surveys with a link, collect responses, and view
              results — all in one place.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          Built with AI. Powered by Survai.
        </div>
      </footer>
    </div>
  );
}
