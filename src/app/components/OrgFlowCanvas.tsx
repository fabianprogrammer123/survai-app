"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ---- Helpers ----
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const TAU = Math.PI * 2;

// ---- Colors ----
const C = {
  exec: "#a78bfa",
  mgmt: "#6366f1",
  team: "#06b6d4",
  ic: "#94a3b8",
  tacit: "#f59e0b",
  insight: "#10b981",
};

const DEPT_COLORS = [
  "#a78bfa", "#6366f1", "#06b6d4", "#14b8a6",
  "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6",
];

const DEPT_NAMES = ["Engineering", "Product", "Sales", "Operations", "Design"];

// ---- Org levels ----
const LEVELS = [
  { name: "CEO", color: C.exec, r: 10, count: 1 },
  { name: "C-Suite", color: C.exec, r: 8, count: 4 },
  { name: "VP", color: C.mgmt, r: 6, count: 10 },
  { name: "Director", color: C.mgmt, r: 5, count: 18 },
  { name: "Manager", color: C.team, r: 4, count: 30 },
  { name: "Team Lead", color: C.team, r: 3.5, count: 40 },
  { name: "IC", color: C.ic, r: 2.5, count: 80 },
];

interface OrgNode {
  id: number;
  level: number;
  levelName: string;
  dept: number;
  color: string;
  deptColor: string;
  r: number;
  nx: number; ny: number;
  hx: number; hy: number;
  x: number; y: number;
  phase: number;
  breathe: number;
  pulseTime: number;
  isBottleneck: boolean;
  tacitCount: number;
}

interface FormalEdge { from: number; to: number; }
interface TacitEdge { from: number; to: number; strength: number; active: boolean; activeTime: number; }
interface Packet {
  from: number; to: number; progress: number; speed: number;
  color: string; size: number;
  trail: Array<{ x: number; y: number }>;
}

type Mode = "natural" | "hierarchy" | "bottleneck";

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

