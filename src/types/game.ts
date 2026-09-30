export type GameState = 'menu' | 'tutorial' | 'playing' | 'paused' | 'gameover';

export type BiomeType = 'canopy' | 'bridge' | 'cavern' | 'ramparts';

export type ObstacleType =
  | 'fallen_tree'
  | 'broken_wall'
  | 'large_rock'
  | 'spiked_gate'
  | 'collapsing_bridge'
  | 'fire_trap'
  | 'swinging_pendulum'
  | 'path_gap';

export type CollectibleType = 'coin' | 'rare_relic';

export type PowerUpType = 'shield' | 'magnet' | 'speed_boost' | 'multiplier';

export type LaneIndex = -1 | 0 | 1; // -1 = Left, 0 = Center, 1 = Right

export interface ActivePowerUp {
  type: PowerUpType;
  remaining: number;
  duration: number;
}

export interface FloatingCallout {
  id: number;
  text: string;
  subtext?: string;
  color: 'amber' | 'cyan' | 'emerald' | 'rose' | 'violet';
  timestamp: number;
}

export interface GameMetrics {
  score: number;
  distance: number;
  coins: number;
  rareRelics: number;
  speed: number;
  multiplier: number;
  combo: number;
  biome: BiomeType;
  activePowerUps: ActivePowerUp[];
  deathReason?: string;
  isNewHighScore?: boolean;
}

export interface GameSettings {
  musicVolume: number; // 0 to 1
  sfxVolume: number;   // 0 to 1
  musicMuted: boolean;
  sfxMuted: boolean;
  graphicsQuality: 'high' | 'balanced' | 'performance';
  cameraShake: boolean;
}

export interface PlayerOutfit {
  id: string;
  name: string;
  title: string;
  cost: number;
  tunicColor: number;
  scarfColor: number;
  hatColor: number;
  accentColor: number;
}

export interface PersistentData {
  highScore: number;
  bestDistance: number;
  totalCoins: number;
  totalRuns: number;
  tutorialCompleted: boolean;
  selectedOutfit: string;
  unlockedOutfits: string[];
  settings: GameSettings;
}

export const EXPLORER_OUTFITS: PlayerOutfit[] = [
  {
    id: 'sunstone_cartographer',
    name: 'Kaelen Vance',
    title: 'Sunstone Cartographer',
    cost: 0,
    tunicColor: 0xb45309, // Warm expedition amber-ochre
    scarfColor: 0x0d9488, // Jungle teal scarf
    hatColor: 0x573b26,   // Weathered leather brown
    accentColor: 0xfbbf24,
  },
  {
    id: 'emerald_pathfinder',
    name: 'Lyra Thorne',
    title: 'Canopy Ranger',
    cost: 150,
    tunicColor: 0x065f46, // Deep emerald
    scarfColor: 0xf59e0b, // Golden sun scarf
    hatColor: 0x1e293b,   // Slate expedition hood
    accentColor: 0x34d399,
  },
  {
    id: 'obsidian_vanguard',
    name: 'Vaelen Dusk',
    title: 'Cavern Delver',
    cost: 350,
    tunicColor: 0x312e81, // Deep indigo-obsidian
    scarfColor: 0xec4899, // Crimson-magenta scarf
    hatColor: 0x18181b,   // Obsidian leather
    accentColor: 0x38bdf8,
  },
  {
    id: 'solar_monarch',
    name: 'Aurelia Sol',
    title: 'High Temple Guardian',
    cost: 750,
    tunicColor: 0x991b1b, // Royal crimson
    scarfColor: 0xfde047, // Radiant solar gold
    hatColor: 0x78350f,   // Bronze-trimmed helm
    accentColor: 0xfef08a,
  },
];

export const BIOME_CONFIGS: Record<
  BiomeType,
  {
    name: string;
    subtitle: string;
    fogColor: number;
    skyTopColor: string;
    skyBottomColor: string;
    ambientColor: number;
    sunColor: number;
    groundColor: number;
  }
> = {
  canopy: {
    name: 'Emerald Canopy Viaduct',
    subtitle: 'Overgrown Sunstone Causeway',
    fogColor: 0x132a23,
    skyTopColor: '#0c241d',
    skyBottomColor: '#254d3e',
    ambientColor: 0x86efac,
    sunColor: 0xfde68a,
    groundColor: 0x57534e,
  },
  bridge: {
    name: 'Whispering Gorge Bridges',
    subtitle: 'High Mist Suspension Crossings',
    fogColor: 0x1e293b,
    skyTopColor: '#0f172a',
    skyBottomColor: '#334155',
    ambientColor: 0x93c5fd,
    sunColor: 0xfed7aa,
    groundColor: 0x78350f,
  },
  cavern: {
    name: 'Sunken Obsidian Sanctum',
    subtitle: 'Subterranean Crystal Galleries',
    fogColor: 0x161129,
    skyTopColor: '#090614',
    skyBottomColor: '#1e1638',
    ambientColor: 0xa78bfa,
    sunColor: 0x38bdf8,
    groundColor: 0x27272a,
  },
  ramparts: {
    name: 'Solar Temple Ramparts',
    subtitle: 'Golden Citadel Acropolis',
    fogColor: 0x2d1a12,
    skyTopColor: '#1f100a',
    skyBottomColor: '#5c2d16',
    ambientColor: 0xfdba74,
    sunColor: 0xfef08a,
    groundColor: 0x854d0e,
  },
};

export const OBSTACLE_INFO: Record<
  ObstacleType,
  {
    name: string;
    action: 'JUMP' | 'SLIDE' | 'DODGE' | 'JUMP / DODGE';
    description: string;
  }
> = {
  fallen_tree: {
    name: 'Fallen Banyan Trunk',
    action: 'JUMP',
    description: 'Massive moss-grown tree trunk across the stone path. Jump cleanly over it.',
  },
  broken_wall: {
    name: 'Shattered Ruin Monolith',
    action: 'DODGE',
    description: 'Tall carved temple masonry blocking the lane. Switch lanes left or right.',
  },
  large_rock: {
    name: 'Granite Boulder Cluster',
    action: 'JUMP / DODGE',
    description: 'Craggy jungle rockfall. Leap over the crest or sidestep to an open lane.',
  },
  spiked_gate: {
    name: 'Bronze Spiked Portcullis',
    action: 'SLIDE',
    description: 'Overhead iron-spiked temple gate. Slide underneath to pass safely.',
  },
  collapsing_bridge: {
    name: 'Rotting Timber Span',
    action: 'JUMP / DODGE',
    description: 'Unstable wooden planks that drop into the gorge as you near. Jump across!',
  },
  fire_trap: {
    name: 'Serpent Flame Brazier',
    action: 'SLIDE',
    description: 'Ancient stone dragon nozzle firing a high jet of searing temple flame. Slide low!',
  },
  swinging_pendulum: {
    name: 'Swinging Crescent Blade',
    action: 'DODGE',
    description: 'Pendulum axe sweeping across the viaduct. Time your lane change carefully.',
  },
  path_gap: {
    name: 'Abyssal Chasm Gap',
    action: 'JUMP',
    description: 'Collapsed viaduct section over a roaring waterfall. Leap before the edge!',
  },
};
