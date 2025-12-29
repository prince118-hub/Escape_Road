/**
 * EnemyChaser - AI-controlled police vehicle with omnidirectional movement and 3D model
 * Responsibility: Chase player using free-roaming movement, support multiple instances
 * Tank-style movement for isometric city chase
 */

import * as THREE from "three";
import { ENEMY_CONFIG, COLORS } from "../utils/constants.js";
import { lerp, clamp, distance2D } from "../utils/helpers.js";
import { modelLoader } from "../utils/modelLoader.js";

export class EnemyChaser {
  constructor(
    scene,
    playerRef,
    spawnOffset = { x: 0, z: 30 },
    cityRef = null,
    enemiesRef = null
  ) {
    this.scene = scene;
    this.playerRef = playerRef;
    this.cityRef = cityRef;
    this.enemiesRef = enemiesRef; // Optional reference to all police for cooperation

    // Physics state (omnidirectional)
    this.position = { x: spawnOffset.x, y: 0, z: spawnOffset.z };
    this.velocity = { x: 0, z: 0 };
    this.rotation = 0;
    this.speed = ENEMY_CONFIG.INITIAL_SPEED;
    this.targetRotation = 0;

    // AI state
    this.distanceToPlayer = 0;
    this.aggressionLevel = ENEMY_CONFIG.AGGRESSION_FACTOR;

    // Three.js mesh
    this.mesh = null;
    this.lights = [];
    this.lightBlinkTime = 0;
    this.modelLoaded = false;
    // Behavior state
    this.pursuitOffset = {
      // Give each police a unique lateral offset relative to player's heading
      x: (Math.random() - 0.5) * 10,
      z: (Math.random() - 0.5) * 4,
    };
    this.blockTimer = 0; // Active cutoff maneuver time
    this.skidMarkSystem = null; // Skid mark system reference
    this.skidMarkTimer = 0; // Timer to control skid mark frequency
    this.previousSpeed = 0; // Track previous speed for acceleration/braking detection

    // Siren audio
    this.sirenAudio = null;
    this._initSirenAudio();

    this._loadAndCreateMesh();
  }

  /**
   * Initialize siren audio for this police car
   * @private
   */
  _initSirenAudio() {
    this.sirenAudio = new Audio(
      "/audio/Police Car Siren Sound Effect.mp3"
    );
    this.sirenAudio.loop = true;
    this.sirenAudio.volume = 0; // Start at 0, will be updated based on distance
    this.sirenAudio.play().catch((err) => {
      console.warn("Could not play police siren:", err);
    });
  }

  /**
   * Load and create police car with 3D model and flashing lights
   * @private
   */
  async _loadAndCreateMesh() {
    try {
      const config = ENEMY_CONFIG;
      const model = await modelLoader.loadModel(
        "/model/police_car/policecar1.glb"
      );

      this.mesh = new THREE.Group();

      // Add the loaded model
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Scale and position the model
      // Use a smaller uniform scale so the police car matches road proportions
      model.scale.set(0.035, 0.035, 0.035);
      // Rotate model to face forward

      // Center the model so it sits properly on the road
      model.position.set(0, 0.8, -0.1);
      this.mesh.add(model);

      // Add police lights on top
      const lightGeometry = new THREE.BoxGeometry(0.25, 0.2, 0.25);

      const redLight = new THREE.Mesh(
        lightGeometry,
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
      );
      redLight.position.set(-0.4, ENEMY_CONFIG.HEIGHT * 0.9, -0.3);

      const blueLight = new THREE.Mesh(
        lightGeometry,
        new THREE.MeshBasicMaterial({ color: 0x0000ff })
      );
      blueLight.position.set(0.4, ENEMY_CONFIG.HEIGHT * 0.9, -0.3);

      this.lights = [redLight, blueLight];
      this.mesh.add(redLight);
      this.mesh.add(blueLight);

      this.mesh.position.set(this.position.x, 0.2, this.position.z);
      this.scene.add(this.mesh);
      this.modelLoaded = true;
    } catch (error) {
      console.error("Failed to load police car model:", error);
      this._createFallbackMesh();
    }
  }

