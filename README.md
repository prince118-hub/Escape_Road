# Escape Road

A high-intensity 3D car chase survival game built with Three.js, where players must evade an escalating police pursuit through a dynamic urban environment.

## Overview

Escape Road is an action-packed, browser-based 3D game that combines fast-paced driving mechanics with survival gameplay. Built using modern web technologies and the Three.js graphics library, the game delivers an immersive experience where players navigate through city streets, dodging obstacles and outrunning police cars in an endless chase.

The game features a sophisticated wanted system inspired by classic open-world games, where the intensity of police pursuit increases the longer you survive. With dynamic difficulty scaling, realistic physics, traffic simulation, and a rich visual environment including city buildings, street furniture, and desert landscapes, Escape Road challenges players to test their reflexes and strategic decision-making under pressure.

## Game Concept

Escape Road is an endless runner-style survival game with the following core mechanics:

- **Omnidirectional Movement**: Drive freely in any direction using WASD controls with smooth steering and acceleration
- **Dynamic Wanted System**: Police pursuit intensity escalates over time, spawning additional police cars as your wanted level increases (1-5 stars)
- **Boost Mechanic**: Strategic nitro boost system with cooldown management for quick escapes
- **Environmental Hazards**: Navigate through traffic, obstacles (barrels, cones), and city structures
- **Progressive Difficulty**: The game becomes increasingly challenging with faster police, more obstacles, and heightened pursuit
- **Score System**: Earn points based on survival time and distance traveled

## Storyline

You're a street racer who caught the attention of law enforcement during an illegal midnight run through the city. What started as a routine police encounter has escalated into an all-out chase. With sirens wailing behind you and the wanted level rising by the minute, your only objective is survival.

**Your Role**: An anonymous driver behind the wheel of a high-performance vehicle, desperately trying to evade capture.

**Your Objective**: Survive as long as possible, racking up distance and evading the increasingly aggressive police pursuit. Navigate through city streets, avoid obstacles, outmaneuver traffic, and use your boost strategically to stay ahead of the law. The longer you survive, the higher your wanted level climbs, bringing more heat down on you. Can you escape the road, or will the chase finally catch up to you?

## Features

- **3D Graphics**: Powered by Three.js with optimized rendering for smooth performance
- **Realistic Physics**: Momentum-based movement with drift mechanics and skid marks
- **AI Pursuit**: Intelligent police cars that adapt their strategy based on player position
- **Sound System**: Background music and sound effects for an immersive experience
- **Visual Effects**: Particle systems, skid marks, and dynamic camera following
- **Progressive Gameplay**: Difficulty scales with survival time through the DifficultyManager
- **Multiple Environments**: City landscape with buildings and desert terrain
- **Traffic System**: Dynamic traffic cars that add complexity to navigation
- **Responsive UI**: HUD displaying speed, score, wanted level, and boost status

## Installation and Setup

### Prerequisites

Before running the project, ensure you have the following installed:

- **Node.js** (version 14.x or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn** package manager
- A modern web browser (Chrome, Firefox, Edge, or Safari)

### Installation Steps

1. **Clone or Download the Repository**

   ```bash
   git clone <repository-url>
   cd Escape_Road
   ```

2. **Install Dependencies**

   Navigate to the project directory and install the required packages:

   ```bash
   npm install
   ```

   This will install:

   - Three.js (3D graphics library)
   - Vite (development server and build tool)

3. **Verify Installation**

   Ensure all dependencies are properly installed by checking your `node_modules` folder.

## Running the Game

### Development Mode

To run the game in development mode with hot-reload:

```bash
npm run dev
```

This will start the Vite development server. The game will be available at:

```
http://localhost:5173
```

The browser should automatically open. If not, manually navigate to the URL above.

### Production Build

To create an optimized production build:

```bash
npm run build
```

The optimized files will be generated in the `dist` folder.

### Preview Production Build

To preview the production build locally:

```bash
npm run preview
```

### Alternative Method (Simple HTTP Server)

If you prefer using Python's built-in HTTP server:

```bash
npm run serve
```

This starts a server on `http://localhost:8000`

## How to Play

### Controls

- **W** - Accelerate forward
- **S** - Brake / Reverse
- **A** - Steer left
- **D** - Steer right
- **SPACE** - Activate nitro boost (when available)
- **ESC** - Pause game

### Gameplay Tips

1. **Manage Your Boost**: The boost has a cooldown - use it strategically to escape tight situations
2. **Watch Your Wanted Level**: More stars mean more aggressive police pursuit
3. **Avoid Obstacles**: Collisions will slow you down and make you vulnerable
4. **Navigate Traffic**: Traffic cars move in lanes - anticipate their movement
5. **Use the Environment**: Use buildings and obstacles to break line of sight with police
6. **Keep Moving**: Staying stationary makes you an easy target

### Objective

Survive as long as possible while evading police. Your score increases with distance traveled. The game ends when police cars catch you or you take too much damage.

## Project Structure

```
Escape_Road/
├── index.html              # Entry HTML file
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite configuration
├── src/
│   ├── main.js             # Game entry point
│   ├── core/               # Core engine (renderer, game loop)
│   ├── objects/            # Game entities (player, enemies, environment)
│   ├── systems/            # Game logic (collision, scoring, difficulty)
│   ├── controls/           # Input and camera management
│   ├── ui/                 # HUD and menu systems
│   └── utils/              # Constants and helper functions
├── public/
│   └── model/              # 3D models (GLTF/GLB files)
└── assets/                 # Additional game assets
```

## Technologies Used

- **Three.js** (v0.160.0) - 3D graphics rendering
- **Vite** (v5.0.0) - Build tool and development server
- **JavaScript (ES6+)** - Core programming language
- **HTML5 Canvas** - Rendering surface
- **CSS3** - UI styling

## Development

The project follows a modular architecture with clear separation of concerns:

- **Core Systems**: GameEngine handles Three.js setup, GameLoop manages the update cycle
- **Game Objects**: PlayerCar, EnemyChaser, City, Desert, TrafficCar
- **Game Systems**: CollisionSystem, WantedSystem, ScoreSystem, DifficultyManager, EffectsSystem
- **Controls**: InputManager for keyboard input, CameraController for camera following
- **UI**: HUD for in-game display, MenuSystem for menus

For detailed architecture documentation, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Authors

**ITE18 Project Team**

This project was developed as part of an academic assignment. All team members contributed to the design, development, and testing of the game.

---

_Escape Road_ - Where every second counts and the chase never ends.
