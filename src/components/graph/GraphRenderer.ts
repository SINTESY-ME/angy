import type { GraphNode, GraphEdge } from './GraphTypes';

// ── Canvas 2D rendering engine for the agent graph ───────────────────────

// Node style constants
const AGENT_RADIUS = 22;
const CARD_HEIGHT = 26;
const CARD_PAD_X = 10;
const CARD_MIN_W = 52;
const CARD_R = 6;
const MILESTONE_RADIUS = 18;
const VALIDATION_RADIUS = 13;
const CHECKPOINT_RADIUS = 14;

// ── Catppuccin Mocha palette ─────────────────────────────────────────────
const BG_BASE      = '#0f1117';
const BG_SURFACE   = '#1c1f2a';
const BG_RAISED    = '#252836';
const BORDER_SUB   = 'rgba(255,255,255,0.04)';
const BORDER_STD   = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY  = '#e2e8f0';
const TEXT_SECOND   = '#94a3b8';
const TEXT_MUTED    = '#64748b';
const TEXT_FAINT    = '#475569';
const ACCENT_MAUVE  = '#cba6f7';
const ACCENT_BLUE   = '#89b4fa';
const ACCENT_TEAL   = '#10b981';
const ACCENT_EMBER  = '#f59e0b';
const ACCENT_CYAN   = '#22d3ee';
const ACCENT_ROSE   = '#FF6B8A';
const GREEN         = '#a6e3a1';
const RED           = '#f38ba8';
const GHOST         = '#45475a';

const STATUS_COLORS: Record<string, string> = {
  idle:    TEXT_MUTED,
  working: ACCENT_TEAL,
  done:    GREEN,
  error:   RED,
  blocked: ACCENT_EMBER,
};

const TOOL_COLOR       = ACCENT_BLUE;
const FILE_COLOR       = ACCENT_CYAN;
const CHECKPOINT_COLOR = GREEN;

const EDGE_COLORS: Record<string, string> = {
  delegation:     ACCENT_MAUVE,
  'tool-call':    ACCENT_BLUE,
  'file-touch':   'rgba(34,211,238,0.45)',
  'peer-message': ACCENT_EMBER,
  validation:     GREEN,
  checkpoint:     GREEN,
};

const FONT_SANS = '"Inter", -apple-system, sans-serif';
const FONT_MONO = '"JetBrains Mono", monospace';

