"use client";

import { useEffect, useRef, useCallback } from "react";

/* ────────────────────────────────────────────────────────────────
   1.  NETWORK BACKGROUND — Neural Constellation
   Persistent memory traces, constellation patterns, layered decay
   ──────────────────────────────────────────────────────────────── */

interface NetNode {
  ox: number; oy: number; x: number; y: number; r: number;
  energy: number;
  memory: number; // persistent glow (decays very slowly)
}

interface PersistentEdge {
  i: number; j: number;
  strength: number;
  memory: number; // persistent trace
}

interface FlowParticle {
  edge: number;
  progress: number;
  speed: number;
  size: number;
}

interface CursorImpulse {
  originX: number; originY: number; // where it was spawned (cursor pos at spawn)
  nodeIdx: number;                  // target node
  progress: number;
  speed: number;
  returning: boolean;               // false = cursor→node, true = node→cursor
  size: number;
}

interface ConstellationShape {
  nodes: number[]; // indices of 3-5 nodes forming a shape
  brightness: number;
  pulsePhase: number;
  pulseSpeed: number;
}

export function NetworkBackground() {
  const cvs = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const prevMouse = useRef({ x: -9999, y: -9999 });
  const nodes = useRef<NetNode[]>([]);
  const persistentEdges = useRef<PersistentEdge[]>([]);
  const flowParticles = useRef<FlowParticle[]>([]);
  const cursorImpulses = useRef<CursorImpulse[]>([]);
  const constellations = useRef<ConstellationShape[]>([]);
  const dwellTime = useRef(0);
  const globalIntensity = useRef(0);
  const raf = useRef(0);
  const frameCount = useRef(0);

  const build = useCallback((w: number, h: number) => {
    const out: NetNode[] = [];
    const sp = 48;
    for (let y = 0; y < h + sp; y += sp) {
      for (let x = 0; x < w + sp; x += sp) {
        if (Math.random() < 0.3) continue;
        out.push({
          ox: x + (Math.random() - 0.5) * 16,
          oy: y + (Math.random() - 0.5) * 16,
          x: x + (Math.random() - 0.5) * 16,
          y: y + (Math.random() - 0.5) * 16,
          r: 1.0 + Math.random() * 0.8,
          energy: 0,
          memory: 0,
        });
      }
    }
    nodes.current = out;
    persistentEdges.current = [];
    flowParticles.current = [];
    cursorImpulses.current = [];
    constellations.current = [];
  }, []);

  useEffect(() => {
    const c = cvs.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let w = 0, h = 0;
    let running = true;

    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      c.width = w; c.height = h;
      build(w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: MouseEvent) => {
      prevMouse.current = { ...mouse.current };
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove);

    // Try to form constellation from recently activated nodes
    const tryFormConstellation = () => {
      const ns = nodes.current;
      const active = ns.map((n, i) => ({ i, e: n.energy })).filter(x => x.e > 0.3);
      if (active.length < 3) return;
      // find 3 nearby active nodes
      for (let a = 0; a < active.length; a++) {
        for (let b = a + 1; b < active.length; b++) {
          const dab = Math.hypot(ns[active[a].i].x - ns[active[b].i].x, ns[active[a].i].y - ns[active[b].i].y);
          if (dab > 150) continue;
          for (let cc = b + 1; cc < active.length; cc++) {
            const dac = Math.hypot(ns[active[a].i].x - ns[active[cc].i].x, ns[active[a].i].y - ns[active[cc].i].y);
            const dbc = Math.hypot(ns[active[b].i].x - ns[active[cc].i].x, ns[active[b].i].y - ns[active[cc].i].y);
            if (dac > 150 || dbc > 150) continue;
            const ids = [active[a].i, active[b].i, active[cc].i].sort();
            const exists = constellations.current.some(c =>
              c.nodes.length === 3 && c.nodes[0] === ids[0] && c.nodes[1] === ids[1] && c.nodes[2] === ids[2]
            );
            if (!exists && constellations.current.length < 20) {
              constellations.current.push({
                nodes: ids,
                brightness: 0.2,
                pulsePhase: Math.random() * Math.PI * 2,
                pulseSpeed: 0.005 + Math.random() * 0.01,
              });
            }
          }
        }
      }
    };

    const draw = () => {
      if (!running) return;
      frameCount.current++;
      ctx.clearRect(0, 0, w, h);
      const mx = mouse.current.x;
      const my = mouse.current.y;
      const pmx = prevMouse.current.x;
      const pmy = prevMouse.current.y;
      const ns = nodes.current;
      const pes = persistentEdges.current;
      const fps = flowParticles.current;
      const cons = constellations.current;
      const radius = 200;
      const dwellRadius = 280;

      // dwell detection
      const cursorDelta = Math.sqrt((mx - pmx) ** 2 + (my - pmy) ** 2);
      if (cursorDelta < 3 && mx > 0) {
        dwellTime.current = Math.min(dwellTime.current + 0.016, 4);
      } else {
        dwellTime.current *= 0.95;
      }
      const dwellFactor = Math.min(dwellTime.current / 1.5, 1);

      const targetIntensity = mx > 0 ? 0.3 + dwellFactor * 0.7 : 0;
      globalIntensity.current += (targetIntensity - globalIntensity.current) * 0.03;
      const gi = globalIntensity.current;

      // update nodes
      for (const n of ns) {
        const dx = mx - n.ox;
        const dy = my - n.oy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const effectiveRadius = radius + dwellFactor * 80;

        if (d < effectiveRadius) {
          const pull = (1 - d / effectiveRadius) * (14 + dwellFactor * 10);
          n.x += (n.ox + (dx / (d || 1)) * pull - n.x) * 0.08;
          n.y += (n.oy + (dy / (d || 1)) * pull - n.y) * 0.08;
          n.energy = Math.min(n.energy + 0.02 + dwellFactor * 0.04, 1);
          // build memory (persistent trace)
          n.memory = Math.min(n.memory + 0.005 + dwellFactor * 0.01, 1);
        } else {
          n.x += (n.ox - n.x) * 0.04;
          n.y += (n.oy - n.y) * 0.04;
          n.energy *= 0.992;
        }
        // memory decays very slowly
        n.memory *= 0.9997;
      }

      // create persistent edges near cursor
      if (mx > 0 && dwellFactor > 0.1) {
        for (let i = 0; i < ns.length; i++) {
          const di = Math.sqrt((mx - ns[i].x) ** 2 + (my - ns[i].y) ** 2);
          if (di > dwellRadius) continue;
          for (let j = i + 1; j < ns.length; j++) {
            const dj = Math.sqrt((mx - ns[j].x) ** 2 + (my - ns[j].y) ** 2);
            if (dj > dwellRadius) continue;
            const edgeDist = Math.sqrt((ns[i].x - ns[j].x) ** 2 + (ns[i].y - ns[j].y) ** 2);
            if (edgeDist > 110) continue;
            const exists = pes.find(e => (e.i === i && e.j === j) || (e.i === j && e.j === i));
            if (exists) {
              exists.strength = Math.min(exists.strength + 0.01 * dwellFactor, 1);
              exists.memory = Math.min(exists.memory + 0.003, 1);
            } else if (Math.random() < 0.003 * dwellFactor) {
              pes.push({ i, j, strength: 0.15, memory: 0.05 });
            }
          }
        }
      }

      // decay edges
      for (let i = pes.length - 1; i >= 0; i--) {
        pes[i].strength *= 0.9985;
        pes[i].memory *= 0.9998; // memory decays very slowly
        if (pes[i].strength < 0.01 && pes[i].memory < 0.005) pes.splice(i, 1);
      }

      // try form constellations periodically
      if (frameCount.current % 30 === 0) tryFormConstellation();

      // decay constellations
      for (let i = cons.length - 1; i >= 0; i--) {
        cons[i].brightness *= 0.9995;
        cons[i].pulsePhase += cons[i].pulseSpeed;
        if (cons[i].brightness < 0.005) cons.splice(i, 1);
      }

      // spawn flow particles along edges (ambient)
      if (fps.length < 40) {
        for (const pe of pes) {
          if (pe.strength > 0.1 && Math.random() < pe.strength * 0.02) {
            fps.push({ edge: pes.indexOf(pe), progress: 0, speed: 0.005 + Math.random() * 0.015, size: 1 + pe.strength * 1.5 });
          }
        }
      }

      // spawn cursor impulses — from cursor to nearby nodes
      const cis = cursorImpulses.current;
      if (mx > 0 && cis.length < 30) {
        const spawnRate = 0.08 + dwellFactor * 0.15;
        if (Math.random() < spawnRate) {
          // find nodes within range, weighted by proximity
          const candidates: { idx: number; dist: number }[] = [];
          for (let i = 0; i < ns.length; i++) {
            const d = Math.hypot(mx - ns[i].x, my - ns[i].y);
            if (d > 40 && d < 250 + dwellFactor * 100) {
              candidates.push({ idx: i, dist: d });
            }
          }
          if (candidates.length > 0) {
            // prefer closer nodes
            candidates.sort((a, b) => a.dist - b.dist);
            const pick = candidates[Math.floor(Math.random() * Math.min(candidates.length, 8))];
            cis.push({
              originX: mx, originY: my,
              nodeIdx: pick.idx,
              progress: 0,
              speed: 0.012 + Math.random() * 0.01,
              returning: false,
              size: 1.2 + Math.random() * 0.8,
            });
          }
        }
      }

      // === DRAW ===

      // 1. Memory traces (soft radial glows behind nodes)
      for (const n of ns) {
        if (n.memory > 0.01) {
          const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 8 + n.memory * 12);
          grad.addColorStop(0, `rgba(255,255,255,${n.memory * 0.08})`);
          grad.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(n.x, n.y, 8 + n.memory * 12, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Constellation shapes (faint geometric outlines)
      for (const con of cons) {
        const pulse = 0.7 + 0.3 * Math.sin(con.pulsePhase);
        const alpha = con.brightness * pulse * 0.12;
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let k = 0; k < con.nodes.length; k++) {
          const n = ns[con.nodes[k]];
          k === 0 ? ctx.moveTo(n.x, n.y) : ctx.lineTo(n.x, n.y);
        }
        ctx.closePath();
        ctx.stroke();
        // faint fill
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.15})`;
        ctx.fill();
      }

      // 3. Ambient edges
      const maxD = 80 + gi * 30;
      ctx.lineWidth = 0.5;
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[i].x - ns[j].x;
          const dy = ns[i].y - ns[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > maxD) continue;
          const midX = (ns[i].x + ns[j].x) / 2;
          const midY = (ns[i].y + ns[j].y) / 2;
          const dm = Math.sqrt((mx - midX) ** 2 + (my - midY) ** 2);
          const effectiveR = radius + dwellFactor * 100;
          let a = 0.03 + gi * 0.02;
          if (dm < effectiveR) a += (1 - dm / effectiveR) * (0.12 + dwellFactor * 0.15);
          a += (ns[i].memory + ns[j].memory) * 0.04;
          a += (ns[i].energy + ns[j].energy) * 0.06;
          ctx.strokeStyle = `rgba(255,255,255,${a * (1 - d / maxD)})`;
          ctx.beginPath();
          ctx.moveTo(ns[i].x, ns[i].y);
          ctx.lineTo(ns[j].x, ns[j].y);
          ctx.stroke();
        }
      }

      // 4. Persistent edge traces (memory layer)
      for (const pe of pes) {
        const a = ns[pe.i], b = ns[pe.j];
        // memory trace (dim, persistent)
        if (pe.memory > 0.01) {
          ctx.strokeStyle = `rgba(255,255,255,${pe.memory * 0.15})`;
          ctx.lineWidth = 0.4 + pe.memory;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        // active edge (brighter)
        if (pe.strength > 0.02) {
          ctx.strokeStyle = `rgba(255,255,255,${pe.strength * 0.35})`;
          ctx.lineWidth = 0.5 + pe.strength * 1.5;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      ctx.lineWidth = 0.5;

      // 5. Flow particles
      for (let i = fps.length - 1; i >= 0; i--) {
        const fp = fps[i];
        fp.progress += fp.speed;
        if (fp.progress >= 1 || fp.edge >= pes.length) { fps.splice(i, 1); continue; }
        const pe = pes[fp.edge];
        if (!pe) { fps.splice(i, 1); continue; }
        const a = ns[pe.i], b = ns[pe.j];
        const px = a.x + (b.x - a.x) * fp.progress;
        const py = a.y + (b.y - a.y) * fp.progress;
        const alpha = pe.strength * 0.7 * Math.sin(fp.progress * Math.PI);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath(); ctx.arc(px, py, fp.size, 0, Math.PI * 2); ctx.fill();
      }

      // 5b. Cursor impulses (cursor → node → cursor)
      for (let i = cis.length - 1; i >= 0; i--) {
        const ci = cis[i];
        ci.progress += ci.speed;
        if (ci.progress >= 1) {
          if (!ci.returning) {
            // reached the node — energize it, then spawn return impulse
            const node = ns[ci.nodeIdx];
            if (node) {
              node.energy = Math.min(node.energy + 0.15, 1);
              node.memory = Math.min(node.memory + 0.05, 1);
            }
            cis.splice(i, 1);
            // spawn return impulse back to current cursor
            cis.push({
              originX: mx, originY: my,
              nodeIdx: ci.nodeIdx,
              progress: 0,
              speed: 0.01 + Math.random() * 0.012,
              returning: true,
              size: ci.size * 0.8,
            });
          } else {
            // returned to cursor — done
            cis.splice(i, 1);
          }
          continue;
        }
        const node = ns[ci.nodeIdx];
        if (!node) { cis.splice(i, 1); continue; }
        let px: number, py: number;
        if (!ci.returning) {
          // outgoing: from spawn origin to node
          px = ci.originX + (node.x - ci.originX) * ci.progress;
          py = ci.originY + (node.y - ci.originY) * ci.progress;
        } else {
          // returning: from node to current cursor (dynamic target)
          px = node.x + (mx - node.x) * ci.progress;
          py = node.y + (my - node.y) * ci.progress;
        }
        const alpha = 0.6 * Math.sin(ci.progress * Math.PI);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath(); ctx.arc(px, py, ci.size, 0, Math.PI * 2); ctx.fill();
        // draw faint trail line
        if (alpha > 0.1) {
          ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.2})`;
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          if (!ci.returning) {
            ctx.moveTo(ci.originX, ci.originY); ctx.lineTo(px, py);
          } else {
            ctx.moveTo(node.x, node.y); ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }

      // 6. Nodes
      for (const n of ns) {
        const d = Math.sqrt((mx - n.x) ** 2 + (my - n.y) ** 2);
        const effectiveR = radius + dwellFactor * 80;
        let a = 0.15 + gi * 0.08 + n.energy * 0.3 + n.memory * 0.15;
        if (d < effectiveR) a += (1 - d / effectiveR) * (0.4 + dwellFactor * 0.3);
        const r = n.r + n.energy * 0.8 + n.memory * 0.3;
        ctx.fillStyle = `rgba(255,255,255,${Math.min(a, 1)})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
      }

      if (running) {
        raf.current = requestAnimationFrame(draw);
      }
    };
    raf.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, [build]);

  return <canvas ref={cvs} className="fixed inset-0 w-full h-full" style={{ zIndex: 0 }} />;
}

/* ────────────────────────────────────────────────────────────────
   2.  ADAPTIVE PATHS CANVAS — branching knowledge lines
   ──────────────────────────────────────────────────────────────── */

interface Branch {
  pts: { x: number; y: number }[];
  speed: number;
  progress: number;
  opacity: number;
}

export function AdaptivePathsCanvas() {
  const cvs = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const c = cvs.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    let w = c.offsetWidth, h = c.offsetHeight;
    c.width = w; c.height = h;

    const makeBranch = (): Branch => {
      const pts: { x: number; y: number }[] = [];
      let x = 0, y = h * (0.2 + Math.random() * 0.6);
      const steps = 6 + Math.floor(Math.random() * 5);
      for (let i = 0; i <= steps; i++) {
        pts.push({ x, y }); x += w / steps;
        y += (Math.random() - 0.5) * (h * 0.2);
        y = Math.max(20, Math.min(h - 20, y));
      }
      return { pts, speed: 0.003 + Math.random() * 0.004, progress: 0, opacity: 0.15 + Math.random() * 0.2 };
    };
    const branches: Branch[] = Array.from({ length: 8 }, makeBranch);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const b of branches) {
        b.progress += b.speed;
        if (b.progress > 1.2) { Object.assign(b, makeBranch()); b.progress = 0; }
        const drawLen = Math.min(b.progress, 1);
        ctx.strokeStyle = `rgba(255,255,255,${b.opacity})`; ctx.lineWidth = 1; ctx.beginPath();
        for (let t = 0; t <= drawLen; t += 0.01) {
          const idx = t * (b.pts.length - 1); const i = Math.floor(idx); const f = idx - i;
          const p0 = b.pts[Math.max(0, i - 1)], p1 = b.pts[i];
          const p2 = b.pts[Math.min(b.pts.length - 1, i + 1)], p3 = b.pts[Math.min(b.pts.length - 1, i + 2)];
          const x = cm(p0.x, p1.x, p2.x, p3.x, f), y = cm(p0.y, p1.y, p2.y, p3.y, f);
          t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        if (b.progress <= 1) {
          const idx = b.progress * (b.pts.length - 1); const i = Math.floor(idx); const f = idx - i;
          const p0 = b.pts[Math.max(0, i - 1)], p1 = b.pts[i];
          const p2 = b.pts[Math.min(b.pts.length - 1, i + 1)], p3 = b.pts[Math.min(b.pts.length - 1, i + 2)];
          ctx.fillStyle = `rgba(255,255,255,${b.opacity + 0.3})`; ctx.beginPath();
          ctx.arc(cm(p0.x, p1.x, p2.x, p3.x, f), cm(p0.y, p1.y, p2.y, p3.y, f), 2.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);
    const onResize = () => { w = c.offsetWidth; h = c.offsetHeight; c.width = w; c.height = h; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener("resize", onResize); };
  }, []);

  return <canvas ref={cvs} className="w-full h-full" />;
}

function cm(p0: number, p1: number, p2: number, p3: number, t: number) {
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

/* ────────────────────────────────────────────────────────────────
   3.  SURVEY COMPARISON CANVAS — side-by-side split
   Traditional Survey (left) vs Intelligent Survey (right)
   Both reset every ~10 seconds (600 frames at 60fps)

   KEY MECHANIC: Packet travel speed is IDENTICAL on both sides.
   The speed advantage of the intelligent survey comes ONLY from:
     - No waiting for all responses to come back
     - No post-processing / analysis delay
     - No drafting-new-survey delay
     - Immediate AI-adapted follow-up per response
   ──────────────────────────────────────────────────────────────── */

interface SurveyNode {
  x: number; y: number;
  reached: boolean;
  reachedTime: number;
  ring: number;
  angle: number;
  neighbors: number[];
  cluster: number;
  respondedBack: boolean; // for traditional: has this node sent its response back?
}

interface SurveyPacket {
  from: number; to: number;
  progress: number;
  speed: number;
  returning: boolean;
  size: number;
  isAdapted?: boolean;
}

// Same speed for all packets on both sides
const PACKET_SPEED = 0.015;
const PACKET_JITTER = 0.005;

function buildSurveyNodes(cx: number, cy: number, w: number, h: number): SurveyNode[] {
  const nodes: SurveyNode[] = [];
  nodes.push({ x: cx, y: cy, reached: true, reachedTime: 0, ring: 0, angle: 0, neighbors: [], cluster: -1, respondedBack: false });

  const ringCounts = [8, 16, 28, 40];
  const ringRadii = [0.12, 0.24, 0.38, 0.48];
  const minDim = Math.min(w, h);

  for (let r = 0; r < ringCounts.length; r++) {
    for (let i = 0; i < ringCounts[r]; i++) {
      const angle = (i / ringCounts[r]) * Math.PI * 2 + (r * 0.3);
      const jitter = (Math.random() - 0.5) * 0.03;
      const radius = ringRadii[r] * minDim + (Math.random() - 0.5) * 15;
      const cluster = Math.floor(((angle + jitter + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2 / 6));
      nodes.push({
        x: cx + Math.cos(angle + jitter) * radius,
        y: cy + Math.sin(angle + jitter) * radius,
        reached: false, reachedTime: -1,
        ring: r + 1, angle: angle + jitter,
        neighbors: [], cluster,
        respondedBack: false,
      });
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (d < minDim * 0.14) {
        nodes[i].neighbors.push(j);
        nodes[j].neighbors.push(i);
      }
    }
  }

  return nodes;
}

function resetNodes(nodes: SurveyNode[]) {
  for (let i = 0; i < nodes.length; i++) {
    if (i === 0) { nodes[i].reached = true; nodes[i].reachedTime = 0; nodes[i].respondedBack = false; }
    else { nodes[i].reached = false; nodes[i].reachedTime = -1; nodes[i].respondedBack = false; }
  }
}

// helper: draw a dark pill-shaped label background
function drawLabelBg(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string) {
  ctx.font = font;
  const m = ctx.measureText(text);
  const pw = m.width + 16;
  const ph = 18;
  ctx.fillStyle = "rgba(8,8,12,0.85)";
  ctx.beginPath();
  const rx = x - pw / 2, ry = y - ph / 2 - 1;
  ctx.roundRect(rx, ry, pw, ph, 4);
  ctx.fill();
}

export default function SurveyComparisonCanvas() {
  const cvs = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const c = cvs.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    let w = c.offsetWidth, h = c.offsetHeight;
    c.width = w; c.height = h;
    let running = true;

    let halfW = w / 2;
    let leftCx = halfW / 2, rightCx = halfW + halfW / 2;
    let cy = h / 2;

    // Same number of nodes on both sides (same org)
    let tradN = buildSurveyNodes(leftCx, cy, halfW, h);
    let intellN = buildSurveyNodes(rightCx, cy, halfW, h);
    let tradP: SurveyPacket[] = [];
    let intellP: SurveyPacket[] = [];
    let tradReached = 1;
    let intellReached = 1;
    let t = 0;

    const CYCLE = 600; // 10 seconds at 60fps
    const totalNodes = tradN.length;

    // Traditional: iteration & phase tracking
    let tradIteration = 1;
    let tradPhase: "sending" | "waiting" | "processing" | "drafting" = "sending";
    let tradPhaseStart = 0;
    let tradBurstSent = false;
    let tradAllResponded = false;

    // Intelligent: directional bias
    let expansionBias: number[] = [];
    function pickExpansionDirs() {
      const count = 2 + Math.floor(Math.random() * 2);
      const dirs: number[] = [];
      while (dirs.length < count) {
        const d = Math.floor(Math.random() * 6);
        if (!dirs.includes(d)) dirs.push(d);
      }
      expansionBias = dirs;
    }
    pickExpansionDirs();

    const resetCycle = () => {
      t = 0;
      resetNodes(tradN);
      resetNodes(intellN);
      tradP = [];
      intellP = [];
      tradReached = 1;
      intellReached = 1;
      tradIteration = 1;
      tradPhase = "sending";
      tradPhaseStart = 0;
      tradBurstSent = false;
      tradAllResponded = false;
      pickExpansionDirs();
    };

    // Traditional phase durations (in frames)
    const TRAD_PROCESS_DUR = 60;
    const TRAD_DRAFT_DUR = 50;

    const draw = () => {
      if (!running) return;
      t++;
      if (t >= CYCLE) resetCycle();

      ctx.clearRect(0, 0, w, h);

      // divider
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(halfW, 40); ctx.lineTo(halfW, h - 50); ctx.stroke();

      // ═══════════════════════════════════════
      // LEFT: Traditional Survey
      // burst out → each dot responds back (trickle) → wait for ALL → process → draft → next
      // ═══════════════════════════════════════

      const tradPhaseElapsed = t - tradPhaseStart;

      // Check if all responses are back during "waiting"
      if (tradPhase === "waiting") {
        const currentRingNodes = tradN.filter(n => n.ring === tradIteration && n.reached);
        tradAllResponded = currentRingNodes.length > 0 && currentRingNodes.every(n => n.respondedBack);
        // Also must have no outbound or return packets in flight
        const hasInFlight = tradP.length > 0;
        if (tradAllResponded && !hasInFlight) {
          tradPhase = "processing";
          tradPhaseStart = t;
        }
      } else if (tradPhase === "processing" && tradPhaseElapsed >= TRAD_PROCESS_DUR) {
        tradPhase = "drafting";
        tradPhaseStart = t;
      } else if (tradPhase === "drafting" && tradPhaseElapsed >= TRAD_DRAFT_DUR) {
        tradIteration++;
        if (tradIteration <= 4) {
          tradPhase = "sending";
          tradPhaseStart = t;
          tradBurstSent = false;
          tradAllResponded = false;
        }
      }

      // Sending phase: burst ALL packets at once to current ring
      if (tradPhase === "sending" && !tradBurstSent) {
        tradBurstSent = true;
        const targetRing = tradIteration;
        const targets = tradN.filter(n => n.ring === targetRing && !n.reached);
        for (const target of targets) {
          const idx = tradN.indexOf(target);
          tradP.push({
            from: 0, to: idx, progress: 0,
            speed: PACKET_SPEED + (Math.random() - 0.5) * PACKET_JITTER,
            returning: false, size: 2,
          });
        }
        // Also transition to waiting after a few frames
        setTimeout(() => {
          if (tradPhase === "sending") {
            tradPhase = "waiting";
            tradPhaseStart = t;
          }
        }, 0);
      }

      // draw trad edges (hub-to-node radial lines)
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 0.4;
      for (const n of tradN) {
        if (n.ring === 0) continue;
        ctx.beginPath(); ctx.moveTo(tradN[0].x, tradN[0].y); ctx.lineTo(n.x, n.y); ctx.stroke();
      }

      // draw trad nodes
      for (let i = 0; i < tradN.length; i++) {
        const n = tradN[i];
        const isHub = i === 0;
        if (isHub) {
          const pulse = 0.6 + 0.4 * Math.sin(t * 0.05);
          ctx.fillStyle = `rgba(255,255,255,${0.8 * pulse})`;
          ctx.beginPath(); ctx.arc(n.x, n.y, 4 + pulse * 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = `rgba(255,255,255,${isHub ? 0.8 : n.reached ? 0.5 : 0.15})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, isHub ? 4 : n.reached ? 2 : 1.2, 0, Math.PI * 2); ctx.fill();
      }

      // draw + update trad packets
      for (let i = tradP.length - 1; i >= 0; i--) {
        const p = tradP[i];
        p.progress += p.speed;
        if (p.progress >= 1) {
          if (!p.returning && tradN[p.to]) {
            tradN[p.to].reached = true;
            tradN[p.to].reachedTime = t;
            tradReached = tradN.filter(n => n.reached).length;
            // Schedule a trickle-back response with random delay
            const nodeIdx = p.to;
            const delay = 20 + Math.floor(Math.random() * 80); // 20-100 frames delay
            setTimeout(() => {
              if (!tradN[nodeIdx].respondedBack && running) {
                tradN[nodeIdx].respondedBack = true;
                tradP.push({
                  from: nodeIdx, to: 0, progress: 0,
                  speed: PACKET_SPEED + (Math.random() - 0.5) * PACKET_JITTER,
                  returning: true, size: 1.5,
                });
              }
            }, delay * 16.67); // convert frames to ms
          }
          tradP.splice(i, 1); continue;
        }
        const from = tradN[p.from], to = tradN[p.to];
        const px = from.x + (to.x - from.x) * p.progress;
        const py = from.y + (to.y - from.y) * p.progress;
        ctx.fillStyle = `rgba(255,255,255,${p.returning ? 0.4 : 0.7})`;
        ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fill();
      }

      // ═══════════════════════════════════════
      // RIGHT: Intelligent Survey — same speed, zero delay
      // Each response → impulse to hub → hub immediately sends adapted question
      // ═══════════════════════════════════════

      // Continuous spawning from frontier (no batching, no waiting)
      // Spawn rate increases gently with coverage (more frontier = more activity)
      const coverageRatio = intellReached / totalNodes;
      const spawnChance = 0.15 + coverageRatio * 0.2; // gentle ramp

      if (Math.random() < spawnChance && intellP.length < 80) {
        const frontier: number[] = [];
        for (let ri = 0; ri < intellN.length; ri++) {
          if (intellN[ri].reached && intellN[ri].neighbors.some(ni => !intellN[ni].reached)) {
            frontier.push(ri);
          }
        }
        if (frontier.length > 0) {
          // bias toward expansion directions
          const biasedFrontier = frontier.filter(fi => expansionBias.includes(intellN[fi].cluster));
          let sourceIdx: number;
          if (biasedFrontier.length > 0 && Math.random() < 0.65) {
            sourceIdx = biasedFrontier[Math.floor(Math.random() * biasedFrontier.length)];
          } else {
            sourceIdx = frontier[Math.floor(Math.random() * frontier.length)];
          }
          const unreached = intellN[sourceIdx].neighbors.filter(ni => !intellN[ni].reached);
          if (unreached.length > 0) {
            const biasedTargets = unreached.filter(ni => expansionBias.includes(intellN[ni].cluster));
            const target = biasedTargets.length > 0 && Math.random() < 0.5
              ? biasedTargets[Math.floor(Math.random() * biasedTargets.length)]
              : unreached[Math.floor(Math.random() * unreached.length)];
            intellP.push({
              from: sourceIdx, to: target, progress: 0,
              speed: PACKET_SPEED + (Math.random() - 0.5) * PACKET_JITTER, // SAME speed
              returning: false, size: 1.8,
            });
          }
        }
      }

      // Lateral knowledge exchange between reached nodes
      const lateralRate = Math.min(coverageRatio, 0.4) * 0.2;
      if (Math.random() < lateralRate && intellP.length < 80) {
        const reached: number[] = [];
        for (let ri = 0; ri < intellN.length; ri++) { if (intellN[ri].reached) reached.push(ri); }
        if (reached.length >= 2) {
          const ai = reached[Math.floor(Math.random() * reached.length)];
          const rn = intellN[ai].neighbors.filter(ni => intellN[ni].reached);
          if (rn.length > 0) {
            const bi = rn[Math.floor(Math.random() * rn.length)];
            intellP.push({
              from: ai, to: bi, progress: 0,
              speed: PACKET_SPEED + (Math.random() - 0.5) * PACKET_JITTER,
              returning: false, size: 1,
            });
          }
        }
      }

      // draw intelligent edges
      ctx.lineWidth = 0.4;
      for (let i = 0; i < intellN.length; i++) {
        if (!intellN[i].reached) continue;
        for (const j of intellN[i].neighbors) {
          if (j <= i || !intellN[j].reached) continue;
          const age = Math.min((t - Math.max(intellN[i].reachedTime, intellN[j].reachedTime)) / 150, 1);
          ctx.strokeStyle = `rgba(255,255,255,${0.03 + age * 0.08})`;
          ctx.beginPath(); ctx.moveTo(intellN[i].x, intellN[i].y); ctx.lineTo(intellN[j].x, intellN[j].y); ctx.stroke();
        }
      }

      // draw intelligent nodes
      for (let i = 0; i < intellN.length; i++) {
        const n = intellN[i];
        const isHub = i === 0;
        let alpha: number, r: number;
        if (isHub) { alpha = 0.8; r = 4; }
        else if (n.reached) {
          const age = Math.min((t - n.reachedTime) / 80, 1);
          alpha = 0.25 + age * 0.4;
          r = 1.5 + age * 1;
        } else { alpha = 0.1; r = 1; }
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
      }

      // draw + update intelligent packets
      for (let i = intellP.length - 1; i >= 0; i--) {
        const p = intellP[i];
        p.progress += p.speed;
        if (p.progress >= 1) {
          if (!p.returning && !intellN[p.to].reached) {
            intellN[p.to].reached = true;
            intellN[p.to].reachedTime = t;
            intellReached = intellN.filter(n => n.reached).length;
            // Response impulse back to hub (same speed)
            intellP.push({
              from: p.to, to: 0, progress: 0,
              speed: PACKET_SPEED + (Math.random() - 0.5) * PACKET_JITTER,
              returning: true, size: 1.2,
            });
          }
          // When impulse reaches hub → immediately send AI-adapted question
          if (p.returning && p.to === 0) {
            const origin = p.from;
            if (origin > 0 && origin < intellN.length) {
              // Find unreached neighbor near the origin area
              const nearUnreached = intellN[origin].neighbors.filter(ni => !intellN[ni].reached);
              if (nearUnreached.length > 0) {
                const adaptedTarget = nearUnreached[Math.floor(Math.random() * nearUnreached.length)];
                intellP.push({
                  from: 0, to: adaptedTarget, progress: 0,
                  speed: PACKET_SPEED + (Math.random() - 0.5) * PACKET_JITTER,
                  returning: false, size: 2, isAdapted: true,
                });
              }
            }
          }
          intellP.splice(i, 1); continue;
        }
        const from = intellN[p.from], to = intellN[p.to];
        const px = from.x + (to.x - from.x) * p.progress;
        const py = from.y + (to.y - from.y) * p.progress;
        ctx.fillStyle = p.isAdapted
          ? "rgba(255,255,255,0.9)"
          : `rgba(255,255,255,${p.returning ? 0.5 : 0.7})`;
        ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fill();
      }

      // ─── Labels (with dark backgrounds to avoid dot overlap) ───

      // Top titles
      const titleFont = "11px monospace";
      drawLabelBg(ctx, "TRADITIONAL SURVEY", leftCx, 22, titleFont);
      ctx.font = titleFont;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText("TRADITIONAL SURVEY", leftCx, 26);

      drawLabelBg(ctx, "INTELLIGENT SURVEY", rightCx, 22, titleFont);
      ctx.font = titleFont;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText("INTELLIGENT SURVEY", rightCx, 26);

      // Phase labels
      const phaseFont = "9px monospace";
      let tradLabel = "";
      if (tradIteration <= 4) {
        if (tradPhase === "sending") tradLabel = `Iteration ${tradIteration} · Sending survey`;
        else if (tradPhase === "waiting") tradLabel = `Iteration ${tradIteration} · Waiting for responses`;
        else if (tradPhase === "processing") tradLabel = `Iteration ${tradIteration} · Analysing results`;
        else if (tradPhase === "drafting") tradLabel = tradIteration < 4 ? `Iteration ${tradIteration} · Drafting new survey` : "Analysis complete";
      } else {
        tradLabel = "Analysis complete";
      }
      drawLabelBg(ctx, tradLabel, leftCx, h - 44, phaseFont);
      ctx.font = phaseFont;
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillText(tradLabel, leftCx, h - 40);

      const coverage = Math.round((intellReached / totalNodes) * 100);
      const intellLabel = coverage < 15
        ? "AI adapting questionnaire in real-time"
        : coverage < 50
        ? "Network effects accelerating coverage"
        : "Deep knowledge network established";
      drawLabelBg(ctx, intellLabel, rightCx, h - 44, phaseFont);
      ctx.font = phaseFont;
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillText(intellLabel, rightCx, h - 40);

      // Counters (reached only, no total)
      const counterFont = "bold 16px monospace";
      const tradCounter = `${tradReached} responses`;
      drawLabelBg(ctx, tradCounter, leftCx, h - 18, counterFont);
      ctx.font = counterFont;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(tradCounter, leftCx, h - 14);

      const intellCounter = `${intellReached} responses`;
      drawLabelBg(ctx, intellCounter, rightCx, h - 18, counterFont);
      ctx.font = counterFont;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(intellCounter, rightCx, h - 14);

      if (running) raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);

    const onResize = () => {
      w = c.offsetWidth; h = c.offsetHeight; c.width = w; c.height = h;
      halfW = w / 2;
      leftCx = halfW / 2; rightCx = halfW + halfW / 2;
      cy = h / 2;
      tradN = buildSurveyNodes(leftCx, cy, halfW, h);
      intellN = buildSurveyNodes(rightCx, cy, halfW, h);
      resetCycle();
    };
    window.addEventListener("resize", onResize);
    return () => { running = false; cancelAnimationFrame(raf.current); window.removeEventListener("resize", onResize); };
  }, []);

  return <canvas ref={cvs} className="w-full h-full" />;
}
