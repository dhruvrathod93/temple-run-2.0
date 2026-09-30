import * as THREE from 'three';
import {
  ActivePowerUp,
  BIOME_CONFIGS,
  BiomeType,
  CollectibleType,
  EXPLORER_OUTFITS,
  FloatingCallout,
  GameMetrics,
  GameSettings,
  LaneIndex,
  OBSTACLE_INFO,
  ObstacleType,
  PowerUpType,
} from '../types/game';
import { soundEngine } from '../audio/SoundEngine';
import {
  assets,
  createCollectibleMesh,
  createExplorerRig,
  createHorizonMountains,
  createObstacleMesh,
  createPowerUpMesh,
  createRampMesh,
  createTurnArchMesh,
  decorateTrackChunk,
  ExplorerRig,
  updateExplorerOutfit,
} from './WorldBuilder';

const LANE_WIDTH = 2.4;
const CHUNK_LENGTH = 16;
const NUM_CHUNKS = 14;
const BASE_SPEED = 16.5;
const MAX_SPEED = 36.0;
const GRAVITY = 38.0;
const JUMP_VELOCITY = 14.6;
const SLIDE_DURATION = 0.72;

interface TrackChunk {
  group: THREE.Group;
  deckMesh: THREE.Mesh;
  leftCurb: THREE.Mesh;
  rightCurb: THREE.Mesh;
  zStart: number;
  index: number;
  biome: BiomeType;
}

interface ActiveObstacle {
  id: number;
  type: ObstacleType;
  lane: LaneIndex;
  z: number;
  group: THREE.Group;
  animatedPart?: THREE.Object3D;
  phase: number;
  passed: boolean;
  shattered: boolean;
}

interface ActiveRamp {
  lane: LaneIndex;
  zCenter: number;
  length: number;
  height: number;
  group: THREE.Group;
}

interface ActiveTurnArch {
  direction: 'left' | 'right';
  z: number;
  triggered: boolean;
  group: THREE.Group;
}

interface ActiveCollectible {
  id: number;
  type: CollectibleType;
  lane: LaneIndex;
  baseX: number;
  baseY: number;
  z: number;
  group: THREE.Group;
  collected: boolean;
  magnetized: boolean;
}

interface ActivePowerUpItem {
  id: number;
  type: PowerUpType;
  lane: LaneIndex;
  y: number;
  z: number;
  group: THREE.Group;
  collected: boolean;
}

interface Particle3D {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

export class GameEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private playerLight: THREE.PointLight;
  private fog: THREE.FogExp2;
  private horizonGroup: THREE.Group;

  private explorer: ExplorerRig;

  // World & Pooled Collections
  private chunks: TrackChunk[] = [];
  private obstacles: ActiveObstacle[] = [];
  private ramps: ActiveRamp[] = [];
  private turnArches: ActiveTurnArch[] = [];
  private collectibles: ActiveCollectible[] = [];
  private powerUpItems: ActivePowerUpItem[] = [];
  private particles: Particle3D[] = [];

  // Game State
  private isRunning = false;
  private isPaused = false;
  private isGameOver = false;
  private deathAnimationType: 'stumble' | 'fall' = 'stumble';
  private deathTimer = 0;

  // Player Physics & Controls
  private currentLane: LaneIndex = 0;
  private playerX = 0;
  private playerY = 0;
  private playerZ = 0;
  private velocityY = 0;
  private isJumping = false;
  private isSliding = false;
  private slideTimer = 0;
  private jumpBufferTimer = 0;
  private slideBufferTimer = 0;
  private runCycle = 0;
  private footstepTimer = 0;

  // Camera & Visual Feedback
  private cameraShakeIntensity = 0;
  private worldTurnAngle = 0;
  private targetTurnBank = 0;
  private currentTurnBank = 0;

  // Progression & Metrics
  private score = 0;
  private distance = 0;
  private coins = 0;
  private rareRelics = 0;
  private speed = BASE_SPEED;
  private combo = 0;
  private lastCoinTime = 0;
  private currentBiome: BiomeType = 'canopy';
  private activePowerUps: Map<PowerUpType, ActivePowerUp> = new Map();

  private nextChunkIndex = 0;
  private farthestChunkZ = 0;
  private entityIdCounter = 1;
  private calloutIdCounter = 1;

  private settings: GameSettings;
  private onMetricsUpdate: (metrics: GameMetrics) => void;
  private onCallout: (callout: FloatingCallout) => void;
  private onGameOverCallback: (metrics: GameMetrics) => void;

  private animationFrameId: number | null = null;
  private lastFrameTime = 0;

  // Touch Gesture Tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;

