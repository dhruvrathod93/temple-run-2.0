import * as THREE from 'three';
import {
  BiomeType,
  CollectibleType,
  ObstacleType,
  PlayerOutfit,
  PowerUpType,
} from '../types/game';

export interface ExplorerRig {
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  scarfTail: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  shieldBubble: THREE.Mesh;
  magnetRing: THREE.Mesh;
  boostTrail: THREE.Group;
  materials: {
    tunic: THREE.MeshStandardMaterial;
    scarf: THREE.MeshStandardMaterial;
    hat: THREE.MeshStandardMaterial;
    accent: THREE.MeshStandardMaterial;
  };
}

// Shared Materials & Geometries for 60 FPS Object Pooling
export class AssetLibrary {
  public readonly stoneMat = new THREE.MeshStandardMaterial({
    color: 0x6b665e,
    roughness: 0.85,
    metalness: 0.08,
  });

  public readonly darkStoneMat = new THREE.MeshStandardMaterial({
    color: 0x3f3c37,
    roughness: 0.9,
    metalness: 0.1,
  });

  public readonly mossMat = new THREE.MeshStandardMaterial({
    color: 0x2d6a4f,
    roughness: 0.88,
    metalness: 0.02,
  });

  public readonly foliageDeepMat = new THREE.MeshStandardMaterial({
    color: 0x1b4332,
    roughness: 0.82,
    metalness: 0.04,
  });

  public readonly foliageBrightMat = new THREE.MeshStandardMaterial({
    color: 0x40916c,
    roughness: 0.78,
    metalness: 0.05,
  });

  public readonly woodMat = new THREE.MeshStandardMaterial({
    color: 0x5c3a21,
    roughness: 0.86,
    metalness: 0.05,
  });

  public readonly plankMat = new THREE.MeshStandardMaterial({
    color: 0x7c4d2b,
    roughness: 0.82,
    metalness: 0.06,
  });

  public readonly bronzeMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.35,
    metalness: 0.78,
  });

  public readonly steelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.28,
    metalness: 0.85,
  });

  public readonly goldCoinMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.9,
  });

  public readonly rareRelicMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.7,
    roughness: 0.12,
    metalness: 0.85,
  });

  public readonly flameOuterMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.88,
  });

  public readonly flameCoreMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.95,
  });

  public readonly waterMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0369a1,
    emissiveIntensity: 0.35,
    roughness: 0.18,
    metalness: 0.2,
    transparent: true,
    opacity: 0.82,
  });

  public readonly crystalMat = new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    emissive: 0x7e22ce,
    emissiveIntensity: 0.75,
    roughness: 0.15,
    metalness: 0.6,
  });

  public readonly boxGeo = new THREE.BoxGeometry(1, 1, 1);
  public readonly cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  public readonly coneGeo = new THREE.ConeGeometry(0.5, 1, 7);
  public readonly dodecaGeo = new THREE.DodecahedronGeometry(0.6, 0);
  public readonly octaGeo = new THREE.OctahedronGeometry(0.5, 0);
}

export const assets = new AssetLibrary();

