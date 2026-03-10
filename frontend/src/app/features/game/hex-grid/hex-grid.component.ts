import {
  Component, Input, Output, EventEmitter, OnChanges,
  ElementRef, ViewChild, AfterViewInit, OnDestroy, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState, Tile, Unit, City, TileType } from '../../../core/models/game.models';
import { GameService } from '../../../core/services/game.service';
import { Subscription } from 'rxjs';

// Hex size in pixels
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
    :host { display: block; width: 100%; height: 100%; overflow: hidden; }
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
      this.attackUnit.emit({ attackerUnitId: this.selectedUnitId, defenderUnitId: enemyUnit.id });
      this.gameService.selectUnit(null);
      return;
    }

    // Move to reachable tile
    if (this.selectedUnitId && this.reachableTiles.has(`${hex.x},${hex.y}`)) {
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
