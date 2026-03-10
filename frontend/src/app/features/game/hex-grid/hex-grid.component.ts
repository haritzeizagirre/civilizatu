import {
  Component, Input, Output, EventEmitter, OnChanges,
  ElementRef, ViewChild, AfterViewInit, OnDestroy, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState, Tile, Unit, City, TileType } from '../../../core/models/game.models';
import { GameService } from '../../../core/services/game.service';
import { Subscription } from 'rxjs';

// ─── Animation types ─────────────────────────────────────────────────────────
interface Pos { x: number; y: number; }

interface CombatAnim {
  attackerPos: Pos;   // hex coords
  defenderPos: Pos;
  t: number;          // 0 → 1 progress
  damage?: number;
}

interface MoveAnim {
  unitId: string;
  from: Pos;          // pixel coords
  to: Pos;
  t: number;          // 0 → 1 progress
}

interface FloatingText {
  text: string;
  px: number;         // pixel coords
  py: number;
  t: number;          // 0 → 1 (fades out)
  color: string;
}

// ─── Hex size in pixels ───────────────────────────────────────────────────────
const HEX_SIZE = 36;
const HEX_W = Math.sqrt(3) * HEX_SIZE;
const HEX_H = 2 * HEX_SIZE;

// Tile colours
const TILE_COLORS: Record<TileType, string> = {
  plains:    '#6b8c3e',
  forest:    '#2d5a27',
  hills:     '#8c7a4a',
  mountains: '#6b6b6b',
  ocean:     '#1a5276',
  desert:    '#c9a84c',
  tundra:    '#aacccc',
  river:     '#3498db',
};

const TILE_EMOJI: Record<TileType, string> = {
  plains: '🌿', forest: '🌲', hills: '⛰', mountains: '🏔',
  ocean: '🌊', desert: '🏜', tundra: '❄', river: '💧',
};

function hexToPixel(col: number, row: number): { x: number; y: number } {
  const x = HEX_W * col + (row % 2) * (HEX_W / 2);
  const y = HEX_H * 0.75 * row;
  return { x, y };
}

function hexCorners(cx: number, cy: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return [cx + HEX_SIZE * Math.cos(angle), cy + HEX_SIZE * Math.sin(angle)];
  });
}

