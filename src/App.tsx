/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Compass,
  Flame,
  Magnet,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  BookOpen,
  Check,
  Lock,
} from 'lucide-react';
import {
  BIOME_CONFIGS,
  EXPLORER_OUTFITS,
  FloatingCallout,
  GameMetrics,
  GameSettings,
  GameState,
  OBSTACLE_INFO,
  ObstacleType,
  PersistentData,
  PowerUpType,
} from './types/game';
import { GameEngine } from './game/GameEngine';
import { soundEngine } from './audio/SoundEngine';

const STORAGE_KEY = 'sunstone_stride_save_v1';

const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.5,
  sfxVolume: 0.8,
  musicMuted: false,
  sfxMuted: false,
  graphicsQuality: 'high',
  cameraShake: true,
};

const DEFAULT_SAVE: PersistentData = {
  highScore: 0,
  bestDistance: 0,
  totalCoins: 100,
  totalRuns: 0,
  tutorialCompleted: false,
  selectedOutfit: 'sunstone_cartographer',
  unlockedOutfits: ['sunstone_cartographer'],
  settings: DEFAULT_SETTINGS,
};

function loadSaveData(): PersistentData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SAVE;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SAVE,
      ...parsed,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings || {}),
      },
    };
  } catch {
    return DEFAULT_SAVE;
  }
}

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [saveData, setSaveData] = useState<PersistentData>(() => loadSaveData());
  const [gameState, setGameState] = useState<GameState>('menu');
  const [menuTab, setMenuTab] = useState<'expedition' | 'outfits'>('expedition');
  const [showSettings, setShowSettings] = useState(false);
  const [tutorialTab, setTutorialTab] = useState<'controls' | 'obstacles' | 'powerups'>('controls');
  const [confirmReset, setConfirmReset] = useState(false);

  const [metrics, setMetrics] = useState<GameMetrics>({
    score: 0,
    distance: 0,
    coins: 0,
    rareRelics: 0,
    speed: 16.5,
    multiplier: 1,
    combo: 0,
    biome: 'canopy',
    activePowerUps: [],
  });

  const [callouts, setCallouts] = useState<FloatingCallout[]>([]);

  // Persist saveData changes to localStorage & sync audio engine
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    } catch {
      // Ignore storage quota errors
    }
    const { musicVolume, sfxVolume, musicMuted, sfxMuted } = saveData.settings;
    soundEngine.setSettings(musicVolume, sfxVolume, musicMuted, sfxMuted);
    if (engineRef.current) {
      engineRef.current.updateSettings(saveData.settings);
    }
  }, [saveData]);

  const handleMetricsUpdate = useCallback((newMetrics: GameMetrics) => {
    setMetrics(newMetrics);
  }, []);

  const handleCallout = useCallback((callout: FloatingCallout) => {
    setCallouts((prev) => [...prev.slice(-3), callout]);
  }, []);

  const handleGameOver = useCallback((finalMetrics: GameMetrics) => {
    setSaveData((prev) => {
      const isNewBest = finalMetrics.score > prev.highScore;
      const bestDist = Math.max(prev.bestDistance, finalMetrics.distance);
      return {
        ...prev,
        highScore: Math.max(prev.highScore, finalMetrics.score),
        bestDistance: bestDist,
        totalCoins: prev.totalCoins + finalMetrics.coins,
        totalRuns: prev.totalRuns + 1,
      };
    });
    setMetrics((prev) => ({
      ...finalMetrics,
      isNewHighScore: finalMetrics.score > saveData.highScore,
    }));
    setGameState('gameover');
  }, [saveData.highScore]);

  // Initialize Three.js GameEngine once
  useEffect(() => {
    if (!canvasContainerRef.current) return;
    const engine = new GameEngine(
      canvasContainerRef.current,
      saveData.settings,
      saveData.selectedOutfit,
      handleMetricsUpdate,
      handleCallout,
      handleGameOver
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expire floating HUD callouts after 2.1 seconds
  useEffect(() => {
    if (callouts.length === 0) return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      setCallouts((prev) => prev.filter((c) => now - c.timestamp < 2100));
    }, 250);
    return () => clearInterval(timer);
  }, [callouts.length]);

  // Global keyboard shortcuts for Pause (P / Escape) and Quick Restart on Game Over (Space / Enter)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (showSettings) {
          setShowSettings(false);
          return;
        }
        if (gameState === 'playing') {
          engineRef.current?.setPaused(true);
          setGameState('paused');
        } else if (gameState === 'paused') {
          engineRef.current?.setPaused(false);
          setGameState('playing');
        } else if (gameState === 'tutorial') {
          setGameState('menu');
        }
      } else if (
        (e.code === 'Space' || e.code === 'Enter') &&
        gameState === 'gameover' &&
        !showSettings
      ) {
        e.preventDefault();
        startExpedition(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const startExpedition = (skipTutorialCheck = false) => {
    soundEngine.unlock();
    soundEngine.playButtonClick();

    if (!saveData.tutorialCompleted && !skipTutorialCheck) {
      setGameState('tutorial');
      return;
    }

    setCallouts([]);
    setGameState('playing');
    engineRef.current?.startNewRun();
  };

  const completeTutorialAndStart = () => {
    soundEngine.unlock();
    soundEngine.playButtonClick();
    setSaveData((prev) => ({ ...prev, tutorialCompleted: true }));
    setCallouts([]);
    setGameState('playing');
    engineRef.current?.startNewRun();
  };

  const togglePause = () => {
    soundEngine.playButtonClick();
    if (gameState === 'playing') {
      engineRef.current?.setPaused(true);
      setGameState('paused');
    } else if (gameState === 'paused') {
      engineRef.current?.setPaused(false);
      setGameState('playing');
    }
  };

  const returnToMainMenu = () => {
    soundEngine.playButtonClick();
    engineRef.current?.stopToMenu();
    setGameState('menu');
  };

  const handleSelectOrUnlockOutfit = (outfitId: string, cost: number) => {
    soundEngine.playButtonClick();
    if (saveData.unlockedOutfits.includes(outfitId)) {
      setSaveData((prev) => ({ ...prev, selectedOutfit: outfitId }));
      engineRef.current?.setOutfit(outfitId);
    } else if (saveData.totalCoins >= cost) {
      soundEngine.playRareRelic();
      setSaveData((prev) => ({
        ...prev,
        totalCoins: prev.totalCoins - cost,
        unlockedOutfits: [...prev.unlockedOutfits, outfitId],
        selectedOutfit: outfitId,
      }));
      engineRef.current?.setOutfit(outfitId);
    }
  };

  const updateSetting = <K extends keyof GameSettings>(
    key: K,
    value: GameSettings[K]
  ) => {
    setSaveData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [key]: value,
      },
    }));
  };

  const powerUpMeta: Record<
    PowerUpType,
    { label: string; icon: React.ReactNode; barColor: string }
  > = {
    shield: {
      label: 'Aegis Shield',
      icon: <Shield className="w-4 h-4 text-cyan-300" />,
      barColor: 'bg-cyan-400',
    },
    magnet: {
      label: 'Lodestone Magnet',
      icon: <Magnet className="w-4 h-4 text-fuchsia-300" />,
      barColor: 'bg-fuchsia-400',
    },
    speed_boost: {
      label: 'Zephyr Rush',
      icon: <Zap className="w-4 h-4 text-emerald-300" />,
      barColor: 'bg-emerald-400',
    },
    multiplier: {
      label: '2X Solar Crest',
      icon: <Sparkles className="w-4 h-4 text-amber-300" />,
      barColor: 'bg-amber-400',
    },
  };

  const activeOutfit =
    EXPLORER_OUTFITS.find((o) => o.id === saveData.selectedOutfit) ||
    EXPLORER_OUTFITS[0];

  return (
    <div className="relative w-full h-full overflow-hidden bg-stone-950 select-none">
      {/* 3D WebGL Viewport Container */}
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 w-full h-full"
        aria-label="3D Endless Runner Game Viewport"
      />

      {/* Subtle Vignette Scrim for HUD legibility */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/65" />

      {/* ==================== 1. MAIN MENU SCREEN ==================== */}
      {gameState === 'menu' && (
        <div className="relative z-10 flex flex-col justify-between w-full h-full pointer-events-auto">
          {/* Strict 3-Zone Top Bar Contract */}
          <header className="flex items-center justify-between px-6 py-4 bg-black/45 backdrop-blur-md border-b border-white/10">
            {/* Zone 1: Single Text Wordmark */}
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                setMenuTab('expedition');
              }}
              className="font-display text-lg font-bold tracking-wider text-amber-300 whitespace-nowrap"
            >
              Sunstone Stride
            </a>

            {/* Zone 2: Clean Text Navigation Links */}
            <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-300">
              <button
                onClick={() => {
                  soundEngine.playButtonClick();
                  setMenuTab('expedition');
                }}
                className={`transition-colors whitespace-nowrap ${
                  menuTab === 'expedition'
                    ? 'text-white underline underline-offset-8 decoration-amber-400 decoration-2'
                    : 'hover:text-white'
                }`}
              >
                Expedition
              </button>
              <button
                onClick={() => {
                  soundEngine.playButtonClick();
                  setMenuTab('outfits');
                }}
                className={`transition-colors whitespace-nowrap ${
                  menuTab === 'outfits'
                    ? 'text-white underline underline-offset-8 decoration-amber-400 decoration-2'
                    : 'hover:text-white'
                }`}
              >
                Explorers
              </button>
              <button
                onClick={() => {
                  soundEngine.playButtonClick();
                  setGameState('tutorial');
                }}
                className="hover:text-white transition-colors whitespace-nowrap"
              >
                Field Guide
              </button>
              <button
                onClick={() => {
                  soundEngine.playButtonClick();
                  setShowSettings(true);
                }}
                className="hover:text-white transition-colors whitespace-nowrap"
              >
                Settings
              </button>
            </nav>

            {/* Zone 3: 1-2 Primary Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  soundEngine.unlock();
                  updateSetting('musicMuted', !saveData.settings.musicMuted);
                }}
                className="p-2 text-stone-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
                title={
                  saveData.settings.musicMuted ? 'Unmute Audio' : 'Mute Audio'
                }
                aria-label="Toggle Music Mute"
              >
                {saveData.settings.musicMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-amber-300" />
                )}
              </button>
              <button
                onClick={() => startExpedition(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shadow-sm"
              >
                Start Run
              </button>
            </div>
          </header>

          {/* Main Menu Content Area */}
          <main className="flex-1 flex items-end md:items-center justify-between px-6 md:px-12 pb-8 max-w-7xl w-full mx-auto">
            {menuTab === 'expedition' ? (
              <div className="max-w-xl bg-black/55 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl">
                <p className="text-xs font-medium text-amber-300/90 tracking-wide mb-2">
                  Ancient Canopy Viaducts · Active Explorer: {activeOutfit.name}
                </p>
                <h1 className="font-display text-3xl md:text-5xl font-bold text-white tracking-tight text-balance leading-tight mb-3">
                  Outrun the Crumbling Sunstone Sanctum
                </h1>
                <p className="text-sm md:text-base text-stone-300 leading-relaxed mb-6">
                  Sprint across overgrown jungle causeways, leap collapsing
                  suspension bridges, slide beneath spiked bronze gates, and
                  harness ancient relics across four shifting biomes.
                </p>

                {/* Unboxed Tabular Stats Row (Zero-Pill Discipline) */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 mb-6 border-y border-white/10 text-xs md:text-sm text-stone-300 font-mono tabular-nums">
                  <span>
                    High Score:{' '}
                    <strong className="text-amber-300 font-semibold">
                      {saveData.highScore.toLocaleString()}
                    </strong>
                  </span>
                  <span aria-hidden="true" className="text-stone-600">
                    ·
                  </span>
                  <span>
                    Best Distance:{' '}
                    <strong className="text-emerald-300 font-semibold">
                      {saveData.bestDistance.toLocaleString()}m
                    </strong>
                  </span>
                  <span aria-hidden="true" className="text-stone-600">
                    ·
                  </span>
                  <span>
                    Sunstone Vault:{' '}
                    <strong className="text-amber-200 font-semibold">
                      {saveData.totalCoins.toLocaleString()} Coins
                    </strong>
                  </span>
                </div>

                {/* Primary & Secondary Action Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => startExpedition(false)}
                    className="flex items-center justify-center gap-2.5 px-6 py-3.5 text-sm font-semibold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-transform active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Launch Expedition</span>
                  </button>

                  <button
                    onClick={() => {
                      soundEngine.playButtonClick();
                      setMenuTab('outfits');
                    }}
                    className="px-4 py-3.5 text-sm font-medium text-stone-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Explorers ({saveData.unlockedOutfits.length}/
                    {EXPLORER_OUTFITS.length})
                  </button>

                  <button
                    onClick={() => {
                      soundEngine.playButtonClick();
                      setGameState('tutorial');
                    }}
                    className="px-4 py-3.5 text-sm font-medium text-stone-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Field Guide
                  </button>

                  <button
                    onClick={() => {
                      soundEngine.playButtonClick();
                      setShowSettings(true);
                    }}
                    className="p-3.5 text-stone-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors md:hidden"
                    aria-label="Open Settings"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Explorer Roster / Outfit Customization Panel */
              <div className="max-w-xl w-full bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white">
                      Expedition Guild Roster
                    </h2>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Unlock and equip original explorers using collected
                      Sunstone Coins
                    </p>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <span className="text-xs text-stone-400 block">
                      Available Vault
                    </span>
                    <span className="text-base font-bold text-amber-300">
                      {saveData.totalCoins.toLocaleString()} Coins
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {EXPLORER_OUTFITS.map((outfit) => {
                    const isUnlocked = saveData.unlockedOutfits.includes(
                      outfit.id
                    );
                    const isSelected = saveData.selectedOutfit === outfit.id;
                    const canAfford = saveData.totalCoins >= outfit.cost;

                    return (
                      <button
                        key={outfit.id}
                        onClick={() =>
                          handleSelectOrUnlockOutfit(outfit.id, outfit.cost)
                        }
                        disabled={!isUnlocked && !canAfford}
                        className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-400/60'
                            : isUnlocked
                            ? 'bg-white/5 border-white/10 hover:bg-white/10'
                            : canAfford
                            ? 'bg-white/5 border-amber-500/30 hover:bg-amber-500/10'
                            : 'bg-black/40 border-white/5 opacity-55 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm text-white">
                            {outfit.name}
                          </span>
                          {isSelected ? (
                            <Check className="w-4 h-4 text-amber-400" />
                          ) : !isUnlocked ? (
                            <Lock className="w-3.5 h-3.5 text-stone-400" />
                          ) : null}
                        </div>
                        <p className="text-xs text-stone-400 mb-3">
                          {outfit.title}
                        </p>
                        <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-3 h-3 rounded-full inline-block border border-white/20"
                              style={{
                                backgroundColor: `#${outfit.tunicColor
                                  .toString(16)
                                  .padStart(6, '0')}`,
                              }}
                            />
                            <span
                              className="w-3 h-3 rounded-full inline-block border border-white/20"
                              style={{
                                backgroundColor: `#${outfit.scarfColor
                                  .toString(16)
                                  .padStart(6, '0')}`,
                              }}
                            />
                          </div>
                          <span
                            className={
                              isSelected
                                ? 'text-amber-300 font-semibold'
                                : isUnlocked
                                ? 'text-emerald-300'
                                : canAfford
                                ? 'text-amber-200'
                                : 'text-stone-500'
                            }
                          >
                            {isSelected
                              ? 'Equipped'
                              : isUnlocked
                              ? 'Select'
                              : `${outfit.cost} Coins`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <button
                    onClick={() => setMenuTab('expedition')}
                    className="px-4 py-2.5 text-xs font-medium text-stone-300 hover:text-white transition-colors whitespace-nowrap"
                  >
                    Back to Overview
                  </button>
                  <button
                    onClick={() => startExpedition(false)}
                    className="px-5 py-2.5 text-xs font-semibold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Run as {activeOutfit.name}
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* Clean Quiet Footer */}
          <footer className="px-6 py-3 flex items-center justify-between text-xs text-stone-400 bg-black/40 border-t border-white/5">
            <span>
              Controls: A/D or Left/Right to Switch Lanes · W/Space to Jump · S
              to Slide
            </span>
            <span className="hidden sm:inline">
              4 Dynamic Biomes · 8 Original Temple Traps
            </span>
          </footer>
        </div>
      )}

      {/* ==================== 2. GAMEPLAY HUD ==================== */}
      {gameState === 'playing' && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 md:p-6">
          {/* Top HUD Bar */}
          <div className="flex items-start justify-between gap-4">
            {/* Left Cluster: Score, Distance, Coins */}
            <div className="pointer-events-auto flex items-center gap-4 md:gap-6 px-4 py-2.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl font-mono tabular-nums">
              <div>
                <div className="text-[11px] text-stone-400 font-sans">
                  Score{' '}
                  {metrics.multiplier > 1 && (
                    <span className="text-amber-300 font-semibold">
                      · {metrics.multiplier}x
                    </span>
                  )}
                </div>
                <div className="text-lg md:text-2xl font-bold text-white">
                  {metrics.score.toLocaleString()}
                </div>
              </div>

              <div className="h-7 w-px bg-white/10" />

              <div>
                <div className="text-[11px] text-stone-400 font-sans">
                  Distance
                </div>
                <div className="text-base md:text-xl font-semibold text-emerald-300">
                  {metrics.distance.toLocaleString()}m
                </div>
              </div>

              <div className="h-7 w-px bg-white/10" />

              <div>
                <div className="text-[11px] text-stone-400 font-sans">
                  Sunstones
                </div>
                <div className="text-base md:text-xl font-semibold text-amber-300">
                  {metrics.coins.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Center Biome & Callout Notifications */}
            <div className="hidden lg:flex flex-col items-center">
              <div className="px-3.5 py-1 bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg text-xs text-stone-300">
                <span>{BIOME_CONFIGS[metrics.biome].name}</span>
                <span className="mx-2 text-stone-500">·</span>
                <span className="font-mono tabular-nums text-amber-300">
                  {metrics.speed.toFixed(1)} m/s
                </span>
              </div>
            </div>

            {/* Right Cluster: Active Power-Ups & Pause Button */}
            <div className="pointer-events-auto flex items-center gap-2.5">
              {metrics.activePowerUps.map((p) => {
                const meta = powerUpMeta[p.type];
                const pct = Math.max(
                  0,
                  Math.min(100, (p.remaining / p.duration) * 100)
                );
                return (
                  <div
                    key={p.type}
                    className="flex items-center gap-2.5 px-3 py-2 bg-black/55 backdrop-blur-md border border-white/15 rounded-xl min-w-[130px]"
                  >
                    {meta.icon}
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[11px] font-medium text-white mb-1">
                        <span className="truncate">{meta.label}</span>
                        <span className="font-mono tabular-nums text-stone-300 ml-1">
                          {p.remaining.toFixed(1)}s
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${meta.barColor} transition-all duration-100`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={togglePause}
                className="p-3 text-white bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/15 rounded-xl transition-colors cursor-pointer"
                aria-label="Pause Game"
                title="Pause (P)"
              >
                <Pause className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Center-Top Floating Event Callouts */}
          <div className="flex flex-col items-center gap-2 my-auto pointer-events-none">
            {callouts.map((c) => (
              <div
                key={c.id}
                className="px-4 py-2 bg-black/65 backdrop-blur-md border border-white/15 rounded-xl text-center animate-bounce"
              >
                <div
                  className={`font-display text-sm md:text-base font-bold tracking-wider ${
                    c.color === 'amber'
                      ? 'text-amber-300'
                      : c.color === 'cyan'
                      ? 'text-cyan-300'
                      : c.color === 'emerald'
                      ? 'text-emerald-300'
                      : 'text-fuchsia-300'
                  }`}
                >
                  {c.text}
                </div>
                {c.subtext && (
                  <div className="text-[11px] text-stone-300">{c.subtext}</div>
                )}
              </div>
            ))}
          </div>

          {/* Bottom Controls Bar: Touch D-Pad for Mobile/Pointer + Subtle Desktop Hint */}
          <div className="flex items-end justify-between w-full">
            <div className="hidden md:block px-3.5 py-2 bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg text-xs text-stone-300">
              <span>[A / D or ◄ / ►] Switch Lane</span>
              <span className="mx-2 text-stone-500">·</span>
              <span>[W / Space or ▲] Jump</span>
              <span className="mx-2 text-stone-500">·</span>
              <span>[S or ▼] Slide</span>
              <span className="mx-2 text-stone-500">·</span>
              <span>[P] Pause</span>
            </div>

            {/* Accessible On-Screen Action Buttons (Works on both Mobile & Desktop Click) */}
            <div className="pointer-events-auto flex items-center gap-2 ml-auto">
              <button
                onClick={() => engineRef.current?.moveLeft()}
                className="w-12 h-12 flex items-center justify-center bg-black/50 hover:bg-black/70 active:scale-95 backdrop-blur-md border border-white/15 rounded-xl text-white transition-transform cursor-pointer"
                aria-label="Move Left Lane"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => engineRef.current?.jump()}
                  className="w-12 h-12 flex items-center justify-center bg-amber-400/20 hover:bg-amber-400/35 active:scale-95 backdrop-blur-md border border-amber-400/40 rounded-xl text-amber-200 transition-transform cursor-pointer"
                  aria-label="Jump"
                >
                  <ChevronUp className="w-6 h-6" />
                </button>
                <button
                  onClick={() => engineRef.current?.slide()}
                  className="w-12 h-12 flex items-center justify-center bg-cyan-400/20 hover:bg-cyan-400/35 active:scale-95 backdrop-blur-md border border-cyan-400/40 rounded-xl text-cyan-200 transition-transform cursor-pointer"
                  aria-label="Slide"
                >
                  <ChevronDown className="w-6 h-6" />
                </button>
              </div>
              <button
                onClick={() => engineRef.current?.moveRight()}
                className="w-12 h-12 flex items-center justify-center bg-black/50 hover:bg-black/70 active:scale-95 backdrop-blur-md border border-white/15 rounded-xl text-white transition-transform cursor-pointer"
                aria-label="Move Right Lane"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 3. TUTORIAL / FIELD GUIDE MODAL ==================== */}
      {gameState === 'tutorial' && (
        <div className="relative z-20 flex items-center justify-center w-full h-full p-4 bg-black/70 backdrop-blur-md pointer-events-auto">
          <div className="max-w-2xl w-full bg-stone-900/95 border border-white/15 rounded-2xl p-6 md:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h2 className="font-display text-xl md:text-2xl font-bold text-white">
                  Explorer&apos;s Field Guide
                </h2>
              </div>

              {/* Interactive Segmented Control */}
              <div className="flex items-center gap-1 p-1 bg-stone-950 rounded-lg border border-white/10">
                {(
                  [
                    { id: 'controls', label: 'Controls' },
                    { id: 'obstacles', label: '8 Traps' },
                    { id: 'powerups', label: 'Relics' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      soundEngine.playButtonClick();
                      setTutorialTab(t.id);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      tutorialTab === t.id
                        ? 'bg-amber-400 text-stone-950 font-semibold'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {tutorialTab === 'controls' && (
              <div className="space-y-4 mb-6">
                <p className="text-sm text-stone-300 leading-relaxed">
                  Your explorer runs forward automatically along a three-lane
                  ancient viaduct. React swiftly to obstacles, elevated stone
                  ramps, and glowing temple turn archways:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="font-semibold text-amber-300 mb-1">
                      Switch Lanes &amp; Bank Turns
                    </div>
                    <p className="text-xs text-stone-300">
                      Press <strong>A / D</strong>,{' '}
                      <strong>Left / Right Arrows</strong>, or{' '}
                      <strong>Swipe Left / Right</strong>. Banking into a
                      glowing green Temple Turn Archway awards a{' '}
                      <strong>+200 Turn Bonus</strong>!
                    </p>
                  </div>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="font-semibold text-emerald-300 mb-1">
                      Leap Obstacles &amp; Chasms
                    </div>
                    <p className="text-xs text-stone-300">
                      Press <strong>W / Space / Up Arrow</strong> or{' '}
                      <strong>Swipe Up</strong> to leap over fallen banyan
                      trunks, boulders, collapsing bridges, and waterfall gaps.
                    </p>
                  </div>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="font-semibold text-cyan-300 mb-1">
                      Slide &amp; Fast-Drop
                    </div>
                    <p className="text-xs text-stone-300">
                      Press <strong>S / Down Arrow</strong> or{' '}
                      <strong>Swipe Down</strong> to duck beneath spiked bronze
                      portcullises and high serpent flame jets. Pressing Down in
                      mid-air triggers a fast dive!
                    </p>
                  </div>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="font-semibold text-fuchsia-300 mb-1">
                      Elevated Stone Ramps
                    </div>
                    <p className="text-xs text-stone-300">
                      Run up sloped stone viaduct ramps to reach elevated coin
                      streams and avoid ground-level hazards.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {tutorialTab === 'obstacles' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1 mb-6">
                {(Object.keys(OBSTACLE_INFO) as ObstacleType[]).map((key) => {
                  const info = OBSTACLE_INFO[key];
                  return (
                    <div
                      key={key}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-white">
                          {info.name}
                        </span>
                        <span className="font-mono text-amber-300">
                          {info.action}
                        </span>
                      </div>
                      <p className="text-xs text-stone-400 leading-snug">
                        {info.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {tutorialTab === 'powerups' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center gap-2 font-semibold text-cyan-300 text-sm mb-1">
                    <Shield className="w-4 h-4" />
                    <span>Aegis Shield</span>
                  </div>
                  <p className="text-xs text-stone-300">
                    Encases your explorer in a crystalline barrier that absorbs
                    and shatters one fatal obstacle collision.
                  </p>
                </div>
                <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center gap-2 font-semibold text-fuchsia-300 text-sm mb-1">
                    <Magnet className="w-4 h-4" />
                    <span>Lodestone Magnet</span>
                  </div>
                  <p className="text-xs text-stone-300">
                    Automatically pulls all Sunstone Coins and Star-Relics
                    across all three lanes directly to you.
                  </p>
                </div>
                <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center gap-2 font-semibold text-emerald-300 text-sm mb-1">
                    <Zap className="w-4 h-4" />
                    <span>Zephyr Speed Boost</span>
                  </div>
                  <p className="text-xs text-stone-300">
                    Blasts forward at hyper-velocity with temporary
                    invulnerability, smashing through obstacles for +100 bonus
                    points.
                  </p>
                </div>
                <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center gap-2 font-semibold text-amber-300 text-sm mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span>2X Solar Multiplier &amp; Star-Relics</span>
                  </div>
                  <p className="text-xs text-stone-300">
                    Doubles all distance and relic points earned. Look out for
                    glowing cyan Azure Star-Relics worth +50 points and +5
                    coins!
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <button
                onClick={() => {
                  soundEngine.playButtonClick();
                  setSaveData((prev) => ({ ...prev, tutorialCompleted: true }));
                  setGameState('menu');
                }}
                className="px-4 py-2.5 text-xs font-medium text-stone-300 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                Return to Menu
              </button>
              <button
                onClick={completeTutorialAndStart}
                className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Expedition Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 4. PAUSE OVERLAY ==================== */}
      {gameState === 'paused' && (
        <div className="relative z-20 flex items-center justify-center w-full h-full p-4 bg-black/65 backdrop-blur-md pointer-events-auto">
          <div className="max-w-md w-full bg-stone-900/95 border border-white/15 rounded-2xl p-6 md:p-8 shadow-2xl text-center">
            <p className="text-xs text-amber-300 tracking-wide mb-1">
              {BIOME_CONFIGS[metrics.biome].name}
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-4">
              Expedition Paused
            </h2>

            <div className="flex items-center justify-center gap-4 py-3 mb-6 border-y border-white/10 text-xs font-mono tabular-nums text-stone-300">
              <span>
                Score: <strong className="text-white">{metrics.score}</strong>
              </span>
              <span>·</span>
              <span>
                Distance:{' '}
                <strong className="text-emerald-300">
                  {metrics.distance}m
                </strong>
              </span>
              <span>·</span>
              <span>
                Coins:{' '}
                <strong className="text-amber-300">{metrics.coins}</strong>
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={togglePause}
                className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume Run</span>
              </button>

              <button
                onClick={() => startExpedition(true)}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart Expedition</span>
              </button>

              <button
                onClick={() => {
                  soundEngine.playButtonClick();
                  setShowSettings(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-stone-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <Sliders className="w-4 h-4" />
                <span>Audio &amp; Graphics Settings</span>
              </button>

              <button
                onClick={returnToMainMenu}
                className="w-full py-2.5 text-xs font-medium text-stone-400 hover:text-white transition-colors cursor-pointer"
              >
                Abandon Run &amp; Return to Camp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 5. GAME OVER SCREEN ==================== */}
      {gameState === 'gameover' && (
        <div className="relative z-20 flex items-center justify-center w-full h-full p-4 bg-black/70 backdrop-blur-md pointer-events-auto">
          <div className="max-w-lg w-full bg-stone-900/95 border border-white/15 rounded-2xl p-6 md:p-8 shadow-2xl">
            {metrics.isNewHighScore && (
              <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold tracking-wide mb-2">
                <Trophy className="w-4 h-4" />
                <span>New All-Time Expedition Record!</span>
              </div>
            )}

            <h2 className="font-display text-3xl font-bold text-white mb-1">
              Run Concluded
            </h2>
            <p className="text-xs md:text-sm text-rose-300/90 mb-6">
              {metrics.deathReason || 'Stopped in the Ancient Canopy'}
            </p>

            {/* Primary Score Readout */}
            <div className="p-5 bg-black/45 border border-white/10 rounded-xl mb-6">
              <div className="flex items-baseline justify-between mb-4 pb-4 border-b border-white/10">
                <span className="text-xs text-stone-400">Final Score</span>
                <span className="font-mono tabular-nums text-3xl md:text-4xl font-bold text-amber-300">
                  {metrics.score.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center font-mono tabular-nums">
                <div>
                  <div className="text-[11px] text-stone-400 font-sans mb-0.5">
                    Distance
                  </div>
                  <div className="text-base md:text-lg font-semibold text-emerald-300">
                    {metrics.distance.toLocaleString()}m
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-stone-400 font-sans mb-0.5">
                    Sunstones
                  </div>
                  <div className="text-base md:text-lg font-semibold text-amber-200">
                    +{metrics.coins}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-stone-400 font-sans mb-0.5">
                    Star-Relics
                  </div>
                  <div className="text-base md:text-lg font-semibold text-cyan-300">
                    {metrics.rareRelics}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-stone-400 font-mono tabular-nums mb-6">
              <span>
                Personal Best: {saveData.highScore.toLocaleString()} pts
              </span>
              <span>·</span>
              <span>
                Total Vault: {saveData.totalCoins.toLocaleString()} Coins
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => startExpedition(true)}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3.5 px-6 text-sm font-semibold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-transform active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Run Again (Space)</span>
              </button>

              <button
                onClick={returnToMainMenu}
                className="w-full sm:w-auto px-5 py-3.5 text-sm font-medium text-stone-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 6. SETTINGS MODAL ==================== */}
      {showSettings && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md pointer-events-auto">
          <div className="max-w-md w-full bg-stone-900 border border-white/15 rounded-2xl p-6 md:p-7 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-amber-400" />
                <h2 className="font-display text-xl font-bold text-white">
                  Expedition Settings
                </h2>
              </div>
              <button
                onClick={() => {
                  soundEngine.playButtonClick();
                  setShowSettings(false);
                  setConfirmReset(false);
                }}
                className="text-xs font-medium text-stone-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="space-y-5">
              {/* Music Volume Control */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-medium text-stone-200">
                    Background Music Volume
                  </span>
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="text-amber-300">
                      {saveData.settings.musicMuted
                        ? 'Muted'
                        : `${Math.round(saveData.settings.musicVolume * 100)}%`}
                    </span>
                    <button
                      onClick={() =>
                        updateSetting(
                          'musicMuted',
                          !saveData.settings.musicMuted
                        )
                      }
                      className="text-stone-400 hover:text-white underline"
                    >
                      {saveData.settings.musicMuted ? 'Unmute' : 'Mute'}
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={saveData.settings.musicVolume}
                  onChange={(e) => {
                    updateSetting('musicVolume', parseFloat(e.target.value));
                    if (saveData.settings.musicMuted) {
                      updateSetting('musicMuted', false);
                    }
                  }}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              {/* Sound Effects Volume Control */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-medium text-stone-200">
                    Sound Effects (SFX) Volume
                  </span>
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="text-emerald-300">
                      {saveData.settings.sfxMuted
                        ? 'Muted'
                        : `${Math.round(saveData.settings.sfxVolume * 100)}%`}
                    </span>
                    <button
                      onClick={() =>
                        updateSetting('sfxMuted', !saveData.settings.sfxMuted)
                      }
                      className="text-stone-400 hover:text-white underline"
                    >
                      {saveData.settings.sfxMuted ? 'Unmute' : 'Mute'}
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={saveData.settings.sfxVolume}
                  onChange={(e) => {
                    updateSetting('sfxVolume', parseFloat(e.target.value));
                    if (saveData.settings.sfxMuted) {
                      updateSetting('sfxMuted', false);
                    }
                    soundEngine.playCoin(2);
                  }}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>

              {/* Graphics Quality Selector */}
              <div>
                <label className="block text-xs font-medium text-stone-200 mb-2">
                  3D Graphics &amp; Shadow Quality
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-950 rounded-xl border border-white/10">
                  {(
                    [
                      { id: 'high', label: 'High' },
                      { id: 'balanced', label: 'Balanced' },
                      { id: 'performance', label: '60 FPS Fast' },
                    ] as const
                  ).map((q) => (
                    <button
                      key={q.id}
                      onClick={() => {
                        soundEngine.playButtonClick();
                        updateSetting('graphicsQuality', q.id);
                      }}
                      className={`py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        saveData.settings.graphicsQuality === q.id
                          ? 'bg-amber-400 text-stone-950 font-semibold'
                          : 'text-stone-400 hover:text-white'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Shake Toggle */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="text-xs font-medium text-stone-200">
                    Impact Camera Shake
                  </div>
                  <div className="text-[11px] text-stone-400">
                    Dynamic screen tremor on collisions and shield breaks
                  </div>
                </div>
                <button
                  onClick={() => {
                    soundEngine.playButtonClick();
                    updateSetting(
                      'cameraShake',
                      !saveData.settings.cameraShake
                    );
                  }}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    saveData.settings.cameraShake
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-stone-400'
                  }`}
                >
                  {saveData.settings.cameraShake ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Reset High Score & Vault Data */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                {!confirmReset ? (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Reset High Score &amp; Saved Progress
                  </button>
                ) : (
                  <div className="flex items-center gap-3 w-full justify-between">
                    <span className="text-xs text-rose-300">
                      Confirm full reset?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSaveData(DEFAULT_SAVE);
                          engineRef.current?.setOutfit(
                            DEFAULT_SAVE.selectedOutfit
                          );
                          setConfirmReset(false);
                        }}
                        className="px-3 py-1 text-xs font-semibold bg-rose-500 text-white rounded-lg"
                      >
                        Yes, Reset
                      </button>
                      <button
                        onClick={() => setConfirmReset(false)}
                        className="px-3 py-1 text-xs text-stone-300 bg-white/10 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => {
                  soundEngine.playButtonClick();
                  setShowSettings(false);
                }}
                className="px-5 py-2.5 text-xs font-semibold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors cursor-pointer"
              >
                Save &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