  constructor(
    container: HTMLElement,
    settings: GameSettings,
    selectedOutfitId: string,
    onMetricsUpdate: (metrics: GameMetrics) => void,
    onCallout: (callout: FloatingCallout) => void,
    onGameOverCallback: (metrics: GameMetrics) => void
  ) {
    this.container = container;
    this.settings = settings;
    this.onMetricsUpdate = onMetricsUpdate;
    this.onCallout = onCallout;
    this.onGameOverCallback = onGameOverCallback;

    // 1. Scene & Atmospheric Fog
    this.scene = new THREE.Scene();
    const initialBiome = BIOME_CONFIGS.canopy;
    this.fog = new THREE.FogExp2(initialBiome.fogColor, 0.014);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(initialBiome.fogColor);

    // 2. Camera (Third-person chase perspective)
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 220);
    this.camera.position.set(0, 4.3, 6.8);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: settings.graphicsQuality !== 'performance',
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      settings.graphicsQuality === 'high'
        ? Math.min(window.devicePixelRatio, 2)
        : settings.graphicsQuality === 'balanced'
        ? Math.min(window.devicePixelRatio, 1.5)
        : 1
    );
    this.renderer.shadowMap.enabled = settings.graphicsQuality !== 'performance';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Clear container and mount canvas
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(this.renderer.domElement);

    // 4. Three-Point & Atmospheric Lighting
    this.hemiLight = new THREE.HemisphereLight(
      initialBiome.ambientColor,
      0x1c1917,
      0.85
    );
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(initialBiome.sunColor, 1.65);
    this.dirLight.position.set(18, 32, 16);
    this.dirLight.castShadow = settings.graphicsQuality !== 'performance';
    this.dirLight.shadow.mapSize.width =
      settings.graphicsQuality === 'high' ? 2048 : 1024;
    this.dirLight.shadow.mapSize.height =
      settings.graphicsQuality === 'high' ? 2048 : 1024;
    this.dirLight.shadow.camera.near = 2;
    this.dirLight.shadow.camera.far = 95;
    const d = 24;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    this.playerLight = new THREE.PointLight(0xfbbf24, 0.8, 12);
    this.playerLight.position.set(0, 2.8, 1);
    this.scene.add(this.playerLight);

    // 5. Distant Horizon Mountains & Sun
    this.horizonGroup = createHorizonMountains();
    this.scene.add(this.horizonGroup);

    // 6. Explorer Character
    const outfit =
      EXPLORER_OUTFITS.find((o) => o.id === selectedOutfitId) ||
      EXPLORER_OUTFITS[0];
    this.explorer = createExplorerRig(outfit);
    this.scene.add(this.explorer.root);

    // 7. Initialize Pooled Track Chunks & 3D Particles
    this.initTrackChunks();
    this.initParticlePool();

    // 8. Bind Event Listeners
    this.handleResize = this.handleResize.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    const dom = this.renderer.domElement;
    dom.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    dom.addEventListener('touchend', this.handleTouchEnd, { passive: true });

    // Start main render loop (renders idle scene in menu and active run in gameplay)
    this.lastFrameTime = performance.now();
    this.animate(this.lastFrameTime);
  }

  private initTrackChunks() {
    const laneLineMat = new THREE.MeshBasicMaterial({
      color: 0xd6d3d1,
      transparent: true,
      opacity: 0.22,
    });

    for (let i = 0; i < NUM_CHUNKS; i++) {
      const group = new THREE.Group();

      // Main 3-lane stone viaduct deck
      const deckMat = new THREE.MeshStandardMaterial({
        color: BIOME_CONFIGS.canopy.groundColor,
        roughness: 0.88,
        metalness: 0.05,
      });
      const deckMesh = new THREE.Mesh(assets.boxGeo, deckMat);
      deckMesh.scale.set(7.6, 1.2, CHUNK_LENGTH);
      deckMesh.position.set(0, -0.6, -CHUNK_LENGTH / 2);
      deckMesh.receiveShadow = true;
      group.add(deckMesh);

      // Left & Right carved stone curbs
      const leftCurb = new THREE.Mesh(assets.boxGeo, assets.darkStoneMat);
      leftCurb.scale.set(0.55, 0.36, CHUNK_LENGTH);
      leftCurb.position.set(-4.05, 0.18, -CHUNK_LENGTH / 2);
      leftCurb.receiveShadow = true;
      group.add(leftCurb);

      const rightCurb = new THREE.Mesh(assets.boxGeo, assets.darkStoneMat);
      rightCurb.scale.set(0.55, 0.36, CHUNK_LENGTH);
      rightCurb.position.set(4.05, 0.18, -CHUNK_LENGTH / 2);
      rightCurb.receiveShadow = true;
      group.add(rightCurb);

      // Subtle carved lane groove markers
      for (const grooveX of [-1.2, 1.2]) {
        const groove = new THREE.Mesh(assets.boxGeo, laneLineMat);
        groove.scale.set(0.08, 0.02, CHUNK_LENGTH - 1.5);
        groove.position.set(grooveX, 0.01, -CHUNK_LENGTH / 2);
        group.add(groove);
      }

      const zStart = 12 - i * CHUNK_LENGTH;
      group.position.set(0, 0, zStart);
      decorateTrackChunk(group, 'canopy', i);
      this.scene.add(group);

      this.chunks.push({
        group,
        deckMesh,
        leftCurb,
        rightCurb,
        zStart,
        index: i,
        biome: 'canopy',
      });

      this.nextChunkIndex = i + 1;
      this.farthestChunkZ = zStart - CHUNK_LENGTH;
    }
  }

  private initParticlePool() {
    const pGeo = new THREE.OctahedronGeometry(0.14, 0);
    for (let i = 0; i < 90; i++) {
      const pMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(pGeo, pMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.5,
        active: false,
      });
    }
  }

  public spawnBurstParticles(
    position: THREE.Vector3,
    colorHex: number,
    count = 14,
    speedScale = 1
  ) {
    let spawned = 0;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.35 + Math.random() * 0.35;
        p.mesh.position.copy(position);
        (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
        p.mesh.scale.setScalar(0.8 + Math.random() * 0.8);
        p.mesh.visible = true;

        const angle = Math.random() * Math.PI * 2;
        const speed = (2.2 + Math.random() * 4.5) * speedScale;
        p.velocity.set(
          Math.cos(angle) * speed,
          2.0 + Math.random() * 4.5 * speedScale,
          Math.sin(angle) * speed
        );

        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  // ==================== PUBLIC CONTROLS & LIFECYCLE ====================

  public updateSettings(newSettings: GameSettings) {
    this.settings = newSettings;
    this.renderer.shadowMap.enabled =
      newSettings.graphicsQuality !== 'performance';
    this.dirLight.castShadow = newSettings.graphicsQuality !== 'performance';
    this.renderer.setPixelRatio(
      newSettings.graphicsQuality === 'high'
        ? Math.min(window.devicePixelRatio, 2)
        : newSettings.graphicsQuality === 'balanced'
        ? Math.min(window.devicePixelRatio, 1.5)
        : 1
    );
  }

  public setOutfit(outfitId: string) {
    const outfit =
      EXPLORER_OUTFITS.find((o) => o.id === outfitId) || EXPLORER_OUTFITS[0];
    updateExplorerOutfit(this.explorer, outfit);
  }

  public startNewRun() {
    soundEngine.unlock();
    soundEngine.startMusic();

    // Clear existing dynamic objects
    this.clearDynamicEntities();

    // Reset Player & Run Metrics
    this.currentLane = 0;
    this.playerX = 0;
    this.playerY = 0;
    this.playerZ = 0;
    this.velocityY = 0;
    this.isJumping = false;
    this.isSliding = false;
    this.slideTimer = 0;
    this.jumpBufferTimer = 0;
    this.slideBufferTimer = 0;
    this.runCycle = 0;
    this.cameraShakeIntensity = 0;
    this.currentTurnBank = 0;
    this.targetTurnBank = 0;

    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.rareRelics = 0;
    this.speed = BASE_SPEED;
    this.combo = 0;
    this.currentBiome = 'canopy';
    this.activePowerUps.clear();

    this.isRunning = true;
    this.isPaused = false;
    this.isGameOver = false;
    this.deathTimer = 0;

    // Reset Explorer Pose
    this.explorer.root.position.set(0, 0, 0);
    this.explorer.root.rotation.set(0, 0, 0);
    this.explorer.pelvis.position.set(0, 0.92, 0);
    this.explorer.pelvis.rotation.set(0, 0, 0);
    this.explorer.shieldBubble.visible = false;
    this.explorer.magnetRing.visible = false;
    this.explorer.boostTrail.visible = false;

    // Reset Track Chunks around Z = 0
    this.nextChunkIndex = 0;
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      chunk.zStart = 12 - i * CHUNK_LENGTH;
      chunk.index = i;
      chunk.biome = 'canopy';
      chunk.group.position.set(0, 0, chunk.zStart);
      (chunk.deckMesh.material as THREE.MeshStandardMaterial).color.setHex(
        BIOME_CONFIGS.canopy.groundColor
      );
      decorateTrackChunk(chunk.group, 'canopy', i);
      this.nextChunkIndex = i + 1;
      this.farthestChunkZ = chunk.zStart - CHUNK_LENGTH;

      // Spawn obstacles & coins starting from chunk 3 onward so the player has a clean 40m runway
      if (i >= 3) {
        this.populateChunkEntities(chunk.zStart, i);
      } else if (i === 2) {
        // Welcome trail of coins in center lane
        this.spawnCoinLine(0, chunk.zStart - 2, 5, 0);
      }
    }

    this.emitMetrics();
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    if (paused) {
      soundEngine.stopMusic();
    } else if (this.isRunning && !this.isGameOver) {
      soundEngine.startMusic();
    }
  }

  public stopToMenu() {
    this.isRunning = false;
    this.isPaused = false;
    this.isGameOver = false;
    soundEngine.stopMusic();
    this.clearDynamicEntities();
    this.explorer.root.position.set(0, 0, 0);
    this.explorer.root.rotation.set(0, 0, 0);
    this.explorer.pelvis.position.set(0, 0.92, 0);
    this.explorer.pelvis.rotation.set(0, 0, 0);
    this.explorer.shieldBubble.visible = false;
    this.explorer.magnetRing.visible = false;
    this.explorer.boostTrail.visible = false;
  }

  private clearDynamicEntities() {
    this.obstacles.forEach((o) => this.scene.remove(o.group));
    this.obstacles = [];

    this.ramps.forEach((r) => this.scene.remove(r.group));
    this.ramps = [];

    this.turnArches.forEach((t) => this.scene.remove(t.group));
    this.turnArches = [];

    this.collectibles.forEach((c) => this.scene.remove(c.group));
    this.collectibles = [];

    this.powerUpItems.forEach((p) => this.scene.remove(p.group));
    this.powerUpItems = [];
  }

  // ==================== PROCEDURAL LEVEL GENERATION ====================

  private populateChunkEntities(zStart: number, chunkIdx: number) {
    // Determine difficulty factor (0.0 to 1.0)
    const difficulty = Math.min(1, this.distance / 1800);

    // Every 14th chunk, spawn a Temple Turn Gateway!
    if (chunkIdx > 0 && chunkIdx % 14 === 0) {
      const dir: 'left' | 'right' = chunkIdx % 28 === 0 ? 'left' : 'right';
      const archGroup = createTurnArchMesh(dir);
      const archZ = zStart - CHUNK_LENGTH * 0.5;
      archGroup.position.set(0, 0, archZ);
      this.scene.add(archGroup);
      this.turnArches.push({
        direction: dir,
        z: archZ,
        triggered: false,
        group: archGroup,
      });

      // Spawn a diagonal trail of coins guiding the player toward the turn direction
      const targetLane: LaneIndex = dir === 'left' ? -1 : 1;
      for (let c = 0; c < 6; c++) {
        const lane = c < 2 ? 0 : targetLane;
        this.spawnCollectible(
          c === 5 ? 'rare_relic' : 'coin',
          lane as LaneIndex,
          zStart - c * 2.2,
          0.95
        );
      }
      return;
    }

    // Every 9th chunk, spawn an Elevated Stone Ramp on one lane with high coins & power-up!
    if (chunkIdx > 0 && chunkIdx % 9 === 0) {
      const lanes: LaneIndex[] = [-1, 0, 1];
      const rampLane = lanes[chunkIdx % 3];
      const rampGroup = createRampMesh();
      const rampZ = zStart - CHUNK_LENGTH * 0.5;
      rampGroup.position.set(rampLane * LANE_WIDTH, 0, rampZ);
      this.scene.add(rampGroup);

      this.ramps.push({
        lane: rampLane,
        zCenter: rampZ,
        length: 9.6,
        height: 1.35,
        group: rampGroup,
      });

      // Spawn coins ascending the ramp and launching into a high jump arc!
      for (let c = 0; c < 6; c++) {
        const cz = rampZ + 4.0 - c * 1.8;
        const cy = c < 3 ? 1.0 + c * 0.45 : 2.35;
        this.spawnCollectible('coin', rampLane, cz, cy);
      }

      // Place an obstacle on one of the other lanes so the ramp is an exciting route choice
      const otherLane = ((rampLane + 2) % 3 - 1) as LaneIndex;
      this.spawnObstacle('broken_wall', otherLane, rampZ);
      return;
    }

    // Standard Chunk: Spawn 1 or 2 obstacle rows depending on difficulty
    const rows = difficulty > 0.45 && chunkIdx % 2 === 0 ? 2 : 1;
    for (let r = 0; r < rows; r++) {
      const rowZ =
        rows === 1
          ? zStart - CHUNK_LENGTH * 0.5
          : zStart - (r === 0 ? 4.5 : 12.5);

      this.spawnObstacleRow(rowZ, chunkIdx + r, difficulty);
    }
  }

  private spawnObstacleRow(z: number, seed: number, difficulty: number) {
    const allLanes: LaneIndex[] = [-1, 0, 1];

    // 15% chance for a full-width Swinging Pendulum
    if (seed % 7 === 0 && difficulty > 0.1) {
      this.spawnObstacle('swinging_pendulum', 0, z);
      const coinLane = allLanes[seed % 3];
      this.spawnCoinLine(coinLane, z + 3, 4, 0);
      return;
    }

    // Choose whether to block 1 lane or 2 lanes
    const numObstacles = Math.random() < 0.38 + difficulty * 0.35 ? 2 : 1;
    const shuffledLanes = [...allLanes].sort(() => Math.random() - 0.5);
    const obstacleLanes = shuffledLanes.slice(0, numObstacles);
    const openLane = shuffledLanes[numObstacles];

    const pool: ObstacleType[] = [
      'fallen_tree',
      'broken_wall',
      'large_rock',
      'spiked_gate',
      'collapsing_bridge',
      'fire_trap',
      'path_gap',
    ];

    obstacleLanes.forEach((lane, idx) => {
      // Pick varied obstacle type
      const obsType =
        pool[Math.floor((Math.random() * pool.length + idx) % pool.length)];
      this.spawnObstacle(obsType, lane, z);

      // If obstacle is jumpable, sometimes place a coin arc right over it!
      if (
        idx === 0 &&
        (obsType === 'fallen_tree' ||
          obsType === 'large_rock' ||
          obsType === 'path_gap' ||
          obsType === 'collapsing_bridge') &&
        Math.random() < 0.55
      ) {
        this.spawnCoinArc(lane, z);
      }
    });

    // Spawn collectibles or a power-up in the open lane
    if (Math.random() < 0.14) {
      const pTypes: PowerUpType[] = [
        'shield',
        'magnet',
        'speed_boost',
        'multiplier',
      ];
      const pType = pTypes[Math.floor(Math.random() * pTypes.length)];
      this.spawnPowerUp(pType, openLane, z);
    } else if (Math.random() < 0.78) {
      this.spawnCoinLine(openLane, z + 3.2, 4, Math.random() < 0.12 ? 1 : 0);
    }
  }

  private spawnObstacle(type: ObstacleType, lane: LaneIndex, z: number) {
    const { group, animatedPart } = createObstacleMesh(type);
    const x = type === 'swinging_pendulum' ? 0 : lane * LANE_WIDTH;
    group.position.set(x, 0, z);
    this.scene.add(group);

    this.obstacles.push({
      id: this.entityIdCounter++,
      type,
      lane,
      z,
      group,
      animatedPart,
      phase: Math.random() * Math.PI * 2,
      passed: false,
      shattered: false,
    });
  }

  private spawnCollectible(
    type: CollectibleType,
    lane: LaneIndex,
    z: number,
    y = 0.95
  ) {
    const group = createCollectibleMesh(type);
    const x = lane * LANE_WIDTH;
    group.position.set(x, y, z);
    this.scene.add(group);

    this.collectibles.push({
      id: this.entityIdCounter++,
      type,
      lane,
      baseX: x,
      baseY: y,
      z,
      group,
      collected: false,
      magnetized: false,
    });
  }

  private spawnCoinLine(
    lane: LaneIndex,
    zStart: number,
    count: number,
    includeRare: number
  ) {
    for (let i = 0; i < count; i++) {
      const isRare = includeRare > 0 && i === count - 1;
      this.spawnCollectible(
        isRare ? 'rare_relic' : 'coin',
        lane,
        zStart - i * 1.85,
        0.95
      );
    }
  }

  private spawnCoinArc(lane: LaneIndex, centerZ: number) {
    const offsets = [
      { dz: 3.0, y: 1.1 },
      { dz: 1.5, y: 2.05 },
      { dz: 0.0, y: 2.55 },
      { dz: -1.5, y: 2.05 },
      { dz: -3.0, y: 1.1 },
    ];
    offsets.forEach((pt, idx) => {
      this.spawnCollectible(
        idx === 2 && Math.random() < 0.25 ? 'rare_relic' : 'coin',
        lane,
        centerZ + pt.dz,
        pt.y
      );
    });
  }

  private spawnPowerUp(type: PowerUpType, lane: LaneIndex, z: number) {
    const group = createPowerUpMesh(type);
    group.position.set(lane * LANE_WIDTH, 1.25, z);
    this.scene.add(group);

    this.powerUpItems.push({
      id: this.entityIdCounter++,
      type,
      lane,
      y: 1.25,
      z,
      group,
      collected: false,
    });
  }

  // ==================== PLAYER INPUT HANDLERS ====================

  public moveLeft() {
    if (!this.isRunning || this.isPaused || this.isGameOver) return;
    this.checkTurnGateway('left');
    if (this.currentLane > -1) {
      this.currentLane = (this.currentLane - 1) as LaneIndex;
      this.targetTurnBank = 0.16;
      soundEngine.playLaneSwitch();
    }
  }

  public moveRight() {
    if (!this.isRunning || this.isPaused || this.isGameOver) return;
    this.checkTurnGateway('right');
    if (this.currentLane < 1) {
      this.currentLane = (this.currentLane + 1) as LaneIndex;
      this.targetTurnBank = -0.16;
      soundEngine.playLaneSwitch();
    }
  }

  public jump() {
    if (!this.isRunning || this.isPaused || this.isGameOver) return;
    if (!this.isJumping) {
      this.executeJump();
    } else {
      // Buffer jump for 0.18s so pressing right before landing still jumps
      this.jumpBufferTimer = 0.18;
    }
  }

  private executeJump() {
    this.isJumping = true;
    this.isSliding = false;
    this.slideTimer = 0;
    this.velocityY = JUMP_VELOCITY;
    soundEngine.playJump();
    this.spawnBurstParticles(
      new THREE.Vector3(this.playerX, this.playerY + 0.1, this.playerZ),
      0xd6d3d1,
      6,
      0.5
    );
  }

  public slide() {
    if (!this.isRunning || this.isPaused || this.isGameOver) return;
    if (this.isJumping) {
      // Fast-fall dive from air into immediate slide!
      this.velocityY = -26.0;
      this.slideBufferTimer = 0.28;
      soundEngine.playSlide();
    } else if (!this.isSliding) {
      this.executeSlide();
    } else {
      this.slideTimer = SLIDE_DURATION;
    }
  }

  private executeSlide() {
    this.isSliding = true;
    this.slideTimer = SLIDE_DURATION;
    soundEngine.playSlide();
    this.spawnBurstParticles(
      new THREE.Vector3(this.playerX, this.playerY + 0.1, this.playerZ),
      0xa8a29e,
      8,
      0.6
    );
  }

  private checkTurnGateway(inputDir: 'left' | 'right') {
    for (const arch of this.turnArches) {
      if (!arch.triggered && Math.abs(arch.z - this.playerZ) < 14) {
        if (arch.direction === inputDir) {
          arch.triggered = true;
          const mult = this.getScoreMultiplier();
          const bonus = 200 * mult;
          this.score += bonus;
          this.worldTurnAngle = inputDir === 'left' ? 0.34 : -0.34;
          soundEngine.playTurnBonus();
          this.onCallout({
            id: this.calloutIdCounter++,
            text: `+${bonus} TEMPLE TURN!`,
            subtext: 'Precision Cornering Bonus',
            color: 'emerald',
            timestamp: performance.now(),
          });
        }
      }
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (!this.isRunning || this.isPaused || this.isGameOver) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault();
      this.moveLeft();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault();
      this.moveRight();
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
      e.preventDefault();
      this.jump();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      this.slide();
    }
  }

  private handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 0) return;
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.touchStartTime = performance.now();
  }

  private handleTouchEnd(e: TouchEvent) {
    if (!this.isRunning || this.isPaused || this.isGameOver) return;
    if (e.changedTouches.length === 0) return;

    const dx = e.changedTouches[0].clientX - this.touchStartX;
    const dy = e.changedTouches[0].clientY - this.touchStartY;
    const elapsed = performance.now() - this.touchStartTime;

    if (elapsed > 650) return;
    const minSwipe = 26;
    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) this.moveRight();
      else this.moveLeft();
    } else {
      if (dy < 0) this.jump();
      else this.slide();
    }
  }

  private handleResize() {
    if (!this.container) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // ==================== MAIN GAMEPLAY UPDATE LOOP ====================

  private getScoreMultiplier(): number {
    const has2x = this.activePowerUps.has('multiplier') ? 2 : 1;
    const comboMult = this.combo >= 15 ? 2 : 1;
    return has2x * comboMult;
  }

  private getGroundHeightAt(lane: LaneIndex, z: number): number {
    for (const ramp of this.ramps) {
      if (ramp.lane === lane) {
        const halfLen = ramp.length * 0.5;
        if (z <= ramp.zCenter + halfLen && z >= ramp.zCenter - halfLen) {
          // Smooth ramp profile: slope up on front half, flat deck on back half
          const progress = (ramp.zCenter + halfLen - z) / ramp.length;
          if (progress < 0.45) {
            return (progress / 0.45) * ramp.height;
          }
          return ramp.height;
        }
      }
    }
    return 0;
  }

  private animate = (now: number) => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    if (!this.isRunning) {
      this.updateMenuIdleScene(now * 0.001);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.isPaused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.isGameOver) {
      this.updateDeathAnimation(dt);
      this.updateParticles(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.updateGameplay(dt, now * 0.001);
    this.updateParticles(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private updateMenuIdleScene(timeSec: number) {
    // Showcase Kaelen at the temple entrance with gentle breathing and warm camera orbit
    this.explorer.root.position.set(0, 0, 0);
    this.explorer.root.rotation.y = Math.sin(timeSec * 0.6) * 0.22;
    this.explorer.pelvis.position.y = 0.92 + Math.sin(timeSec * 2.5) * 0.025;
    this.explorer.leftArm.rotation.x = Math.sin(timeSec * 1.8) * 0.1;
    this.explorer.rightArm.rotation.x = -Math.sin(timeSec * 1.8) * 0.1;
    this.explorer.leftLeg.rotation.x = 0;
    this.explorer.rightLeg.rotation.x = 0;
    this.explorer.scarfTail.rotation.x = 0.2 + Math.sin(timeSec * 4.5) * 0.15;

    this.camera.position.set(
      Math.sin(timeSec * 0.35) * 1.6,
      3.1,
      5.2 + Math.cos(timeSec * 0.35) * 0.4
    );
    this.camera.lookAt(0, 1.35, -4);
  }

  private updateGameplay(dt: number, timeSec: number) {
    // 1. Update Active Power-Up Timers
    const isBoostActive = this.activePowerUps.has('speed_boost');
    const isShieldActive = this.activePowerUps.has('shield');
    const isMagnetActive = this.activePowerUps.has('magnet');

    for (const [key, p] of this.activePowerUps.entries()) {
      p.remaining -= dt;
      if (p.remaining <= 0) {
        this.activePowerUps.delete(key);
      }
    }

    this.explorer.shieldBubble.visible = isShieldActive;
    if (isShieldActive) {
      this.explorer.shieldBubble.rotation.y += dt * 1.8;
    }

    this.explorer.magnetRing.visible = isMagnetActive;
    if (isMagnetActive) {
      this.explorer.magnetRing.scale.setScalar(
        1 + Math.sin(timeSec * 8) * 0.12
      );
    }

    this.explorer.boostTrail.visible = isBoostActive;

    // 2. Speed & Difficulty Progression
    const targetBaseSpeed = Math.min(
      MAX_SPEED,
      BASE_SPEED + this.distance * 0.0085
    );
    this.speed = isBoostActive ? targetBaseSpeed * 1.42 : targetBaseSpeed;
    soundEngine.setTempoMultiplier(this.speed / BASE_SPEED);

    const dz = this.speed * dt;
    this.playerZ -= dz;
    this.distance += dz * 0.65;
    this.score += dz * 1.8 * this.getScoreMultiplier();

    // Check Biome Transitions every 350m
    const biomes: BiomeType[] = ['canopy', 'bridge', 'cavern', 'ramparts'];
    const biomeIdx = Math.floor(this.distance / 350) % biomes.length;
    const nextBiome = biomes[biomeIdx];
    if (nextBiome !== this.currentBiome) {
      this.currentBiome = nextBiome;
      const cfg = BIOME_CONFIGS[nextBiome];
      this.onCallout({
        id: this.calloutIdCounter++,
        text: cfg.name.toUpperCase(),
        subtext: cfg.subtitle,
        color: 'amber',
        timestamp: performance.now(),
      });
    }

    // Smoothly interpolate biome atmosphere colors
    const targetBiomeCfg = BIOME_CONFIGS[this.currentBiome];
    this.fog.color.lerp(new THREE.Color(targetBiomeCfg.fogColor), dt * 1.5);
    (this.scene.background as THREE.Color).copy(this.fog.color);
    this.hemiLight.color.lerp(
      new THREE.Color(targetBiomeCfg.ambientColor),
      dt * 1.5
    );
    this.dirLight.color.lerp(new THREE.Color(targetBiomeCfg.sunColor), dt * 1.5);

    // 3. Lateral Movement & Ground/Ramp Physics
    const targetX = this.currentLane * LANE_WIDTH;
    this.playerX = THREE.MathUtils.lerp(this.playerX, targetX, Math.min(1, dt * 15));
    this.targetTurnBank = THREE.MathUtils.lerp(this.targetTurnBank, 0, dt * 8);
    this.currentTurnBank = THREE.MathUtils.lerp(
      this.currentTurnBank,
      this.targetTurnBank,
      dt * 12
    );
    this.worldTurnAngle = THREE.MathUtils.lerp(this.worldTurnAngle, 0, dt * 2.5);

    const groundY = this.getGroundHeightAt(this.currentLane, this.playerZ);

    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;
    if (this.slideBufferTimer > 0) this.slideBufferTimer -= dt;

    if (this.isJumping || this.playerY > groundY + 0.02) {
      this.playerY += this.velocityY * dt;
      this.velocityY -= GRAVITY * dt;

      if (this.playerY <= groundY) {
        this.playerY = groundY;
        this.velocityY = 0;
        this.isJumping = false;

        if (this.jumpBufferTimer > 0) {
          this.jumpBufferTimer = 0;
          this.executeJump();
        } else if (this.slideBufferTimer > 0) {
          this.slideBufferTimer = 0;
          this.executeSlide();
        } else {
          soundEngine.playFootstep(
            this.currentBiome === 'bridge' ? 'wood' : 'stone'
          );
        }
      }
    } else {
      this.playerY = groundY;
    }

    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      }
    }

    // 4. Update Explorer Character Rig Pose & Animations
    this.explorer.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.explorer.root.rotation.z = this.currentTurnBank;
    this.explorer.root.rotation.y = (this.playerX - targetX) * 0.18;

    this.runCycle += dt * (this.speed * 0.88);
    this.footstepTimer += dt * (this.speed * 0.19);
    if (!this.isJumping && !this.isSliding && this.footstepTimer >= 1) {
      this.footstepTimer = 0;
      soundEngine.playFootstep(
        this.currentBiome === 'bridge'
          ? 'wood'
          : this.currentBiome === 'cavern'
          ? 'cave'
          : 'stone'
      );
    }

    if (this.isJumping) {
      // Airborne Jump Pose
      this.explorer.pelvis.position.y = 1.05;
      this.explorer.pelvis.rotation.x = -0.18;
      this.explorer.leftLeg.rotation.x = 0.65;
      this.explorer.rightLeg.rotation.x = -0.35;
      this.explorer.leftArm.rotation.x = -2.1;
      this.explorer.rightArm.rotation.x = -2.1;
      this.explorer.scarfTail.rotation.x = -0.55;
    } else if (this.isSliding) {
      // Low Aerodynamic Slide Pose
      this.explorer.pelvis.position.y = 0.46;
      this.explorer.pelvis.rotation.x = 0.95;
      this.explorer.leftLeg.rotation.x = -1.1;
      this.explorer.rightLeg.rotation.x = -0.85;
      this.explorer.leftArm.rotation.x = 0.7;
      this.explorer.rightArm.rotation.x = 0.7;
      this.explorer.scarfTail.rotation.x = 0.1;
    } else {
      // Dynamic Running Stride Pose
      const stride = Math.sin(this.runCycle);
      const bob = Math.abs(Math.cos(this.runCycle)) * 0.11;
      this.explorer.pelvis.position.y = 0.92 + bob;
      this.explorer.pelvis.rotation.x = -0.14;
      this.explorer.leftLeg.rotation.x = stride * 0.85;
      this.explorer.rightLeg.rotation.x = -stride * 0.85;
      this.explorer.leftArm.rotation.x = -stride * 0.78;
      this.explorer.rightArm.rotation.x = stride * 0.78;
      this.explorer.scarfTail.rotation.x =
        0.35 + Math.sin(this.runCycle * 1.5) * 0.22;
    }

    // 5. Update Lighting & Horizon Anchors to Follow Player Z
    this.dirLight.position.set(18, 32, this.playerZ + 16);
    this.dirLight.target.position.set(0, 0, this.playerZ - 12);
    this.playerLight.position.set(this.playerX, this.playerY + 2.6, this.playerZ + 1.2);
    this.horizonGroup.position.set(0, 0, this.playerZ);

    // 6. Camera Choreography (Smooth chase + FOV speed cue + screen shake)
    const targetFov = isBoostActive
      ? 74
      : 62 + Math.min(8, (this.speed - BASE_SPEED) * 0.4);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 5);
    this.camera.updateProjectionMatrix();

    let shakeX = 0;
    let shakeY = 0;
    if (this.cameraShakeIntensity > 0.001 && this.settings.cameraShake) {
      shakeX = (Math.random() - 0.5) * this.cameraShakeIntensity;
      shakeY = (Math.random() - 0.5) * this.cameraShakeIntensity;
      this.cameraShakeIntensity = THREE.MathUtils.lerp(
        this.cameraShakeIntensity,
        0,
        dt * 7
      );
    }

    const camTargetX = this.playerX * 0.58 + this.worldTurnAngle * 3.2;
    const camTargetY = 4.25 + this.playerY * 0.45;
    const camTargetZ = this.playerZ + 6.7;

    this.camera.position.x =
      THREE.MathUtils.lerp(this.camera.position.x, camTargetX, dt * 8) + shakeX;
    this.camera.position.y =
      THREE.MathUtils.lerp(this.camera.position.y, camTargetY, dt * 7) + shakeY;
    this.camera.position.z = camTargetZ;

    this.camera.lookAt(
      this.playerX * 0.35,
      1.35 + this.playerY * 0.3,
      this.playerZ - 9.5
    );

    // 7. Recycle Track Chunks & Spawn Ahead
    for (const chunk of this.chunks) {
      if (chunk.zStart - CHUNK_LENGTH > this.playerZ + 16) {
        chunk.zStart = this.farthestChunkZ;
        chunk.index = this.nextChunkIndex++;
        chunk.biome = this.currentBiome;
        chunk.group.position.set(0, 0, chunk.zStart);
        (chunk.deckMesh.material as THREE.MeshStandardMaterial).color.setHex(
          BIOME_CONFIGS[this.currentBiome].groundColor
        );
        decorateTrackChunk(chunk.group, this.currentBiome, chunk.index);
        this.populateChunkEntities(chunk.zStart, chunk.index);
        this.farthestChunkZ = chunk.zStart - CHUNK_LENGTH;
      }
    }

    // 8. Update & Check Obstacles
    this.updateObstacles(dt, timeSec, isBoostActive, isShieldActive);

    // 9. Update & Check Collectibles & Power-Ups
    this.updateCollectiblesAndPowerUps(dt, timeSec, isMagnetActive);

    // 10. Cleanup Passed Ramps & Turn Arches
    this.ramps = this.ramps.filter((r) => {
      if (r.zCenter < this.playerZ + 14) return true;
      this.scene.remove(r.group);
      return false;
    });
    this.turnArches = this.turnArches.filter((t) => {
      if (t.z < this.playerZ + 14) return true;
      this.scene.remove(t.group);
      return false;
    });

    // 11. Emit HUD Metrics
    this.emitMetrics();
  }

  private updateObstacles(
    dt: number,
    timeSec: number,
    isBoostActive: boolean,
    isShieldActive: boolean
  ) {
    const playerBottom = this.playerY;
    const playerTop = this.playerY + (this.isSliding ? 0.72 : 1.78);

    this.obstacles = this.obstacles.filter((obs) => {
      // Remove behind camera
      if (obs.z > this.playerZ + 10 || obs.shattered) {
        this.scene.remove(obs.group);
        return false;
      }

      // Animate dynamic obstacle parts
      if (obs.type === 'swinging_pendulum' && obs.animatedPart) {
        const swingAngle = Math.sin(timeSec * 2.65 + obs.phase) * 0.72;
        obs.animatedPart.rotation.z = swingAngle;
      } else if (obs.type === 'collapsing_bridge' && obs.animatedPart) {
        const distToPlayer = this.playerZ - obs.z;
        if (distToPlayer < 17 && distToPlayer > -4) {
          // Bridge planks tremble and drop down into the gorge!
          obs.animatedPart.rotation.x = THREE.MathUtils.lerp(
            obs.animatedPart.rotation.x,
            -0.62,
            dt * 5.5
          );
        }
      } else if (obs.type === 'fire_trap' && obs.animatedPart) {
        const pulse = 0.88 + Math.sin(timeSec * 22 + obs.phase) * 0.16;
        obs.animatedPart.scale.set(pulse, 1, pulse);
      }

      // Check Collision when obstacle is within Z-overlap window
      const zDiff = Math.abs(obs.z - this.playerZ);
      const zThreshold =
        obs.type === 'path_gap' || obs.type === 'collapsing_bridge' ? 1.05 : 0.72;

      if (zDiff < zThreshold) {
        let hit = false;

        if (obs.type === 'swinging_pendulum' && obs.animatedPart) {
          // Calculate horizontal X coordinate of pendulum blade
          const swingAngle = obs.animatedPart.rotation.z;
          const bladeX = Math.sin(swingAngle) * 3.1;
          const bladeY = 4.2 - Math.cos(swingAngle) * 3.1;
          if (
            Math.abs(this.playerX - bladeX) < 0.95 &&
            playerTop > bladeY - 0.55
          ) {
            hit = true;
          }
        } else {
          const obsX = obs.lane * LANE_WIDTH;
          if (Math.abs(this.playerX - obsX) < 0.88) {
            switch (obs.type) {
              case 'fallen_tree':
                if (playerBottom < 0.96) hit = true;
                break;
              case 'large_rock':
                if (playerBottom < 1.08) hit = true;
                break;
              case 'broken_wall':
                if (playerBottom < 2.65) hit = true;
                break;
              case 'spiked_gate':
                // Bottom spikes end at y = 1.02m -> sliding (playerTop = 0.72m) clears it!
                if (playerTop > 1.0) hit = true;
                break;
              case 'fire_trap':
                // Flame jet is at y = 1.15m to 2.15m -> sliding clears underneath!
                if (playerTop > 1.05 && playerBottom < 2.1) hit = true;
                break;
              case 'collapsing_bridge':
              case 'path_gap':
                if (playerBottom < 0.32) hit = true;
                break;
            }
          }
        }

        if (hit) {
          if (isBoostActive) {
            // Speed Boost smashes right through obstacles!
            obs.shattered = true;
            this.score += 100 * this.getScoreMultiplier();
            this.cameraShakeIntensity = 0.25;
            soundEngine.playShieldBreak();
            this.spawnBurstParticles(
              new THREE.Vector3(this.playerX, this.playerY + 1, obs.z),
              0xfbbf24,
              18,
              1.3
            );
            this.onCallout({
              id: this.calloutIdCounter++,
              text: '+100 ZEPHYR SMASH!',
              color: 'emerald',
              timestamp: performance.now(),
            });
            this.scene.remove(obs.group);
            return false;
          } else if (isShieldActive) {
            // Shield absorbs the impact and shatters!
            this.activePowerUps.delete('shield');
            this.explorer.shieldBubble.visible = false;
            obs.shattered = true;
            this.cameraShakeIntensity = 0.42;
            soundEngine.playShieldBreak();
            this.spawnBurstParticles(
              new THREE.Vector3(this.playerX, this.playerY + 1, this.playerZ),
              0x22d3ee,
              24,
              1.5
            );
            this.onCallout({
              id: this.calloutIdCounter++,
              text: 'AEGIS SHIELD SAVED YOU!',
              subtext: 'Obstacle Destroyed',
              color: 'cyan',
              timestamp: performance.now(),
            });
            // If it was a gap, give player a safety hop
            if (
              obs.type === 'path_gap' ||
              obs.type === 'collapsing_bridge'
            ) {
              this.velocityY = JUMP_VELOCITY * 0.85;
              this.isJumping = true;
            }
            this.scene.remove(obs.group);
            return false;
          } else {
            // Fatal Collision -> Trigger Game Over
            this.triggerGameOver(obs.type);
          }
        }
      }

      return true;
    });
  }

  private updateCollectiblesAndPowerUps(
    dt: number,
    timeSec: number,
    isMagnetActive: boolean
  ) {
    // 1. Collectibles (Coins & Rare Relics)
    this.collectibles = this.collectibles.filter((item) => {
      if (item.z > this.playerZ + 8 || item.collected) {
        this.scene.remove(item.group);
        return false;
      }

      item.group.rotation.y += dt * 3.2;

      const distZ = Math.abs(item.z - this.playerZ);
      if (isMagnetActive && distZ < 15.5) {
        item.magnetized = true;
      }

      if (item.magnetized) {
        item.group.position.x = THREE.MathUtils.lerp(
          item.group.position.x,
          this.playerX,
          dt * 14
        );
        item.group.position.y = THREE.MathUtils.lerp(
          item.group.position.y,
          this.playerY + 0.95,
          dt * 14
        );
        item.group.position.z = THREE.MathUtils.lerp(
          item.group.position.z,
          this.playerZ,
          dt * 14
        );
        item.z = item.group.position.z;
      } else {
        item.group.position.y =
          item.baseY + Math.sin(timeSec * 4.5 + item.id) * 0.1;
      }

      const dx = Math.abs(item.group.position.x - this.playerX);
      const dy = Math.abs(item.group.position.y - (this.playerY + 0.9));
      const dz = Math.abs(item.z - this.playerZ);

      if (dx < 1.05 && dy < 1.25 && dz < 1.1) {
        item.collected = true;
        const now = performance.now();
        if (now - this.lastCoinTime < 1400) {
          this.combo++;
        } else {
          this.combo = 1;
        }
        this.lastCoinTime = now;

        const mult = this.getScoreMultiplier();
        if (item.type === 'rare_relic') {
          this.coins += 5;
          this.rareRelics += 1;
          const pts = 50 * mult;
          this.score += pts;
          soundEngine.playRareRelic();
          this.spawnBurstParticles(item.group.position, 0x38bdf8, 16, 1.1);
          this.onCallout({
            id: this.calloutIdCounter++,
            text: `+${pts} STAR RELIC`,
            subtext: '+5 Sunstone Coins',
            color: 'cyan',
            timestamp: now,
          });
        } else {
          this.coins += 1;
          this.score += 10 * mult;
          soundEngine.playCoin(this.combo);
          this.spawnBurstParticles(item.group.position, 0xfbbf24, 9, 0.8);
        }

        this.scene.remove(item.group);
        return false;
      }

      return true;
    });

    // 2. Power-Ups
    this.powerUpItems = this.powerUpItems.filter((p) => {
      if (p.z > this.playerZ + 8 || p.collected) {
        this.scene.remove(p.group);
        return false;
      }

      p.group.rotation.y += dt * 2.5;
      p.group.position.y = p.y + Math.sin(timeSec * 4 + p.id) * 0.15;

      const dx = Math.abs(p.group.position.x - this.playerX);
      const dz = Math.abs(p.z - this.playerZ);

      if (dx < 1.1 && dz < 1.15) {
        p.collected = true;
        this.activatePowerUp(p.type);
        this.spawnBurstParticles(p.group.position, 0xe879f9, 20, 1.3);
        this.scene.remove(p.group);
        return false;
      }

      return true;
    });
  }

  private activatePowerUp(type: PowerUpType) {
    soundEngine.playPowerUp(type);

    const durations: Record<PowerUpType, number> = {
      shield: 18,
      magnet: 12,
      speed_boost: 6.5,
      multiplier: 14,
    };

    const labels: Record<
      PowerUpType,
      { title: string; sub: string; color: FloatingCallout['color'] }
    > = {
      shield: {
        title: 'AEGIS SHIELD ACTIVE',
        sub: 'Blocks Next Obstacle Impact',
        color: 'cyan',
      },
      magnet: {
        title: 'LODESTONE MAGNET',
        sub: 'Drawing All Nearby Relics',
        color: 'violet',
      },
      speed_boost: {
        title: 'ZEPHYR HYPER-STRIDE',
        sub: 'Invulnerable High-Speed Rush',
        color: 'emerald',
      },
      multiplier: {
        title: '2X SOLAR MULTIPLIER',
        sub: 'Double Points Active',
        color: 'amber',
      },
    };

    const dur = durations[type];
    this.activePowerUps.set(type, {
      type,
      remaining: dur,
      duration: dur,
    });

    const info = labels[type];
    this.onCallout({
      id: this.calloutIdCounter++,
      text: info.title,
      subtext: info.sub,
      color: info.color,
      timestamp: performance.now(),
    });
  }

  private triggerGameOver(obstacleType: ObstacleType) {
    this.isGameOver = true;
    this.deathTimer = 0;
    this.cameraShakeIntensity = 0.65;

    this.deathAnimationType =
      obstacleType === 'path_gap' || obstacleType === 'collapsing_bridge'
        ? 'fall'
        : 'stumble';

    soundEngine.stopMusic();
    soundEngine.playCollision();
    soundEngine.playGameOver();

    this.spawnBurstParticles(
      new THREE.Vector3(this.playerX, this.playerY + 1.0, this.playerZ),
      0xef4444,
      24,
      1.4
    );

    const obsName = OBSTACLE_INFO[obstacleType].name;
    const biomeName = BIOME_CONFIGS[this.currentBiome].name;
    const finalMetrics: GameMetrics = {
      score: Math.floor(this.score),
      distance: Math.floor(this.distance),
      coins: this.coins,
      rareRelics: this.rareRelics,
      speed: Number(this.speed.toFixed(1)),
      multiplier: this.getScoreMultiplier(),
      combo: this.combo,
      biome: this.currentBiome,
      activePowerUps: [],
      deathReason: `Stopped by ${obsName} in ${biomeName}`,
    };

    this.onMetricsUpdate(finalMetrics);
    this.onGameOverCallback(finalMetrics);
  }

  private updateDeathAnimation(dt: number) {
    this.deathTimer += dt;

    if (this.deathAnimationType === 'fall') {
      // Plunge into the canyon chasm
      this.explorer.root.position.y -= dt * 11.5;
      this.explorer.root.rotation.x += dt * 3.5;
      this.explorer.leftArm.rotation.x = -2.6;
      this.explorer.rightArm.rotation.x = -2.6;
    } else {
      // Knockback stumble and fall flat
      const progress = Math.min(1, this.deathTimer * 3.2);
      this.explorer.root.position.z += dt * Math.max(0, 4.5 - this.deathTimer * 8);
      this.explorer.pelvis.position.y = THREE.MathUtils.lerp(0.92, 0.3, progress);
      this.explorer.pelvis.rotation.x = THREE.MathUtils.lerp(0, -1.45, progress);
      this.explorer.leftArm.rotation.z = -0.6 * progress;
      this.explorer.rightArm.rotation.z = 0.6 * progress;
    }

    if (this.cameraShakeIntensity > 0.001 && this.settings.cameraShake) {
      this.camera.position.x +=
        (Math.random() - 0.5) * this.cameraShakeIntensity;
      this.camera.position.y +=
        (Math.random() - 0.5) * this.cameraShakeIntensity;
      this.cameraShakeIntensity = THREE.MathUtils.lerp(
        this.cameraShakeIntensity,
        0,
        dt * 6
      );
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= 9.8 * dt;
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.y += dt * 6;
      const alpha = 1 - p.life / p.maxLife;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
    }
  }

  private emitMetrics() {
    this.onMetricsUpdate({
      score: Math.floor(this.score),
      distance: Math.floor(this.distance),
      coins: this.coins,
      rareRelics: this.rareRelics,
      speed: Number(this.speed.toFixed(1)),
      multiplier: this.getScoreMultiplier(),
      combo: this.combo,
      biome: this.currentBiome,
      activePowerUps: Array.from(this.activePowerUps.values()),
    });
  }

  public dispose() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    soundEngine.stopMusic();
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    const dom = this.renderer.domElement;
    dom.removeEventListener('touchstart', this.handleTouchStart);
    dom.removeEventListener('touchend', this.handleTouchEnd);
    this.renderer.dispose();
  }
}
