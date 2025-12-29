/**
 * CollisionSystem - Handles collision detection and response
 * Responsibility: Detect collisions between player, obstacles, and enemy
 * Uses AABB (Axis-Aligned Bounding Box) collision detection
 */

import { checkAABBCollision, distance2D, clamp } from "../utils/helpers.js";
import { PLAYER_CONFIG, SCORING_CONFIG } from "../utils/constants.js";

export class CollisionSystem {
  constructor(
    playerRef,
    enemiesRef,
    cityRef = null,
    effectsSystem = null,
    soundSystem = null,
    trafficManagerRef = null
  ) {
    this.playerRef = playerRef;
    this.enemiesRef = enemiesRef; // Array of enemies
    this.cityRef = cityRef;
    this.effectsSystem = effectsSystem;
    this.soundSystem = soundSystem;
    this.trafficManagerRef = trafficManagerRef;

    // Collision cooldown to prevent multiple hits
    this.collisionCooldown = 0;
    this.cooldownDuration = 300; // ms

    // Callbacks for collision events
    this.onPlayerHitEnemy = null;
  }

  /**
   * Update collision detection
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    // Update cooldown
    if (this.collisionCooldown > 0) {
      this.collisionCooldown -= deltaTime * 1000;
    }

    // CRITICAL: Enforce player-police separation EVERY frame (not just on collision)
    // This prevents pass-through at high speeds
    this._enforcePlayerPoliceSeparation();

    // Check player vs enemy for effects/sounds
    this._checkPlayerEnemyCollision();

    // Check player vs traffic cars
    if (this.trafficManagerRef) {
      this._checkPlayerTrafficCollisions();
    }

    // Check player vs buildings
    if (this.cityRef) {
      this._checkPlayerBuildingCollisions();
      this._checkPlayerCityObstacleCollisions();
    }

    // Enforce solid inter-vehicle boundaries (traffic↔traffic, enemy↔traffic, enemy↔enemy)
    this._resolveInterVehicleCollisions(deltaTime);

    // Check if player is truly trapped (all directions blocked) - check more frequently near police
    if (this.enemiesRef && this.enemiesRef.length > 0) {
      this._checkPlayerTrapped(deltaTime);
    }
  }

  /**
   * Check collisions between player and obstacles
   * @private
   */
  _checkPlayerObstacleCollisions() {
    if (this.collisionCooldown > 0) return;

    const playerBox = this.playerRef.getBoundingBox();
    const obstacles = this.obstacleSpawnerRef.getObstacles();

    for (const obstacle of obstacles) {
      const obstacleBox = obstacle.getBoundingBox();

      if (checkAABBCollision(playerBox, obstacleBox)) {
        this._handlePlayerObstacleCollision(obstacle);
        break; // One collision per frame
      }
    }
  }

  _handlePlayerObstacleCollision(obstacle) {
    const playerPos = this.playerRef.getPosition();
    const obstaclePos = obstacle.getPosition();
    const collisionPos = {
      x: (playerPos.x + obstaclePos.x) / 2,
      y: 1,
      z: (playerPos.z + obstaclePos.z) / 2,
    };

    this.collisionCooldown = this.cooldownDuration;

    if (this.effectsSystem) {
      this.effectsSystem.createCollisionEffect(collisionPos, 0.8);
      this.effectsSystem.createSparks?.(collisionPos, {
        x: playerPos.x - obstaclePos.x,
        z: playerPos.z - obstaclePos.z,
      });
      this.effectsSystem.createDamageIndicator?.(
        collisionPos,
        PLAYER_CONFIG.COLLISION_DAMAGE
      );
    }

    if (this.soundSystem) {
      this.soundSystem.playCollisionSound(0.7);
    }

    const pushDirection = {
      x: playerPos.x - obstaclePos.x,
      z: playerPos.z - obstaclePos.z,
    };
    const pushMagnitude = Math.sqrt(
      pushDirection.x ** 2 + pushDirection.z ** 2
    );
    if (pushMagnitude > 0) {
      this.playerRef.velocity.x += (pushDirection.x / pushMagnitude) * 5;
      this.playerRef.velocity.z += (pushDirection.z / pushMagnitude) * 5;
    }

    obstacle.markedForRemoval = true;

    if (this.onPlayerHitObstacle) {
      this.onPlayerHitObstacle();
    }
  }