export function createExplorerRig(outfit: PlayerOutfit): ExplorerRig {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd99b78,
    roughness: 0.65,
  });

  const tunicMat = new THREE.MeshStandardMaterial({
    color: outfit.tunicColor,
    roughness: 0.65,
    metalness: 0.12,
  });

  const scarfMat = new THREE.MeshStandardMaterial({
    color: outfit.scarfColor,
    roughness: 0.55,
  });

  const hatMat = new THREE.MeshStandardMaterial({
    color: outfit.hatColor,
    roughness: 0.7,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: outfit.accentColor,
    emissive: outfit.accentColor,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.8,
  });

  const trousersMat = new THREE.MeshStandardMaterial({
    color: 0x292524,
    roughness: 0.8,
  });

  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    roughness: 0.7,
  });

  // Pelvis / Core pivot (center of mass at y = 0.95)
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.92, 0);
  root.add(pelvis);

  const beltMesh = new THREE.Mesh(assets.boxGeo, bootMat);
  beltMesh.scale.set(0.54, 0.16, 0.34);
  beltMesh.castShadow = true;
  pelvis.add(beltMesh);

  const buckleMesh = new THREE.Mesh(assets.boxGeo, accentMat);
  buckleMesh.scale.set(0.14, 0.12, 0.06);
  buckleMesh.position.set(0, 0, 0.16);
  pelvis.add(buckleMesh);

  // Torso
  const torso = new THREE.Group();
  torso.position.set(0, 0.08, 0);
  pelvis.add(torso);

  const chestMesh = new THREE.Mesh(assets.boxGeo, tunicMat);
  chestMesh.scale.set(0.58, 0.62, 0.34);
  chestMesh.position.set(0, 0.31, 0);
  chestMesh.castShadow = true;
  torso.add(chestMesh);

  // Explorer Backpack & Rolled Map
  const backpack = new THREE.Mesh(assets.boxGeo, hatMat);
  backpack.scale.set(0.44, 0.48, 0.24);
  backpack.position.set(0, 0.32, 0.26);
  backpack.castShadow = true;
  torso.add(backpack);

  const mapScroll = new THREE.Mesh(assets.cylGeo, accentMat);
  mapScroll.scale.set(0.14, 0.52, 0.14);
  mapScroll.rotation.z = Math.PI / 2;
  mapScroll.position.set(0, 0.6, 0.26);
  torso.add(mapScroll);

  // Glowing Sunstone Compass on back of pack so player sees it from 3rd person
  const packCore = new THREE.Mesh(assets.octaGeo, accentMat);
  packCore.scale.set(0.22, 0.22, 0.12);
  packCore.position.set(0, 0.32, 0.39);
  torso.add(packCore);

  // Scarf wrap + fluttering tail
  const scarfCollar = new THREE.Mesh(assets.cylGeo, scarfMat);
  scarfCollar.scale.set(0.42, 0.14, 0.42);
  scarfCollar.position.set(0, 0.64, 0);
  torso.add(scarfCollar);

  const scarfTail = new THREE.Mesh(assets.boxGeo, scarfMat);
  scarfTail.scale.set(0.22, 0.06, 0.55);
  scarfTail.position.set(0.08, 0.62, 0.35);
  scarfTail.castShadow = true;
  torso.add(scarfTail);

  // Head & Adventurer Hat
  const head = new THREE.Group();
  head.position.set(0, 0.68, 0);
  torso.add(head);

  const cranium = new THREE.Mesh(assets.boxGeo, skinMat);
  cranium.scale.set(0.38, 0.38, 0.38);
  cranium.position.set(0, 0.2, 0);
  cranium.castShadow = true;
  head.add(cranium);

  // Explorer Hat Brim & Crown
  const hatBrim = new THREE.Mesh(assets.cylGeo, hatMat);
  hatBrim.scale.set(0.76, 0.05, 0.72);
  hatBrim.position.set(0, 0.38, 0);
  hatBrim.castShadow = true;
  head.add(hatBrim);

  const hatCrown = new THREE.Mesh(assets.cylGeo, hatMat);
  hatCrown.scale.set(0.44, 0.22, 0.46);
  hatCrown.position.set(0, 0.48, 0);
  hatCrown.castShadow = true;
  head.add(hatCrown);

  const hatBand = new THREE.Mesh(assets.cylGeo, accentMat);
  hatBand.scale.set(0.46, 0.05, 0.48);
  hatBand.position.set(0, 0.41, 0);
  head.add(hatBand);

  // Arms
  const makeArm = (side: -1 | 1) => {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.38, 0.56, 0);

    const upperArm = new THREE.Mesh(assets.boxGeo, tunicMat);
    upperArm.scale.set(0.18, 0.34, 0.18);
    upperArm.position.set(0, -0.15, 0);
    upperArm.castShadow = true;
    armGroup.add(upperArm);

    const foreArm = new THREE.Mesh(assets.boxGeo, skinMat);
    foreArm.scale.set(0.15, 0.32, 0.15);
    foreArm.position.set(0, -0.44, -0.04);
    foreArm.castShadow = true;
    armGroup.add(foreArm);

    const bracer = new THREE.Mesh(assets.boxGeo, bootMat);
    bracer.scale.set(0.17, 0.14, 0.17);
    bracer.position.set(0, -0.48, -0.04);
    armGroup.add(bracer);

    torso.add(armGroup);
    return armGroup;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Legs
  const makeLeg = (side: -1 | 1) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.17, -0.04, 0);

    const thigh = new THREE.Mesh(assets.boxGeo, trousersMat);
    thigh.scale.set(0.22, 0.44, 0.22);
    thigh.position.set(0, -0.22, 0);
    thigh.castShadow = true;
    legGroup.add(thigh);

    const boot = new THREE.Mesh(assets.boxGeo, bootMat);
    boot.scale.set(0.23, 0.44, 0.26);
    boot.position.set(0, -0.64, -0.02);
    boot.castShadow = true;
    legGroup.add(boot);

    pelvis.add(legGroup);
    return legGroup;
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // Active Power-Up Visual Auras attached to Explorer
  const shieldGeo = new THREE.IcosahedronGeometry(1.25, 1);
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.28,
    wireframe: false,
    roughness: 0.1,
  });
  const shieldBubble = new THREE.Mesh(shieldGeo, shieldMat);
  shieldBubble.position.set(0, 1.0, 0);
  shieldBubble.visible = false;
  root.add(shieldBubble);

  const magnetGeo = new THREE.TorusGeometry(0.95, 0.05, 8, 24);
  const magnetMat = new THREE.MeshBasicMaterial({
    color: 0xe879f9,
    transparent: true,
    opacity: 0.75,
  });
  const magnetRing = new THREE.Mesh(magnetGeo, magnetMat);
  magnetRing.rotation.x = Math.PI / 2;
  magnetRing.position.set(0, 0.9, 0);
  magnetRing.visible = false;
  root.add(magnetRing);

  const boostTrail = new THREE.Group();
  const wingGeo = new THREE.ConeGeometry(0.25, 1.4, 5);
  const wingMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    transparent: true,
    opacity: 0.65,
  });
  const leftJet = new THREE.Mesh(wingGeo, wingMat);
  leftJet.rotation.x = Math.PI / 2;
  leftJet.position.set(-0.35, 0.8, 0.8);
  const rightJet = new THREE.Mesh(wingGeo, wingMat);
  rightJet.rotation.x = Math.PI / 2;
  rightJet.position.set(0.35, 0.8, 0.8);
  boostTrail.add(leftJet, rightJet);
  boostTrail.visible = false;
  root.add(boostTrail);

  return {
    root,
    pelvis,
    torso,
    head,
    scarfTail,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    shieldBubble,
    magnetRing,
    boostTrail,
    materials: {
      tunic: tunicMat,
      scarf: scarfMat,
      hat: hatMat,
      accent: accentMat,
    },
  };
}