  _createFallbackMesh() {
    const config = ENEMY_CONFIG;

    const bodyGeometry = new THREE.BoxGeometry(
      config.WIDTH,
      config.HEIGHT,
      config.LENGTH
    );
    const bodyMaterial = new THREE.MeshLambertMaterial({
      color: COLORS.ENEMY_CAR,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;

    const cabinGeometry = new THREE.BoxGeometry(
      config.WIDTH * 0.8,
      config.HEIGHT * 0.6,
      config.LENGTH * 0.45
    );
    const cabinMaterial = new THREE.MeshLambertMaterial({
      color: COLORS.POLICE_CABIN,
    });
    const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
    cabin.position.y = config.HEIGHT * 0.7;
    cabin.position.z = -0.3;
    cabin.castShadow = true;

    const lightGeometry = new THREE.BoxGeometry(0.35, 0.25, 0.35);
    const redLight = new THREE.Mesh(
      lightGeometry,
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    redLight.position.set(-0.4, config.HEIGHT * 1.5, -0.3);

    const blueLight = new THREE.Mesh(
      lightGeometry,
      new THREE.MeshBasicMaterial({ color: 0x0000ff })
    );
    blueLight.position.set(0.4, config.HEIGHT * 1.5, -0.3);

    this.lights = [redLight, blueLight];

    this.mesh = new THREE.Group();
    this.mesh.add(body);
    this.mesh.add(cabin);
    this.mesh.add(redLight);
    this.mesh.add(blueLight);

    this.mesh.position.set(this.position.x, config.HEIGHT / 2, this.position.z);
    this.scene.add(this.mesh);
    this.modelLoaded = true;
  }

  /**
   * Update enemy AI and movement
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    if (!this.modelLoaded || !this.mesh) return;

    if (this.blockTimer > 0) this.blockTimer -= deltaTime;
    const playerPos = this.playerRef.getPosition();

    // Calculate distance to player
    this.distanceToPlayer = distance2D(
      this.position.x,
      this.position.z,
      playerPos.x,
      playerPos.z
    );

    // Update AI behavior
    this._updatePursuitAI(playerPos, deltaTime);

    // Update position
    this._updatePosition(deltaTime);

    // Flash lights
    this._updateLights(deltaTime);

    // Update siren volume based on distance
    this._updateSirenVolume();

    // Update mesh
    this._updateMesh();

    // Create skid marks if conditions are met
    if (this.skidMarkSystem && this.modelLoaded) {
      this.skidMarkTimer += deltaTime;
      // Create marks every 0.05 seconds (20 times per second)
      if (this.skidMarkTimer >= 0.05) {
        const currentSpeed = Math.sqrt(
          this.velocity.x ** 2 + this.velocity.z ** 2
        );
        const speedDiff = currentSpeed - this.previousSpeed;

        // Calculate rotation difference (how sharply they're turning)
        let rotDiff = this.targetRotation - this.rotation;
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        const steering = Math.abs(rotDiff) / Math.PI; // Normalize to 0-1

        // Police cars skid when:
        // 1. Rapid acceleration during pursuit
        const isAccelerating = speedDiff > 0.25 && currentSpeed > 12;
        // 2. Hard braking to avoid obstacles or cornering
        const isBraking = speedDiff < -0.25 && currentSpeed > 8;
        // 3. Sharp turns during aggressive pursuit
        const isSharpTurn = steering > 0.35 && currentSpeed > 12;

        if (isAccelerating || isBraking || isSharpTurn) {
          this.skidMarkSystem.addCarSkidMarks(
            this.position,
            this.rotation,
            currentSpeed,
            steering,
            isBraking || isAccelerating,
            isSharpTurn
          );
        }

        this.previousSpeed = currentSpeed;
        this.skidMarkTimer = 0;
      }
    }
  }

  /**
   * Update pursuit AI logic (omnidirectional)
   * @private
   */
  _updatePursuitAI(playerPos, deltaTime) {
    const config = ENEMY_CONFIG;

    // Get player's velocity
    const pvx = this.playerRef.velocity?.x ?? 0;
    const pvz = this.playerRef.velocity?.z ?? 0;
    const playerSpeed = Math.sqrt(pvx * pvx + pvz * pvz);

    // Calculate distance to player
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const distToPlayer = Math.sqrt(dx * dx + dz * dz);

    // Predict where player will be (interception point)
    let lookAhead = 0.3; // Start conservative
    if (playerSpeed > 1) {
      // Scale prediction based on distance and player speed
      lookAhead = Math.min(2.0, distToPlayer / (playerSpeed * 15));
    }

    // Calculate interception point - where player is heading
    const intercept = {
      x: playerPos.x + pvx * lookAhead,
      z: playerPos.z + pvz * lookAhead,
    };

    // Get vector from police to player (direction to attack)
    const toPlayer = {
      x: dx / (distToPlayer || 1),
      z: dz / (distToPlayer || 1),
    };

    // Each police has a unique interceptor strategy:
    // Some try to get ahead, some try to flank
    const strategyVariant = (this.pursuitOffset.x + 10) / 20; // 0 to 1

    let target = { ...intercept };

    if (strategyVariant < 0.33) {
      // Strategy 1: Head-on blocker - aim directly at player's path ahead
      const blockDistance = 12;
      target.x = playerPos.x + toPlayer.x * blockDistance;
      target.z = playerPos.z + toPlayer.z * blockDistance;
    } else if (strategyVariant < 0.66) {
      // Strategy 2: Left flank - intercept from the side
      const perpX = -pvz / (playerSpeed || 1);
      const perpZ = pvx / (playerSpeed || 1);
      const flankDistance = 10;
      target.x = intercept.x + perpX * flankDistance;
      target.z = intercept.z + perpZ * flankDistance;
    } else {
      // Strategy 3: Right flank - intercept from opposite side
      const perpX = pvz / (playerSpeed || 1);
      const perpZ = -pvx / (playerSpeed || 1);
      const flankDistance = 10;
      target.x = intercept.x + perpX * flankDistance;
      target.z = intercept.z + perpZ * flankDistance;
    }

    // Aggressive pursuit: if close enough, get even more aggressive
    if (distToPlayer < 15) {
      // Reduce prediction time - be more direct
      target = {
        x: playerPos.x + pvx * 0.15,
        z: playerPos.z + pvz * 0.15,
      };
    }

    // Separation: steer away from nearby police to avoid stacking
    if (this.enemiesRef && Array.isArray(this.enemiesRef)) {
      let sepX = 0,
        sepZ = 0;
      const sepRadius = 8;
      for (const other of this.enemiesRef) {
        if (other === this) continue;
        const op = other.getPosition?.() ?? other.position;
        const dxo = this.position.x - op.x;
        const dzo = this.position.z - op.z;
        const d2 = dxo * dxo + dzo * dzo;
        if (d2 > 0 && d2 < sepRadius * sepRadius) {
          const d = Math.sqrt(d2);
          sepX += (dxo / d) * 3; // Stronger separation
          sepZ += (dzo / d) * 3;
        }
      }
      const sepWeight = 1.5;
      target.x += sepX * sepWeight;
      target.z += sepZ * sepWeight;
    }

    // Compute desired angle towards target
    const targetDx = target.x - this.position.x;
    const targetDz = target.z - this.position.z;
    this.targetRotation = Math.atan2(targetDx, targetDz);

    // Smoothly rotate towards target
    let rotDiff = this.targetRotation - this.rotation;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    this.rotation += rotDiff * config.ROTATION_SPEED;

    // Dynamic speed: be much more aggressive
    if (distToPlayer > config.MAX_DISTANCE - 10) {
      // Far away - chase at max speed
      this.speed = config.CATCH_UP_SPEED;
    } else if (distToPlayer < 8) {
      // Very close - maintain speed to corner the player
      this.speed = Math.max(
        this.speed - this.aggressionLevel * 0.5,
        config.INITIAL_SPEED
      );
    } else {
      // Mid-range - match player speed and be slightly faster
      const playerSpeed = this.playerRef.getSpeed();
      this.speed = lerp(
        this.speed,
        Math.max(playerSpeed + 5, config.INITIAL_SPEED * 1.2),
        0.04
      );
    }

    // Clamp speed
    this.speed = clamp(this.speed, config.INITIAL_SPEED, config.MAX_SPEED);
  }

  /**
   * Update position based on AI decisions
   * @private
   */
  _updatePosition(deltaTime) {
    // Calculate velocity
    this.velocity.x = Math.sin(this.rotation) * this.speed;
    this.velocity.z = Math.cos(this.rotation) * this.speed;

    // Store old position for collision resolution
    const oldX = this.position.x;
    const oldZ = this.position.z;

    // Update position
    this.position.x += this.velocity.x * deltaTime;
    this.position.z += this.velocity.z * deltaTime;

    // Check building collisions and resolve
    if (this.cityRef) {
      this._checkBuildingCollisions(oldX, oldZ);
    }
  }

  /**
   * Check and resolve collisions with buildings
   * Police cars stop smoothly and reroute instead of bouncing
   * @private
   */
  _checkBuildingCollisions(oldX, oldZ) {
    const buildings = this.cityRef.getBuildings();
    const policeBox = this.getBoundingBox();
    const policeRadius = 2.0;

    for (const building of buildings) {
      const halfWidth = building.geometry.parameters.width / 2 + policeRadius;
      const halfDepth = building.geometry.parameters.depth / 2 + policeRadius;

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

      // Check AABB collision
      if (
        policeBox.min.x < buildingBox.max.x &&
        policeBox.max.x > buildingBox.min.x &&
        policeBox.min.z < buildingBox.max.z &&
        policeBox.max.z > buildingBox.min.z
      ) {
        // Collision detected - SMOOTH STOP AND REROUTE

        // 1. Stop immediately to prevent penetration
        this.position.x = oldX;
        this.position.z = oldZ;
        this.velocity.x = 0;
        this.velocity.z = 0;

        // 2. Reduce speed smoothly (decelerate, don't stop instantly)
        this.speed = Math.max(
          this.speed * 0.3,
          ENEMY_CONFIG.INITIAL_SPEED * 0.5
        );

        // 3. Calculate smart reroute direction
        const buildingCenter = {
          x: (buildingBox.min.x + buildingBox.max.x) / 2,
          z: (buildingBox.min.z + buildingBox.max.z) / 2,
        };

        // Direction away from building
        const awayX = this.position.x - buildingCenter.x;
        const awayZ = this.position.z - buildingCenter.z;
        const awayDist = Math.sqrt(awayX * awayX + awayZ * awayZ);

        if (awayDist > 0.01) {
          // Calculate perpendicular directions (left and right relative to building)
          const perpLeftX = -awayZ / awayDist;
          const perpLeftZ = awayX / awayDist;
          const perpRightX = awayZ / awayDist;
          const perpRightZ = -awayX / awayDist;

          // Choose direction that's more aligned with player direction
          const playerPos = this.playerRef.getPosition();
          const toPlayerX = playerPos.x - this.position.x;
          const toPlayerZ = playerPos.z - this.position.z;

          const leftDot = perpLeftX * toPlayerX + perpLeftZ * toPlayerZ;
          const rightDot = perpRightX * toPlayerX + perpRightZ * toPlayerZ;

          // Choose better direction for pursuit
          let rerouteX, rerouteZ;
          if (leftDot > rightDot) {
            rerouteX = perpLeftX;
            rerouteZ = perpLeftZ;
          } else {
            rerouteX = perpRightX;
            rerouteZ = perpRightZ;
          }

          // Blend reroute direction with away-from-building direction for safety
          const blendFactor = 0.6; // 60% perpendicular, 40% away
          const finalX =
            rerouteX * blendFactor + (awayX / awayDist) * (1 - blendFactor);
          const finalZ =
            rerouteZ * blendFactor + (awayZ / awayDist) * (1 - blendFactor);

          // Set new rotation to face reroute direction
          this.rotation = Math.atan2(finalX, finalZ);
          this.targetRotation = this.rotation;
        } else {
          // Fallback: turn around 90 degrees
          this.rotation += Math.PI / 2;
          this.targetRotation = this.rotation;
        }

        // 4. Move slightly away from building to ensure clearance
        const clearanceDistance = 1.5;
        this.position.x += Math.sin(this.rotation) * clearanceDistance;
        this.position.z += Math.cos(this.rotation) * clearanceDistance;

        break; // Handle one collision at a time
      }
    }
  }

  /**
  /**
   * Flash police lights
   * @private
   */
  _updateLights(deltaTime) {
    this.lightBlinkTime += deltaTime;
    const blinkSpeed = 3; // Blinks per second

    if (Math.floor(this.lightBlinkTime * blinkSpeed) % 2 === 0) {
      this.lights[0].material.color.setHex(0xff0000);
      this.lights[1].material.color.setHex(0x000000);
    } else {
      this.lights[0].material.color.setHex(0x000000);
      this.lights[1].material.color.setHex(0x0000ff);
    }
  }

  /**
   * Update siren volume based on distance to player
   * @private
   */
  _updateSirenVolume() {
    if (!this.sirenAudio) return;

    // Calculate volume based on distance (0-100 units)
    const maxHearingDistance = 100; // Maximum distance to hear siren
    const minDistance = 5; // Distance for maximum volume

    // Clamp distance
    const effectiveDistance = Math.max(
      minDistance,
      Math.min(this.distanceToPlayer, maxHearingDistance)
    );

    // Calculate volume (inverse relationship with distance)
    // At minDistance: volume = 0.15 (max)
    // At maxHearingDistance: volume = 0
    const volume =
      0.15 *
      (1 -
        (effectiveDistance - minDistance) / (maxHearingDistance - minDistance));

    this.sirenAudio.volume = Math.max(0, Math.min(0.15, volume));
  }

  /**
   * Pause the siren audio
   */
  pauseSiren() {
    if (this.sirenAudio) {
      this.sirenAudio.pause();
    }
  }

  /**
   * Resume the siren audio
   */
  resumeSiren() {
    if (this.sirenAudio) {
      this.sirenAudio.play().catch((err) => {
        console.warn("Could not resume police siren:", err);
      });
    }
  }
  /**
   * Update Three.js mesh
   * @private
   */
  _updateMesh() {
    if (this.mesh) {
      this.mesh.position.set(this.position.x, 0.2, this.position.z);
      // The loaded model is rotated by Math.PI to face forward,
      // so the group rotation should match `this.rotation` directly.
      this.mesh.rotation.y = this.rotation;
    }
  }

  /**
   * Increase difficulty over time
   * @param {number} difficultyMultiplier - Multiplier for speed increase
   */
  scaleDifficulty(difficultyMultiplier) {
    this.aggressionLevel =
      ENEMY_CONFIG.AGGRESSION_FACTOR * (1 + difficultyMultiplier * 0.5);
  }

  /**
   * Get bounding box for collision detection
   */
  getBoundingBox() {
    // Enlarged bounding box with padding to ensure no pass-through
    const padding = 0.5; // Extra padding for safety
    return {
      min: {
        x: this.position.x - (ENEMY_CONFIG.WIDTH / 2 + padding),
        y: 0,
        z: this.position.z - (ENEMY_CONFIG.LENGTH / 2 + padding),
      },
      max: {
        x: this.position.x + (ENEMY_CONFIG.WIDTH / 2 + padding),
        y: ENEMY_CONFIG.HEIGHT,
        z: this.position.z + (ENEMY_CONFIG.LENGTH / 2 + padding),
      },
    };
  }

  /**
   * Get current position
   */
  getPosition() {
    return { ...this.position };
  }

  /**
   * Set skid mark system reference
   */
  setSkidMarkSystem(system) {
    this.skidMarkSystem = system;
  }

  /**
   * Get distance to player
   */
  getDistanceToPlayer() {
    return this.distanceToPlayer;
  }

  /**
   * Cleanup resources
   */
  dispose() {
    // Stop and cleanup siren
    if (this.sirenAudio) {
      this.sirenAudio.pause();
      this.sirenAudio = null;
    }

    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
  }
}
