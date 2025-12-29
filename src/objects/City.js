/**
 * City - Open world city environment with buildings
 * Responsibility: Generate and manage city buildings and ground
 * Creates an isometric city view with procedurally placed buildings
 */

import * as THREE from "three";
import { WORLD_CONFIG, COLORS, ROAD_CONFIG } from "../utils/constants.js";
import { random, randomInt } from "../utils/helpers.js";
import { CityObstacles } from "./CityObstacles.js";
import { StreetFurniture } from "./StreetFurniture.js";

export class City {
  constructor(scene) {
    this.scene = scene;
    this.buildings = [];
    this.tiles = new Map(); // Use Map for efficient tile lookup by grid coordinates
    this.tileSize = WORLD_CONFIG.SIZE;
    this.cityObstacles = new CityObstacles(scene);
    this.streetFurniture = new StreetFurniture(scene);
    this.visibleRadius = 2; // Reduced from 3 - fewer tiles loaded (2x2 = 4 tiles)
    this.lastPlayerGrid = { x: 0, z: 0 }; // Track last player grid position

    // Async loading system for smooth performance
    this.loadQueue = []; // Tiles waiting to load
    this.loadingTiles = new Set(); // Currently loading tiles
    this.maxLoadTimePerFrame = 4; // Reduced from 6 - less work per frame
    this.buildingsPerChunk = 2; // Reduced from 3 - smaller chunks

    // Shared materials (reused across all objects to reduce texture/material count)
    this._initSharedMaterials();

    // Create initial 3x3 grid around spawn point (dynamic loading will handle the rest)
    this._initializeInitialTiles();
    this._spawnUrbanObstacles();
    // Walls removed
  }

  /**
   * Initialize shared materials to prevent texture limit issues
   */
  _initSharedMaterials() {
    // Create enhanced urban pavement texture with sidewalk details
    const concreteCanvas = document.createElement("canvas");
    concreteCanvas.width = 512;
    concreteCanvas.height = 512;
    const concreteCtx = concreteCanvas.getContext("2d");

    // Base concrete color - medium gray
    concreteCtx.fillStyle = "#7a7a7a";
    concreteCtx.fillRect(0, 0, 512, 512);

    // Add paving stone grid pattern for urban plaza effect
    concreteCtx.strokeStyle = "#656565";
    concreteCtx.lineWidth = 2;
    const gridSize = 64;
    for (let x = 0; x < 512; x += gridSize) {
      concreteCtx.beginPath();
      concreteCtx.moveTo(x, 0);
      concreteCtx.lineTo(x, 512);
      concreteCtx.stroke();
    }
    for (let y = 0; y < 512; y += gridSize) {
      concreteCtx.beginPath();
      concreteCtx.moveTo(0, y);
      concreteCtx.lineTo(512, y);
      concreteCtx.stroke();
    }

    // Add concrete texture - cracks and variations
    for (let i = 0; i < 1200; i++) {
      const brightness = 100 + Math.random() * 60;
      concreteCtx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, ${
        0.1 + Math.random() * 0.2
      })`;
      concreteCtx.fillRect(
        Math.random() * 512,
        Math.random() * 512,
        Math.random() * 4 + 1,
        Math.random() * 4 + 1
      );
    }

    // Add some darker spots and weathering effects
    for (let i = 0; i < 150; i++) {
      const darkness = 40 + Math.random() * 40;
      concreteCtx.fillStyle = `rgba(${darkness}, ${darkness}, ${darkness}, 0.15)`;
      concreteCtx.fillRect(
        Math.random() * 512,
        Math.random() * 512,
        Math.random() * 12 + 3,
        Math.random() * 12 + 3
      );
    }

    // Add subtle sidewalk edge lines (alternating pattern)
    concreteCtx.strokeStyle = "#909090";
    concreteCtx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const y = i * 64 + 32;
      concreteCtx.setLineDash([8, 8]);
      concreteCtx.beginPath();
      concreteCtx.moveTo(0, y);
      concreteCtx.lineTo(512, y);
      concreteCtx.stroke();
    }
    concreteCtx.setLineDash([]);

    const concreteTexture = new THREE.CanvasTexture(concreteCanvas);
    concreteTexture.wrapS = THREE.RepeatWrapping;
    concreteTexture.wrapT = THREE.RepeatWrapping;
    concreteTexture.repeat.set(15, 15);

    // Create realistic asphalt texture for roads
    const asphaltCanvas = document.createElement("canvas");
    asphaltCanvas.width = 256;
    asphaltCanvas.height = 256;
    const asphaltCtx = asphaltCanvas.getContext("2d");
    // Base dark asphalt color
    asphaltCtx.fillStyle = "#2a2a2a";
    asphaltCtx.fillRect(0, 0, 256, 256);
    // Add realistic asphalt grain and aggregate
    for (let i = 0; i < 4000; i++) {
      const brightness = Math.random() * 40;
      asphaltCtx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, ${
        0.15 + Math.random() * 0.25
      })`;
      asphaltCtx.fillRect(
        Math.random() * 256,
        Math.random() * 256,
        Math.random() * 2,
        Math.random() * 2
      );
    }
    // Add some lighter patches (worn areas)
    for (let i = 0; i < 50; i++) {
      const lightness = 50 + Math.random() * 30;
      asphaltCtx.fillStyle = `rgba(${lightness}, ${lightness}, ${lightness}, 0.1)`;
      asphaltCtx.fillRect(
        Math.random() * 256,
        Math.random() * 256,
        Math.random() * 10 + 5,
        Math.random() * 10 + 5
      );
    }
    const asphaltTexture = new THREE.CanvasTexture(asphaltCanvas);
    asphaltTexture.wrapS = THREE.RepeatWrapping;
    asphaltTexture.wrapT = THREE.RepeatWrapping;
    asphaltTexture.repeat.set(4, 4);

    // Modern urban building color palette - neutral and comfortable
    this.buildingColors = [
      0xc0c0c0, // Light gray
      0xa0a0a0, // Medium gray
      0xe8e8e8, // Off-white
      0x909090, // Darker gray
      0xb0b8c0, // Cool gray-blue
      0xa8b0b0, // Neutral gray-green
      0xd0d0d0, // Very light gray
      0x888888, // Charcoal gray
    ];

    // Ground material with concrete texture
    this.groundMaterial = new THREE.MeshLambertMaterial({
      map: concreteTexture,
    });

    // Road material with asphalt texture
    this.roadMaterial = new THREE.MeshLambertMaterial({
      map: asphaltTexture,
    });

    // Stripe material for buildings - lighter for better contrast
    this.stripeMaterial = new THREE.MeshLambertMaterial({ color: 0x606060 });

    // Rooftop material - neutral gray for modern look
    this.rooftopMaterial = new THREE.MeshLambertMaterial({ color: 0x707070 });