export function updateExplorerOutfit(rig: ExplorerRig, outfit: PlayerOutfit) {
  rig.materials.tunic.color.setHex(outfit.tunicColor);
  rig.materials.scarf.color.setHex(outfit.scarfColor);
  rig.materials.hat.color.setHex(outfit.hatColor);
  rig.materials.accent.color.setHex(outfit.accentColor);
  rig.materials.accent.emissive.setHex(outfit.accentColor);
}

// ==================== OBSTACLE BUILDERS ====================

export function createObstacleMesh(type: ObstacleType): {
  group: THREE.Group;
  animatedPart?: THREE.Object3D;
} {
  const group = new THREE.Group();
  let animatedPart: THREE.Object3D | undefined;

  switch (type) {
    case 'fallen_tree': {
      // Massive mossy jungle trunk across the lane (Jump over: height ~1.15m)
      const trunk = new THREE.Mesh(assets.cylGeo, assets.woodMat);
      trunk.scale.set(0.95, 2.35, 0.95);
      trunk.rotation.z = Math.PI / 2;
      trunk.position.set(0, 0.52, 0);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      group.add(trunk);

      const mossCap = new THREE.Mesh(assets.boxGeo, assets.mossMat);
      mossCap.scale.set(2.1, 0.22, 0.72);
      mossCap.position.set(0, 0.96, 0);
      group.add(mossCap);

      // Glowing amber forest mushroom on log
      const shroom = new THREE.Mesh(assets.coneGeo, assets.goldCoinMat);
      shroom.scale.set(0.3, 0.28, 0.3);
      shroom.position.set(0.55, 1.12, 0.15);
      group.add(shroom);
      break;
    }

    case 'broken_wall': {
      // Tall crumbling carved temple monolith (Must switch lanes: height ~2.9m)
      const base = new THREE.Mesh(assets.boxGeo, assets.stoneMat);
      base.scale.set(2.05, 2.75, 0.95);
      base.position.set(0, 1.375, 0);
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);

      const topCrumble = new THREE.Mesh(assets.boxGeo, assets.darkStoneMat);
      topCrumble.scale.set(1.5, 0.55, 0.85);
      topCrumble.position.set(-0.2, 2.9, 0);
      topCrumble.castShadow = true;
      group.add(topCrumble);

      const vine = new THREE.Mesh(assets.boxGeo, assets.mossMat);
      vine.scale.set(0.45, 1.8, 1.02);
      vine.position.set(0.45, 1.5, 0);
      group.add(vine);

      // Carved sun relief
      const emblem = new THREE.Mesh(assets.octaGeo, assets.bronzeMat);
      emblem.scale.set(0.65, 0.65, 0.25);
      emblem.position.set(0, 1.6, 0.48);
      group.add(emblem);
      break;
    }

    case 'large_rock': {
      // Jagged granite boulder cluster (Jump over or Dodge: height ~1.25m)
      const mainRock = new THREE.Mesh(assets.dodecaGeo, assets.darkStoneMat);
      mainRock.scale.set(1.55, 1.25, 1.35);
      mainRock.position.set(0, 0.62, 0);
      mainRock.castShadow = true;
      mainRock.receiveShadow = true;
      group.add(mainRock);

      const sideRock = new THREE.Mesh(assets.dodecaGeo, assets.stoneMat);
      sideRock.scale.set(0.95, 0.85, 0.9);
      sideRock.position.set(0.6, 0.42, 0.2);
      sideRock.castShadow = true;
      group.add(sideRock);

      const moss = new THREE.Mesh(assets.dodecaGeo, assets.mossMat);
      moss.scale.set(1.1, 0.45, 0.95);
      moss.position.set(-0.1, 1.05, 0);
      group.add(moss);
      break;
    }

    case 'spiked_gate': {
      // High overhead portcullis with bottom clearance of 1.05m -> MUST SLIDE UNDER!
      const leftPost = new THREE.Mesh(assets.boxGeo, assets.darkStoneMat);
      leftPost.scale.set(0.34, 3.3, 0.55);
      leftPost.position.set(-0.98, 1.65, 0);
      leftPost.castShadow = true;
      group.add(leftPost);

      const rightPost = new THREE.Mesh(assets.boxGeo, assets.darkStoneMat);
      rightPost.scale.set(0.34, 3.3, 0.55);
      rightPost.position.set(0.98, 1.65, 0);
      rightPost.castShadow = true;
      group.add(rightPost);

      // Heavy bronze gate crossbeam occupying y = 1.35 to 3.2
      const upperGate = new THREE.Mesh(assets.boxGeo, assets.bronzeMat);
      upperGate.scale.set(2.15, 1.75, 0.35);
      upperGate.position.set(0, 2.28, 0);
      upperGate.castShadow = true;
      group.add(upperGate);

      // Gleaming downward steel spikes from y = 1.4 down to y = 1.02
      for (let i = -2; i <= 2; i++) {
        const spike = new THREE.Mesh(assets.coneGeo, assets.steelMat);
        spike.scale.set(0.24, 0.48, 0.24);
        spike.rotation.x = Math.PI;
        spike.position.set(i * 0.38, 1.18, 0);
        group.add(spike);
      }
      break;
    }

    case 'collapsing_bridge': {
      // Unstable cracked wooden span that tilts down when player approaches (Jump over!)
      const pitRim = new THREE.Mesh(assets.boxGeo, assets.darkStoneMat);
      pitRim.scale.set(2.2, 0.18, 3.2);
      pitRim.position.set(0, -0.08, 0);
      group.add(pitRim);

      const voidHole = new THREE.Mesh(
        assets.boxGeo,
        new THREE.MeshBasicMaterial({ color: 0x05080f })
      );
      voidHole.scale.set(2.0, 0.08, 2.8);
      voidHole.position.set(0, 0.01, 0);
      group.add(voidHole);

      const plankGroup = new THREE.Group();
      plankGroup.position.set(0, 0.05, -1.3); // Hinged at far edge
      for (let i = 0; i < 4; i++) {
        const plank = new THREE.Mesh(assets.boxGeo, assets.plankMat);
        plank.scale.set(1.9, 0.14, 0.55);
        plank.position.set(0, 0, 0.4 + i * 0.65);
        plank.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.04;
        plankGroup.add(plank);
      }
      group.add(plankGroup);
      animatedPart = plankGroup;
      break;
    }

    case 'fire_trap': {
      // Serpent brazier shooting an elevated horizontal flame jet at y = 1.45m (Slide under!)
      const pedestal = new THREE.Mesh(assets.boxGeo, assets.darkStoneMat);
      pedestal.scale.set(0.55, 2.4, 0.55);
      pedestal.position.set(-1.05, 1.2, 0);
      pedestal.castShadow = true;
      group.add(pedestal);

      const nozzle = new THREE.Mesh(assets.cylGeo, assets.bronzeMat);
      nozzle.scale.set(0.45, 0.45, 0.45);
      nozzle.rotation.z = Math.PI / 2;
      nozzle.position.set(-0.75, 1.65, 0);
      group.add(nozzle);

      const flameGroup = new THREE.Group();
      flameGroup.position.set(-0.55, 1.65, 0);

      const outerJet = new THREE.Mesh(assets.coneGeo, assets.flameOuterMat);
      outerJet.scale.set(0.72, 1.95, 0.72);
      outerJet.rotation.z = -Math.PI / 2;
      outerJet.position.set(0.95, 0, 0);
      flameGroup.add(outerJet);

      const coreJet = new THREE.Mesh(assets.coneGeo, assets.flameCoreMat);
      coreJet.scale.set(0.42, 1.45, 0.42);
      coreJet.rotation.z = -Math.PI / 2;
      coreJet.position.set(0.7, 0, 0);
      flameGroup.add(coreJet);

      group.add(flameGroup);
      animatedPart = flameGroup;
      break;
    }

    case 'swinging_pendulum': {
      // Overhead stone arch with a swinging bronze crescent blade
      const archLeft = new THREE.Mesh(assets.boxGeo, assets.darkStoneMat);
      archLeft.scale.set(0.45, 4.4, 0.55);
      archLeft.position.set(-3.6, 2.2, 0);
      group.add(archLeft);

      const archRight = new THREE.Mesh(assets.boxGeo, assets.darkStoneMat);
      archRight.scale.set(0.45, 4.4, 0.55);
      archRight.position.set(3.6, 2.2, 0);
      group.add(archRight);

      const archTop = new THREE.Mesh(assets.boxGeo, assets.stoneMat);
      archTop.scale.set(7.8, 0.55, 0.65);
      archTop.position.set(0, 4.3, 0);
      group.add(archTop);

      const pivot = new THREE.Group();
      pivot.position.set(0, 4.2, 0);

      const rod = new THREE.Mesh(assets.cylGeo, assets.bronzeMat);
      rod.scale.set(0.14, 3.1, 0.14);
      rod.position.set(0, -1.55, 0);
      pivot.add(rod);

      const blade = new THREE.Mesh(assets.cylGeo, assets.steelMat);
      blade.scale.set(1.65, 0.14, 0.95);
      blade.rotation.x = Math.PI / 2;
      blade.position.set(0, -3.1, 0);
      blade.castShadow = true;
      pivot.add(blade);

      const hub = new THREE.Mesh(assets.octaGeo, assets.goldCoinMat);
      hub.scale.set(0.45, 0.45, 0.35);
      hub.position.set(0, -3.0, 0);
      pivot.add(hub);

      group.add(pivot);
      animatedPart = pivot;
      break;
    }

    case 'path_gap': {
      // Deep chasm break across the lane with crumbling stone edge & mist
      const voidPit = new THREE.Mesh(
        assets.boxGeo,
        new THREE.MeshBasicMaterial({ color: 0x04070d })
      );
      voidPit.scale.set(2.25, 0.12, 3.1);
      voidPit.position.set(0, 0.02, 0);
      group.add(voidPit);

      const frontLip = new THREE.Mesh(assets.boxGeo, assets.darkStoneMat);
      frontLip.scale.set(2.25, 0.24, 0.28);
      frontLip.position.set(0, 0.06, 1.55);
      group.add(frontLip);

      const backLip = new THREE.Mesh(assets.boxGeo, assets.darkStoneMat);
      backLip.scale.set(2.25, 0.24, 0.28);
      backLip.position.set(0, 0.06, -1.55);
      group.add(backLip);

      const foam = new THREE.Mesh(assets.boxGeo, assets.waterMat);
      foam.scale.set(2.1, 0.06, 2.7);
      foam.position.set(0, -0.35, 0);
      group.add(foam);
      animatedPart = foam;
      break;
    }
  }

  return { group, animatedPart };
}

