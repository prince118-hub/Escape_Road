/**
 * MenuSystem - Manages game menus and states
 * Responsibility: Handle main menu, pause menu, game over screen
 * Provides callbacks for menu actions
 */

export class MenuSystem {
  constructor() {
    // Menu containers
    this.mainMenu = null;
    this.pauseMenu = null;
    this.gameOverMenu = null;

    // Callbacks
    this.onStartGame = null;
    this.onResumeGame = null;
    this.onRestartGame = null;

    // Background music
    this.menuMusic = null;
    this._initMenuMusic();

    this._createMenus();
  }

  /**
   * Initialize menu background music
   * @private
   */
  _initMenuMusic() {
    this.menuMusic = new Audio(
      "/background_music/Sport Rock Racing by Infraction [No Copyright Music]  Hit Someone.mp3"
    );
    this.menuMusic.loop = true;
    this.menuMusic.volume = 0.3;
    this.musicReady = false;
    
    // Preload the audio
    this.menuMusic.load();
    
    // Add error handler to debug loading issues
    this.menuMusic.addEventListener('error', (e) => {
      console.error('❌ Failed to load menu music:', e);
      console.error('Attempted path:', this.menuMusic.src);
    });
    
    this.menuMusic.addEventListener('canplaythrough', () => {
      console.log('✅ Menu music loaded successfully');
    });
  }

  /**
   * Try to play menu music (handles autoplay policy)
   * @private
   */
  async playMenuMusic() {
    if (!this.menuMusic) return;
    if (this.musicReady) return; // Already playing
    
    this.menuMusic.currentTime = 0;
    
    try {
      // First try: Play with sound
      await this.menuMusic.play();
      this.musicReady = true;
      console.log('🎵 Menu music playing with sound');
    } catch (err) {
      console.log('⏸️ Waiting for user interaction to play music...');
      
      // Play on ANY user interaction
      const startMusic = async () => {
        if (this.musicReady) return;
        
        try {
          this.menuMusic.currentTime = 0;
          await this.menuMusic.play();
          this.musicReady = true;
          console.log('🎵 Menu music started!');
          
          // Remove all listeners
          document.removeEventListener('click', startMusic);
          document.removeEventListener('keydown', startMusic);
          document.removeEventListener('mousemove', startMusic);
          document.removeEventListener('touchstart', startMusic);
        } catch (playErr) {
          console.warn('Failed to start music:', playErr.message);
        }
      };
      
      // Listen to multiple interaction types
      document.addEventListener('click', startMusic, { once: true });
      document.addEventListener('keydown', startMusic, { once: true });
      document.addEventListener('mousemove', startMusic, { once: true });
      document.addEventListener('touchstart', startMusic, { once: true });
    }
  }

  /**
   * Create all menu screens
   * @private
   */
  _createMenus() {
    this._createMainMenu();
    this._createPauseMenu();
    this._createGameOverMenu();
  }

  /**
   * Create main menu
   * @private
   */
  _createMainMenu() {
    this.mainMenu = this._createMenuContainer("main-menu");

    const title = this._createElement(
      "h1",
      `
        font-size: 72px;
        margin-bottom: 20px;
        color: #FF3366;
        text-shadow: 4px 4px 8px rgba(0,0,0,0.8);
        font-weight: bold;
      `,
      "🚗 CHASE ESCAPE"
    );
    this.mainMenu.appendChild(title);

    const subtitle = this._createElement(
      "p",
      `
        font-size: 24px;
        margin-bottom: 40px;
        color: white;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      `,
      "Outrun the police and survive!"
    );
    this.mainMenu.appendChild(subtitle);

    const startButton = this._createButton("START GAME", () => {
      this.hideMainMenu();
      if (this.onStartGame) this.onStartGame();
    });
    this.mainMenu.appendChild(startButton);

    const instructions = this._createElement(
      "div",
      `
        margin-top: 60px;
        font-size: 16px;
        color: #ccc;
        text-align: left;
        max-width: 500px;
        background: rgba(0,0,0,0.6);
        padding: 20px;
        border-radius: 10px;
      `,
      `
        <strong>HOW TO PLAY:</strong><br><br>
        • Use Arrow Keys or WASD to drive<br>
        • Press SPACE for speed boost<br>
        • Avoid obstacles and the police<br>
        • Survive as long as possible<br>
        • Difficulty increases over time
      `
    );
    this.mainMenu.appendChild(instructions);

    document.body.appendChild(this.mainMenu);
  }

  /**
   * Create pause menu
   * @private
   */
  _createPauseMenu() {
    this.pauseMenu = this._createMenuContainer("pause-menu");
    this.pauseMenu.style.display = "none";

    const title = this._createElement(
      "h1",
      `
        font-size: 64px;
        margin-bottom: 40px;
        color: white;
        text-shadow: 4px 4px 8px rgba(0,0,0,0.8);
      `,
      "PAUSED"
    );
    this.pauseMenu.appendChild(title);

    const resumeButton = this._createButton("RESUME", () => {
      this.hidePauseMenu();
      if (this.onResumeGame) this.onResumeGame();
    });
    this.pauseMenu.appendChild(resumeButton);

    const hint = this._createElement(
      "p",
      `
        margin-top: 30px;
        font-size: 18px;
        color: #ccc;
      `,
      "Press ESC to resume"
    );
    this.pauseMenu.appendChild(hint);

    document.body.appendChild(this.pauseMenu);
  }