    // Create window textures for building facades
    this._createBuildingTextures();
  }

  /**
   * Create reusable building facade textures with windows
   * @private
   */
  _createBuildingTextures() {
    this.buildingTextures = {};

    // Office building texture (grid of windows) - modern gray
    const officeCanvas = document.createElement("canvas");
    officeCanvas.width = 256;
    officeCanvas.height = 256;
    const officeCtx = officeCanvas.getContext("2d");
    officeCtx.fillStyle = "#a8a8a8"; // Neutral gray
    officeCtx.fillRect(0, 0, 256, 256);

    // Add subtle vertical lines (building columns)
    officeCtx.strokeStyle = "#989898";
    officeCtx.lineWidth = 2;
    for (let x = 0; x < 256; x += 64) {
      officeCtx.beginPath();
      officeCtx.moveTo(x, 0);
      officeCtx.lineTo(x, 256);
      officeCtx.stroke();
    }

    // Draw windows with subtle glass reflection
    const windowSize = 20;
    const spacing = 8;
    for (let x = 10; x < 256; x += windowSize + spacing) {
      for (let y = 10; y < 256; y += windowSize + spacing) {
        // Glass window with gradient for depth
        const gradient = officeCtx.createLinearGradient(
          x,
          y,
          x + windowSize,
          y + windowSize
        );
        gradient.addColorStop(0, "#c0d4e0");
        gradient.addColorStop(1, "#a0b4c0");
        officeCtx.fillStyle = gradient;
        officeCtx.fillRect(x, y, windowSize, windowSize);
        // Window frame
        officeCtx.strokeStyle = "#606060";
        officeCtx.lineWidth = 1;
        officeCtx.strokeRect(x, y, windowSize, windowSize);
        // Window cross divider
        officeCtx.strokeStyle = "#707070";
        officeCtx.beginPath();
        officeCtx.moveTo(x + windowSize / 2, y);
        officeCtx.lineTo(x + windowSize / 2, y + windowSize);
        officeCtx.moveTo(x, y + windowSize / 2);
        officeCtx.lineTo(x + windowSize, y + windowSize / 2);
        officeCtx.stroke();
      }
    }
    const officeTexture = new THREE.CanvasTexture(officeCanvas);
    officeTexture.magFilter = THREE.NearestFilter;
    this.buildingTextures.office = new THREE.MeshLambertMaterial({
      map: officeTexture,
    });

    // Residential building texture - modern apartment style
    const residentialCanvas = document.createElement("canvas");
    residentialCanvas.width = 256;
    residentialCanvas.height = 256;
    const resCtx = residentialCanvas.getContext("2d");
    resCtx.fillStyle = "#c8c8c8"; // Light gray
    resCtx.fillRect(0, 0, 256, 256);

    // Add horizontal floor lines
    resCtx.strokeStyle = "#b0b0b0";
    resCtx.lineWidth = 2;
    for (let y = 0; y < 256; y += 28) {
      resCtx.beginPath();
      resCtx.moveTo(0, y);
      resCtx.lineTo(256, y);
      resCtx.stroke();
    }

    // Draw windows with balconies
    const windowSize2 = 18;
    const spacing2 = 10;
    for (let x = 15; x < 256; x += windowSize2 + spacing2) {
      for (let y = 15; y < 256; y += windowSize2 + spacing2) {
        // Cool white indoor lighting (modern LED)
        resCtx.fillStyle = "#f0f4f8";
        resCtx.fillRect(x, y, windowSize2, windowSize2);
        resCtx.fillStyle = "#555";
        resCtx.fillRect(x + 4, y + 4, windowSize2 - 8, windowSize2 - 8);

        // Add small balcony rail below every other window
        if (Math.random() > 0.5) {
          resCtx.strokeStyle = "#909090";
          resCtx.lineWidth = 1;
          resCtx.beginPath();
          resCtx.moveTo(x, y + windowSize2 + 2);
          resCtx.lineTo(x + windowSize2, y + windowSize2 + 2);
          resCtx.stroke();
        }
      }
    }
    const residentialTexture = new THREE.CanvasTexture(residentialCanvas);
    residentialTexture.magFilter = THREE.NearestFilter;
    this.buildingTextures.residential = new THREE.MeshLambertMaterial({
      map: residentialTexture,
    });

    // Shop/Commercial texture - modern storefront
    const shopCanvas = document.createElement("canvas");
    shopCanvas.width = 256;
    shopCanvas.height = 256;
    const shopCtx = shopCanvas.getContext("2d");
    shopCtx.fillStyle = "#b0b0b0"; // Neutral gray
    shopCtx.fillRect(0, 0, 256, 256);

    // Add decorative horizontal bands
    shopCtx.fillStyle = "#9a9a9a";
    shopCtx.fillRect(0, 80, 256, 4);
    shopCtx.fillRect(0, 170, 256, 4);

    // Draw shop windows (larger for storefronts)
    const windowSize3 = 35;
    const spacing3 = 15;
    for (let x = 10; x < 256; x += windowSize3 + spacing3) {
      for (let y = 10; y < 256; y += windowSize3 + spacing3) {
        // Glass with gradient for depth
        const gradient = shopCtx.createLinearGradient(
          x,
          y,
          x + windowSize3,
          y + windowSize3
        );
        gradient.addColorStop(0, "#f0f8ff");
        gradient.addColorStop(1, "#d8e8f8");
        shopCtx.fillStyle = gradient;
        shopCtx.fillRect(x, y, windowSize3, windowSize3);
        // Frame with depth
        shopCtx.strokeStyle = "#505050";
        shopCtx.lineWidth = 2;
        shopCtx.strokeRect(x, y, windowSize3, windowSize3);
        // Inner frame
        shopCtx.strokeStyle = "#707070";
        shopCtx.lineWidth = 1;
        shopCtx.strokeRect(x + 3, y + 3, windowSize3 - 6, windowSize3 - 6);
      }
    }
    const shopTexture = new THREE.CanvasTexture(shopCanvas);
    shopTexture.magFilter = THREE.NearestFilter;
    this.buildingTextures.shop = new THREE.MeshLambertMaterial({
      map: shopTexture,
    });

    // Modern/Glass texture - sleek glass facade
    const modernCanvas = document.createElement("canvas");
    modernCanvas.width = 256;
    modernCanvas.height = 256;
    const modCtx = modernCanvas.getContext("2d");
    modCtx.fillStyle = "#9098a0"; // Cool gray
    modCtx.fillRect(0, 0, 256, 256);
    // Draw glass panels with subtle reflection
    const panelSize = 32;
    for (let x = 0; x < 256; x += panelSize) {
      for (let y = 0; y < 256; y += panelSize) {
        // Glass panel with blue-gray tint
        modCtx.fillStyle = "#a8c0d0";
        modCtx.fillRect(x + 2, y + 2, panelSize - 4, panelSize - 4);
        modCtx.strokeStyle = "#505050";
        modCtx.lineWidth = 2;
        modCtx.strokeRect(x + 2, y + 2, panelSize - 4, panelSize - 4);
      }
    }
    const modernTexture = new THREE.CanvasTexture(modernCanvas);
    modernTexture.magFilter = THREE.NearestFilter;
    this.buildingTextures.modern = new THREE.MeshLambertMaterial({
      map: modernTexture,
    });

    // Brick texture - detailed brick pattern
    const brickCanvas = document.createElement("canvas");
    brickCanvas.width = 256;
    brickCanvas.height = 256;
    const brickCtx = brickCanvas.getContext("2d");
    brickCtx.fillStyle = "#9a8a7a"; // Warm brick gray
    brickCtx.fillRect(0, 0, 256, 256);
    // Draw brick pattern
    const brickWidth = 32;
    const brickHeight = 16;
    for (let y = 0; y < 256; y += brickHeight) {
      const offset = (Math.floor(y / brickHeight) % 2) * (brickWidth / 2);
      for (let x = -brickWidth; x < 256; x += brickWidth) {
        // Individual brick with slight color variation
        const colorVar = Math.random() * 20 - 10;
        brickCtx.fillStyle = `rgb(${154 + colorVar}, ${138 + colorVar}, ${
          122 + colorVar
        })`;
        brickCtx.fillRect(x + offset, y, brickWidth - 2, brickHeight - 2);
        // Mortar lines
        brickCtx.strokeStyle = "#787878";
        brickCtx.lineWidth = 2;
        brickCtx.strokeRect(x + offset, y, brickWidth - 2, brickHeight - 2);
      }
    }
    const brickTexture = new THREE.CanvasTexture(brickCanvas);
    brickTexture.magFilter = THREE.NearestFilter;
    this.buildingTextures.brick = new THREE.MeshLambertMaterial({
      map: brickTexture,
    });

    // Metal panel texture - industrial modern
    const metalCanvas = document.createElement("canvas");
    metalCanvas.width = 256;
    metalCanvas.height = 256;
    const metalCtx = metalCanvas.getContext("2d");
    metalCtx.fillStyle = "#858585"; // Metallic gray
    metalCtx.fillRect(0, 0, 256, 256);
    // Draw horizontal metal panels
    const panelHeight = 32;
    for (let y = 0; y < 256; y += panelHeight) {
      // Panel with gradient effect
      const gradient = metalCtx.createLinearGradient(0, y, 0, y + panelHeight);
      gradient.addColorStop(0, "#909090");
      gradient.addColorStop(0.5, "#858585");
      gradient.addColorStop(1, "#707070");
      metalCtx.fillStyle = gradient;
      metalCtx.fillRect(0, y, 256, panelHeight - 2);
      // Rivets
      for (let x = 20; x < 256; x += 40) {
        metalCtx.fillStyle = "#606060";
        metalCtx.beginPath();
        metalCtx.arc(x, y + panelHeight / 2, 2, 0, Math.PI * 2);
        metalCtx.fill();
      }
    }
    const metalTexture = new THREE.CanvasTexture(metalCanvas);
    metalTexture.magFilter = THREE.NearestFilter;
    this.buildingTextures.metal = new THREE.MeshLambertMaterial({
      map: metalTexture,
    });

    // Concrete panel texture - brutalist style
    const concretePanelCanvas = document.createElement("canvas");
    concretePanelCanvas.width = 256;
    concretePanelCanvas.height = 256;
    const concretePanelCtx = concretePanelCanvas.getContext("2d");
    concretePanelCtx.fillStyle = "#a0a0a0"; // Concrete gray
    concretePanelCtx.fillRect(0, 0, 256, 256);
    // Draw large concrete panels with seams
    const concretePanel = 64;
    for (let x = 0; x < 256; x += concretePanel) {
      for (let y = 0; y < 256; y += concretePanel) {
        // Add texture variation to each panel
        for (let i = 0; i < 100; i++) {
          const brightness = 130 + Math.random() * 60;
          concretePanelCtx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, 0.2)`;
          concretePanelCtx.fillRect(
            x + Math.random() * concretePanel,
            y + Math.random() * concretePanel,
            2,
            2
          );
        }
        // Panel seams
        concretePanelCtx.strokeStyle = "#707070";
        concretePanelCtx.lineWidth = 3;
        concretePanelCtx.strokeRect(x, y, concretePanel, concretePanel);
      }
    }
    const concretePanelTexture = new THREE.CanvasTexture(concretePanelCanvas);
    concretePanelTexture.magFilter = THREE.NearestFilter;
    this.buildingTextures.concretePanel = new THREE.MeshLambertMaterial({
      map: concretePanelTexture,
    });
  }

  /**
   * Initialize only the starting 3x3 tiles around origin
   * @private
   */
  _initializeInitialTiles() {
    // Start with minimal 3x3 grid (9 tiles) for quick load
    for (let gx = -1; gx <= 1; gx++) {
      for (let gz = -1; gz <= 1; gz++) {
        this._createAndAddTile(gx, gz);
      }
    }
  }

  /**
   * Create a tile key from grid coordinates for Map lookup
   * @private
   */
  _getTileKey(gridX, gridZ) {
    return `${gridX},${gridZ}`;
  }

  /**
   * Create and add a tile to the scene (sync version for initial load)
   * @private
   */
  _createAndAddTile(gridX, gridZ) {
    const key = this._getTileKey(gridX, gridZ);

    // Don't create if already exists
    if (this.tiles.has(key)) {
      return this.tiles.get(key);
    }

    const tile = this._createTile(gridX, gridZ);
    this.tiles.set(key, tile);
    return tile;
  }

  /**
   * Create tile asynchronously with incremental building loading
   * @private
   */
  _createTileAsync(gridX, gridZ) {
    const key = this._getTileKey(gridX, gridZ);

    if (this.tiles.has(key)) {
      this.loadingTiles.delete(key);
      return;
    }

    const origin = {
      x: gridX * this.tileSize,
      z: gridZ * this.tileSize,
    };

    const tile = {
      gridX,
      gridZ,
      origin,
      ground: null,
      roads: [],
      buildings: [],
      props: [],
    };

    // Fast: Create ground and roads immediately
    tile.ground = this._createGround(origin);
    tile.roads = this._createRoadPatches(origin);

    // Slow: Load buildings incrementally
    this._loadBuildingsAsync(tile);

    this.tiles.set(key, tile);
    this.loadingTiles.delete(key);
  }

  /**
   * Load buildings incrementally using exact zone logic
   * @private
   */
  _loadBuildingsAsync(tile) {
    const buildingData = this._getBuildingDataForTile(tile.origin);
    let loaded = 0;

    const loadChunk = () => {
      const end = Math.min(
        loaded + this.buildingsPerChunk,
        buildingData.length
      );

      for (let i = loaded; i < end; i++) {
        const data = buildingData[i];
        const building = this._createBuildingByType(
          data.type,
          data.width,
          data.height,
          data.depth
        );
        building.position.set(data.x, data.height / 2, data.z);

        tile.buildings.push(building);
        this.buildings.push(building);
        this.scene.add(building);
      }

      loaded = end;

      if (loaded < buildingData.length) {
        requestAnimationFrame(loadChunk);
      } else {
        // Buildings complete, add props
        tile.props = this._createUrbanProps(tile.origin, tile);

        // Add street furniture to ALL tiles so it's visible
        this._addMinimalStreetFurniture(tile.origin);
      }
    };

    requestAnimationFrame(loadChunk);
  }

  /**
   * Get building data using EXACT zone logic from _createBuildingsForTile
   * @private
   */
  _getBuildingDataForTile(origin) {
    const data = [];
    const roadWidth = 16;
    const roadBuffer = 5;

    // EXACT SAME ZONES as original
    const buildingZones = [
      {
        xMin: -95,
        xMax: -roadWidth - roadBuffer,
        zMin: -95,
        zMax: -roadWidth - roadBuffer,
      },
      {
        xMin: roadWidth + roadBuffer,
        xMax: 95,
        zMin: -95,
        zMax: -roadWidth - roadBuffer,
      },
      {
        xMin: -95,
        xMax: -roadWidth - roadBuffer,
        zMin: roadWidth + roadBuffer,
        zMax: 95,
      },
      {
        xMin: roadWidth + roadBuffer,
        xMax: 95,
        zMin: roadWidth + roadBuffer,
        zMax: 95,
      },
    ];

    const spacing = 35; // Increased from 25 - fewer buildings

    buildingZones.forEach((zone) => {
      for (let x = zone.xMin + spacing / 2; x < zone.xMax; x += spacing) {
        for (let z = zone.zMin + spacing / 2; z < zone.zMax; z += spacing) {
          const actualX = origin.x + x;
          const actualZ = origin.z + z;

          const buildingType = randomInt(0, 6);
          const sizeVariation = randomInt(0, 2);

          let width, height, depth;

          if (sizeVariation === 0) {
            width = randomInt(8, 12);
            height = random(12, 22);
          } else if (sizeVariation === 1) {
            width = randomInt(12, 16);
            height = random(20, 35);
          } else {
            width = randomInt(16, 22);
            height = random(28, 40);
          }
          depth = randomInt(8, 16);

          data.push({
            x: actualX,
            z: actualZ,
            width,
            height,
            depth,
            type: buildingType,
          });
        }
      }
    });

    return data;
  }

  /**
   * Create building by type index
   * @private
   */
  _createBuildingByType(type, width, height, depth) {
    if (type === 0) return this._createOfficeBuilding(width, height, depth);
    if (type === 1)
      return this._createResidentialBuilding(width, height, depth);
    if (type === 2) return this._createShopBuilding(width, height, depth);
    if (type === 3) return this._createModernBuilding(width, height, depth);
    if (type === 4) return this._createBrickBuilding(width, height, depth);
    if (type === 5) return this._createMetalBuilding(width, height, depth);
    return this._createConcretePanelBuilding(width, height, depth);
  }

  /**
   * Remove and cleanup a tile
   * @private
   */
  _removeTile(gridX, gridZ) {
    const key = this._getTileKey(gridX, gridZ);
    const tile = this.tiles.get(key);

    if (!tile) return;

    // Remove ground
    if (tile.ground) {
      this.scene.remove(tile.ground);
      tile.ground.geometry.dispose();
      tile.ground.material.dispose();
    }

    // Remove roads
    tile.roads.forEach((road) => {
      this.scene.remove(road);
      if (road.isMesh && road.geometry) {
        if (typeof road.geometry.dispose === "function") {
          road.geometry.dispose();
        }
      } else if (road.traverse) {
        road.traverse((child) => {
          if (child.geometry && typeof child.geometry.dispose === "function") {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m && m.dispose && m.dispose());
            } else if (typeof child.material.dispose === "function") {
              child.material.dispose();
            }
          }
        });
      }
      if (road.material && typeof road.material.dispose === "function") {
        road.material.dispose();
      }
    });

    // Remove buildings (but keep in this.buildings array for collision)
    tile.buildings.forEach((building) => {
      this.scene.remove(building);
      building.traverse((child) => {
        if (child.geometry && typeof child.geometry.dispose === "function") {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m && m.dispose && m.dispose());
          } else if (typeof child.material.dispose === "function") {
            child.material.dispose();
          }
        }
      });

      // Remove from global buildings array
      const idx = this.buildings.indexOf(building);
      if (idx > -1) {
        this.buildings.splice(idx, 1);
      }
    });

    // Remove props (streetlights, cars, benches, trees)
    if (tile.props) {
      tile.props.forEach((prop) => {
        this.scene.remove(prop);
        prop.traverse((child) => {
          if (child.geometry && typeof child.geometry.dispose === "function") {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m && m.dispose && m.dispose());
            } else if (typeof child.material.dispose === "function") {
              child.material.dispose();
            }
          }
        });
      });
    }

    this.tiles.delete(key);
  }

  _createTile(gridX, gridZ) {
    const origin = {
      x: gridX * this.tileSize,
      z: gridZ * this.tileSize,
    };

    const tile = {
      gridX,
      gridZ,
      origin,
      ground: null,
      roads: [],
      buildings: [],
      props: [], // Urban props (streetlights, cars, benches, trees)
    };

    tile.ground = this._createGround(origin);
    tile.roads = this._createRoadPatches(origin);
    tile.buildings = this._createBuildingsForTile(origin);
    tile.props = this._createUrbanProps(origin, tile); // Add urban elements
    // Rivers removed

    // Add street furniture to ALL tiles so it's visible
    this._addMinimalStreetFurniture(origin);

    return tile;
  }

  _createGround(origin) {
    const size = this.tileSize;
    const groundGeometry = new THREE.PlaneGeometry(size, size);

    const ground = new THREE.Mesh(groundGeometry, this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(origin.x, 0, origin.z);
    ground.receiveShadow = true;

    this.scene.add(ground);
    return ground;
  }

  _createRoadPatches(origin) {
    // Dual-carriageway setup
    const totalRoadWidth = 18; // entire road including both directions
    const medianWidth = 2;
    const laneWidth = 3.5;
    const lanesPerDirection = 2;
    const carriageWidth = lanesPerDirection * laneWidth; // width per direction
    const carriageOffset = medianWidth / 2 + carriageWidth / 2; // offset from center for each carriageway

    const roads = [];

    // Lane markers (white dashed)
    const laneMarkerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const laneMarkerLength = 3;
    const laneMarkerSpacing = 8;

    const addLaneMarkers = (length, isVertical, centerX, centerZ) => {
      const count = Math.floor(length / laneMarkerSpacing);
      const group = new THREE.Group();

      // Geometry orientation
      const laneGeo = isVertical
        ? new THREE.PlaneGeometry(0.25, laneMarkerLength)
        : new THREE.PlaneGeometry(laneMarkerLength, 0.25);

      // For each direction (-1 = left/down, +1 = right/up)
      [-1, 1].forEach((dir) => {
        const cx = dir * carriageOffset; // center of this carriageway

        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * laneMarkerSpacing;

          // Divider between the two lanes in this carriageway (sits at carriage center)
          const divider = new THREE.Mesh(laneGeo, laneMarkerMat);
          divider.rotation.x = -Math.PI / 2;
          if (isVertical) {
            divider.position.set(centerX + cx, 0.03, centerZ + offset);
          } else {
            divider.position.set(centerX + offset, 0.03, centerZ + cx);
          }
          group.add(divider);
        }
      });

      this.scene.add(group);
      roads.push(group);
    };

    // Main vertical road (center)
    const verticalRoad = new THREE.PlaneGeometry(totalRoadWidth, 200);
    const vRoad = new THREE.Mesh(verticalRoad, this.roadMaterial);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(origin.x, 0.02, origin.z);
    vRoad.receiveShadow = false;
    this.scene.add(vRoad);
    roads.push(vRoad);

    // Median strip - concrete divider
    const vMedianGeo = new THREE.PlaneGeometry(medianWidth, 200);
    const vMedian = new THREE.Mesh(
      vMedianGeo,
      new THREE.MeshLambertMaterial({
        color: 0x606060, // Concrete gray divider
        depthWrite: true,
      })
    );
    vMedian.rotation.x = -Math.PI / 2;
    vMedian.position.set(origin.x, 0.025, origin.z); // Higher y-position to prevent z-fighting
    vMedian.receiveShadow = false;
    this.scene.add(vMedian);
    roads.push(vMedian);

    // Lane markers for vertical road
    addLaneMarkers(200, true, origin.x, origin.z);

    // Main horizontal road (center)
    const horizontalRoad = new THREE.PlaneGeometry(200, totalRoadWidth);
    const hRoad = new THREE.Mesh(horizontalRoad, this.roadMaterial);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(origin.x, 0.02, origin.z);
    hRoad.receiveShadow = false;
    this.scene.add(hRoad);
    roads.push(hRoad);

    // Median strip for horizontal road - concrete divider
    const hMedianGeo = new THREE.PlaneGeometry(200, medianWidth);
    const hMedian = new THREE.Mesh(
      hMedianGeo,
      new THREE.MeshLambertMaterial({
        color: 0x606060, // Concrete gray divider
        depthWrite: true,
      })
    );
    hMedian.rotation.x = -Math.PI / 2;
    hMedian.position.set(origin.x, 0.026, origin.z); // Slightly higher to prevent overlap at intersections
    hMedian.receiveShadow = false;
    this.scene.add(hMedian);
    roads.push(hMedian);

    // Lane markers for horizontal road
    addLaneMarkers(200, false, origin.x, origin.z);

    return roads;
  }

  _createBuildingsForTile(origin) {
    const config = WORLD_CONFIG;
    const buildings = [];
    const roadWidth = 16;
    const roadBuffer = 5; // Keep buildings away from roads

    // Define building zones - ONLY on green areas (all four quadrants)
    const buildingZones = [
      // Top-left (x negative, z negative)
      {
        xMin: -95,
        xMax: -roadWidth - roadBuffer,
        zMin: -95,
        zMax: -roadWidth - roadBuffer,
      },
      // Top-right (x positive, z negative)
      {
        xMin: roadWidth + roadBuffer,
        xMax: 95,
        zMin: -95,
        zMax: -roadWidth - roadBuffer,
      },
      // Bottom-left (x negative, z positive)
      {
        xMin: -95,
        xMax: -roadWidth - roadBuffer,
        zMin: roadWidth + roadBuffer,
        zMax: 95,
      },
      // Bottom-right (x positive, z positive)
      {
        xMin: roadWidth + roadBuffer,
        xMax: 95,
        zMin: roadWidth + roadBuffer,
        zMax: 95,
      },
    ];

    // PRECISE EQUAL SPACING - 25 units between building centers on all sides
    const spacing = 25;

    buildingZones.forEach((zone) => {
      for (let x = zone.xMin + spacing / 2; x < zone.xMax; x += spacing) {
        for (let z = zone.zMin + spacing / 2; z < zone.zMax; z += spacing) {
          const actualX = origin.x + x;
          const actualZ = origin.z + z;

          // Randomize building type and size with more variety
          const buildingType = randomInt(0, 6); // 0-6: office, residential, shop, modern, brick, metal, concrete
          const sizeVariation = randomInt(0, 2); // 0: small, 1: medium, 2: large

          let width, height, depth, building;

          if (sizeVariation === 0) {
            // Small buildings
            width = randomInt(8, 12);
            height = random(12, 22);
          } else if (sizeVariation === 1) {
            // Medium buildings
            width = randomInt(12, 16);
            height = random(20, 35);
          } else {
            // Large buildings
            width = randomInt(16, 22);
            height = random(28, 40);
          }
          depth = randomInt(8, 16);

          // Create building based on type with more variety
          if (buildingType === 0) {
            building = this._createOfficeBuilding(width, height, depth);
          } else if (buildingType === 1) {
            building = this._createResidentialBuilding(width, height, depth);
          } else if (buildingType === 2) {
            building = this._createShopBuilding(width, height, depth);
          } else if (buildingType === 3) {
            building = this._createModernBuilding(width, height, depth);
          } else if (buildingType === 4) {
            building = this._createBrickBuilding(width, height, depth);
          } else if (buildingType === 5) {
            building = this._createMetalBuilding(width, height, depth);
          } else {
            building = this._createConcretePanelBuilding(width, height, depth);
          }

          building.position.set(actualX, height / 2, actualZ);

          buildings.push(building);
          this.buildings.push(building);
          this.scene.add(building);
        }
      }
    });

    return buildings;
  }

  /**
   * Spawn minimal urban obstacles (only in green areas, not on roads)
   * @private
   */
  _spawnUrbanObstacles() {
    // MODERN CLEAN CITY: No obstacles on roads
    // Only place decorative elements in green areas away from roads

    // Traffic signs only at intersections (on green areas near roads)
    const trafficSignPositions = [
      { x: 18, z: 18, type: "stop" },
      { x: -18, z: -18, type: "stop" },
      { x: 18, z: -18, type: "stop" },
      { x: -18, z: 18, type: "stop" },
    ];

    trafficSignPositions.forEach((pos) => {
      this.cityObstacles.createTrafficSign({ x: pos.x, z: pos.z }, pos.type);
    });
  }

  /**
   * Create boundary walls around the play area
   * @private
   */
  _createBoundaryWalls() {
    const wallHeight = 8;
    const wallThickness = 2;
    const worldSize = WORLD_CONFIG.SIZE / 2;
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });

    // North wall
    const northWall = new THREE.Mesh(
      new THREE.BoxGeometry(
        WORLD_CONFIG.SIZE + wallThickness * 2,
        wallHeight,
        wallThickness
      ),
      wallMaterial
    );
    northWall.position.set(0, wallHeight / 2, -worldSize - wallThickness / 2);
    this.scene.add(northWall);

    // South wall
    const southWall = new THREE.Mesh(
      new THREE.BoxGeometry(
        WORLD_CONFIG.SIZE + wallThickness * 2,
        wallHeight,
        wallThickness
      ),
      wallMaterial
    );
    southWall.position.set(0, wallHeight / 2, worldSize + wallThickness / 2);
    this.scene.add(southWall);

    // West wall
    const westWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, WORLD_CONFIG.SIZE),
      wallMaterial
    );
    westWall.position.set(-worldSize - wallThickness / 2, wallHeight / 2, 0);
    this.scene.add(westWall);

    // East wall
    const eastWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, WORLD_CONFIG.SIZE),
      wallMaterial
    );
    eastWall.position.set(worldSize + wallThickness / 2, wallHeight / 2, 0);
    this.scene.add(eastWall);
  }

  /**
   * Check if position is on a road
   * @private
   */
  _isOnRoad(x, z) {
    const roadWidth = WORLD_CONFIG.ROAD_WIDTH;
    // Horizontal roads at z = 0
    if (Math.abs(z) < roadWidth / 2) return true;
    // Vertical roads at x = 0
    if (Math.abs(x) < roadWidth / 2) return true;
    return false;
  }

  /**
   * Check if building overlaps with existing buildings
   * @private
   */
  _checkBuildingCollision(x, z, width, depth, existingBuildings) {
    const spacing = WORLD_CONFIG.BUILDING_SPACING;
    for (const building of existingBuildings) {
      const bx = building.position.x;
      const bz = building.position.z;
      const bw = building.geometry.parameters.width;
      const bd = building.geometry.parameters.depth;

      // Check if bounding boxes overlap (with spacing)
      if (
        Math.abs(x - bx) < (width + bw) / 2 + spacing &&
        Math.abs(z - bz) < (depth + bd) / 2 + spacing
      ) {
        return true; // Collision detected
      }
    }
    return false; // No collision
  }

  /**
   * Create office building with textured facade
   * @private
   */
  _createOfficeBuilding(width, height, depth) {
    const building = new THREE.Group();

    // Main body - uses textured facade material
    const bodyGeometry = new THREE.BoxGeometry(width, height, depth);
    const body = new THREE.Mesh(bodyGeometry, this.buildingTextures.office);
    building.add(body);

    // Small rooftop details
    const rooftopDetail1 = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.3, 1, depth * 0.3),
      this.rooftopMaterial
    );
    rooftopDetail1.position.set(width * 0.2, height / 2 + 0.5, depth * 0.2);
    building.add(rooftopDetail1);

    building.geometry = { parameters: { width, height, depth } };
    return building;
  }

  /**
   * Create residential building with warm colors
   * @private
   */
  _createResidentialBuilding(width, height, depth) {
    const building = new THREE.Group();

    // Main body with residential texture
    const bodyGeometry = new THREE.BoxGeometry(width, height, depth);
    const body = new THREE.Mesh(
      bodyGeometry,
      this.buildingTextures.residential
    );
    building.add(body);

    // Add simple door detail at base
    const doorGeometry = new THREE.BoxGeometry(
      width * 0.15,
      height * 0.3,
      depth * 0.1
    );
    const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(0, height / 2 - height * 0.35, depth / 2 + 0.01);
    building.add(door);

    // Rooftop detail
    const rooftopDetail = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.4, 0.8, depth * 0.4),
      this.rooftopMaterial
    );
    rooftopDetail.position.set(-width * 0.15, height / 2 + 0.4, -depth * 0.15);
    building.add(rooftopDetail);

    building.geometry = { parameters: { width, height, depth } };
    return building;
  }

  /**
   * Create shop/commercial building with storefront
   * @private
   */
  _createShopBuilding(width, height, depth) {
    const building = new THREE.Group();

    // Main body with shop texture
    const bodyGeometry = new THREE.BoxGeometry(width, height, depth);
    const body = new THREE.Mesh(bodyGeometry, this.buildingTextures.shop);
    building.add(body);

    // Large storefront window
    const windowGeometry = new THREE.BoxGeometry(
      width * 0.7,
      height * 0.35,
      depth * 0.05
    );
    const windowMaterial = new THREE.MeshLambertMaterial({ color: 0xd0e8f0 }); // Light blue-gray glass
    const window = new THREE.Mesh(windowGeometry, windowMaterial);
    window.position.set(0, height * 0.1, depth / 2 + 0.02);
    building.add(window);

    // Store sign frame
    const signGeometry = new THREE.BoxGeometry(
      width * 0.8,
      height * 0.15,
      depth * 0.1
    );
    const signMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, height / 2 + 0.3, depth / 2 + 0.05);
    building.add(sign);

    building.geometry = { parameters: { width, height, depth } };
    return building;
  }

  /**
   * Create modern glass-style building
   * @private
   */
  _createModernBuilding(width, height, depth) {
    const building = new THREE.Group();

    // Main body with modern glass texture
    const bodyGeometry = new THREE.BoxGeometry(width, height, depth);
    const body = new THREE.Mesh(bodyGeometry, this.buildingTextures.modern);
    building.add(body);

    // Glass reflection panels on sides (for depth effect)
    const panelMaterial = new THREE.MeshLambertMaterial({
      color: 0xcccccc,
      opacity: 0.8,
      transparent: true,
    });

    // Side panel 1
    const panel1Geometry = new THREE.PlaneGeometry(depth * 0.8, height * 0.9);
    const panel1 = new THREE.Mesh(panel1Geometry, panelMaterial);
    panel1.position.set(width / 2 + 0.01, 0, 0);
    panel1.rotation.y = -Math.PI / 2;
    building.add(panel1);

    // Side panel 2
    const panel2Geometry = new THREE.PlaneGeometry(depth * 0.8, height * 0.9);
    const panel2 = new THREE.Mesh(panel2Geometry, panelMaterial);
    panel2.position.set(-width / 2 - 0.01, 0, 0);
    panel2.rotation.y = Math.PI / 2;
    building.add(panel2);

    // Roof detail (modern style)
    const roofGeometry = new THREE.BoxGeometry(width * 1.05, 0.5, depth * 1.05);
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(0, height / 2 + 0.25, 0);
    building.add(roof);

    building.geometry = { parameters: { width, height, depth } };
    return building;
  }

  /**
   * Create a colorful striped building like in the reference image
   * @private
   */
  _createStripedBuilding(width, height, depth) {
    const building = new THREE.Group();

    // Pick random color for this building
    const buildingColor =
      this.buildingColors[randomInt(0, this.buildingColors.length - 1)];
    const baseMaterial = new THREE.MeshLambertMaterial({
      color: buildingColor,
    });

    // Main building body
    const bodyGeometry = new THREE.BoxGeometry(width, height, depth);
    const body = new THREE.Mesh(bodyGeometry, baseMaterial);
    building.add(body);

    // Add horizontal black stripes (windows/floors)
    const stripeHeight = 1.2;
    const numStripes = Math.floor(height / 3);

    for (let i = 0; i < numStripes; i++) {
      const yPos = (i - numStripes / 2) * 3 + 1.5;

      // Front stripe
      const stripeFront = new THREE.Mesh(
        new THREE.PlaneGeometry(width + 0.1, stripeHeight),
        this.stripeMaterial
      );
      stripeFront.position.set(0, yPos, depth / 2 + 0.01);
      building.add(stripeFront);

      // Back stripe
      const stripeBack = new THREE.Mesh(
        new THREE.PlaneGeometry(width + 0.1, stripeHeight),
        this.stripeMaterial
      );
      stripeBack.position.set(0, yPos, -depth / 2 - 0.01);
      stripeBack.rotation.y = Math.PI;
      building.add(stripeBack);

      // Left stripe
      const stripeLeft = new THREE.Mesh(
        new THREE.PlaneGeometry(depth + 0.1, stripeHeight),
        this.stripeMaterial
      );
      stripeLeft.position.set(-width / 2 - 0.01, yPos, 0);
      stripeLeft.rotation.y = Math.PI / 2;
      building.add(stripeLeft);

      // Right stripe
      const stripeRight = new THREE.Mesh(
        new THREE.PlaneGeometry(depth + 0.1, stripeHeight),
        this.stripeMaterial
      );
      stripeRight.position.set(width / 2 + 0.01, yPos, 0);
      stripeRight.rotation.y = -Math.PI / 2;
      building.add(stripeRight);
    }

    // Add rooftop details (AC units, etc.)
    const rooftopDetail1 = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1, 2.5),
      this.rooftopMaterial
    );
    rooftopDetail1.position.set(-2, height / 2 + 0.5, -1);
    building.add(rooftopDetail1);

    const rooftopDetail2 = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1, 3),
      this.rooftopMaterial
    );
    rooftopDetail2.position.set(2, height / 2 + 0.5, 1.5);
    building.add(rooftopDetail2);

    // Store geometry parameters for collision detection
    building.geometry = { parameters: { width, height, depth } };

    return building;
  }

  /**
   * Create brick texture building
   * @private
   */
  _createBrickBuilding(width, height, depth) {
    const building = new THREE.Group();

    // Main building body with brick texture
    const bodyGeometry = new THREE.BoxGeometry(width, height, depth);
    const body = new THREE.Mesh(bodyGeometry, this.buildingTextures.brick);
    building.add(body);

    // Rooftop
    const roofGeometry = new THREE.BoxGeometry(width + 0.5, 0.5, depth + 0.5);
    const roof = new THREE.Mesh(roofGeometry, this.rooftopMaterial);
    roof.position.y = height / 2 + 0.25;
    building.add(roof);

    building.geometry = { parameters: { width, height, depth } };
    return building;
  }

  /**
   * Create metal panel building (industrial)
   * @private
   */
  _createMetalBuilding(width, height, depth) {
    const building = new THREE.Group();

    // Main building body with metal panels
    const bodyGeometry = new THREE.BoxGeometry(width, height, depth);
    const body = new THREE.Mesh(bodyGeometry, this.buildingTextures.metal);
    building.add(body);

    // Industrial rooftop with equipment
    const roofGeometry = new THREE.BoxGeometry(width, 0.5, depth);
    const roof = new THREE.Mesh(roofGeometry, this.rooftopMaterial);
    roof.position.y = height / 2 + 0.25;
    building.add(roof);

    // Add industrial equipment on roof
    const equipmentGeometry = new THREE.BoxGeometry(3, 1.5, 2);
    const equipmentMaterial = new THREE.MeshLambertMaterial({
      color: 0x505050,
    });
    const equipment = new THREE.Mesh(equipmentGeometry, equipmentMaterial);
    equipment.position.set(0, height / 2 + 1, 0);
    building.add(equipment);

    building.geometry = { parameters: { width, height, depth } };
    return building;
  }

  /**
   * Create concrete panel building (brutalist)
   * @private
   */
  _createConcretePanelBuilding(width, height, depth) {
    const building = new THREE.Group();

    // Main building body with concrete panels
    const bodyGeometry = new THREE.BoxGeometry(width, height, depth);
    const body = new THREE.Mesh(
      bodyGeometry,
      this.buildingTextures.concretePanel
    );
    building.add(body);

    // Flat concrete rooftop
    const roofGeometry = new THREE.BoxGeometry(width, 0.5, depth);
    const roof = new THREE.Mesh(roofGeometry, this.rooftopMaterial);
    roof.position.y = height / 2 + 0.25;
    building.add(roof);

    building.geometry = { parameters: { width, height, depth } };
    return building;
  }

  /**
   * Get all buildings for collision detection
   */
  getBuildings() {
    return this.buildings;
  }

  /**
   * Get city obstacles for collision detection
   */
  getCityObstacles() {
    return this.cityObstacles.getObstacles();
  }

  /**
   * Check if position collides with any building
   */
  checkBuildingCollision(x, z, radius = 2) {
    for (const building of this.buildings) {
      const bx = building.position.x;
      const bz = building.position.z;
      const halfWidth = building.geometry.parameters.width / 2 + radius;
      const halfDepth = building.geometry.parameters.depth / 2 + radius;

      if (
        x > bx - halfWidth &&
        x < bx + halfWidth &&
        z > bz - halfDepth &&
        z < bz + halfDepth
      ) {
        return true;
      }
    }
    return false;
  }

  update(playerPosition) {
    const currentGridX = Math.round(playerPosition.x / this.tileSize);
    const currentGridZ = Math.round(playerPosition.z / this.tileSize);

    // Always process load queue
    this._processLoadQueue();

    // Only update tiles if player has moved to a new grid cell
    if (
      currentGridX === this.lastPlayerGrid.x &&
      currentGridZ === this.lastPlayerGrid.z
    ) {
      return;
    }

    this.lastPlayerGrid.x = currentGridX;
    this.lastPlayerGrid.z = currentGridZ;

    // Queue tiles by distance (load closest first)
    const tilesToKeep = new Set();
    const newTiles = [];

    for (let distance = 0; distance <= this.visibleRadius; distance++) {
      for (let dx = -distance; dx <= distance; dx++) {
        for (let dz = -distance; dz <= distance; dz++) {
          if (Math.abs(dx) === distance || Math.abs(dz) === distance) {
            const gridX = currentGridX + dx;
            const gridZ = currentGridZ + dz;
            const key = this._getTileKey(gridX, gridZ);
            tilesToKeep.add(key);

            if (!this.tiles.has(key) && !this.loadingTiles.has(key)) {
              newTiles.push({ gridX, gridZ, distance });
              this.loadingTiles.add(key);
            }
          }
        }
      }
    }

    // Add to queue
    this.loadQueue.push(...newTiles);

    // Async cleanup of distant tiles
    const tilesToRemove = [];
    for (const [key, tile] of this.tiles.entries()) {
      if (!tilesToKeep.has(key)) {
        tilesToRemove.push({ gridX: tile.gridX, gridZ: tile.gridZ });
      }
    }

    if (tilesToRemove.length > 0) {
      this._asyncCleanup(tilesToRemove);
    }

    // Cleanup distant street furniture (only every ~50 frames for performance)
    if (Math.random() > 0.98) {
      this.streetFurniture.cleanup(playerPosition.x, playerPosition.z, 300);
    }
  }

  /**
   * Process load queue with time-slicing
   * @private
   */
  _processLoadQueue() {
    if (this.loadQueue.length === 0) return;

    const startTime = performance.now();
    while (
      this.loadQueue.length > 0 &&
      performance.now() - startTime < this.maxLoadTimePerFrame
    ) {
      const tile = this.loadQueue.shift();
      this._createTileAsync(tile.gridX, tile.gridZ);
    }
  }

  /**
   * Async cleanup in idle time
   * @private
   */
  _asyncCleanup(tilesToRemove) {
    const cleanup = () => {
      const start = performance.now();
      let i = 0;
      while (i < tilesToRemove.length && performance.now() - start < 3) {
        this._removeTile(tilesToRemove[i].gridX, tilesToRemove[i].gridZ);
        i++;
      }
      if (i < tilesToRemove.length) {
        setTimeout(() => this._asyncCleanup(tilesToRemove.slice(i)), 50);
      }
    };

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(cleanup, { timeout: 100 });
    } else {
      setTimeout(cleanup, 16);
    }
  }

  /**
   * Create urban props for a tile (streetlights at crossings only, benches, trees)
   * @private
   */
  _createUrbanProps(origin, tile) {
    const props = [];
    const roadWidth = 16;
    const roadBuffer = 5;

    // Reduced props - only add occasionally for performance
    if (Math.random() > 0.7) {
      // Only 30% of tiles get lights
      props.push(...this._createStreetlights(origin, roadWidth));
    }

    // Minimal furniture - only 20% of tiles
    if (Math.random() > 0.8) {
      props.push(...this._createUrbanFurniture(origin, roadWidth, roadBuffer));
    }

    return props;
  }

  /**
   * Create streetlights ONLY at crossings (intersections)
   * @private
   */
  _createStreetlights(origin, roadWidth) {
    const lights = [];
    const offset = roadWidth / 2 + 2;

    // Only 2 lights per intersection instead of 4
    const cornerPositions = [
      { x: origin.x - offset, z: origin.z - offset }, // Top-left
      { x: origin.x + offset, z: origin.z + offset }, // Bottom-right
    ];

    cornerPositions.forEach((pos) => {
      const light = this._createStreetlight(pos.x, pos.z);
      lights.push(light);
    });
    return lights;
  }

  /**
   * Create a single streetlight
   * @private
   */
  _createStreetlight(x, z) {
    const group = new THREE.Group();

    // Simplified pole with fewer segments
    const poleGeometry = new THREE.CylinderGeometry(0.12, 0.15, 5, 6); // Reduced from 8 to 6 segments
    const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x404040 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 2.5;
    group.add(pole);

    // Simplified light housing
    const housingGeometry = new THREE.BoxGeometry(0.5, 0.3, 0.5);
    const housingMaterial = new THREE.MeshLambertMaterial({ color: 0x303030 });
    const housing = new THREE.Mesh(housingGeometry, housingMaterial);
    housing.position.y = 5.2;
    group.add(housing);

    // Light bulb (emissive) - no point light for performance
    const bulbGeometry = new THREE.BoxGeometry(0.4, 0.15, 0.4);
    const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffffdd }); // Basic material, no emissive
    const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
    bulb.position.y = 5;
    group.add(bulb);

    group.position.set(x, 0, z);
    this.scene.add(group);
    return group;
  }

  /**
   * Create urban furniture (benches, trees, signs)
   * @private
   */
  _createUrbanFurniture(origin, roadWidth, roadBuffer) {
    const furniture = [];

    // Add trees in building zones
    const treePositions = [
      // Top-left quadrant
      { x: origin.x - 40, z: origin.z - 40 },
      { x: origin.x - 60, z: origin.z - 60 },
      { x: origin.x - 45, z: origin.z - 70 },
      // Top-right quadrant
      { x: origin.x + 40, z: origin.z - 40 },
      { x: origin.x + 60, z: origin.z - 60 },
      { x: origin.x + 45, z: origin.z - 70 },
      // Bottom-left quadrant
      { x: origin.x - 40, z: origin.z + 40 },
      { x: origin.x - 60, z: origin.z + 60 },
      { x: origin.x - 45, z: origin.z + 70 },
      // Bottom-right quadrant
      { x: origin.x + 40, z: origin.z + 40 },
      { x: origin.x + 60, z: origin.z + 60 },
      { x: origin.x + 45, z: origin.z + 70 },
    ];

    treePositions.forEach((pos) => {
      if (Math.random() > 0.5) {
        furniture.push(this._createTree(pos.x, pos.z));
      }
    });

    // Add benches near streets
    const benchPositions = [
      { x: origin.x - roadWidth - 3, z: origin.z - 30, rotation: 0 },
      { x: origin.x + roadWidth + 3, z: origin.z + 30, rotation: Math.PI },
      { x: origin.x - 30, z: origin.z - roadWidth - 3, rotation: Math.PI / 2 },
      { x: origin.x + 30, z: origin.z + roadWidth + 3, rotation: -Math.PI / 2 },
    ];

    benchPositions.forEach((pos) => {
      if (Math.random() > 0.6) {
        furniture.push(this._createBench(pos.x, pos.z, pos.rotation));
      }
    });

    return furniture;
  }

  /**
   * Create a tree
   * @private
   */
  _createTree(x, z) {
    const group = new THREE.Group();

    // Trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 4, 8);
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x4a3520 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Foliage (multiple spheres for fuller look)
    const foliageMaterial = new THREE.MeshLambertMaterial({ color: 0x2d5016 });

    const foliagePositions = [
      [0, 4.5, 0, 1.8],
      [0, 5.5, 0, 1.5],
      [0.8, 4.8, 0, 1.2],
      [-0.8, 4.8, 0, 1.2],
      [0, 4.8, 0.8, 1.2],
      [0, 4.8, -0.8, 1.2],
    ];

    foliagePositions.forEach(([fx, fy, fz, radius]) => {
      const foliageGeometry = new THREE.SphereGeometry(radius, 8, 8);
      const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
      foliage.position.set(fx, fy, fz);
      foliage.castShadow = true;
      group.add(foliage);
    });

    group.position.set(x, 0, z);
    this.scene.add(group);
    return group;
  }

  /**
   * Create a bench
   * @private
   */
  _createBench(x, z, rotation) {
    const group = new THREE.Group();

    // Bench seat
    const seatGeometry = new THREE.BoxGeometry(2, 0.1, 0.6);
    const woodMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    const seat = new THREE.Mesh(seatGeometry, woodMaterial);
    seat.position.y = 0.4;
    seat.castShadow = true;
    group.add(seat);

    // Bench back
    const backGeometry = new THREE.BoxGeometry(2, 0.6, 0.1);
    const back = new THREE.Mesh(backGeometry, woodMaterial);
    back.position.set(0, 0.7, -0.25);
    back.castShadow = true;
    group.add(back);

    // Legs (metal)
    const legMaterial = new THREE.MeshLambertMaterial({ color: 0x505050 });
    const legGeometry = new THREE.BoxGeometry(0.1, 0.4, 0.1);

    const legPositions = [
      [-0.8, 0.2, 0.2],
      [0.8, 0.2, 0.2],
      [-0.8, 0.2, -0.2],
      [0.8, 0.2, -0.2],
    ];

    legPositions.forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      group.add(leg);
    });

    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    this.scene.add(group);
    return group;
  }

  /**
   * Add minimal street furniture to intersection (very sparse)
   * @private
   */
  _addMinimalStreetFurniture(origin) {
    const roadWidth = ROAD_CONFIG.SEGMENT_WIDTH;
    const offset = roadWidth / 2 + 2.5;
    
    // Always add street lights
    this.streetFurniture.createIntersectionLights(
      origin.x,
      origin.z,
      roadWidth
    );

    // Add realistic traffic lights at intersection
    this.streetFurniture.createIntersectionTrafficLights(
      origin.x,
      origin.z,
      roadWidth
    );

    // Add ALL 4 crosswalks (complete intersection coverage)
    // North crosswalk
    this.streetFurniture.createCrosswalk(
      origin.x,
      origin.z - offset,
      roadWidth,
      true
    );
    
    // South crosswalk
    this.streetFurniture.createCrosswalk(
      origin.x,
      origin.z + offset,
      roadWidth,
      true
    );
    
    // East crosswalk
    this.streetFurniture.createCrosswalk(
      origin.x + offset,
      origin.z,
      roadWidth,
      false
    );
    
    // West crosswalk
    this.streetFurniture.createCrosswalk(
      origin.x - offset,
      origin.z,
      roadWidth,
      false
    );

    // More visible signs (70% chance)
    if (Math.random() > 0.3) {
      const signOffset = roadWidth / 2 + 1.2;
      this.streetFurniture.createTrafficSign(
        origin.x + signOffset,
        origin.z - signOffset - 4,
        "stop"
      );
    }
    
    // Add bus stops occasionally
    if (Math.random() > 0.6) {
      this.streetFurniture.createBusStop(
        origin.x + roadWidth / 2 + 3,
        origin.z + 10
      );
    }
  }

  /**
   * Cleanup resources
   */
  dispose() {
    // Remove all tiles
    const tileKeys = Array.from(this.tiles.keys());
    tileKeys.forEach((key) => {
      const tile = this.tiles.get(key);
      if (tile) {
        this._removeTile(tile.gridX, tile.gridZ);
      }
    });

    this.buildings.forEach((building) => {
      this.scene.remove(building);
      // Traverse all descendants; guard against non-THREE placeholder geometry
      building.traverse((child) => {
        if (child.geometry && typeof child.geometry.dispose === "function") {
          child.geometry.dispose();
        }
        if (child.material) {
          // Materials can be arrays
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m && m.dispose && m.dispose());
          } else if (typeof child.material.dispose === "function") {
            child.material.dispose();
          }
        }
      });
    });

    // Cleanup city obstacles
    if (this.cityObstacles) {
      this.cityObstacles.dispose();
    }

    // Cleanup street furniture
    if (this.streetFurniture) {
      this.streetFurniture.dispose();
    }

    // Clear the tiles Map
    this.tiles.clear();
  }
}