// ==================== COLLECTIBLES & POWER-UPS ====================

export function createCollectibleMesh(type: CollectibleType): THREE.Group {
  const group = new THREE.Group();

  if (type === 'coin') {
    const coin = new THREE.Mesh(assets.cylGeo, assets.goldCoinMat);
    coin.scale.set(0.68, 0.14, 0.68);
    coin.rotation.x = Math.PI / 2;
    coin.castShadow = true;
    group.add(coin);

    const core = new THREE.Mesh(assets.octaGeo, assets.flameCoreMat);
    core.scale.set(0.28, 0.28, 0.22);
    group.add(core);
  } else {
    // Rare Star-Relic (+50 pts, +5 coins)
    const crystal = new THREE.Mesh(assets.octaGeo, assets.rareRelicMat);
    crystal.scale.set(0.65, 0.95, 0.65);
    crystal.castShadow = true;
    group.add(crystal);

    const haloGeo = new THREE.TorusGeometry(0.55, 0.045, 6, 16);
    const halo = new THREE.Mesh(haloGeo, assets.goldCoinMat);
    group.add(halo);
  }

  return group;
}

export function createPowerUpMesh(type: PowerUpType): THREE.Group {
  const group = new THREE.Group();

  const colorMap: Record<PowerUpType, number> = {
    shield: 0x06b6d4,      // Cyan Aegis
    magnet: 0xe879f9,      // Magenta Lodestone
    speed_boost: 0x10b981, // Emerald Zephyr
    multiplier: 0xf59e0b,  // Solar Gold 2X
  };

  const mat = new THREE.MeshStandardMaterial({
    color: colorMap[type],
    emissive: colorMap[type],
    emissiveIntensity: 0.75,
    roughness: 0.15,
    metalness: 0.85,
  });

  // Outer spinning gyro ring
  const ringGeo = new THREE.TorusGeometry(0.68, 0.06, 8, 20);
  const ring = new THREE.Mesh(ringGeo, assets.goldCoinMat);
  group.add(ring);

  if (type === 'shield') {
    const core = new THREE.Mesh(assets.octaGeo, mat);
    core.scale.set(0.75, 0.75, 0.75);
    group.add(core);
  } else if (type === 'magnet') {
    const uLeft = new THREE.Mesh(assets.boxGeo, mat);
    uLeft.scale.set(0.18, 0.55, 0.18);
    uLeft.position.set(-0.2, 0.05, 0);
    const uRight = new THREE.Mesh(assets.boxGeo, mat);
    uRight.scale.set(0.18, 0.55, 0.18);
    uRight.position.set(0.2, 0.05, 0);
    const uBase = new THREE.Mesh(assets.boxGeo, mat);
    uBase.scale.set(0.58, 0.18, 0.18);
    uBase.position.set(0, -0.2, 0);
    group.add(uLeft, uRight, uBase);
  } else if (type === 'speed_boost') {
    const bolt = new THREE.Mesh(assets.coneGeo, mat);
    bolt.scale.set(0.65, 1.0, 0.45);
    bolt.rotation.x = -Math.PI / 4;
    group.add(bolt);
  } else {
    // Multiplier Star
    const star1 = new THREE.Mesh(assets.octaGeo, mat);
    star1.scale.set(0.8, 0.8, 0.4);
    const star2 = new THREE.Mesh(assets.octaGeo, assets.flameCoreMat);
    star2.scale.set(0.55, 0.55, 0.55);
    star2.rotation.z = Math.PI / 4;
    group.add(star1, star2);
  }

  return group;
}