  /**
   * Create game over menu
   * @private
   */
  _createGameOverMenu() {
    this.gameOverMenu = this._createMenuContainer("gameover-menu");
    this.gameOverMenu.style.display = "none";

    const title = this._createElement(
      "h1",
      `
        font-size: 64px;
        margin-bottom: 20px;
        color: #FF3366;
        text-shadow: 4px 4px 8px rgba(0,0,0,0.8);
      `,
      "GAME OVER"
    );
    this.gameOverMenu.appendChild(title);

    // Stats container (will be updated dynamically)
    this.gameOverStats = this._createElement(
      "div",
      `
        font-size: 24px;
        margin-bottom: 40px;
        color: white;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        background: rgba(0,0,0,0.6);
        padding: 20px;
        border-radius: 10px;
      `,
      ""
    );
    this.gameOverMenu.appendChild(this.gameOverStats);

    const restartButton = this._createButton("PLAY AGAIN", () => {
      console.log("🎮 PLAY AGAIN button clicked");
      this.hideGameOverMenu();
      if (this.onRestartGame) {
        console.log("📞 Calling onRestartGame callback");
        this.onRestartGame();
      } else {
        console.error("❌ onRestartGame callback not set!");
      }
    });
    this.gameOverMenu.appendChild(restartButton);

    document.body.appendChild(this.gameOverMenu);
  }

  /**
   * Helper to create menu container
   * @private
   */
  _createMenuContainer(id) {
    const container = document.createElement("div");
    container.id = id;
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.85);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      font-family: 'Arial', sans-serif;
      text-align: center;
    `;
    return container;
  }

  /**
   * Helper to create a button
   * @private
   */
  _createButton(text, onClick) {
    const button = document.createElement("button");
    button.innerHTML = text;
    button.style.cssText = `
      font-size: 28px;
      padding: 15px 40px;
      margin: 10px;
      background: linear-gradient(135deg, #FF3366, #FF6600);
      color: white;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      transition: transform 0.2s, box-shadow 0.2s;
    `;

    button.addEventListener("mouseenter", () => {
      button.style.transform = "scale(1.05)";
      button.style.boxShadow = "0 6px 12px rgba(0,0,0,0.4)";
    });

    button.addEventListener("mouseleave", () => {
      button.style.transform = "scale(1)";
      button.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
    });

    button.addEventListener("click", onClick);

    return button;
  }

  /**
   * Helper to create a DOM element
   * @private
   */
  _createElement(tag, styleString, innerHTML = "") {
    const element = document.createElement(tag);
    element.style.cssText = styleString;
    element.innerHTML = innerHTML;
    return element;
  }

  // Show/hide methods
  showMainMenu() {
    this.mainMenu.style.display = "flex";
    // Start menu music immediately
    console.log('🎵 Attempting to play menu music...');
    this.playMenuMusic();
  }

  hideMainMenu() {
    this.mainMenu.style.display = "none";
    // Stop menu music
    if (this.menuMusic) {
      this.menuMusic.pause();
    }
  }

  showPauseMenu() {
    this.pauseMenu.style.display = "flex";
  }

  hidePauseMenu() {
    this.pauseMenu.style.display = "none";
  }

  showGameOverMenu(stats) {
    // Update stats display
    this.gameOverStats.innerHTML = `
      <strong>FINAL SCORE: ${stats.totalScore.toLocaleString()}</strong><br><br>
      Survival Time: ${this._formatTime(stats.survivalTime)}<br>
      Distance: ${Math.floor(stats.distance)} units
    `;

    this.gameOverMenu.style.display = "flex";
    
    // Start menu music on game over
    this.playMenuMusic();
  }

  hideGameOverMenu() {
    this.gameOverMenu.style.display = "none";
    // Stop menu music
    if (this.menuMusic) {
      this.menuMusic.pause();
    }
  }

  /**
   * Format time helper
   * @private
   */
  _formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  // Register callbacks
  setOnStartGame(callback) {
    this.onStartGame = callback;
  }

  setOnResumeGame(callback) {
    this.onResumeGame = callback;
  }

  setOnRestartGame(callback) {
    this.onRestartGame = callback;
  }

  /**
   * Cleanup menus
   */
  dispose() {
    // Stop and cleanup music
    if (this.menuMusic) {
      this.menuMusic.pause();
      this.menuMusic = null;
    }
    
    [this.mainMenu, this.pauseMenu, this.gameOverMenu].forEach((menu) => {
      if (menu && menu.parentElement) {
        menu.parentElement.removeChild(menu);
      }
    });
  }
}