export default function OrgFlowCanvas({ mode = "natural" }: { mode?: Mode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    nodes: OrgNode[];
    formalEdges: FormalEdge[];
    tacitEdges: TacitEdge[];
    packets: Packet[];
    time: number;
    mouse: { x: number; y: number };
    hovered: OrgNode | null;
    w: number; h: number; cx: number; cy: number;
  }>({
    nodes: [], formalEdges: [], tacitEdges: [], packets: [],
    time: 0, mouse: { x: -9999, y: -9999 }, hovered: null,
    w: 0, h: 0, cx: 0, cy: 0,
  });
  const modeRef = useRef<Mode>(mode);
  const [metrics, setMetrics] = useState({ nodes: 0, paths: 0, cross: 0, insights: 0 });

  useEffect(() => { modeRef.current = mode; }, [mode]);

  const buildOrg = useCallback((w: number, h: number) => {
    const s = stateRef.current;
    s.w = w; s.h = h; s.cx = w / 2; s.cy = h / 2;
    s.nodes = []; s.formalEdges = []; s.tacitEdges = [];
    const depts = 5;
    let id = 0;

    for (let li = 0; li < LEVELS.length; li++) {
      const level = LEVELS[li];
      for (let i = 0; i < level.count; i++) {
        const dept = i % depts;
        const deptAngle = (dept / depts) * TAU - Math.PI / 2;
        const layerRadius = li === 0 ? 0 : (li / (LEVELS.length - 1)) * Math.min(w, h) * 0.38;
        const angleSpread = level.count <= 1 ? 0 : (i / level.count) * TAU;
        const jitter = li > 2 ? rand(-15, 15) : rand(-5, 5);

        const nx = s.cx + Math.cos(angleSpread + deptAngle * 0.15) * layerRadius + jitter;
        const ny = s.cy + Math.sin(angleSpread + deptAngle * 0.15) * layerRadius + jitter;
        const hx = ((i + 0.5) / level.count) * w * 0.85 + w * 0.075;
        const hy = ((li + 0.5) / LEVELS.length) * h * 0.85 + h * 0.075;

        s.nodes.push({
          id: id++, level: li, levelName: level.name, dept,
          color: level.color, deptColor: DEPT_COLORS[dept % DEPT_COLORS.length],
          r: level.r, nx, ny, hx, hy, x: nx, y: ny,
          phase: rand(0, TAU), breathe: rand(0.8, 1.2),
          pulseTime: 0, isBottleneck: false, tacitCount: 0,
        });
      }
    }

    // Formal edges
    for (const node of s.nodes) {
      if (node.level === 0) continue;
      const parents = s.nodes.filter(n => n.level === node.level - 1);
      if (parents.length === 0) continue;
      const parent = parents.find(n => n.dept === node.dept) || parents[Math.floor(Math.random() * parents.length)];
      s.formalEdges.push({ from: parent.id, to: node.id });
    }

    // Tacit edges
    const tacitCount = Math.floor(s.nodes.length * 0.3);
    for (let i = 0; i < tacitCount; i++) {
      const a = s.nodes[Math.floor(Math.random() * s.nodes.length)];
      const b = s.nodes[Math.floor(Math.random() * s.nodes.length)];
      if (a.id === b.id) continue;
      if (a.dept === b.dept && Math.random() < 0.6) continue;
      if (Math.abs(a.level - b.level) <= 1 && Math.random() < 0.3) continue;
      s.tacitEdges.push({ from: a.id, to: b.id, strength: rand(0.3, 1), active: false, activeTime: 0 });
      a.tacitCount++;
      b.tacitCount++;
    }

    for (const n of s.nodes) {
      n.isBottleneck = n.tacitCount > 4 && n.level >= 2 && n.level <= 4;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    let running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.parentElement!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildOrg(w, h);
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      s.mouse.x = e.clientX - rect.left;
      s.mouse.y = e.clientY - rect.top;
    };
    const onMouseLeave = () => { s.mouse.x = -9999; s.mouse.y = -9999; s.hovered = null; };

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);

    let insightTotal = 0;

    const animate = () => {
      if (!running) return;
      s.time++;
      const t = s.time * 0.005;
      const currentMode = modeRef.current;

      ctx.clearRect(0, 0, s.w, s.h);

      // Spawn packets
      if (s.time % 3 === 0 && s.tacitEdges.length > 0) {
        const edge = s.tacitEdges[Math.floor(Math.random() * s.tacitEdges.length)];
        const from = s.nodes[edge.from];
        const to = s.nodes[edge.to];
        if (from && to) {
          edge.active = true;
          edge.activeTime = s.time;
          const isCross = from.dept !== to.dept;
          s.packets.push({
            from: edge.from, to: edge.to, progress: 0,
            speed: rand(0.008, 0.02),
            color: isCross ? C.tacit : C.insight,
            size: isCross ? 3 : 2, trail: [],
          });
        }
      }

      // Update node positions
      for (const n of s.nodes) {
        let tx: number, ty: number;
        if (currentMode === "hierarchy") {
          tx = n.hx; ty = n.hy;
        } else {
          tx = n.nx + Math.sin(t * n.breathe + n.phase) * 3;
          ty = n.ny + Math.cos(t * n.breathe * 0.7 + n.phase) * 3;
        }
        n.x = lerp(n.x, tx, 0.04);
        n.y = lerp(n.y, ty, 0.04);
      }

      // Find hovered
      s.hovered = null;
      for (const n of s.nodes) {
        if (dist(n, s.mouse) < Math.max(n.r * 3, 12)) {
          s.hovered = n;
          break;
        }
      }

      // Draw formal edges
      ctx.lineWidth = 0.5;
      for (const edge of s.formalEdges) {
        const a = s.nodes[edge.from];
        const b = s.nodes[edge.to];
        let alpha = currentMode === "hierarchy" ? 0.15 : 0.07;
        if (s.hovered && (edge.from === s.hovered.id || edge.to === s.hovered.id)) alpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(100,116,139,${alpha})`;
        ctx.stroke();
      }

      // Draw tacit edges
      for (const edge of s.tacitEdges) {
        const a = s.nodes[edge.from];
        const b = s.nodes[edge.to];
        const isActive = edge.active && (s.time - edge.activeTime) < 120;
        const isHover = s.hovered && (edge.from === s.hovered.id || edge.to === s.hovered.id);

        let alpha = isActive ? 0.2 : 0.03;
        if (currentMode === "bottleneck") alpha = (a.isBottleneck || b.isBottleneck) ? 0.15 : 0.02;
        if (isHover) alpha = 0.45;
        if (currentMode === "hierarchy") alpha *= 0.3;

        const mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.15;
        const my = (a.y + b.y) / 2 + (b.x - a.x) * 0.15;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.strokeStyle = `rgba(245,158,11,${alpha})`;
        ctx.lineWidth = isActive ? 1.2 : 0.5;
        ctx.stroke();

        if (!isActive && edge.active) edge.active = false;
      }

      // Draw packets
      const alive: Packet[] = [];
      for (const p of s.packets) {
        p.progress += p.speed;
        const a = s.nodes[p.from];
        const b = s.nodes[p.to];
        if (!a || !b) continue;
        if (p.progress > 1) {
          b.pulseTime = s.time;
          insightTotal++;
          continue;
        }

        const mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.15;
        const my = (a.y + b.y) / 2 + (b.x - a.x) * 0.15;
        const t1 = p.progress;
        const px = (1 - t1) * (1 - t1) * a.x + 2 * (1 - t1) * t1 * mx + t1 * t1 * b.x;
        const py = (1 - t1) * (1 - t1) * a.y + 2 * (1 - t1) * t1 * my + t1 * t1 * b.y;

        p.trail.push({ x: px, y: py });
        if (p.trail.length > 12) p.trail.shift();

        for (let i = 0; i < p.trail.length; i++) {
          const ta = (i / p.trail.length) * 0.5;
          const sz = (i / p.trail.length) * p.size;
          const { r, g, b: bl } = hexToRgb(p.color);
          ctx.beginPath();
          ctx.arc(p.trail[i].x, p.trail[i].y, sz, 0, TAU);
          ctx.fillStyle = `rgba(${r},${g},${bl},${ta})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, TAU);
        ctx.fillStyle = p.color;
        ctx.fill();

        const { r, g, b: bl } = hexToRgb(p.color);
        ctx.beginPath();
        ctx.arc(px, py, p.size * 3, 0, TAU);
        ctx.fillStyle = `rgba(${r},${g},${bl},0.15)`;
        ctx.fill();

        alive.push(p);
      }
      s.packets = alive;

      // Draw nodes
      for (const n of s.nodes) {
        const isHovered = s.hovered === n;
        const isConnected = s.hovered && (
          s.tacitEdges.some(e => (e.from === s.hovered!.id && e.to === n.id) || (e.to === s.hovered!.id && e.from === n.id)) ||
          s.formalEdges.some(e => (e.from === s.hovered!.id && e.to === n.id) || (e.to === s.hovered!.id && e.from === n.id))
        );

        let r = n.r;
        let alpha = 0.85;

        if (s.hovered && !isHovered && !isConnected) alpha = 0.2;
        if (isHovered) { r *= 2; alpha = 1; }
        if (isConnected) alpha = 1;
        if (currentMode === "bottleneck") {
          if (n.isBottleneck) { r *= 1.5; alpha = 1; } else alpha = 0.3;
        }

        // Pulse
        const pd = s.time - n.pulseTime;
        if (pd < 30) {
          const pr = r + (pd / 30) * 20;
          const pa = (1 - pd / 30) * 0.3;
          ctx.beginPath();
          ctx.arc(n.x, n.y, pr, 0, TAU);
          ctx.strokeStyle = `rgba(245,158,11,${pa})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        const breathe = Math.sin(t * 3 + n.phase) * 0.3 + 0.7;
        const nodeColor = currentMode === "bottleneck" && n.isBottleneck ? C.tacit : n.color;
        const { r: cr, g: cg, b: cb } = hexToRgb(nodeColor);

        // Glow
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 3 * breathe, 0, TAU);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${0.08 * alpha})`;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, TAU);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.fill();

        // Inner
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 0.4, 0, TAU);
        ctx.fillStyle = `rgba(255,255,255,${0.4 * alpha})`;
        ctx.fill();

        // Hover label
        if (isHovered) {
          ctx.font = '600 11px "Space Grotesk", sans-serif';
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.textAlign = "center";
          ctx.fillText(n.levelName, n.x, n.y - r * 2 - 12);
          ctx.font = '400 10px "Space Mono", monospace';
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillText(`Dept ${n.dept + 1} · ${n.tacitCount} tacit flows`, n.x, n.y - r * 2);
        }

        // Bottleneck label
        if (currentMode === "bottleneck" && n.isBottleneck) {
          ctx.font = '700 9px "Space Mono", monospace';
          ctx.fillStyle = C.tacit;
          ctx.textAlign = "center";
          ctx.fillText("BOTTLENECK", n.x, n.y - r * 2 - 4);
        }
      }

      // Department labels
      if (currentMode === "natural") {
        ctx.font = '500 10px "Space Mono", monospace';
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.textAlign = "center";
        for (let d = 0; d < 5; d++) {
          const dn = s.nodes.filter(n => n.dept === d);
          if (dn.length === 0) continue;
          const avgX = dn.reduce((sum, n) => sum + n.x, 0) / dn.length;
          const avgY = dn.reduce((sum, n) => sum + n.y, 0) / dn.length;
          ctx.fillText(DEPT_NAMES[d], avgX, avgY);
        }
      }

      // Update metrics every 30 frames
      if (s.time % 30 === 0) {
        setMetrics({
          nodes: s.nodes.length,
          paths: s.formalEdges.length + s.tacitEdges.length,
          cross: s.tacitEdges.filter(e => {
            const a = s.nodes[e.from], b = s.nodes[e.to];
            return a && b && a.dept !== b.dept;
          }).length,
          insights: insightTotal,
        });
      }

      requestAnimationFrame(animate);
    };

    // Only run when visible
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          running = true;
          requestAnimationFrame(animate);
        } else {
          running = false;
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(canvas);

    return () => {
      running = false;
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      observer.disconnect();
    };
  }, [buildOrg]);

  return { canvasRef, metrics };
}