// ==================== ENVIRONMENT SCENERY BUILDERS ====================

export function createRampMesh(): THREE.Group {
  const group = new THREE.Group();
  // Elevated stone ramp: 10m long, rises up to 1.6m height in the middle and steps down
  const rampSlope = new THREE.Mesh(assets.boxGeo, assets.stoneMat);
  rampSlope.scale.set(2.15, 0.35, 5.2);
  rampSlope.rotation.x = 0.26;
  rampSlope.position.set(0, 0.68, 2.4);
  rampSlope.receiveShadow = true;
  group.add(rampSlope);

  const deck = new THREE.Mesh(assets.boxGeo, assets.stoneMat);
  deck.scale.set(2.15, 1.35, 4.8);
  deck.position.set(0, 0.675, -2.2);
  deck.receiveShadow = true;
  deck.castShadow = true;
  group.add(deck);

  // Golden trim stripes along ramp edges
  const trim = new THREE.Mesh(assets.boxGeo, assets.bronzeMat);
  trim.scale.set(2.22, 0.12, 4.85);
  trim.position.set(0, 1.32, -2.2);
  group.add(trim);

  return group;
}

export function createTurnArchMesh(direction: 'left' | 'right'): THREE.Group {
  const group = new THREE.Group();

  const pillarLeft = new THREE.Mesh(assets.boxGeo, assets.bronzeMat);
  pillarLeft.scale.set(0.55, 4.2, 0.55);
  pillarLeft.position.set(-3.9, 2.1, 0);
  group.add(pillarLeft);

  const pillarRight = new THREE.Mesh(assets.boxGeo, assets.bronzeMat);
  pillarRight.scale.set(0.55, 4.2, 0.55);
  pillarRight.position.set(3.9, 2.1, 0);
  group.add(pillarRight);

  const header = new THREE.Mesh(assets.boxGeo, assets.darkStoneMat);
  header.scale.set(8.4, 0.75, 0.65);
  header.position.set(0, 4.1, 0);
  group.add(header);

  // Glowing Directional Arrow Indicator on the Arch Header
  const arrowMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
  });
  const arrowShaft = new THREE.Mesh(assets.boxGeo, arrowMat);
  arrowShaft.scale.set(1.8, 0.24, 0.72);
  arrowShaft.position.set(0, 4.1, 0);
  group.add(arrowShaft);

  const arrowHead = new THREE.Mesh(assets.coneGeo, arrowMat);
  arrowHead.scale.set(0.65, 0.75, 0.75);
  arrowHead.rotation.z = direction === 'left' ? Math.PI / 2 : -Math.PI / 2;
  arrowHead.position.set(direction === 'left' ? -1.1 : 1.1, 4.1, 0);
  group.add(arrowHead);

  return group;
}

