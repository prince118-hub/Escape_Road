/**
 * Main Game Entry Point
 * Responsibility: Bootstrap and orchestrate all game systems
 * Coordinates initialization, game loop, and lifecycle management
 */

import { GameEngine } from "./core/GameEngine.js";
import { GameLoop } from "./core/GameLoop.js";
import { PlayerCar } from "./objects/PlayerCar.js";
import { EnemyChaser } from "./objects/EnemyChaser.js";
import { City } from "./objects/City.js";
import { Desert } from "./objects/Desert.js";
import { TrafficManager } from "./objects/TrafficCar.js";
import { CollisionSystem } from "./systems/CollisionSystem.js";
import { ScoreSystem } from "./systems/ScoreSystem.js";
import { DifficultyManager } from "./systems/DifficultyManager.js";
import { EffectsSystem } from "./systems/EffectsSystem.js";
import { SoundSystem } from "./systems/SoundSystem.js";
import { WantedSystem } from "./systems/WantedSystem.js";
import { SkidMarkSystem } from "./systems/SkidMarkSystem.js";
import { InputManager } from "./controls/InputManager.js";
import { CameraController } from "./controls/CameraController.js";
import { HUD } from "./ui/HUD.js";
import { MenuSystem } from "./ui/MenuSystem.js";
import { ENEMY_CONFIG, WANTED_CONFIG } from "./utils/constants.js";

/**
 * Main Game class - orchestrates all game systems
 */
class Game {
  constructor() {
    // Core systems
    this.engine = null;
    this.gameLoop = null;

    // Game objects
    this.player = null;
    this.enemies = []; // Multiple police cars
    this.city = null;
    this.desert = null;
    this.trafficManager = null;

    // Game systems
    this.collisionSystem = null;
    this.scoreSystem = null;
    this.difficultyManager = null;
    this.effectsSystem = null;
    this.soundSystem = null;
    this.wantedSystem = null;
    this.skidMarkSystem = null;

    // Controls
    this.inputManager = null;
    this.cameraController = null;

    // UI
    this.hud = null;
    this.menuSystem = null;

    // Game state
    this.isPlaying = false;
    this.isInitialized = false;
  }

  /**
   * Initialize the game
   */
  async init() {
    console.log("🎮 Initializing Chase Escape...");

    // Initialize core engine
    const canvas = document.getElementById("gameCanvas");
    if (!canvas) {
      console.error("Canvas element not found!");
      return;
    }

    this.engine = new GameEngine(canvas);
    this.gameLoop = new GameLoop();

    // Initialize UI
    this.hud = new HUD();
    this.menuSystem = new MenuSystem();

    // Setup menu callbacks
    this.menuSystem.setOnStartGame(() => this.startGame());
    this.menuSystem.setOnResumeGame(() => this.resumeGame());
    this.menuSystem.setOnRestartGame(() => this.restartGame());

    // Initialize input
    this.inputManager = new InputManager();

    // Show main menu
    this.menuSystem.showMainMenu();
    this.hud.hide();

    this.isInitialized = true;
    console.log("✅ Game initialized successfully");
  }

