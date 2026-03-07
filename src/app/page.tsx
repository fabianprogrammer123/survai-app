"use client";

import { useState, useEffect, useRef } from "react";
import OrgFlowCanvasHook, { HeroCanvas, AdaptivePathsCanvas, CTACanvas } from "./components/OrgFlowCanvas";

type Mode = "natural" | "hierarchy" | "bottleneck";

function CountUp({ target, suffix }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const dur = 2200;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setValue(Math.floor(target * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          obs.unobserve(el);
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      <span className="font-mono text-5xl font-bold text-white">{value}</span>
      {suffix && <span className="font-mono text-2xl text-[#818cf8]">{suffix}</span>}
    </span>
  );
}

function OrgFlowSection() {
  const [mode, setMode] = useState<Mode>("natural");
  const { canvasRef, metrics } = OrgFlowCanvasHook({ mode });

  return (
    <section className="py-28" id="orgflow">
      <div className="max-w-[1300px] mx-auto px-6 md:px-12 mb-12 grid grid-cols-1 md:grid-cols-2 gap-12 items-end">
        <div>
          <span className="inline-block font-mono text-[10px] font-bold tracking-[3px] uppercase text-[#f59e0b] mb-4">
            Live Simulation
          </span>
          <h2 className="text-3xl md:text-5xl font-bold leading-[1.1] tracking-tight">
            Information doesn&apos;t flow
            <br />
            down the org chart.
          </h2>
        </div>
        <p className="text-[15px] text-[#6b6b80] leading-relaxed">
          This is a real-time simulation of how knowledge actually moves inside a 500-person company.
          Watch how tacit insights bypass hierarchy, cluster in unexpected places, and create emergent
          intelligence no single person holds.
        </p>
      </div>

      <div className="relative max-w-[1300px] mx-auto px-6 md:px-12">
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full h-[400px] md:h-[560px] rounded-2xl border border-white/5 bg-[#08080c] cursor-crosshair"
          />
          <div className="absolute top-5 left-5 pointer-events-none">
            <span className="font-mono text-[9px] tracking-[2px] uppercase text-[#3a3a4a] block">Active Nodes</span>
            <span className="font-mono text-2xl font-bold text-white">{metrics.nodes}</span>
          </div>
          <div className="absolute top-5 right-5 text-right pointer-events-none">
            <span className="font-mono text-[9px] tracking-[2px] uppercase text-[#3a3a4a] block">Pathways</span>
            <span className="font-mono text-2xl font-bold text-white">{metrics.paths}</span>
          </div>
          <div className="absolute bottom-16 left-5 pointer-events-none">
            <span className="font-mono text-[9px] tracking-[2px] uppercase text-[#3a3a4a] block">Cross-Dept Flows</span>
            <span className="font-mono text-2xl font-bold text-white">{metrics.cross}</span>
          </div>
          <div className="absolute bottom-16 right-5 text-right pointer-events-none">
            <span className="font-mono text-[9px] tracking-[2px] uppercase text-[#3a3a4a] block">Insights Surfaced</span>
            <span className="font-mono text-2xl font-bold text-white">{metrics.insights}</span>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 bg-[#08080c]/80 backdrop-blur-md rounded-full p-1 border border-white/5">
            {(["natural", "hierarchy", "bottleneck"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 rounded-full font-mono text-[11px] border-none cursor-pointer whitespace-nowrap mode-btn ${mode === m ? "active" : "text-[#3a3a4a]"}`}
              >
                {m === "natural" ? "Natural Flow" : m === "hierarchy" ? "Hierarchy View" : "Bottleneck Detection"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4 md:gap-6 flex-wrap mt-5 max-w-[1300px] mx-auto px-6 md:px-12">
        {[
          { color: "#a78bfa", label: "Executive" },
          { color: "#6366f1", label: "Management" },
          { color: "#06b6d4", label: "Team Lead" },
          { color: "#94a3b8", label: "Individual Contributor" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 font-mono text-[10px] text-[#3a3a4a]">
            <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
            {item.label}
          </div>
        ))}
        <div className="flex items-center gap-2 font-mono text-[10px] text-[#3a3a4a]">
          <span className="w-5 h-px bg-[rgba(100,116,139,0.4)]" />
          Formal Reporting
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-[#3a3a4a]">
          <span className="w-5 h-px" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(245,158,11,0.5) 0, rgba(245,158,11,0.5) 4px, transparent 4px, transparent 8px)" }} />
          Tacit Knowledge Flow
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  useEffect(() => {
    const targets = document.querySelectorAll(".reveal-target");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const siblings = entry.target.parentElement
              ? Array.from(entry.target.parentElement.children).filter((c) => c.classList.contains("reveal-target"))
              : [];
            const idx = siblings.indexOf(entry.target as Element);
            setTimeout(() => entry.target.classList.add("visible"), idx * 60);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    targets.forEach((el) => {
      el.classList.add("reveal");
      obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <>
      {/* TOPBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-[#08080c]/60 backdrop-blur-2xl border-b border-white/5">
        <a href="#" className="font-bold text-xl tracking-tight">
          Surv<span className="gradient-text">ai</span>
        </a>
        <a href="#cta" className="font-mono text-xs tracking-widest uppercase text-[#6b6b80] hover:text-white transition-colors">
          Get Access &rarr;
        </a>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-28 pb-20">
        <HeroCanvas />
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-12 lg:gap-20 max-w-[1300px] mx-auto px-6 md:px-12 items-center">
          <div>
            <p className="font-mono text-[11px] tracking-[3px] uppercase text-[#818cf8] mb-6">
              Decentralized Intelligence Platform
            </p>
            <h1 className="text-[clamp(36px,5.5vw,72px)] font-bold leading-[1.05] tracking-[-3px] text-white">
              The knowledge
              <br />
              your org <em className="font-serif italic font-normal text-[#f59e0b]">actually</em>
              <br />
              runs on has
              <br />
              never been
              <br />
              written down.
            </h1>
          </div>
          <div>
            <p className="text-base text-[#6b6b80] leading-relaxed mb-10">
              Every company is a living network of tacit knowledge — intuitions, workarounds, tribal wisdom
              flowing between people in ways no org chart captures.{" "}
              <strong className="text-[#d4d4e0] font-semibold">Survai makes the invisible visible.</strong>
            </p>
            <div className="flex flex-col gap-6">
              <div>
                <CountUp target={95} suffix="%" />
                <span className="block text-[13px] text-[#3a3a4a] mt-1">of organizational knowledge is tacit</span>
              </div>
              <div>
                <CountUp target={73} suffix="%" />
                <span className="block text-[13px] text-[#3a3a4a] mt-1">of critical decisions rely on unwritten expertise</span>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 left-6 md:left-12 z-10 font-mono text-[10px] tracking-[2px] uppercase text-[#3a3a4a] flex items-center gap-3">
          <span className="w-10 h-px bg-[#3a3a4a]" />
          scroll to explore the information flow
        </div>
      </section>

      {/* ORG FLOW */}
      <OrgFlowSection />

      {/* EDITORIAL QUOTE */}
      <section className="py-28 border-t border-b border-white/5">
        <div className="max-w-[900px] mx-auto px-6 md:px-12">
          <blockquote className="font-serif text-[clamp(22px,3vw,36px)] leading-relaxed text-[#d4d4e0]">
            <span className="text-7xl leading-none relative top-6 mr-1 text-[#6366f1] font-serif">&ldquo;</span>
            We discovered that our most critical product decisions were being shaped by hallway conversations
            between engineers and support staff that never appeared in any Jira ticket, Slack channel, or meeting note.
          </blockquote>
          <cite className="block font-mono text-xs text-[#3a3a4a] mt-8 tracking-wider not-italic">
            — VP of Product, 2,400-person SaaS company
          </cite>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-28" id="how">
        <div className="max-w-[1300px] mx-auto px-6 md:px-12 mb-16">
          <span className="inline-block font-mono text-[10px] font-bold tracking-[3px] uppercase text-[#f59e0b] mb-4">
            How It Works
          </span>
          <h2 className="text-3xl md:text-5xl font-bold leading-[1.1] tracking-tight">
            From scattered minds
            <br />
            to structured intelligence
          </h2>
        </div>
        <div className="max-w-[1300px] mx-auto px-6 md:px-12">
          {[
            {
              n: "01",
              title: "Deploy adaptive surveys across your org",
              desc: "Not forms. Conversations. Each survey adapts in real time, following threads of tacit knowledge that rigid questionnaires can't reach. The AI senses when someone knows more than they're saying — and asks the right follow-up.",
            },
            {
              n: "02",
              title: "Map the invisible knowledge network",
              desc: "Responses are mapped into semantic space. Patterns emerge: who knows what, where expertise clusters, which critical knowledge lives in a single person's head. The org chart shows reporting lines — Survai shows how knowledge actually moves.",
            },
            {
              n: "03",
              title: "Surface emergent insights",
              desc: "When 40 engineers independently describe the same workaround, that's a signal. When customer-facing teams share intuitions that contradict executive assumptions, that's intelligence. Survai detects these patterns before they become crises — or missed opportunities.",
            },
            {
              n: "04",
              title: "Build a living knowledge graph",
              desc: "The result isn't a report. It's a continuously evolving map of your organization's collective intelligence — searchable, queryable, and always current. Tacit becomes explicit. Invisible becomes actionable.",
            },
          ].map((step) => (
            <div key={step.n} className="step-row grid grid-cols-[40px_1fr] md:grid-cols-[80px_1fr] border-t border-white/5 py-10 reveal-target">
              <span className="font-mono text-xs text-[#3a3a4a] pt-1">{step.n}</span>
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-white mb-3">{step.title}</h3>
                <p className="text-[15px] text-[#6b6b80] leading-relaxed max-w-[700px]">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="py-28 bg-[#0e0e14]" id="features">
        <div className="max-w-[1300px] mx-auto px-6 md:px-12 mb-14">
          <span className="inline-block font-mono text-[10px] font-bold tracking-[3px] uppercase text-[#f59e0b] mb-4">
            Capabilities
          </span>
          <h2 className="text-3xl md:text-5xl font-bold leading-[1.1] tracking-tight">
            Built for the knowledge
            <br />
            that lives <em className="font-serif italic font-normal text-[#f59e0b]">between</em> the lines
          </h2>
        </div>
        <div className="max-w-[1300px] mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="reveal-target md:col-span-2 grid grid-cols-1 md:grid-cols-[1.4fr_1fr] bg-[#13131b] border border-white/5 rounded-xl overflow-hidden hover:border-[rgba(99,102,241,0.15)] transition-all hover:-translate-y-0.5">
            <div className="relative min-h-[220px] bg-[#08080c]">
              <AdaptivePathsCanvas />
            </div>
            <div className="p-8 md:p-10 flex flex-col justify-center">
              <h3 className="text-lg font-semibold text-white mb-3 tracking-tight">Adaptive Question Paths</h3>
              <p className="text-sm text-[#6b6b80] leading-relaxed">
                AI-driven branching that follows the scent of tacit knowledge. Each response reshapes the next
                question, creating unique conversational paths.
              </p>
            </div>
          </div>
          {[
            { icon: "⊛", title: "Semantic Clustering", desc: "Natural language responses mapped into semantic space, revealing hidden consensus across your respondent network." },
            { icon: "◉", title: "Knowledge Graphs", desc: "Living knowledge graphs constructed from survey responses, connecting concepts no single respondent could see alone." },
            { icon: "⟁", title: "Signal Detection", desc: "Information-theoretic measures distinguish meaningful patterns from noise, surfacing statistically significant insights." },
            { icon: "⬡", title: "Distributed Consensus", desc: "Identifies strong agreement across decentralized respondents without leading questions or anchoring bias." },
          ].map((cap) => (
            <div key={cap.title} className="reveal-target bg-[#13131b] border border-white/5 rounded-xl p-8 md:p-9 hover:border-[rgba(99,102,241,0.15)] transition-all hover:-translate-y-0.5">
              <span className="text-2xl text-[#818cf8] block mb-4">{cap.icon}</span>
              <h3 className="text-lg font-semibold text-white mb-3 tracking-tight">{cap.title}</h3>
              <p className="text-sm text-[#6b6b80] leading-relaxed">{cap.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-40 overflow-hidden" id="cta">
        <CTACanvas />
        <div className="relative z-10 max-w-[700px] mx-auto px-6 md:px-12 text-center">
          <h2 className="text-3xl md:text-5xl font-bold leading-[1.15] tracking-tight mb-10">
            Your org already knows
            <br />
            what it needs to know.
            <br />
            <em className="font-serif italic font-normal text-[#818cf8]">It just can&apos;t hear itself yet.</em>
          </h2>
          <form className="flex flex-col md:flex-row gap-2 max-w-[440px] mx-auto mb-4" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Work email"
              required
              className="flex-1 px-5 py-3.5 rounded-lg border border-white/5 bg-white/[0.04] text-[#d4d4e0] text-sm outline-none focus:border-[#6366f1] transition-colors"
            />
            <button
              type="submit"
              className="px-7 py-3.5 rounded-lg bg-[#6366f1] text-white font-semibold text-sm hover:bg-[#818cf8] transition-all hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
            >
              Request Access
            </button>
          </form>
          <p className="font-mono text-[11px] text-[#3a3a4a] tracking-wider">
            Free for teams up to 50. No credit card.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-[1300px] mx-auto px-6 md:px-12 flex items-center justify-between flex-wrap gap-4">
          <span className="font-bold text-xl tracking-tight">
            Surv<span className="gradient-text">ai</span>
          </span>
          <div className="flex gap-6">
            {["About", "Blog", "Docs", "Privacy"].map((link) => (
              <a key={link} href="#" className="text-[13px] text-[#3a3a4a] hover:text-[#6b6b80] transition-colors">
                {link}
              </a>
            ))}
          </div>
          <span className="font-mono text-[11px] text-[#3a3a4a]">&copy; 2026</span>
        </div>
      </footer>
    </>
  );
}