export function decorateTrackChunk(
  chunkGroup: THREE.Group,
  biome: BiomeType,
  chunkIndex: number
) {
  // Clear previous biome decorations (children after index 3 are decorations)
  while (chunkGroup.children.length > 3) {
    chunkGroup.remove(chunkGroup.children[chunkGroup.children.length - 1]);
  }

  const seed = (chunkIndex * 9301 + 49297) % 233280;
  const sideSign = chunkIndex % 2 === 0 ? 1 : -1;

  if (biome === 'canopy') {
    // Dense Jungle Trees, Hanging Vines, Guardian Statues & Waterfalls
    for (const side of [-1, 1]) {
      const treeTrunk = new THREE.Mesh(assets.cylGeo, assets.woodMat);
      treeTrunk.scale.set(0.85, 6.5, 0.85);
      treeTrunk.position.set(side * 6.2, 2.5, -4);
      chunkGroup.add(treeTrunk);

      const canopy1 = new THREE.Mesh(assets.dodecaGeo, assets.foliageDeepMat);
      canopy1.scale.set(3.4, 2.4, 3.4);
      canopy1.position.set(side * 5.8, 6.2, -4);
      chunkGroup.add(canopy1);

      const canopy2 = new THREE.Mesh(assets.dodecaGeo, assets.foliageBrightMat);
      canopy2.scale.set(2.4, 1.8, 2.4);
      canopy2.position.set(side * 4.8, 5.2, -9);
      chunkGroup.add(canopy2);

      // Stone Ruin Torch Pillar along viaduct edge
      const pillar = new THREE.Mesh(assets.boxGeo, assets.stoneMat);
      pillar.scale.set(0.65, 2.4, 0.65);
      pillar.position.set(side * 4.15, 1.2, -8);
      chunkGroup.add(pillar);

      const flame = new THREE.Mesh(assets.coneGeo, assets.flameOuterMat);
      flame.scale.set(0.42, 0.65, 0.42);
      flame.position.set(side * 4.15, 2.65, -8);
      chunkGroup.add(flame);
    }

    // Occasional Waterfall or Ancient Guardian Statue
    if (chunkIndex % 3 === 0) {
      const waterfall = new THREE.Mesh(assets.boxGeo, assets.waterMat);
      waterfall.scale.set(0.35, 14, 4.2);
      waterfall.position.set(sideSign * 8.5, -1.5, -6);
      chunkGroup.add(waterfall);
    } else if (seed % 2 === 0) {
      // Guardian Monolith Statue
      const statue = new THREE.Mesh(assets.boxGeo, assets.darkStoneMat);
      statue.scale.set(1.6, 4.2, 1.6);
      statue.position.set(sideSign * 5.6, 2.1, -11);
      chunkGroup.add(statue);

      const eyeLeft = new THREE.Mesh(assets.boxGeo, assets.goldCoinMat);
      eyeLeft.scale.set(0.15, 0.18, 0.3);
      eyeLeft.position.set(sideSign * 4.78, 3.2, -10.6);
      const eyeRight = new THREE.Mesh(assets.boxGeo, assets.goldCoinMat);
      eyeRight.scale.set(0.15, 0.18, 0.3);
      eyeRight.position.set(sideSign * 4.78, 3.2, -11.4);
      chunkGroup.add(eyeLeft, eyeRight);
    }
  } else if (biome === 'bridge') {
    // Timber Suspension Bridge Posts, Rope Cables & Mist Waterfalls
    for (const side of [-1, 1]) {
      for (const zOff of [-3, -11]) {
        const post = new THREE.Mesh(assets.boxGeo, assets.woodMat);
        post.scale.set(0.38, 2.1, 0.38);
        post.position.set(side * 4.05, 1.05, zOff);
        chunkGroup.add(post);

        const lantern = new THREE.Mesh(assets.octaGeo, assets.goldCoinMat);
        lantern.scale.set(0.32, 0.42, 0.32);
        lantern.position.set(side * 4.05, 2.3, zOff);
        chunkGroup.add(lantern);
      }

      const ropeRail = new THREE.Mesh(assets.boxGeo, assets.plankMat);
      ropeRail.scale.set(0.12, 0.12, 16);
      ropeRail.position.set(side * 4.05, 1.65, -8);
      chunkGroup.add(ropeRail);
    }

    // Distant Gorge Waterfall
    const cliffFall = new THREE.Mesh(assets.boxGeo, assets.waterMat);
    cliffFall.scale.set(0.5, 18, 3.5);
    cliffFall.position.set(sideSign * 11, -3, -8);
    chunkGroup.add(cliffFall);
  } else if (biome === 'cavern') {
    // Subterranean Obsidian Cavern Arches & Glowing Crystals
    const roofArch = new THREE.Mesh(assets.boxGeo, assets.darkStoneMat);
    roofArch.scale.set(14, 1.2, 4.5);
    roofArch.position.set(0, 8.2, -8);
    chunkGroup.add(roofArch);

    for (const side of [-1, 1]) {
      const caveWall = new THREE.Mesh(assets.boxGeo, assets.darkStoneMat);
      caveWall.scale.set(2.2, 9.5, 5.5);
      caveWall.position.set(side * 6.2, 3.8, -8);
      chunkGroup.add(caveWall);

      const crystal = new THREE.Mesh(assets.coneGeo, assets.crystalMat);
      crystal.scale.set(0.95, 3.2, 0.95);
      crystal.rotation.z = side * -0.35;
      crystal.position.set(side * 4.6, 1.4, -5);
      chunkGroup.add(crystal);
    }
  } else {
    // Solar Temple Ramparts: Golden Obelisks & Torch Braziers
    for (const side of [-1, 1]) {
      const obelisk = new THREE.Mesh(assets.boxGeo, assets.bronzeMat);
      obelisk.scale.set(1.1, 5.2, 1.1);
      obelisk.position.set(side * 5.2, 2.6, -7);
      chunkGroup.add(obelisk);

      const cap = new THREE.Mesh(assets.coneGeo, assets.goldCoinMat);
      cap.scale.set(1.2, 1.1, 1.2);
      cap.position.set(side * 5.2, 5.7, -7);
      chunkGroup.add(cap);
    }
  }
}