  /**
   * Start a new game
   */
  startGame() {
    console.log("🚀 === STARTING NEW GAME ===");

    // Clear any existing game objects
    console.log("🧹 Cleanup phase...");
    this._cleanupGameObjects();

    // Reset input so pause/boost keys aren't stuck between runs
    if (this.inputManager) {
      this.inputManager.reset();
      console.log("⌨️ Input manager reset");
    }

    // Get scene reference
    const scene = this.engine.getScene();
    console.log(`🎬 Scene ready, children count: ${scene.children.length}`);

    // Create game objects
    console.log("🚗 Creating player car...");
    this.player = new PlayerCar(scene);
    console.log(
      `✅ Player created at (${this.player.position.x}, ${this.player.position.z})`
    );

    console.log("🏙️ Creating city...");
    this.city = new City(scene);
    console.log("✅ City created");

    // OPTIMIZED: Desert disabled for performance
    // this.desert = new Desert(scene);

    console.log("🚕 Creating traffic manager...");
    this.trafficManager = new TrafficManager(scene, this.city); // Pass city reference for collision
    console.log("✅ Traffic manager created");

    // Create multiple enemy police cars
    console.log("🚓 Creating enemy police cars...");
    this.enemies = [];
    const enemySpawnPositions = [
      { x: -30, z: 40 },
      { x: 30, z: 40 },
      { x: 0, z: 50 },
    ];

    for (let i = 0; i < ENEMY_CONFIG.INITIAL_COUNT; i++) {
      const spawnPos = enemySpawnPositions[i] || {
        x: Math.random() * 60 - 30,
        z: 40 + Math.random() * 20,
      };
      const enemy = new EnemyChaser(
        scene,
        this.player,
        spawnPos,
        this.city,
        this.enemies
      );
      this.enemies.push(enemy);
      console.log(
        `🚓 Enemy ${i + 1} created at (${spawnPos.x}, ${spawnPos.z})`
      );
    }

    // Create game systems (updated for multiple enemies)
    console.log("⚙️ Creating game systems...");
    this.effectsSystem = new EffectsSystem(scene);
    this.soundSystem = new SoundSystem();
    this.skidMarkSystem = new SkidMarkSystem(scene);
    this.collisionSystem = new CollisionSystem(
      this.player,
      this.enemies,
      this.city,
      this.effectsSystem,
      this.soundSystem,
      this.trafficManager // Pass traffic manager for collision detection
    );
    this.scoreSystem = new ScoreSystem(this.player);
    this.difficultyManager = new DifficultyManager(this.enemies);

    // Pass skid mark system to player and enemies
    this.player.setSkidMarkSystem(this.skidMarkSystem);
    this.enemies.forEach((enemy) =>
      enemy.setSkidMarkSystem(this.skidMarkSystem)
    );

    // Create wanted system for dynamic police spawning
    this.wantedSystem = new WantedSystem(
      scene,
      this.player,
      this.enemies, // Pass enemies array reference so WantedSystem can add to it
      WANTED_CONFIG,
      this.city, // Pass city reference for building collision
      this.skidMarkSystem, // Pass skid mark system to wanted system
      this.soundSystem // Pass sound system for police siren
    );
    console.log("✅ All game systems created");

    // Setup camera controller
    console.log("🎥 Setting up camera...");
    this.cameraController = new CameraController(
      this.engine.getCamera(),
      this.player
    );
    this.cameraController.reset();
    console.log("✅ Camera ready");

    // Setup collision callbacks
    this.collisionSystem.setOnPlayerHitEnemy(() => {
      this._handlePlayerCaught();
    });

    // Setup difficulty increase callback
    this.difficultyManager.setOnDifficultyIncrease((level) => {
      console.log(`⬆️ Difficulty increased to level ${level}`);
    });

    // Register update callbacks with game loop
    console.log("🔄 Registering game loop callbacks...");
    this.gameLoop.clearCallbacks();
    this.gameLoop.registerUpdate((deltaTime) => this._update(deltaTime));
    this.gameLoop.registerRender(() => this._render());
    console.log("✅ Callbacks registered");

    // Start game loop
    console.log("▶️ Starting game loop...");
    this.gameLoop.start();
    this.isPlaying = true;

    // Show HUD
    this.hud.show();

    console.log("✅ === GAME STARTED SUCCESSFULLY ===");
    console.log(`Scene objects: ${scene.children.length}`);
  }

  /**
   * Handle player being caught by police
   * Triggers immediate game over instead of hanging in caught state
   * @private
   */
  _handlePlayerCaught() {
    // Guard against duplicate triggers
    if (!this.isPlaying) return;

    // Stop player and end the run immediately
    this.player.die();
    this.gameOver();
  }

  /**
   * Main update function - called every frame
   * @private
   */
  _update(deltaTime) {
    // Check for pause input
    if (this.inputManager.getPausePressed()) {
      this.pauseGame();
      return;
    }

    // Update input state
    const input = this.inputManager.getInput();
    this.player.setInput(input);

    // Update game objects
    this.player.update(deltaTime);

    // Keep world tiling aligned to player for endless effect
    if (this.city) {
      this.city.update(this.player.getPosition());
    }

    // Update all enemies
    this.enemies.forEach((enemy) => enemy.update(deltaTime));

    // Update traffic system
    if (this.trafficManager) {
      this.trafficManager.update(deltaTime);
    }

    // Update systems
    this.collisionSystem.update(deltaTime);
    this.scoreSystem.update(deltaTime);
    this.difficultyManager.update(deltaTime);
    this.effectsSystem.update(deltaTime);
    this.wantedSystem.update(deltaTime); // Update wanted system for dynamic police spawning
    this.skidMarkSystem.update(deltaTime); // Update skid marks for fading

    // Update camera
    this.cameraController.update(deltaTime);

    // Update HUD
    this._updateHUD();

    // Check for game over
    if (!this.player.isAlive) {
      this.gameOver();
    }
  }

  /**
   * Render function - called every frame
   * @private
   */
  _render() {
    this.engine.render();
  }

  /**
   * Update HUD with current game state
   * @private
   */
  _updateHUD() {
    this.hud.update({
      score: this.scoreSystem.getTotalScore(),
      boostReady: this.player.canBoost(),
      wantedLevel: this.wantedSystem.getWantedLevel(), // Pass wanted level to HUD
    });
  }

  /**
   * Pause the game
   */
  pauseGame() {
    if (!this.isPlaying) return;

    this.gameLoop.pause();
    this.menuSystem.showPauseMenu();
    this.hud.hide();

    // Stop all police sirens when paused
    this.enemies.forEach((enemy) => {
      if (enemy.pauseSiren) {
        enemy.pauseSiren();
      }
    });

    console.log("⏸️ Game paused");
  }

