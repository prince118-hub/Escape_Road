/**
 * Game Configuration Constants
 * Centralized configuration for easy tuning and maintenance
 */

export const GAME_CONFIG = {
  // Rendering
  CANVAS_WIDTH: window.innerWidth,
  CANVAS_HEIGHT: window.innerHeight,
  FOV: 75,
  NEAR_PLANE: 0.1,
  FAR_PLANE: 1000,

  // Camera (Isometric view)
  CAMERA_OFFSET: { x: 0, y: 40, z: 40 },
  CAMERA_ANGLE: -Math.PI / 4,
  CAMERA_FOLLOW_SMOOTHING: 0.08,

  // Performance
  TARGET_FPS: 60,
  PHYSICS_STEP: 1 / 60,
  ENABLE_SHADOWS: false, // DISABLED for performance
  MAX_LIGHTS: 1, // Reduced from unlimited

  // World
  WORLD_SIZE: 200,
};

export const PLAYER_CONFIG = {
  MAX_SPEED: 28,
  AUTO_FORWARD_SPEED: 22,
  ACCELERATION: 0.8,
  DECELERATION: 0.4,
  ROTATION_SPEED: 0.1,
  DRIFT_FACTOR: 0.92,
  BOOST_MULTIPLIER: 1.8,
  BOOST_DURATION: 2000,
  BOOST_COOLDOWN: 5000,
  WIDTH: 2,
  HEIGHT: 1.2,
  LENGTH: 3.5,
  MAX_HEALTH: 100,
  COLLISION_DAMAGE: 25,
};

export const ENEMY_CONFIG = {
  INITIAL_SPEED: 18, // Slightly faster base speed
  CATCH_UP_SPEED: 23, // Good catchup speed when far away
  MIN_DISTANCE: 8,
  MAX_DISTANCE: 50,
  ROTATION_SPEED: 0.06,
  AGGRESSION_FACTOR: 0.03,
  INITIAL_COUNT: 3,
  MAX_COUNT: 8,
  SPAWN_INTERVAL: 20000,
  SPEED_INCREASE_RATE: 0.001,
  MAX_SPEED: 32, // Slightly faster than player's normal speed (28) but slower than boost
  WIDTH: 2.2,
  HEIGHT: 1.2,
  LENGTH: 4,
};

// Wanted level system (GTA-style stars)
export const WANTED_CONFIG = {
  MAX_WANTED_LEVEL: 5, // Maximum 5 stars
  WANTED_THRESHOLDS: [0, 20, 40, 70, 100], // Time in seconds to reach each star (faster progression)
  BASE_POLICE_COUNT: 5, // Initial police count at 1 star
  POLICE_PER_STAR: 5, // Additional 3 police for each star level (more aggressive)
  BASE_SPAWN_INTERVAL: 8, // Base time (seconds) between police spawns (faster)
  SPAWN_INTERVAL_REDUCTION: 1.5, // Reduce interval by this much per star
  MIN_SPAWN_INTERVAL: 2, // Minimum time between spawns (at 5 stars - very aggressive)
};

export const WORLD_CONFIG = {
  SIZE: 200,
  GROUND_COLOR: 0x7a7a7a, // Urban concrete
  ROAD_COLOR: 0x2a2a2a, // Dark asphalt
  BUILDING_COUNT: 80, // Fill all green zones
  BUILDING_MIN_SIZE: { width: 8, height: 8, depth: 8 },
  BUILDING_MAX_SIZE: { width: 14, height: 25, depth: 14 },
  BUILDING_SPACING: 3, // Minimum spacing between buildings
  ROAD_WIDTH: 16, // Width of roads to avoid
};

export const OBSTACLE_CONFIG = {
  INITIAL_SPAWN_RATE: 2000,
  MIN_SPAWN_RATE: 800,
  SPAWN_RATE_DECREASE: 50,
  TYPES: {
    STATIC: "static",
    MOVING: "moving",
    BARREL: "barrel",
    TRAFFIC_CONE: "cone",
  },
  MOVING_OBSTACLE_CHANCE: 0.3,
  SPEED_RANGE: { min: 5, max: 15 },
};

export const SCORING_CONFIG = {
  DISTANCE_MULTIPLIER: 10,
  SURVIVAL_BONUS: 5,
  NEAR_MISS_BONUS: 50,
  NEAR_MISS_THRESHOLD: 3,
};

export const COLLISION_CONFIG = {
  CHECK_INTERVAL: 16,
  BOUNDING_BOX_PADDING: 0.1,
  SLOWDOWN_FACTOR: 0.5,
  SLOWDOWN_DURATION: 1000,
};

export const DIFFICULTY_CONFIG = {
  INCREASE_INTERVAL: 30000,
  STAGES: [
    { level: 1, enemySpeed: 18, obstacleRate: 2000 },
    { level: 2, enemySpeed: 20, obstacleRate: 1600 },
    { level: 3, enemySpeed: 22, obstacleRate: 1300 },
    { level: 4, enemySpeed: 24, obstacleRate: 1000 },
    { level: 5, enemySpeed: 26, obstacleRate: 800 },
  ],
};

export const COLORS = {
  PLAYER_CAR: 0xff3366,
  ENEMY_CAR: 0x000000,
  POLICE_CABIN: 0x111111,
  OBSTACLE: 0xffaa33,
  ROAD: 0x2a2a2a,
  GRASS: 0x8a8a8a, // Urban concrete/pavement
  SKY: 0x87ceeb,
};

// Road visuals and spacing
export const ROAD_CONFIG = {
  VISIBLE_SEGMENTS: 8,
  SEGMENT_LENGTH: 90,
  SEGMENT_WIDTH: 18,
  LANE_WIDTH: 4,
  ROAD_COLOR: 0x2a2a2a, // Dark asphalt
  LANE_MARKER_COLOR: 0xeeeeee, // Slightly off-white for realism
  CENTER_LINE_COLOR: 0xffdd44, // Slightly warmer yellow
  CENTER_LINE_WIDTH: 0.35,
  CENTER_LINE_LENGTH: 5,
  CENTER_LINE_SPACING: 8,
};

export const INPUT_KEYS = {
  FORWARD: ["ArrowUp", "w", "W"],
  BACKWARD: ["ArrowDown", "s", "S"],
  LEFT: ["ArrowLeft", "a", "A"],
  RIGHT: ["ArrowRight", "d", "D"],
  BOOST: [" ", "Shift"],
  PAUSE: ["Escape", "p", "P"],
};