  /**
   * Check collision between player and buildings
   * @private
   */
  _checkPlayerBuildingCollisions() {
    // Skip building collision checks while car is in crash recovery
    if (this.playerRef.isCrashed) {
      return;
    }

    const playerBox = this.playerRef.getBoundingBox();
    const buildings = this.cityRef.getBuildings();
    const playerRadius = 1.5;

    for (const building of buildings) {
      const halfWidth = building.geometry.parameters.width / 2 + playerRadius;
      const halfDepth = building.geometry.parameters.depth / 2 + playerRadius;

      const buildingBox = {
        min: {
          x: building.position.x - halfWidth,
          y: 0,
          z: building.position.z - halfDepth,
        },
        max: {
          x: building.position.x + halfWidth,
          y: building.geometry.parameters.height,
          z: building.position.z + halfDepth,
        },
      };

      if (checkAABBCollision(playerBox, buildingBox)) {
        this._handlePlayerBuildingCollision(building, buildingBox);
        return; // Only handle one building collision at a time
      }
    }
  }

  /**
   * Handle player hitting a building
   * @private
   */
  _handlePlayerBuildingCollision(building, buildingBox) {
    const playerPos = this.playerRef.getPosition();
    const playerRadius = 1.5;

    // Calculate impact speed for visual/audio feedback
    const impactSpeed = Math.sqrt(
      this.playerRef.velocity.x ** 2 + this.playerRef.velocity.z ** 2
    );

    // IMMEDIATE COMPLETE STOP - no bouncing or sliding
    this.playerRef.velocity.x = 0;
    this.playerRef.velocity.z = 0;
    this.playerRef.speed = 0;

    // Calculate collision normal (direction away from building)
    const buildingCenter = {
      x: (buildingBox.min.x + buildingBox.max.x) / 2,
      z: (buildingBox.min.z + buildingBox.max.z) / 2,
    };

    const dx = playerPos.x - buildingCenter.x;
    const dz = playerPos.z - buildingCenter.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    const normalizedDx = distance > 0 ? dx / distance : 1;
    const normalizedDz = distance > 0 ? dz / distance : 0;

    // Determine which face was hit for precise positioning
    const buildingWidth = buildingBox.max.x - buildingBox.min.x;
    const buildingDepth = buildingBox.max.z - buildingBox.min.z;
    const absNormDx = Math.abs(dx) / buildingWidth;
    const absNormDz = Math.abs(dz) / buildingDepth;

    // Push player out of building to prevent penetration
    const minClearance = playerRadius + 0.5;
    if (absNormDx > absNormDz) {
      // Hit left or right side
      this.playerRef.position.x =
        normalizedDx > 0
          ? buildingBox.max.x + minClearance
          : buildingBox.min.x - minClearance;
    } else {
      // Hit front or back
      this.playerRef.position.z =
        normalizedDz > 0
          ? buildingBox.max.z + minClearance
          : buildingBox.min.z - minClearance;
    }

    // Calculate reverse direction ALONG CAR'S FACING DIRECTION (not collision normal)
    // This ensures realistic backing up behavior
    const carForwardX = Math.sin(this.playerRef.rotation);
    const carForwardZ = Math.cos(this.playerRef.rotation);

    // Reverse is opposite of car's facing direction
    this.playerRef.crashReverseDirection.x = -carForwardX;
    this.playerRef.crashReverseDirection.z = -carForwardZ;

    // Start smooth crash sequence: brief stop, then controlled reverse
    this.playerRef.isCrashed = true;
    this.playerRef.crashStunTimer = 0.2; // 200ms brief stop for impact feel
    this.playerRef.crashReverseTimer = 0.8; // 800ms smooth reverse

    // Extended cooldown to prevent re-collision during recovery
    this.collisionCooldown = 1200;

    // Visual effects based on impact
    const effectIntensity = Math.min(1.2, 0.4 + impactSpeed / 30);
    if (this.effectsSystem) {
      this.effectsSystem.createCollisionEffect(playerPos, effectIntensity);
      this.effectsSystem.createSparks(playerPos, {
        x: normalizedDx,
        z: normalizedDz,
      });
    }

    // Sound with intensity based on impact
    if (this.soundSystem) {
      const volume = Math.min(0.8, 0.3 + impactSpeed / 35);
      this.soundSystem.playCollisionSound(volume);
    }
  }