  /**
   * Resume the game
   */
  resumeGame() {
    this.gameLoop.resume();
    this.menuSystem.hidePauseMenu();
    this.hud.show();

    // Resume all police sirens
    this.enemies.forEach((enemy) => {
      if (enemy.resumeSiren) {
        enemy.resumeSiren();
      }
    });

    console.log("▶️ Game resumed");
  }

  /**
   * Handle game over
   */
  gameOver() {
    console.log("☠️ Game Over");

    // Prevent re-entering game over if already handled
    if (!this.isPlaying) return;

    this.isPlaying = false;
    this.gameLoop.stop();

    // Stop all police sirens when game over
    this.enemies.forEach((enemy) => {
      if (enemy.pauseSiren) {
        enemy.pauseSiren();
      }
    });

    // Get final statistics
    const stats = this.scoreSystem.getStatistics();

    // Show game over menu with stats
    this.menuSystem.showGameOverMenu(stats);
    this.hud.hide();
  }

  /**
   * Restart the game
   */
  restartGame() {
    console.log("🔄 === RESTART GAME INITIATED ===");

    // Stop the current game loop completely
    if (this.gameLoop) {
      console.log("⏸️ Stopping game loop");
      this.gameLoop.stop();
      // Clear all callbacks to prevent old references
      this.gameLoop.clearCallbacks();
    }

    // Mark game as not playing
    this.isPlaying = false;
    console.log("🚫 isPlaying = false");

    // Clean up all game objects properly
    console.log("🧹 Cleaning up game objects");
    this._cleanupGameObjects();

    // Clear all systems that maintain state
    if (this.collisionSystem) {
      console.log("Clearing collision system");
      this.collisionSystem = null;
    }
    if (this.scoreSystem) {
      console.log("Clearing score system");
      this.scoreSystem = null;
    }
    if (this.difficultyManager) {
      console.log("Clearing difficulty manager");
      this.difficultyManager = null;
    }
    if (this.effectsSystem) {
      console.log("Clearing effects system");
      this.effectsSystem = null;
    }
    if (this.wantedSystem) {
      console.log("Clearing wanted system");
      this.wantedSystem = null;
    }
    if (this.cameraController) {
      console.log("Clearing camera controller");
      this.cameraController = null;
    }

    // Ensure any overlay is hidden before restarting
    this.menuSystem.hideGameOverMenu();

    // Small delay to ensure cleanup completes
    console.log("⏳ Waiting 100ms for cleanup to complete...");
    setTimeout(() => {
      console.log("✅ Cleanup complete, starting new game");
      this.startGame();
    }, 100);
  }

  /**
   * Cleanup game objects
   * @private
   */
  _cleanupGameObjects() {
    try {
      if (this.player) {
        console.log("Disposing player...");
        this.player.dispose();
      }
    } catch (error) {
      console.error("Error disposing player:", error);
    }

    // Cleanup all enemies
    try {
      if (this.enemies) {
        console.log(`Disposing ${this.enemies.length} enemies...`);
        this.enemies.forEach((enemy) => enemy.dispose());
        this.enemies = [];
      }
    } catch (error) {
      console.error("Error disposing enemies:", error);
    }

    try {
      if (this.city) {
        console.log("Disposing city...");
        this.city.dispose();
      }
    } catch (error) {
      console.error("Error disposing city:", error);
    }

    try {
      if (this.desert) {
        console.log("Disposing desert...");
        this.desert.dispose();
      }
    } catch (error) {
      console.error("Error disposing desert:", error);
    }

    try {
      if (this.trafficManager) {
        console.log("Disposing traffic manager...");
        this.trafficManager.dispose();
      }
    } catch (error) {
      console.error("Error disposing traffic manager:", error);
    }

    try {
      if (this.skidMarkSystem) {
        console.log("Disposing skid mark system...");
        this.skidMarkSystem.dispose();
      }
    } catch (error) {
      console.error("Error disposing skid mark system:", error);
    }

    console.log("✅ All game objects cleaned up");
  }

  /**
   * Cleanup and dispose of all resources
   */
  dispose() {
    console.log("🧹 Cleaning up game...");

    if (this.gameLoop) this.gameLoop.stop();

    this._cleanupGameObjects();

    if (this.inputManager) this.inputManager.dispose();
    if (this.hud) this.hud.dispose();
    if (this.menuSystem) this.menuSystem.dispose();
    if (this.engine) this.engine.dispose();

    console.log("✅ Game cleaned up");
  }
}

/**
 * Initialize and start the game when DOM is ready
 */
window.addEventListener("DOMContentLoaded", async () => {
  console.log("🎮 Chase Escape - Loading...");

  const game = new Game();
  await game.init();

  // Make game instance globally accessible for debugging
  window.game = game;
});

export default Game;
