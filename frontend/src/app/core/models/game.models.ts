export interface Position { x: number; y: number; }

export type TileType = 'plains' | 'forest' | 'hills' | 'mountains' | 'ocean' | 'desert' | 'tundra' | 'river';
export type ResourceType = 'iron' | 'cattle' | 'luxury_silk' | 'wheat' | 'coal' | 'oil';
export type UnitType = 'warrior' | 'archer' | 'knight' | 'settler' | 'tank' | 'eagle_warrior' | 'legion';
export type BuildingType = 'granary' | 'library' | 'barracks' | 'market' | 'temple' | 'forge' | 'palace' | 'workshop' | 'aqueduct' | 'colosseum' | 'university' | 'factory' | 'power_plant' | 'space_shuttle';
export type DiplomacyStatus = 'peace' | 'war' | 'alliance';
export type GameResult = 'ongoing' | 'player_win_conquest' | 'player_win_science' | 'player_win_culture' | 'player_win_domination' | 'ai_win_conquest' | 'ai_win_science' | 'ai_win_culture' | 'ai_win_domination';

export interface Resources {
  food: number;
  production: number;
  science: number;
  gold: number;
  culture: number;
  happiness: number;
}

export interface Tile {
  x: number;
  y: number;
  tile_type: TileType;
  resource?: ResourceType;
  resource_improved: boolean;
  has_ruins: boolean;
  has_barbarian_camp: boolean;
  road: boolean;
  owner?: string;
}

export interface Building {
  building_type: BuildingType;
  turns_built: number;
}

export interface ProductionQueue {
  item_type: string;
  is_unit: boolean;
  turns_remaining: number;
}

export interface City {
  id: string;
  name: string;
  owner: string;
  position: Position;
  population: number;
  food_stored: number;
  buildings: Building[];
  production_queue?: ProductionQueue;
  yields: Resources;
  happiness: number;
  culture: number;
}

export interface Unit {
  id: string;
  unit_type: UnitType;
  owner: string;
  position: Position;
  movement_points: number;
  movement_points_left: number;
  strength: number;
  health: number;
  promotions: string[];
  has_attacked: boolean;
}

export interface MapData {
  width: number;
  height: number;
  tiles: Tile[];
  fog_of_war: boolean[][];
}

export interface PlayerState {
  civ_id: string;
  resources: Resources;
  cities: City[];
  units: Unit[];
  researched_techs: string[];
  current_research?: string;
  research_progress: number;
  diplomacy_status: DiplomacyStatus;
  score: number;
  spaceship_built: boolean;
}

export interface GameState {
  id: string;
  name: string;
  turn: number;
  current_phase: string;
  current_player: 'player' | 'ai';
  player: PlayerState;
  ai: Partial<PlayerState> & { cities: any[]; units: any[] };
  map: MapData;
  result: GameResult;
  max_turns: number;
  cheats_used: string[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  map_width: number;
  map_height: number;
}

export interface SavedGameSummary {
  id: string;
  name: string;
  scenario_id: string;
  created_at: string;
  last_saved: string;
  is_autosave: boolean;
  turn: number;
  result: string;
}

export interface ActionRequest {
  action_type: string;
  details: Record<string, unknown>;
}