  /**
   * Check collision between player and enemy
   * @private
   */
  _checkPlayerEnemyCollision() {
    if (this.collisionCooldown > 0) return;

    const playerBox = this.playerRef.getBoundingBox();

    // Check all enemies
    for (const enemy of this.enemiesRef) {
      const enemyBox = enemy.getBoundingBox();
      if (checkAABBCollision(playerBox, enemyBox)) {
        this._handlePlayerEnemyCollision();
        break; // One collision per frame
      }
    }
  }

  /**
   * Handle player being caught by enemy (collision response only)
   * NEVER triggers game over - only trapped detection does that
   * @private
   */
  _handlePlayerEnemyCollision() {
    const playerPos = this.playerRef.getPosition();

    // Set cooldown
    this.collisionCooldown = this.cooldownDuration;

    // Create visual effects
    if (this.effectsSystem) {
      this.effectsSystem.createCollisionEffect(playerPos, 1.2);
    }

    // Play collision sound only (NO siren to prevent buzzing)
    if (this.soundSystem) {
      this.soundSystem.playCollisionSound(0.5);
    }

    // NO CALLBACKS - game over only via trapped detection
  }

  /**
   * Check for near misses with obstacles for bonus points
   * @private
   */
  _checkNearMisses() {
    const playerPos = this.playerRef.getPosition();
    const obstacles = this.obstacleSpawnerRef.getObstacles();

    for (const obstacle of obstacles) {
      const obstaclePos = obstacle.getPosition();

      // Only check obstacles roughly alongside player
      if (Math.abs(obstaclePos.z - playerPos.z) < 2) {
        const dist = distance2D(
          playerPos.x,
          playerPos.z,
          obstaclePos.x,
          obstaclePos.z
        );

        if (
          dist < SCORING_CONFIG.NEAR_MISS_THRESHOLD &&
          !obstacle.nearMissRegistered
        ) {
          obstacle.nearMissRegistered = true;

          if (this.onNearMiss) {
            this.onNearMiss(obstacle);
          }
        }
      }
    }
  }

  /**
   * Check collisions between player and traffic cars
   * @private
   */
  _checkPlayerTrafficCollisions() {
    if (this.collisionCooldown > 0) return;

    const playerBox = this.playerRef.getBoundingBox();
    const trafficCars = this.trafficManagerRef.getTrafficCars();

    for (const car of trafficCars) {
      const carBox = car.getBoundingBox();

      if (checkAABBCollision(playerBox, carBox)) {
        this._handlePlayerTrafficCollision(car);
        break;
      }
    }
  }

  /**
   * Handle player collision with traffic car with smooth stop-reverse
   * @private
   */
  _handlePlayerTrafficCollision(trafficCar) {
    const playerPos = this.playerRef.getPosition();
    const carPos = trafficCar.getPosition();

    // Calculate impact speed
    const impactSpeed = Math.sqrt(
      this.playerRef.velocity.x ** 2 + this.playerRef.velocity.z ** 2
    );

    // IMMEDIATE COMPLETE STOP - no bouncing
    this.playerRef.velocity.x = 0;
    this.playerRef.velocity.z = 0;
    this.playerRef.speed = 0;

    // Calculate separation direction
    const dx = playerPos.x - carPos.x;
    const dz = playerPos.z - carPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > 0.01) {
      // Push player slightly out to prevent overlap
      const separationDist = 2.5;
      this.playerRef.position.x = carPos.x + (dx / distance) * separationDist;
      this.playerRef.position.z = carPos.z + (dz / distance) * separationDist;
    }

    // Set reverse direction ALONG CAR'S FACING DIRECTION
    const carForwardX = Math.sin(this.playerRef.rotation);
    const carForwardZ = Math.cos(this.playerRef.rotation);

    this.playerRef.crashReverseDirection.x = -carForwardX;
    this.playerRef.crashReverseDirection.z = -carForwardZ;

    // Trigger smooth crash response
    this.playerRef.isCrashed = true;
    this.playerRef.crashStunTimer = 0.15; // Brief stop
    this.playerRef.crashReverseTimer = 0.6; // Quick reverse

    this.collisionCooldown = 800;

    // Effects and sound
    if (this.effectsSystem) {
      this.effectsSystem.createCollisionEffect(playerPos, 0.5);
    }

    if (this.soundSystem) {
      this.soundSystem.playCollisionSound(0.5);
    }