export function createHorizonMountains(): THREE.Group {
  const horizon = new THREE.Group();

  const mtnMat = new THREE.MeshBasicMaterial({
    color: 0x0f1f1c,
    fog: false,
  });

  // Distant mountain silhouettes ahead of the player
  const peaks = [
    { x: -38, y: -4, z: -135, sx: 42, sy: 34, sz: 25 },
    { x: -12, y: -4, z: -145, sx: 48, sy: 44, sz: 28 },
    { x: 20, y: -4, z: -140, sx: 46, sy: 38, sz: 26 },
    { x: 45, y: -4, z: -130, sx: 38, sy: 30, sz: 24 },
  ];

  peaks.forEach((p) => {
    const peak = new THREE.Mesh(assets.coneGeo, mtnMat);
    peak.scale.set(p.sx, p.sy, p.sz);
    peak.position.set(p.x, p.y + p.sy * 0.5, p.z);
    horizon.add(peak);
  });

  // Warm Ancient Sun Disc above the mountain horizon
  const sunGeo = new THREE.CircleGeometry(14, 32);
  const sunMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    transparent: true,
    opacity: 0.45,
    fog: false,
  });
  const sunDisc = new THREE.Mesh(sunGeo, sunMat);
  sunDisc.position.set(0, 26, -150);
  horizon.add(sunDisc);

  return horizon;
}