// ---- Hero background ----
export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let running = true;

    interface HNode { x: number; y: number; vx: number; vy: number; r: number; phase: number; level: number; }
    interface HEdge { a: number; b: number; }
    interface HPkt { a: number; b: number; progress: number; speed: number; }
    let nodes: HNode[] = [];
    let edges: HEdge[] = [];
    let packets: HPkt[] = [];
    let w = 0, h = 0, time = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.parentElement!.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };

    const build = () => {
      nodes = []; edges = [];
      const count = 60;
      for (let i = 0; i < count; i++) {
        nodes.push({ x: rand(0, w), y: rand(0, h), vx: rand(-0.15, 0.15), vy: rand(-0.15, 0.15), r: rand(1.5, 4), phase: rand(0, TAU), level: Math.floor(rand(0, 5)) });
      }
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          if (dist(nodes[i], nodes[j]) < 150 && Math.random() < 0.15) edges.push({ a: i, b: j });
        }
      }
    };

    const anim = () => {
      if (!running) return;
      time++;
      ctx.clearRect(0, 0, w, h);
      const t = time * 0.003;

      for (const n of nodes) {
        n.x += n.vx + Math.sin(t + n.phase) * 0.1;
        n.y += n.vy + Math.cos(t * 0.7 + n.phase) * 0.1;
        if (n.x < -20) n.x = w + 20; if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20; if (n.y > h + 20) n.y = -20;
      }

      if (time % 8 === 0 && edges.length > 0) {
        const e = edges[Math.floor(Math.random() * edges.length)];
        packets.push({ a: e.a, b: e.b, progress: 0, speed: rand(0.01, 0.025) });
      }

      for (const e of edges) {
        const a = nodes[e.a], b = nodes[e.b];
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "rgba(99,102,241,0.06)"; ctx.lineWidth = 0.5; ctx.stroke();
      }

      const alive: HPkt[] = [];
      for (const p of packets) {
        p.progress += p.speed; if (p.progress > 1) continue;
        const a = nodes[p.a], b = nodes[p.b];
        const px = lerp(a.x, b.x, p.progress);
        const py = lerp(a.y, b.y, p.progress);
        ctx.beginPath(); ctx.arc(px, py, 1.5, 0, TAU);
        ctx.fillStyle = `rgba(245,158,11,${0.5 * (1 - p.progress)})`;
        ctx.fill(); alive.push(p);
      }
      packets = alive;

      const colors = [C.exec, C.mgmt, C.team, C.ic, C.tacit];
      for (const n of nodes) {
        const g = Math.sin(t * 2 + n.phase) * 0.3 + 0.7;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * g, 0, TAU);
        ctx.fillStyle = colors[n.level] || C.ic;
        ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
      }

      requestAnimationFrame(anim);
    };

    resize();
    window.addEventListener("resize", resize);
    requestAnimationFrame(anim);

    return () => { running = false; window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ---- Adaptive Paths Mini Viz ----
export function AdaptivePathsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let running = false;
    let time = 0;

    interface P { x1: number; y1: number; x2: number; y2: number; depth: number; opacity: number; progress: number; delay: number; }
    let paths: P[] = [];
    let w = 0, h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.parentElement!.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const genBranch = (x: number, y: number, depth: number, max: number, op: number) => {
      if (depth >= max || x > w - 30) return;
      const sl = rand(40, 70); const ex = x + sl; const ey = y + rand(-35, 35);
      paths.push({ x1: x, y1: y, x2: ex, y2: ey, depth, opacity: op, progress: 0, delay: depth * 20 + paths.length * 4 });
      const branches = depth === 0 ? 3 : Math.random() < 0.5 ? 2 : 1;
      for (let i = 0; i < branches; i++) genBranch(ex, ey, depth + 1, max, op * 0.7);
    };

    const init = () => { paths = []; genBranch(30, h / 2, 0, 4, 1); };

    const anim = () => {
      if (!running) return;
      time++;
      ctx.clearRect(0, 0, w, h);
      for (const p of paths) {
        const tt = Math.max(0, time - p.delay);
        p.progress = Math.min(1, tt / 25);
        if (p.progress <= 0) continue;
        const ex = lerp(p.x1, p.x2, p.progress);
        const ey = lerp(p.y1, p.y2, p.progress);
        const hue = 35 + p.depth * 50;
        ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(ex, ey);
        ctx.strokeStyle = `hsla(${hue}, 70%, 55%, ${p.opacity * 0.7})`;
        ctx.lineWidth = Math.max(0.5, 2 - p.depth * 0.4); ctx.stroke();
        if (p.progress >= 1) {
          ctx.beginPath(); ctx.arc(p.x2, p.y2, 3 - p.depth * 0.5, 0, TAU);
          ctx.fillStyle = `hsla(${hue}, 70%, 55%, ${p.opacity})`; ctx.fill();
        }
      }
      if (time > 200) { time = 0; init(); }
      requestAnimationFrame(anim);
    };

    resize();
    window.addEventListener("resize", resize);

    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !running) { running = true; init(); anim(); }
      else if (!entries[0].isIntersecting) running = false;
    }, { threshold: 0.1 });
    obs.observe(canvas);

    return () => { running = false; window.removeEventListener("resize", resize); obs.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ---- CTA subtle background ----
export function CTACanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let running = false;
    let time = 0;
    let w = 0, h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.parentElement!.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const anim = () => {
      if (!running) return;
      time += 0.008;
      ctx.clearRect(0, 0, w, h);
      const spacing = 50;
      for (let x = 0; x < w; x += spacing) {
        for (let y = 0; y < h; y += spacing) {
          const dx = Math.sin(x * 0.01 + time) * Math.cos(y * 0.01 + time * 0.5) * 10;
          const dy = Math.cos(y * 0.01 + time * 0.7) * Math.sin(x * 0.01 + time * 0.3) * 10;
          const alpha = 0.04 + Math.sin(x * 0.02 + y * 0.02 + time * 2) * 0.02;
          ctx.beginPath(); ctx.arc(x + dx, y + dy, 1, 0, TAU);
          ctx.fillStyle = `rgba(99,102,241,${alpha})`; ctx.fill();
        }
      }
      requestAnimationFrame(anim);
    };

    resize();
    window.addEventListener("resize", resize);

    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !running) { running = true; anim(); }
      else if (!entries[0].isIntersecting) running = false;
    }, { threshold: 0.05 });
    obs.observe(canvas);

    return () => { running = false; window.removeEventListener("resize", resize); obs.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}