    // Apply small push to traffic car for realism
    if (trafficCar.velocity) {
      const pushForce = 3.0;
      trafficCar.velocity.x += (dx / distance) * pushForce;
      trafficCar.velocity.z += (dz / distance) * pushForce;
    }
  }

  /**
   * Check collisions between player and city obstacles
   * @private
   */
  _checkPlayerCityObstacleCollisions() {
    if (this.collisionCooldown > 0) return;

    const playerBox = this.playerRef.getBoundingBox();
    const cityObstacles = this.cityRef.getCityObstacles();

    for (const obstacle of cityObstacles) {
      if (checkAABBCollision(playerBox, obstacle.bounds)) {
        this._handlePlayerCityObstacleCollision(obstacle);
        break;
      }
    }
  }

  /**
   * Handle player collision with city obstacle
   * @private
   */
  _handlePlayerCityObstacleCollision(obstacle) {
    const playerPos = this.playerRef.getPosition();

    this.collisionCooldown = this.cooldownDuration;

    if (this.effectsSystem) {
      this.effectsSystem.createCollisionEffect(playerPos, 0.3);
    }

    if (this.soundSystem) {
      this.soundSystem.playCollisionSound(0.3);
    }

    // Push player back
    const obstacleCenterX = (obstacle.bounds.min.x + obstacle.bounds.max.x) / 2;
    const obstacleCenterZ = (obstacle.bounds.min.z + obstacle.bounds.max.z) / 2;

    const pushDirection = {
      x: playerPos.x - obstacleCenterX,
      z: playerPos.z - obstacleCenterZ,
    };
    const pushMagnitude = Math.sqrt(
      pushDirection.x ** 2 + pushDirection.z ** 2
    );
    if (pushMagnitude > 0) {
      this.playerRef.velocity.x += (pushDirection.x / pushMagnitude) * 4;
      this.playerRef.velocity.z += (pushDirection.z / pushMagnitude) * 4;
    }
  }

  /**
   * Register callback for player-obstacle collision
   * @param {Function} callback
   */
  setOnPlayerHitObstacle(callback) {
    this.onPlayerHitObstacle = callback;
  }

  /**
   * Register callback for player-enemy collision
   * @param {Function} callback
   */
  setOnPlayerHitEnemy(callback) {
    this.onPlayerHitEnemy = callback;
  }

  /**
   * Register callback for near miss
   * @param {Function} callback
   */
  setOnNearMiss(callback) {
    this.onNearMiss = callback;
  }

  /**
   * Compute minimal translation vector (MTV) for overlapping AABB boxes in XZ plane
   * Returns null if no overlap. Otherwise returns { x, z} with the smallest axis separation.
   * @private
   */
  _computeMTV2D(boxA, boxB) {
    const overlapX =
      Math.min(boxA.max.x, boxB.max.x) - Math.max(boxA.min.x, boxB.min.x);
    const overlapZ =
      Math.min(boxA.max.z, boxB.max.z) - Math.max(boxA.min.z, boxB.min.z);
    if (overlapX <= 0 || overlapZ <= 0) return null;

    const centerAx = (boxA.min.x + boxA.max.x) / 2;
    const centerAz = (boxA.min.z + boxA.max.z) / 2;
    const centerBx = (boxB.min.x + boxB.max.x) / 2;
    const centerBz = (boxB.min.z + boxB.max.z) / 2;

    // Choose the axis with smaller penetration
    if (overlapX < overlapZ) {
      const dir = centerAx < centerBx ? -1 : 1;
      return { x: dir * overlapX, z: 0 };
    } else {
      const dir = centerAz < centerBz ? -1 : 1;
      return { x: 0, z: dir * overlapZ };
    }
  }

  /**
   * Resolve collision between two vehicle objects using Newton's laws.
   * Implements realistic momentum transfer, action-reaction pairs, and elastic/inelastic collision physics.
   * @private
   */
  _resolveVehiclePair(objA, objB, options = {}) {
    const {
      elasticity = 0.4, // Coefficient of restitution (0=perfectly inelastic, 1=perfectly elastic)
      friction = 0.6,
      massA = 1,
      massB = 1,
      minSeparation = 0.25,
      pushStrength = 1.5,
    } = options;

    const boxA = objA.getBoundingBox();
    const boxB = objB.getBoundingBox();
    const mtv = this._computeMTV2D(boxA, boxB);
    if (!mtv) return false;

    // === NEWTON'S FIRST LAW: Position correction (separate overlapping objects) ===
    const totalMass = massA + massB;
    const moveAx = -(mtv.x * (massB / totalMass)) * pushStrength;
    const moveAz = -(mtv.z * (massB / totalMass)) * pushStrength;
    const moveBx = mtv.x * (massA / totalMass) * pushStrength;
    const moveBz = mtv.z * (massA / totalMass) * pushStrength;

    // Apply position corrections with separation buffer
    objA.position.x += moveAx + Math.sign(moveAx || 1) * minSeparation;
    objA.position.z += moveAz + Math.sign(moveAz || 1) * minSeparation;
    objB.position.x += moveBx + Math.sign(moveBx || 1) * minSeparation;
    objB.position.z += moveBz + Math.sign(moveBz || 1) * minSeparation;

    // === NEWTON'S THIRD LAW: Action-Reaction & Momentum Conservation ===
    // For every action, there's an equal and opposite reaction
    const hasVelA = objA.velocity && typeof objA.velocity.x === "number";
    const hasVelB = objB.velocity && typeof objB.velocity.x === "number";

    if (hasVelA && hasVelB) {
      // Both objects have velocity - apply Newton's collision laws
      const collisionNormal = {
        x: mtv.x !== 0 ? Math.sign(mtv.x) : 0,
        z: mtv.z !== 0 ? Math.sign(mtv.z) : 0,
      };

      // Relative velocity along collision normal
      const relVelX = objA.velocity.x - objB.velocity.x;
      const relVelZ = objA.velocity.z - objB.velocity.z;
      const relVelAlongNormal =
        relVelX * collisionNormal.x + relVelZ * collisionNormal.z;

      // Don't resolve if velocities are separating
      if (relVelAlongNormal > 0) return true;

      // Calculate impulse scalar (Newton's 2nd Law: F = ma, impulse = change in momentum)
      const impulseMagnitude =
        (-(1 + elasticity) * relVelAlongNormal) / totalMass;

      // Apply impulse to both objects (Newton's 3rd Law: equal and opposite)
      const impulseX = impulseMagnitude * collisionNormal.x;
      const impulseZ = impulseMagnitude * collisionNormal.z;

      // Change in velocity = impulse / mass
      objA.velocity.x += impulseX * massB;
      objA.velocity.z += impulseZ * massB;
      objB.velocity.x -= impulseX * massA;
      objB.velocity.z -= impulseZ * massA;

      // Apply friction to tangential velocity
      const tangentX = -collisionNormal.z;
      const tangentZ = collisionNormal.x;
      objA.velocity.x += tangentX * objA.velocity.x * (1 - friction);
      objA.velocity.z += tangentZ * objA.velocity.z * (1 - friction);
      objB.velocity.x += tangentX * objB.velocity.x * (1 - friction);
      objB.velocity.z += tangentZ * objB.velocity.z * (1 - friction);
    } else if (hasVelA) {
      // Only objA has velocity - transfer momentum based on elasticity
      const impactStrength = Math.sqrt(
        objA.velocity.x ** 2 + objA.velocity.z ** 2
      );
      const collisionNormal = {
        x: mtv.x !== 0 ? Math.sign(mtv.x) : 0,
        z: mtv.z !== 0 ? Math.sign(mtv.z) : 0,
      };

      // Reflect velocity with energy loss
      objA.velocity.x =
        objA.velocity.x * (1 - elasticity) -
        collisionNormal.x * impactStrength * elasticity;
      objA.velocity.z =
        objA.velocity.z * (1 - elasticity) -
        collisionNormal.z * impactStrength * elasticity;

      // Transfer some momentum to objB if it has speed property
      if (typeof objB.speed === "number") {
        objB.speed = clamp(
          objB.speed + impactStrength * 0.3,
          4,
          objB.speed * 1.5
        );
      }
    } else if (hasVelB) {
      // Only objB has velocity - transfer momentum based on elasticity
      const impactStrength = Math.sqrt(
        objB.velocity.x ** 2 + objB.velocity.z ** 2
      );
      const collisionNormal = {
        x: mtv.x !== 0 ? -Math.sign(mtv.x) : 0,
        z: mtv.z !== 0 ? -Math.sign(mtv.z) : 0,
      };

      // Reflect velocity with energy loss
      objB.velocity.x =
        objB.velocity.x * (1 - elasticity) -
        collisionNormal.x * impactStrength * elasticity;
      objB.velocity.z =
        objB.velocity.z * (1 - elasticity) -
        collisionNormal.z * impactStrength * elasticity;

      // Transfer some momentum to objA if it has speed property
      if (typeof objA.speed === "number") {
        objA.speed = clamp(
          objA.speed + impactStrength * 0.3,
          4,
          objA.speed * 1.5
        );
      }
    } else {
      // Neither has velocity, just reduce speed (for TrafficCar-style objects)
      if (typeof objA.speed === "number")
        objA.speed = clamp(objA.speed * friction, 4, objA.speed);
      if (typeof objB.speed === "number")
        objB.speed = clamp(objB.speed * friction, 4, objB.speed);
    }

    return true;
  }

  /**
   * Resolve collisions across all vehicles to prevent overlaps/clipping.
   * Applies Newton's laws with realistic mass-based physics and visible crashes.
   * @private
   */
  _resolveInterVehicleCollisions(deltaTime) {
    const trafficCars = this.trafficManagerRef?.getTrafficCars?.() || [];
    const enemies = this.enemiesRef || [];

    // traffic ↔ traffic (more elastic collisions, cars bounce off each other)
    for (let i = 0; i < trafficCars.length; i++) {
      for (let j = i + 1; j < trafficCars.length; j++) {
        this._resolveVehiclePair(trafficCars[i], trafficCars[j], {
          elasticity: 0.5, // More bouncy
          friction: 0.7,
          massA: 0.9,
          massB: 0.9,
          minSeparation: 0.3,
          pushStrength: 2.0, // Stronger separation
        });
      }
    }

    // enemy ↔ traffic (police are heavier, push traffic aside)
    for (const enemy of enemies) {
      for (const car of trafficCars) {
        this._resolveVehiclePair(enemy, car, {
          elasticity: 0.4,
          friction: 0.65,
          massA: 1.5, // Police heavier
          massB: 0.9,
          minSeparation: 0.35,
          pushStrength: 2.2,
        });
      }
    }

    // enemy ↔ enemy (police don't stack, strong separation)
    for (let i = 0; i < enemies.length; i++) {
      for (let j = i + 1; j < enemies.length; j++) {
        this._resolveVehiclePair(enemies[i], enemies[j], {
          elasticity: 0.3,
          friction: 0.75,
          massA: 1.5,
          massB: 1.5,
          minSeparation: 0.4,
          pushStrength: 2.5,
        });
      }
    }
  }

  /**
   * Check if player is completely boxed in by police cars.
   * Requires 3+ police cars surrounding the player with most directions blocked.
   * @private
   */
  _checkPlayerTrapped(deltaTime, immediate = false) {
    if (!immediate) {
      this._trappedCheckTimer = (this._trappedCheckTimer || 0) + deltaTime;
      if (this._trappedCheckTimer < 0.15) return; // Check every 150ms
      this._trappedCheckTimer = 0;
    }

    const playerPos = this.playerRef.getPosition();
    const enemies = this.enemiesRef || [];
    const buildings = this.cityRef?.getBuildings?.() || [];

    // Must have at least 3 police very close
    const closePolice = enemies.filter((e) => {
      const ePos = e.getPosition?.() || e.position;
      const dist = Math.sqrt(
        (playerPos.x - ePos.x) ** 2 + (playerPos.z - ePos.z) ** 2
      );
      return dist < 10;
    });

    if (closePolice.length < 3) {
      this._trapConfirmCount = 0;
      return; // Need 3 police minimum
    }

    // Test 8 world directions
    const testDist = 5.0;
    const policeBlockRadius = 5.0;
    const playerRadius = 2.5;

    const dirs = [
      { x: 1, z: 0, n: "E" },
      { x: -1, z: 0, n: "W" },
      { x: 0, z: 1, n: "N" },
      { x: 0, z: -1, n: "S" },
      { x: 0.707, z: 0.707, n: "NE" },
      { x: 0.707, z: -0.707, n: "SE" },
      { x: -0.707, z: 0.707, n: "NW" },
      { x: -0.707, z: -0.707, n: "SW" },
    ];

    let totalBlocked = 0;
    let policeBlocked = 0;
    const escapes = [];

    for (const d of dirs) {
      const testPos = {
        x: playerPos.x + d.x * testDist,
        z: playerPos.z + d.z * testDist,
      };
      let blocked = false;

      // Check police first (priority)
      for (const e of enemies) {
        const ep = e.getPosition?.() || e.position;
        const dist = Math.sqrt(
          (testPos.x - ep.x) ** 2 + (testPos.z - ep.z) ** 2
        );
        if (dist < policeBlockRadius) {
          blocked = true;
          policeBlocked++;
          break;
        }
      }

      // Also check buildings
      if (!blocked) {
        for (const b of buildings) {
          const hw = b.geometry.parameters.width / 2 + playerRadius;
          const hd = b.geometry.parameters.depth / 2 + playerRadius;
          if (
            testPos.x >= b.position.x - hw &&
            testPos.x <= b.position.x + hw &&
            testPos.z >= b.position.z - hd &&
            testPos.z <= b.position.z + hd
          ) {
            blocked = true;
            break;
          }
        }
      }

      if (blocked) {
        totalBlocked++;
      } else {
        escapes.push(d.n);
      }
    }

    // Debug when 3+ police present
    if (closePolice.length >= 3 && totalBlocked >= 6) {
      console.log(
        `Box: Police=${
          closePolice.length
        }, Blocked=${totalBlocked}/8 (P:${policeBlocked}), Escapes=[${escapes}], Count=${
          this._trapConfirmCount || 0
        }`
      );
    }

    // Relaxed: Need 6+ directions blocked AND at least 4 blocked by police
    if (totalBlocked < 6 || policeBlocked < 4) {
      this._trapConfirmCount = 0;
      return;
    }

    // Must have 3+ police forming the box
    if (closePolice.length < 3) {
      this._trapConfirmCount = 0;
      return;
    }

    // Instant trigger - no confirmation delay needed
    console.log(
      `🚔 BOXED IN: ${closePolice.length} police surrounded player, ${totalBlocked}/8 blocked (${policeBlocked} by police)`
    );
    this.playerRef.setTrapped();
    if (this.soundSystem) this.soundSystem.playSirenSound?.();
    this._trapConfirmCount = 0;
  }

  /**
   * Enforce player-police separation EVERY frame with building-aware collision resolution.
   * Prevents pass-through while avoiding clipping into buildings.
   * @private
   */
  _enforcePlayerPoliceSeparation() {
    if (!this.enemiesRef || this.enemiesRef.length === 0) return;

    const playerPos = this.playerRef.getPosition();
    const buildings = this.cityRef?.getBuildings?.() || [];
    const playerRadius = 2.5; // Player car collision radius

    // CRITICAL: Multi-pass collision resolution (2 passes per frame)
    // Reduced from 3 to prevent excessive force accumulation
    for (let pass = 0; pass < 2; pass++) {
      const playerBox = this.playerRef.getBoundingBox();

      for (const enemy of this.enemiesRef) {
        const enemyPos = enemy.getPosition();
        const enemyBox = enemy.getBoundingBox();

        // Calculate center-to-center distance
        const dx = playerPos.x - enemyPos.x;
        const dz = playerPos.z - enemyPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Minimum safe distance (sum of car lengths/widths + buffer)
        const minDist = 5.5; // Slightly reduced from 6.0 for less aggressive pushing

        // If ANY overlap or too close, apply controlled separation
        if (dist < minDist) {
          const overlap = minDist - dist;
          const nx = dist > 0.01 ? dx / dist : 1;
          const nz = dist > 0.01 ? dz / dist : 0;

          // Calculate proposed new player position
          const baseSeparationForce = overlap * 2.5; // Reduced from 5.5 for smoother response
          let proposedPlayerX = playerPos.x + nx * baseSeparationForce * 0.65;
          let proposedPlayerZ = playerPos.z + nz * baseSeparationForce * 0.65;

          // CHECK: Would this push player into a building?
          let wouldHitBuilding = false;
          for (const building of buildings) {
            const halfWidth = building.geometry.parameters.width / 2;
            const halfDepth = building.geometry.parameters.depth / 2;
            const buildingBuffer = playerRadius + 0.5; // Safety margin

            // Check if proposed position intersects building
            if (
              proposedPlayerX >=
                building.position.x - halfWidth - buildingBuffer &&
              proposedPlayerX <=
                building.position.x + halfWidth + buildingBuffer &&
              proposedPlayerZ >=
                building.position.z - halfDepth - buildingBuffer &&
              proposedPlayerZ <=
                building.position.z + halfDepth + buildingBuffer
            ) {
              wouldHitBuilding = true;
              break;
            }
          }

          if (wouldHitBuilding) {
            // SAFE MODE: Player is between police and building
            // Instead of pushing backward, apply minimal separation and let player control
            // This prevents violent clipping through buildings

            // Option 1: Try to slide the player parallel to the collision direction
            // Calculate perpendicular directions
            const perpX1 = -nz;
            const perpZ1 = nx;
            const perpX2 = nz;
            const perpZ2 = -nx;

            // Test both perpendicular directions to find a safe one
            const testDist = 1.5; // Small slide distance
            const perpPos1 = {
              x: playerPos.x + perpX1 * testDist,
              z: playerPos.z + perpZ1 * testDist,
            };
            const perpPos2 = {
              x: playerPos.x + perpX2 * testDist,
              z: playerPos.z + perpZ2 * testDist,
            };

            let canSlidePerpendicular1 = true;
            let canSlidePerpendicular2 = true;

            for (const building of buildings) {
              const halfWidth = building.geometry.parameters.width / 2;
              const halfDepth = building.geometry.parameters.depth / 2;
              const buildingBuffer = playerRadius + 0.5;

              if (
                perpPos1.x >=
                  building.position.x - halfWidth - buildingBuffer &&
                perpPos1.x <=
                  building.position.x + halfWidth + buildingBuffer &&
                perpPos1.z >=
                  building.position.z - halfDepth - buildingBuffer &&
                perpPos1.z <= building.position.z + halfDepth + buildingBuffer
              ) {
                canSlidePerpendicular1 = false;
              }

              if (
                perpPos2.x >=
                  building.position.x - halfWidth - buildingBuffer &&
                perpPos2.x <=
                  building.position.x + halfWidth + buildingBuffer &&
                perpPos2.z >=
                  building.position.z - halfDepth - buildingBuffer &&
                perpPos2.z <= building.position.z + halfDepth + buildingBuffer
              ) {
                canSlidePerpendicular2 = false;
              }
            }

            // Apply gentle slide in a safe perpendicular direction
            if (canSlidePerpendicular1) {
              this.playerRef.position.x += perpX1 * 0.3;
              this.playerRef.position.z += perpZ1 * 0.3;
            } else if (canSlidePerpendicular2) {
              this.playerRef.position.x += perpX2 * 0.3;
              this.playerRef.position.z += perpZ2 * 0.3;
            }

            // Apply minimal direct separation to prevent overlap (but won't push into building)
            const minimalForce = Math.min(baseSeparationForce * 0.15, 0.8);
            this.playerRef.position.x += nx * minimalForce;
            this.playerRef.position.z += nz * minimalForce;

            // Dampen player velocity significantly when trapped between police and building
            if (this.playerRef.velocity) {
              this.playerRef.velocity.x *= 0.5;
              this.playerRef.velocity.z *= 0.5;
            }
            if (this.playerRef.speed) {
              this.playerRef.speed *= 0.7;
            }

            // Push enemy away more since player can't move backward
            if (enemy.position) {
              enemy.position.x -= nx * baseSeparationForce * 0.6;
              enemy.position.z -= nz * baseSeparationForce * 0.6;
            }
          } else {
            // NORMAL MODE: Safe to push player backward
            this.playerRef.position.x = proposedPlayerX;
            this.playerRef.position.z = proposedPlayerZ;

            // Enemy gets pushed less (heavier)
            if (enemy.position) {
              enemy.position.x -= nx * baseSeparationForce * 0.35;
              enemy.position.z -= nz * baseSeparationForce * 0.35;
            }
          }
        }

        // Also apply velocity-based separation with AABB check (only if not in safe mode)
        if (checkAABBCollision(playerBox, enemyBox)) {
          // Check if player is already near a building before applying physics
          let nearBuilding = false;
          for (const building of buildings) {
            const halfWidth = building.geometry.parameters.width / 2;
            const halfDepth = building.geometry.parameters.depth / 2;
            const proximityCheck = playerRadius + 2.0;

            if (
              playerPos.x >= building.position.x - halfWidth - proximityCheck &&
              playerPos.x <= building.position.x + halfWidth + proximityCheck &&
              playerPos.z >= building.position.z - halfDepth - proximityCheck &&
              playerPos.z <= building.position.z + halfDepth + proximityCheck
            ) {
              nearBuilding = true;
              break;
            }
          }

          // Use gentler physics if near building, normal physics otherwise
          this._resolveVehiclePair(this.playerRef, enemy, {
            elasticity: nearBuilding ? 0.3 : 0.5,
            friction: nearBuilding ? 0.7 : 0.5,
            massA: 1.0,
            massB: 1.8, // Reduced from 2.0
            minSeparation: nearBuilding ? 0.4 : 0.6,
            pushStrength: nearBuilding ? 2.0 : 3.5, // Significantly reduced from 6.0
          });
        }
      }
    }
  }
}