@Component({
  selector: 'app-hex-grid',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <canvas
      #canvas
      class="hex-canvas"
      (mousedown)="onMouseDown($event)"
      (mousemove)="onMouseMove($event)"
      (mouseup)="onMouseUp($event)"
      (wheel)="onWheel($event)"
      (contextmenu)="$event.preventDefault()"
    ></canvas>
  `,
  styles: [`
    :host { display: block; width: 100%; flex: 1 1 0; min-height: 0; overflow: hidden; }
    .hex-canvas { width: 100%; height: 100%; cursor: default; display: block; }
  `]
})
export class HexGridComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() state!: GameState;
  @Output() unitSelected = new EventEmitter<string>();
  @Output() citySelected = new EventEmitter<string>();
  @Output() moveUnit = new EventEmitter<{ unitId: string; x: number; y: number }>();
  @Output() attackUnit = new EventEmitter<{ attackerUnitId: string; defenderUnitId: string }>();

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private offsetX = 0;
  private offsetY = 0;
  private zoom = 1;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private dragOffset = { x: 0, y: 0 };
  private hoveredTile: { x: number; y: number } | null = null;
  private selectedUnitId: string | null = null;
  private reachableTiles: Set<string> = new Set();
  private sub = new Subscription();

  // ─── Animation state ────────────────────────────────────────────────────────
  private combatAnim: CombatAnim | null = null;
  private moveAnim: MoveAnim | null = null;
  private floatingTexts: FloatingText[] = [];
  private animFrame: number | null = null;
  private lastTs = 0;

  // Combat animation durations (ms)
  private readonly FLASH_DUR = 250;
  private readonly PROJ_DUR  = 350;
  private readonly EXPLO_DUR = 350;
  private readonly TOTAL_ANIM = this.FLASH_DUR + this.PROJ_DUR + this.EXPLO_DUR;
  private readonly MOVE_DUR  = 400;
  private readonly TEXT_DUR  = 900;

  constructor(private gameService: GameService) {}

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.sub.add(this.gameService.selectedUnitId$.subscribe(id => {
      this.selectedUnitId = id;
      if (id) { this.computeReachable(id); } else { this.reachableTiles.clear(); }
      this.draw();
    }));
    this.draw();
  }

  ngOnChanges(): void {
    if (this.ctx) { this.draw(); }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    window.removeEventListener('resize', () => this.resizeCanvas());
    if (this.animFrame !== null) { cancelAnimationFrame(this.animFrame); }
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    this.draw();
  }

  // ─── Drawing ─────────────────────────────────────────────────────────────

  draw(): void {
    if (!this.ctx || !this.state) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.zoom, this.zoom);

    const tiles = this.state.map.tiles;
    const fog = this.state.map.fog_of_war;

    for (const tile of tiles) {
      const { x: px, y: py } = hexToPixel(tile.x, tile.y);
      const explored = fog[tile.y]?.[tile.x] ?? false;
      this.drawHex(ctx, px, py, tile, explored);
    }

    // Draw cities
    for (const city of this.state.player.cities) {
      const { x: px, y: py } = hexToPixel(city.position.x, city.position.y);
      this.drawCity(ctx, px, py, city, 'player');
    }
    for (const city of (this.state.ai?.cities ?? []) as any[]) {
      if (city.visible === false) continue;
      const { x: px, y: py } = hexToPixel(city.position.x, city.position.y);
      this.drawCity(ctx, px, py, city, 'ai');
    }

    // Draw units
    for (const unit of this.state.player.units) {
      // Skip moving unit – it's rendered by the animation overlay instead
      if (this.moveAnim?.unitId === unit.id) continue;
      const { x: px, y: py } = hexToPixel(unit.position.x, unit.position.y);
      this.drawUnit(ctx, px, py, unit, 'player', unit.id === this.selectedUnitId);
    }
    for (const unit of (this.state.ai?.units ?? []) as any[]) {
      const { x: px, y: py } = hexToPixel(unit.position.x, unit.position.y);
      this.drawUnit(ctx, px, py, unit, 'ai', false);
    }

    // Hover highlight
    if (this.hoveredTile) {
      const { x: px, y: py } = hexToPixel(this.hoveredTile.x, this.hoveredTile.y);
      this.drawHexHighlight(ctx, px, py, 'rgba(255,255,255,0.2)');
    }

    ctx.restore();

    // Animation overlay (drawn outside the map transform so pixel coords are exact)
    this.drawAnimations();
  }

  private drawHex(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: Tile, explored: boolean): void {
    const corners = hexCorners(cx, cy);
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    for (let i = 1; i < 6; i++) { ctx.lineTo(corners[i][0], corners[i][1]); }
    ctx.closePath();

    if (!explored) {
      ctx.fillStyle = '#111';
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      return;
    }

    const isReachable = this.reachableTiles.has(`${tile.x},${tile.y}`);
    ctx.fillStyle = isReachable ? this.brighten(TILE_COLORS[tile.tile_type] ?? '#6b8c3e') : (TILE_COLORS[tile.tile_type] ?? '#6b8c3e');
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Tile type icon
    ctx.font = `${HEX_SIZE * 0.55 * this.zoom < 8 ? 0 : HEX_SIZE * 0.55}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(TILE_EMOJI[tile.tile_type] ?? '', cx, cy - 4);

    // Resource icon
    if (tile.resource) {
      const resourceEmoji: Record<string, string> = { iron: '⚙', cattle: '🐄', luxury_silk: '💎', wheat: '🌾', coal: '🪨', oil: '🛢' };
      ctx.font = `${HEX_SIZE * 0.35}px serif`;
      ctx.fillText(resourceEmoji[tile.resource] ?? '?', cx + 10, cy + 10);
      if (tile.resource_improved) {
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(cx + 6, cy + 14, 10, 3);
      }
    }

    // Ruins / barbarian indicator
    if (tile.has_ruins) { ctx.font = `${HEX_SIZE * 0.3}px serif`; ctx.fillText('🏛', cx - 12, cy + 10); }
    if (tile.has_barbarian_camp) { ctx.font = `${HEX_SIZE * 0.3}px serif`; ctx.fillText('⚔', cx - 12, cy + 10); }

    // Ownership border tint
    if (tile.owner === 'player') {
      ctx.fillStyle = 'rgba(0,100,200,0.12)';
      ctx.fill();
    } else if (tile.owner === 'ai') {
      ctx.fillStyle = 'rgba(200,0,0,0.12)';
      ctx.fill();
    }
  }

  private brighten(hex: string): string {
    // Simple brightness boost for reachable tiles
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)})`;
  }

  private drawHexHighlight(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
    const corners = hexCorners(cx, cy);
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    for (let i = 1; i < 6; i++) { ctx.lineTo(corners[i][0], corners[i][1]); }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  private drawCity(ctx: CanvasRenderingContext2D, cx: number, cy: number, city: any, owner: string): void {
    ctx.fillStyle = owner === 'player' ? '#1565c0' : '#c62828';
    ctx.beginPath();
    ctx.arc(cx, cy, HEX_SIZE * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = owner === 'player' ? '#90caf9' : '#ef9a9a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(8, HEX_SIZE * 0.28)}px Rajdhani, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(city.name?.substring(0, 4) ?? '?', cx, cy);
    // Population badge
    ctx.fillStyle = '#d4af37';
    ctx.font = `${Math.max(7, HEX_SIZE * 0.22)}px Rajdhani`;
    ctx.fillText(`Pop:${city.population ?? '?'}`, cx, cy + HEX_SIZE * 0.55);
  }

  private drawUnit(ctx: CanvasRenderingContext2D, cx: number, cy: number, unit: any, owner: string, selected: boolean): void {
    const size = HEX_SIZE * 0.32;
    const unitEmoji: Record<string, string> = {
      warrior: '⚔', archer: '🏹', knight: '🐴', settler: '🏕',
      tank: '🪖', eagle_warrior: '🦅', legion: '🛡'
    };
    const bg = owner === 'player' ? '#1565c0' : '#c62828';
    const border = selected ? '#ffd700' : (owner === 'player' ? '#90caf9' : '#ef9a9a');

    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(cx - size, cy - size, size * 2, size * 2, 4);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = selected ? 2.5 : 1.5;
    ctx.stroke();

    ctx.font = `${size * 1.1}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unitEmoji[unit.unit_type] ?? '?', cx, cy);

    // Health bar
    const hpBarW = size * 2;
    const hpPct = (unit.health ?? 100) / 100;
    ctx.fillStyle = '#333';
    ctx.fillRect(cx - size, cy + size + 2, hpBarW, 3);
    ctx.fillStyle = hpPct > 0.5 ? '#4caf50' : hpPct > 0.25 ? '#ff9800' : '#f44336';
    ctx.fillRect(cx - size, cy + size + 2, hpBarW * hpPct, 3);

    // Movement indicator
    if ((unit.movement_points_left ?? 0) === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.roundRect(cx - size, cy - size, size * 2, size * 2, 4);
      ctx.fill();
    }
  }

  // ─── Animation system ────────────────────────────────────────────────────────

  /** Start the rAF loop if not already running. */
  private startAnimLoop(): void {
    if (this.animFrame !== null) return;
    this.lastTs = performance.now();
    const loop = (ts: number) => {
      const dt = ts - this.lastTs;
      this.lastTs = ts;
      this.tickAnimations(dt);
      this.draw();
      if (this.hasActiveAnimations()) {
        this.animFrame = requestAnimationFrame(loop);
      } else {
        this.animFrame = null;
      }
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  private hasActiveAnimations(): boolean {
    return this.combatAnim !== null || this.moveAnim !== null || this.floatingTexts.length > 0;
  }

  private tickAnimations(dt: number): void {
    // Advance combat
    if (this.combatAnim) {
      this.combatAnim.t += dt / this.TOTAL_ANIM;
      if (this.combatAnim.t >= 1) { this.combatAnim = null; }
    }
    // Advance move
    if (this.moveAnim) {
      this.moveAnim.t += dt / this.MOVE_DUR;
      if (this.moveAnim.t >= 1) { this.moveAnim = null; }
    }
    // Advance floating texts
    this.floatingTexts = this.floatingTexts
      .map(f => ({ ...f, t: f.t + dt / this.TEXT_DUR, py: f.py - dt * 0.04 }))
      .filter(f => f.t < 1);
  }

  /** Kick off a combat animation between two hex positions. */
  startCombatAnim(attackerHex: Pos, defenderHex: Pos, damage?: number): void {
    this.combatAnim = { attackerPos: attackerHex, defenderPos: defenderHex, t: 0, damage };
    // Queue floating damage text at defender pixel pos (after projectile phase ~0.7s)
    const defPx = this.hexToPixelWorld(defenderHex.x, defenderHex.y);
    setTimeout(() => {
      const label = damage !== undefined ? `-${damage} HP` : '⚔';
      this.floatingTexts.push({ text: label, px: defPx.x, py: defPx.y, t: 0, color: '#ff5252' });
      if (!this.animFrame) this.startAnimLoop();
    }, this.FLASH_DUR + this.PROJ_DUR);
    this.startAnimLoop();
  }

  /** Kick off a smooth move animation for a unit. */
  startMoveAnim(unitId: string, fromHex: Pos, toHex: Pos): void {
    const from = this.hexToPixelWorld(fromHex.x, fromHex.y);
    const to   = this.hexToPixelWorld(toHex.x, toHex.y);
    this.moveAnim = { unitId, from, to, t: 0 };
    this.startAnimLoop();
  }

  /** Convert hex coords → world pixel coords (accounting for offset + zoom). */
  private hexToPixelWorld(col: number, row: number): Pos {
    const { x, y } = hexToPixel(col, row);
    return { x: x * this.zoom + this.offsetX, y: y * this.zoom + this.offsetY };
  }

  /** Draw all active animations on top of the map (in screen space). */
  private drawAnimations(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    // ── Combat animation ───────────────────────────────────────────────────
    if (this.combatAnim) {
      const { attackerPos, defenderPos, t } = this.combatAnim;
      const aPx = this.hexToPixelWorld(attackerPos.x, attackerPos.y);
      const dPx = this.hexToPixelWorld(defenderPos.x, defenderPos.y);
      const flashEnd    = this.FLASH_DUR / this.TOTAL_ANIM;
      const projEnd     = (this.FLASH_DUR + this.PROJ_DUR) / this.TOTAL_ANIM;

      // Phase 1: Flash both tiles
      if (t < flashEnd) {
        const alpha = Math.sin((t / flashEnd) * Math.PI) * 0.7;
        this.drawScreenHexHighlight(ctx, aPx.x, aPx.y, `rgba(255,200,0,${alpha})`);
        this.drawScreenHexHighlight(ctx, dPx.x, dPx.y, `rgba(255,80,80,${alpha * 0.6})`);
      }

      // Phase 2: Projectile
      if (t >= flashEnd && t < projEnd) {
        const pt = (t - flashEnd) / (projEnd - flashEnd);
        // Ease-in for a snappy feel
        const ep = pt * pt;
        const px = aPx.x + (dPx.x - aPx.x) * ep;
        const py = aPx.y + (dPx.y - aPx.y) * ep;
        // Trail
        ctx.save();
        const grad = ctx.createLinearGradient(aPx.x, aPx.y, px, py);
        grad.addColorStop(0, 'rgba(255,200,0,0)');
        grad.addColorStop(1, 'rgba(255,200,0,0.7)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3 * this.zoom;
        ctx.beginPath();
        ctx.moveTo(aPx.x, aPx.y);
        ctx.lineTo(px, py);
        ctx.stroke();
        // Head
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(px, py, 5 * this.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Phase 3: Explosion at defender
      if (t >= projEnd) {
        const et = (t - projEnd) / (1 - projEnd);
        const maxR = HEX_SIZE * this.zoom * 1.1;
        const r = maxR * et;
        const alpha = (1 - et) * 0.85;
        ctx.save();
        // Outer ring
        ctx.strokeStyle = `rgba(255,80,0,${alpha})`;
        ctx.lineWidth = 4 * this.zoom * (1 - et * 0.7);
        ctx.beginPath();
        ctx.arc(dPx.x, dPx.y, r, 0, Math.PI * 2);
        ctx.stroke();
        // Inner flash
        const grad = ctx.createRadialGradient(dPx.x, dPx.y, 0, dPx.x, dPx.y, r * 0.7);
        grad.addColorStop(0, `rgba(255,220,80,${alpha * 0.8})`);
        grad.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(dPx.x, dPx.y, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        // Spark particles (8 fixed-angle sparks)
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const sr = r * 1.3;
          const sx = dPx.x + Math.cos(angle) * sr;
          const sy = dPx.y + Math.sin(angle) * sr;
          ctx.fillStyle = `rgba(255,200,50,${alpha * 0.9})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 3 * this.zoom * (1 - et), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // ── Floating damage texts ──────────────────────────────────────────────
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = 1 - ft.t;
      ctx.font = `bold ${Math.max(12, 16 * this.zoom)}px Rajdhani, sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(ft.text, ft.px, ft.py);
      ctx.fillText(ft.text, ft.px, ft.py);
      ctx.restore();
    }

    // ── Move animation – draw animated unit on top ─────────────────────────
    if (this.moveAnim) {
      const { from, to, t, unitId } = this.moveAnim;
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      const px = from.x + (to.x - from.x) * ease;
      const py = from.y + (to.y - from.y) * ease;
      const unit = this.state?.player.units.find(u => u.id === unitId);
      if (unit) {
        ctx.save();
        // Draw a subtle motion trail
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#90caf9';
        ctx.beginPath();
        ctx.arc(from.x + (px - from.x) * 0.5, from.y + (py - from.y) * 0.5, 4 * this.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        // Draw unit at interpolated position (in screen space, so undo zoom offset)
        const cx = (px - this.offsetX) / this.zoom;
        const cy = (py - this.offsetY) / this.zoom;
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.zoom, this.zoom);
        this.drawUnit(ctx, cx, cy, unit, 'player', true);
        ctx.restore();
      }
    }
  }

  /** Draw a hex highlight in screen pixel coords (no map transform needed). */
  private drawScreenHexHighlight(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
    const r = HEX_SIZE * this.zoom;
    const corners = hexCorners(0, 0).map(([x, y]) => [x * this.zoom + cx, y * this.zoom + cy] as [number, number]);
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // ─── Interaction ──────────────────────────────────────────────────────────

  private pixelToHex(px: number, py: number): { x: number; y: number } | null {
    if (!this.state) return null;
    const { width, height } = this.state.map;
    px = (px - this.offsetX) / this.zoom;
    py = (py - this.offsetY) / this.zoom;
    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const { x: hx, y: hy } = hexToPixel(col, row);
        const dist = Math.hypot(px - hx, py - hy);
        if (dist < bestDist && dist < HEX_SIZE) { bestDist = dist; best = { x: col, y: row }; }
      }
    }
    return best;
  }

  private computeReachable(unitId: string): void {
    this.reachableTiles.clear();
    const unit = this.state?.player.units.find(u => u.id === unitId);
    if (!unit || unit.movement_points_left <= 0) return;
    const mp = unit.movement_points_left;
    const map = this.state.map;

    // BFS
    const queue: { x: number; y: number; mp: number }[] = [{ x: unit.position.x, y: unit.position.y, mp }];
    const visited = new Set<string>();
    visited.add(`${unit.position.x},${unit.position.y}`);

    const OCEAN_COST = 99;
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur.mp <= 0) continue;
      const neighbors = this.getNeighbors(cur.x, cur.y, map.width, map.height);
      for (const [nx, ny] of neighbors) {
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        visited.add(key);
        const tile = map.tiles.find(t => t.x === nx && t.y === ny);
        if (!tile) continue;
        const cost = tile.tile_type === 'ocean' || tile.tile_type === 'mountains' ? OCEAN_COST : 1;
        if (cost <= cur.mp) {
          this.reachableTiles.add(key);
          queue.push({ x: nx, y: ny, mp: cur.mp - cost });
        }
      }
    }
  }

  private getNeighbors(col: number, row: number, w: number, h: number): [number, number][] {
    const isEven = row % 2 === 0;
    const dirs = isEven
      ? [[1, 0], [-1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1]]
      : [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 1]];
    return dirs
      .map(([dc, dr]) => [col + dc, row + dr] as [number, number])
      .filter(([c, r]) => c >= 0 && c < w && r >= 0 && r < h);
  }

  onMouseDown(e: MouseEvent): void {
    if (e.button === 1 || e.button === 2) {
      this.isDragging = true;
      this.dragStart = { x: e.clientX - this.offsetX, y: e.clientY - this.offsetY };
      return;
    }
    const hex = this.pixelToHex(e.clientX, e.clientY);
    if (!hex) return;

    // Check for unit at hex (player units first)
    const unit = this.state.player.units.find(u => u.position.x === hex.x && u.position.y === hex.y);
    if (unit) {
      this.gameService.selectUnit(unit.id);
      this.gameService.selectCity(null);
      return;
    }

    // Check for city
    const city = this.state.player.cities.find(c => c.position.x === hex.x && c.position.y === hex.y);
    if (city) {
      this.gameService.selectCity(city.id);
      this.gameService.selectUnit(null);
      this.citySelected.emit(city.id);
      return;
    }

    // Check for enemy unit (attack if a player unit is selected)
    const enemyUnit = (this.state.ai?.units as any[])?.find((u: any) => u.position?.x === hex.x && u.position?.y === hex.y);
    if (enemyUnit && this.selectedUnitId) {
      const attacker = this.state.player.units.find(u => u.id === this.selectedUnitId);
      if (attacker) {
        this.startCombatAnim(attacker.position, hex, Math.floor(Math.random() * 30 + 10));
      }
      this.attackUnit.emit({ attackerUnitId: this.selectedUnitId, defenderUnitId: enemyUnit.id });
      this.gameService.selectUnit(null);
      return;
    }

    // Move to reachable tile
    if (this.selectedUnitId && this.reachableTiles.has(`${hex.x},${hex.y}`)) {
      const unit = this.state.player.units.find(u => u.id === this.selectedUnitId);
      if (unit) { this.startMoveAnim(unit.id, unit.position, hex); }
      this.moveUnit.emit({ unitId: this.selectedUnitId, x: hex.x, y: hex.y });
      this.gameService.selectUnit(null);
      return;
    }

    // Deselect
    this.gameService.selectUnit(null);
    this.gameService.selectCity(null);
  }

  onMouseMove(e: MouseEvent): void {
    if (this.isDragging) {
      this.offsetX = e.clientX - this.dragStart.x;
      this.offsetY = e.clientY - this.dragStart.y;
      this.draw();
      return;
    }
    const hex = this.pixelToHex(e.clientX, e.clientY);
    if (hex?.x !== this.hoveredTile?.x || hex?.y !== this.hoveredTile?.y) {
      this.hoveredTile = hex;
      this.draw();
    }
  }

  onMouseUp(e: MouseEvent): void { this.isDragging = false; }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoom = Math.min(2.5, Math.max(0.3, this.zoom * delta));
    this.draw();
  }
}