export class GraphRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private dirty = true;
  private time = 0;

  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];

  private zoom = 1;
  private panX = 0;
  private panY = 0;

  private hoveredNodeId: string | null = null;
  private selectedNodeId: string | null = null;

  private currentTurn = Infinity;
  private maxTurn = 0;

  private nodeById = new Map<string, GraphNode>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas 2d context');
    this.ctx = ctx;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  start(): void {
    if (this.animFrameId !== null) return;
    const loop = () => {
      this.time += 16;
      if (this.dirty) {
        this.render();
        this.dirty = this.hasAnimatedElements();
      }
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  markDirty(): void {
    this.dirty = true;
  }

  // ── Data ─────────────────────────────────────────────────────────────

  setData(nodes: GraphNode[], edges: GraphEdge[]): void {
    this.nodes = nodes;
    this.edges = edges;
    this.nodeById.clear();
    for (const n of nodes) {
      this.nodeById.set(n.id, n);
    }
    this.dirty = true;
  }

  setTransform(zoom: number, panX: number, panY: number): void {
    this.zoom = zoom;
    this.panX = panX;
    this.panY = panY;
    this.dirty = true;
  }

  // ── Interaction state ────────────────────────────────────────────────

  setHoveredNode(id: string | null): void {
    if (this.hoveredNodeId !== id) {
      this.hoveredNodeId = id;
      this.dirty = true;
    }
  }

  setSelectedNode(id: string | null): void {
    if (this.selectedNodeId !== id) {
      this.selectedNodeId = id;
      this.dirty = true;
    }
  }

  setCurrentTurn(turn: number, max: number): void {
    this.currentTurn = turn;
    this.maxTurn = max;
    this.dirty = true;
  }

  private isInTimeSlice(node: GraphNode): boolean {
    if (this.currentTurn >= this.maxTurn) return true;
    return node.turnId === undefined || node.turnId <= this.currentTurn;
  }

  private isEdgeInTimeSlice(edge: GraphEdge): boolean {
    if (this.currentTurn >= this.maxTurn) return true;
    return edge.turnId === undefined || edge.turnId <= this.currentTurn;
  }

  // ── Hit testing ──────────────────────────────────────────────────────

  hitTest(screenX: number, screenY: number): GraphNode | null {
    const worldX = (screenX - this.panX) / this.zoom;
    const worldY = (screenY - this.panY) / this.zoom;

    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i];
      const dx = worldX - node.x;
      const dy = worldY - node.y;

      switch (node.type) {
        case 'agent': {
          if (dx * dx + dy * dy <= AGENT_RADIUS * AGENT_RADIUS) return node;
          break;
        }
        case 'tool': {
          const tw = this.measureCardWidth(node);
          if (Math.abs(dx) <= tw / 2 && Math.abs(dy) <= CARD_HEIGHT / 2) return node;
          break;
        }
        case 'file': {
          const fw = this.measureCardWidth(node);
          if (Math.abs(dx) <= fw / 2 && Math.abs(dy) <= CARD_HEIGHT / 2) return node;
          break;
        }
        case 'validation': {
          if (dx * dx + dy * dy <= VALIDATION_RADIUS * VALIDATION_RADIUS) return node;
          break;
        }
        case 'milestone': {
          if (dx * dx + dy * dy <= MILESTONE_RADIUS * MILESTONE_RADIUS) return node;
          break;
        }
        case 'checkpoint': {
          if (dx * dx + dy * dy <= CHECKPOINT_RADIUS * CHECKPOINT_RADIUS) return node;
          break;
        }
      }
    }

    return null;
  }

  // ── Rendering ────────────────────────────────────────────────────────

  private render(): void {
    const { ctx, canvas } = this;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Subtle dot grid background
    this.drawGrid(w, h);

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    for (const edge of this.edges) {
      this.drawEdge(edge);
    }
    for (const node of this.nodes) {
      this.drawNode(node);
    }

    ctx.restore();
  }

  private drawGrid(w: number, h: number): void {
    const { ctx } = this;
    const step = 24;
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    for (let x = (this.panX % step + step) % step; x < w; x += step) {
      for (let y = (this.panY % step + step) % step; y < h; y += step) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // ── Edge drawing ─────────────────────────────────────────────────────

  private drawEdge(edge: GraphEdge): void {
    const src = this.nodeById.get(edge.source);
    const tgt = this.nodeById.get(edge.target);
    if (!src || !tgt) return;

    const { ctx } = this;
    ctx.save();

    if (!this.isEdgeInTimeSlice(edge)) {
      ctx.globalAlpha = 0.12;
    }

    const color = EDGE_COLORS[edge.type] || GHOST;
    const isHoverConnected =
      this.hoveredNodeId !== null &&
      (edge.source === this.hoveredNodeId || edge.target === this.hoveredNodeId);
    const lwBoost = isHoverConnected ? 1.5 : 0;

    if (isHoverConnected) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }

    switch (edge.type) {
      case 'delegation': {
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 + lwBoost;
        this.drawBezierEdge(src, tgt);
        ctx.shadowBlur = 0;
        this.drawArrowhead(src, tgt, color);
        break;
      }
      case 'tool-call': {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2 + lwBoost;
        if (edge.animated) {
          ctx.setLineDash([5, 3]);
          ctx.lineDashOffset = -(this.time * 0.05);
        }
        this.drawStraightEdge(src, tgt);
        this.drawArrowhead(src, tgt, color);
        break;
      }
      case 'file-touch': {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 + lwBoost;
        ctx.setLineDash([3, 3]);
        this.drawStraightEdge(src, tgt);
        break;
      }
      case 'peer-message': {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 + lwBoost;
        ctx.setLineDash([6, 3]);
        this.drawStraightEdge(src, tgt);
        this.drawArrowhead(src, tgt, color);
        this.drawArrowhead(tgt, src, color);
        break;
      }
      case 'validation': {
        const pass = edge.label !== 'fail';
        const vColor = pass ? GREEN : RED;
        ctx.strokeStyle = vColor;
        ctx.lineWidth = 1.5 + lwBoost;
        this.drawStraightEdge(src, tgt);
        this.drawArrowhead(src, tgt, vColor);
        break;
      }
      case 'checkpoint': {
        ctx.strokeStyle = CHECKPOINT_COLOR;
        ctx.lineWidth = 1.5 + lwBoost;
        this.drawStraightEdge(src, tgt);
        this.drawArrowhead(src, tgt, CHECKPOINT_COLOR);
        break;
      }
    }

    ctx.restore();
  }

  private drawBezierEdge(src: GraphNode, tgt: GraphNode): void {
    const { ctx } = this;
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.bezierCurveTo(src.x + dx * 0.4, src.y + dy * 0.1, tgt.x - dx * 0.4, tgt.y - dy * 0.1, tgt.x, tgt.y);
    ctx.stroke();
  }

  private drawStraightEdge(src: GraphNode, tgt: GraphNode): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.stroke();
  }

  private drawArrowhead(src: GraphNode, tgt: GraphNode, color: string): void {
    const { ctx } = this;
    const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
    const size = 7;
    const tipX = tgt.x - Math.cos(angle) * 14;
    const tipY = tgt.y - Math.sin(angle) * 14;

    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - Math.cos(angle - Math.PI / 6) * size, tipY - Math.sin(angle - Math.PI / 6) * size);
    ctx.lineTo(tipX - Math.cos(angle + Math.PI / 6) * size, tipY - Math.sin(angle + Math.PI / 6) * size);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ── Node drawing ─────────────────────────────────────────────────────

  private drawNode(node: GraphNode): void {
    const isHovered = node.id === this.hoveredNodeId;
    const isSelected = node.id === this.selectedNodeId;
    const inSlice = this.isInTimeSlice(node);
    const { ctx } = this;

    if (!inSlice) {
      ctx.save();
      ctx.globalAlpha = 0.2;
    }

    switch (node.type) {
      case 'agent': this.drawAgentNode(node, isHovered, isSelected, inSlice); break;
      case 'tool': this.drawToolNode(node, isHovered, isSelected, inSlice); break;
      case 'file': this.drawFileNode(node, isHovered, isSelected, inSlice); break;
      case 'validation': this.drawValidationNode(node, isHovered, isSelected, inSlice); break;
      case 'milestone': this.drawMilestoneNode(node, isHovered, isSelected, inSlice); break;
      case 'checkpoint': this.drawCheckpointNode(node, isHovered, isSelected, inSlice); break;
    }

    if (!inSlice) {
      ctx.restore();
    }
  }

  // ── Agent node: circle with status glow ─────────────────────────────

  private drawAgentNode(node: GraphNode, hovered: boolean, selected: boolean, inSlice = true): void {
    const { ctx } = this;
    const status = node.status || 'idle';
    const color = inSlice ? (STATUS_COLORS[status] || STATUS_COLORS.idle) : GHOST;

    ctx.save();

    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    if (hovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 0;
    }

    // Pulse ring for working agents
    if (status === 'working' && inSlice) {
      const prevAlpha = ctx.globalAlpha;
      const pulse = Math.sin(this.time * 0.003) * 0.3 + 0.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, AGENT_RADIUS + 5, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.globalAlpha = prevAlpha * pulse * 0.5;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = prevAlpha;
      this.dirty = true;
    }

    // Outer ring (border)
    ctx.beginPath();
    ctx.arc(node.x, node.y, AGENT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = BG_SURFACE;
    ctx.fill();
    ctx.strokeStyle = inSlice ? color : GHOST;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Inner fill with subtle gradient
    ctx.beginPath();
    ctx.arc(node.x, node.y, AGENT_RADIUS - 3, 0, Math.PI * 2);
    if (inSlice) {
      const grad = ctx.createRadialGradient(node.x - 3, node.y - 3, 1, node.x, node.y, AGENT_RADIUS - 3);
      grad.addColorStop(0, this.colorWithAlpha(color, 0.25));
      grad.addColorStop(1, this.colorWithAlpha(color, 0.08));
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = this.colorWithAlpha(GHOST, 0.15);
    }
    ctx.fill();

    if (selected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, AGENT_RADIUS + 1, 0, Math.PI * 2);
      ctx.strokeStyle = TEXT_PRIMARY;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Letter
    const letter = (node.label || 'A').charAt(0).toUpperCase();
    ctx.fillStyle = inSlice ? color : GHOST;
    ctx.font = `bold 13px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, node.x, node.y);

    // Label below
    ctx.fillStyle = inSlice ? TEXT_SECOND : TEXT_FAINT;
    ctx.font = `10px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.truncateLabel(node.label, 12), node.x, node.y + AGENT_RADIUS + 5);

    ctx.restore();
  }

  // ── Tool node: rounded pill ─────────────────────────────────────────

  /** Resolve the status colour of the parent agent node. */
  private parentAgentColor(node: GraphNode): string {
    if (!node.parentNodeId) return TEXT_MUTED;
    const parent = this.nodeById.get(node.parentNodeId);
    if (!parent) return TEXT_MUTED;
    return STATUS_COLORS[parent.status || 'idle'] || TEXT_MUTED;
  }

  private measureCardWidth(node: GraphNode): number {
    const { ctx } = this;
    ctx.font = `600 9px ${FONT_MONO}`;
    const textW = ctx.measureText(node.label).width;
    return Math.max(CARD_MIN_W, textW + CARD_PAD_X * 2);
  }

  private drawToolNode(node: GraphNode, hovered: boolean, selected: boolean, inSlice = true): void {
    const { ctx } = this;
    const agentColor = inSlice ? this.parentAgentColor(node) : GHOST;
    const w = this.measureCardWidth(node);
    const hw = w / 2;
    const hh = CARD_HEIGHT / 2;

    ctx.save();

    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 1;
    if (hovered) { ctx.shadowColor = agentColor; ctx.shadowBlur = 16; ctx.shadowOffsetY = 0; }

    this.roundedRectPath(node.x - hw, node.y - hh, w, CARD_HEIGHT, CARD_R);
    ctx.fillStyle = BG_SURFACE;
    ctx.fill();
    ctx.strokeStyle = inSlice ? agentColor : this.colorWithAlpha(GHOST, 0.4);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (selected) { ctx.strokeStyle = TEXT_PRIMARY; ctx.lineWidth = 2; ctx.stroke(); }

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.font = `600 9px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const label = node.label;
    const xIdx = label.indexOf(' ×');
    if (xIdx > 0) {
      const name = label.slice(0, xIdx);
      const count = label.slice(xIdx);
      const nameW = ctx.measureText(name).width;
      const countW = ctx.measureText(count).width;
      const totalW = nameW + countW;
      const startX = node.x - totalW / 2;

      ctx.fillStyle = inSlice ? agentColor : GHOST;
      ctx.textAlign = 'left';
      ctx.fillText(name, startX, node.y);

      ctx.fillStyle = inSlice ? TEXT_SECOND : GHOST;
      ctx.font = `500 8px ${FONT_MONO}`;
      ctx.fillText(count, startX + nameW, node.y);
    } else {
      ctx.fillStyle = inSlice ? agentColor : GHOST;
      ctx.fillText(label, node.x, node.y);
    }

    ctx.restore();
  }

  // ── File node: rounded pill with filename ───────────────────────────

  private drawFileNode(node: GraphNode, hovered: boolean, selected: boolean, inSlice = true): void {
    const { ctx } = this;
    const baseColor = inSlice ? FILE_COLOR : GHOST;

    ctx.font = `600 9px ${FONT_MONO}`;
    const filename = node.filePath ? node.filePath.split('/').pop() || node.label : node.label;
    const displayName = this.truncateLabel(filename, 16);
    const w = Math.max(CARD_MIN_W, ctx.measureText(displayName).width + CARD_PAD_X * 2);
    const hw = w / 2;
    const hh = CARD_HEIGHT / 2;

    ctx.save();

    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 1;
    if (hovered) { ctx.shadowColor = baseColor; ctx.shadowBlur = 16; ctx.shadowOffsetY = 0; }

    this.roundedRectPath(node.x - hw, node.y - hh, w, CARD_HEIGHT, CARD_R);
    ctx.fillStyle = BG_SURFACE;
    ctx.fill();
    ctx.strokeStyle = inSlice ? this.colorWithAlpha(FILE_COLOR, 0.55) : this.colorWithAlpha(GHOST, 0.3);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (selected) { ctx.strokeStyle = TEXT_PRIMARY; ctx.lineWidth = 2; ctx.stroke(); }

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = inSlice ? FILE_COLOR : GHOST;
    ctx.font = `600 9px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayName, node.x, node.y);

    ctx.restore();
  }

  // ── Validation node: octagon ────────────────────────────────────────

  private drawValidationNode(node: GraphNode, hovered: boolean, selected: boolean, inSlice = true): void {
    const { ctx } = this;
    const pass = node.status !== 'error';
    const rawColor = pass ? GREEN : RED;
    const color = inSlice ? rawColor : GHOST;
    const r = VALIDATION_RADIUS;

    ctx.save();

    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    if (hovered) { ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.shadowOffsetY = 0; }

    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 - Math.PI / 8;
      const px = node.x + Math.cos(angle) * r;
      const py = node.y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();

    ctx.fillStyle = BG_SURFACE;
    ctx.fill();
    ctx.strokeStyle = inSlice ? this.colorWithAlpha(rawColor, 0.5) : this.colorWithAlpha(GHOST, 0.3);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (selected) { ctx.strokeStyle = TEXT_PRIMARY; ctx.lineWidth = 2; ctx.stroke(); }

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = inSlice ? rawColor : GHOST;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    if (pass) {
      ctx.beginPath();
      ctx.moveTo(node.x - 4, node.y);
      ctx.lineTo(node.x - 1, node.y + 3);
      ctx.lineTo(node.x + 5, node.y - 3);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(node.x - 3, node.y - 3);
      ctx.lineTo(node.x + 3, node.y + 3);
      ctx.moveTo(node.x + 3, node.y - 3);
      ctx.lineTo(node.x - 3, node.y + 3);
      ctx.stroke();
    }

    ctx.fillStyle = inSlice ? TEXT_SECOND : TEXT_FAINT;
    ctx.font = `9px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.truncateLabel(node.label, 12), node.x, node.y + r + 4);

    ctx.restore();
  }

  // ── Milestone node: star/x ──────────────────────────────────────────

  private drawMilestoneNode(node: GraphNode, hovered: boolean, selected: boolean, inSlice = true): void {
    const { ctx } = this;
    const pass = node.status !== 'error';
    const r = MILESTONE_RADIUS;
    const rawColor = pass ? GREEN : RED;

    ctx.save();

    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    if (hovered) { ctx.shadowColor = inSlice ? rawColor : GHOST; ctx.shadowBlur = 18; ctx.shadowOffsetY = 0; }

    if (pass) this.drawStar(node.x, node.y, 5, r, r * 0.45);
    else this.drawXShape(node.x, node.y, r);

    ctx.fillStyle = BG_SURFACE;
    ctx.fill();
    ctx.strokeStyle = inSlice ? this.colorWithAlpha(rawColor, 0.6) : this.colorWithAlpha(GHOST, 0.3);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (selected) { ctx.strokeStyle = TEXT_PRIMARY; ctx.lineWidth = 2; ctx.stroke(); }

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = inSlice ? TEXT_SECOND : TEXT_FAINT;
    ctx.font = `10px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.truncateLabel(node.label, 12), node.x, node.y + r + 5);

    ctx.restore();
  }

  // ── Checkpoint node: circle with commit icon ────────────────────────

  private drawCheckpointNode(node: GraphNode, hovered: boolean, selected: boolean, inSlice = true): void {
    const { ctx } = this;
    const r = CHECKPOINT_RADIUS;
    const baseColor = inSlice ? CHECKPOINT_COLOR : GHOST;

    ctx.save();

    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    if (hovered) { ctx.shadowColor = baseColor; ctx.shadowBlur = 18; ctx.shadowOffsetY = 0; }

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fillStyle = BG_SURFACE;
    ctx.fill();
    ctx.strokeStyle = inSlice ? this.colorWithAlpha(GREEN, 0.5) : this.colorWithAlpha(GHOST, 0.3);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (selected) { ctx.strokeStyle = TEXT_PRIMARY; ctx.lineWidth = 2; ctx.stroke(); }

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const innerR = 4;
    const lineLen = 5;
    ctx.strokeStyle = inSlice ? GREEN : GHOST;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(node.x, node.y - innerR - lineLen);
    ctx.lineTo(node.x, node.y - innerR);
    ctx.moveTo(node.x, node.y + innerR);
    ctx.lineTo(node.x, node.y + innerR + lineLen);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(node.x, node.y, innerR, 0, Math.PI * 2);
    ctx.strokeStyle = inSlice ? GREEN : GHOST;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const label = node.commitHash ? node.commitHash.slice(0, 7) : node.label;
    ctx.fillStyle = inSlice ? GREEN : TEXT_FAINT;
    ctx.font = `9px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.truncateLabel(label, 12), node.x, node.y + r + 4);

    ctx.restore();
  }

  // ── Shape helpers ────────────────────────────────────────────────────

  private drawStar(cx: number, cy: number, points: number, outerR: number, innerR: number): void {
    const { ctx } = this;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI * i) / points - Math.PI / 2;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  private drawXShape(cx: number, cy: number, size: number): void {
    const { ctx } = this;
    const arm = size * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx - arm, cy - size);
    ctx.lineTo(cx + arm, cy - size);
    ctx.lineTo(cx + arm, cy - arm);
    ctx.lineTo(cx + size, cy - arm);
    ctx.lineTo(cx + size, cy + arm);
    ctx.lineTo(cx + arm, cy + arm);
    ctx.lineTo(cx + arm, cy + size);
    ctx.lineTo(cx - arm, cy + size);
    ctx.lineTo(cx - arm, cy + arm);
    ctx.lineTo(cx - size, cy + arm);
    ctx.lineTo(cx - size, cy - arm);
    ctx.lineTo(cx - arm, cy - arm);
    ctx.closePath();
  }

  private roundedRectPath(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  private hasAnimatedElements(): boolean {
    for (const edge of this.edges) {
      if (edge.animated) return true;
    }
    for (const node of this.nodes) {
      if (node.type === 'agent' && node.status === 'working') return true;
    }
    return false;
  }

  private truncateLabel(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 1) + '\u2026';
  }

  private colorWithAlpha(hex: string, alpha: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = (num >> 16) & 0xff;
    const g = (num >> 8) & 0xff;
    const b = num & 0xff;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /** Lighten a hex color by a given amount (0-255). */
  private lightenColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + amount);
    const g = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b = Math.min(255, (num & 0xff) + amount);
    return `rgb(${r},${g},${b})`;
  }

  /** Darken a hex color by a given amount (0-255). */
  private darkenColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, ((num >> 16) & 0xff) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return `rgb(${r},${g},${b})`;
  }
}
