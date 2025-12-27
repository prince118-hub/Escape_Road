/**
 * EnemyChaser - AI-controlled police vehicle with omnidirectional movement
 * Responsibility: Chase player using free-roaming movement, support multiple instances
 * Tank-style movement for isometric city chase
 */

import * as THREE from "three";
import { ENEMY_CONFIG, COLORS } from "../utils/constants.js";
import { lerp, clamp, distance2D } from "../utils/helpers.js";

export class EnemyChaser {
  constructor(scene, playerRef, spawnOffset = { x: 0, z: 30 }, cityRef = null) {
    this.scene = scene;
    this.playerRef = playerRef;
    this.cityRef = cityRef;

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
    this.wheels = [];
    this.lights = [];
    this.lightBlinkTime = 0;
    this._createMesh();
  }

  /**
   * Create police car with wheels and flashing lights
   * @private
   */
  _createMesh() {
    const config = ENEMY_CONFIG;

    // Police car body (BLACK)
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

    // Police cabin (also black/dark gray)
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

    // Police light bar on top (red and blue)
    const lightBarGeometry = new THREE.BoxGeometry(
      config.WIDTH * 0.6,
      0.15,
      0.4
    );
    const lightBarMaterial = new THREE.MeshLambertMaterial({
      color: 0x222222,
    });
    const lightBar = new THREE.Mesh(lightBarGeometry, lightBarMaterial);
    lightBar.position.y = config.HEIGHT * 1.35;
    lightBar.position.z = -0.3;
    lightBar.castShadow = true;

    // Police lights (red and blue on top of light bar)
    const lightGeometry = new THREE.BoxGeometry(0.35, 0.25, 0.35);

    const redLight = new THREE.Mesh(
      lightGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xff0000,
      })
    );
    redLight.position.set(-0.4, config.HEIGHT * 1.5, -0.3);

    const blueLight = new THREE.Mesh(
      lightGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x0000ff,
      })
    );
    blueLight.position.set(0.4, config.HEIGHT * 1.5, -0.3);

    this.lights = [redLight, blueLight];

    // Create wheels
    this.wheels = this._createWheels();

    // Create group
    this.mesh = new THREE.Group();
    this.mesh.add(body);
    this.mesh.add(cabin);
    this.mesh.add(lightBar);
    this.mesh.add(redLight);
    this.mesh.add(blueLight);
    this.wheels.forEach((wheel) => this.mesh.add(wheel));

    // Position enemy with base at ground level (y = height/2)
    this.mesh.position.set(this.position.x, config.HEIGHT / 2, this.position.z);
    this.scene.add(this.mesh);
  }

  /**
   * Create animated wheels
   * @private
   */
  _createWheels() {
    const config = ENEMY_CONFIG;
    const wheels = [];
    const wheelGeometry = new THREE.CylinderGeometry(
      config.WHEEL_RADIUS,
      config.WHEEL_RADIUS,
      config.WHEEL_WIDTH,
      16
    );
    const wheelMaterial = new THREE.MeshLambertMaterial({
      color: 0x1a1a1a,
    });
    const wheelPositions = [
      [-config.WIDTH / 2 - 0.2, -config.HEIGHT / 3, config.LENGTH / 3],
      [config.WIDTH / 2 + 0.2, -config.HEIGHT / 3, config.LENGTH / 3],
      [-config.WIDTH / 2 - 0.2, -config.HEIGHT / 3, -config.LENGTH / 3],
      [config.WIDTH / 2 + 0.2, -config.HEIGHT / 3, -config.LENGTH / 3],
    ];
    wheelPositions.forEach((pos) => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos[0], pos[1], pos[2]);
      wheel.castShadow = true;
      wheels.push(wheel);
    });
    return wheels;
  }

  /**
   * Update enemy AI and movement
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
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

    // Animate wheels
    this._animateWheels(deltaTime);

    // Flash lights
    this._updateLights(deltaTime);

    // Update mesh
    this._updateMesh();
  }

  /**
   * Update pursuit AI logic (omnidirectional)
   * @private
   */
  _updatePursuitAI(playerPos, deltaTime) {
    const config = ENEMY_CONFIG;

    // Calculate angle to player
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    this.targetRotation = Math.atan2(dx, dz);

    // Smoothly rotate towards player
    let rotDiff = this.targetRotation - this.rotation;

    // Normalize angle difference to -PI to PI
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;

    this.rotation += rotDiff * config.ROTATION_SPEED;

    // Dynamic speed based on distance to player
    if (this.distanceToPlayer > config.MAX_DISTANCE) {
      this.speed = Math.min(
        this.speed + this.aggressionLevel,
        config.CATCH_UP_SPEED
      );
    } else if (this.distanceToPlayer < config.MIN_DISTANCE) {
      this.speed = Math.max(
        this.speed - this.aggressionLevel,
        config.INITIAL_SPEED * 0.5
      );
    } else {
      const playerSpeed = this.playerRef.getSpeed();
      this.speed = lerp(this.speed, playerSpeed + 2, 0.02);
    }

    // Clamp speed
    this.speed = clamp(
      this.speed,
      config.INITIAL_SPEED * 0.5,
      config.MAX_SPEED
    );
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
   * @private
   */
  _checkBuildingCollisions(oldX, oldZ) {
    const buildings = this.cityRef.getBuildings();
    const policeBox = this.getBoundingBox();

    for (const building of buildings) {
      const halfWidth = building.geometry.parameters.width / 2;
      const halfDepth = building.geometry.parameters.depth / 2;

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
        // Collision detected - resolve by moving back
        this.position.x = oldX;
        this.position.z = oldZ;

        // Bounce off in a different direction
        this.rotation += ((Math.random() - 0.5) * Math.PI) / 2;
        this.speed *= 0.5; // Slow down after collision
        break;
      }
    }
  }

  /**
   * Animate wheels based on speed
   * @private
   */
  _animateWheels(deltaTime) {
    const wheelRotationSpeed = this.speed * deltaTime * 2;
    this.wheels.forEach((wheel) => {
      wheel.rotation.x += wheelRotationSpeed;
    });
  }

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
   * Update Three.js mesh
   * @private
   */
  _updateMesh() {
    this.mesh.position.x = this.position.x;
    this.mesh.position.z = this.position.z;
    this.mesh.rotation.y = this.rotation;
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
    return {
      min: {
        x: this.position.x - ENEMY_CONFIG.WIDTH / 2,
        y: 0,
        z: this.position.z - ENEMY_CONFIG.LENGTH / 2,
      },
      max: {
        x: this.position.x + ENEMY_CONFIG.WIDTH / 2,
        y: ENEMY_CONFIG.HEIGHT,
        z: this.position.z + ENEMY_CONFIG.LENGTH / 2,
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
   * Get distance to player
   */
  getDistanceToPlayer() {
    return this.distanceToPlayer;
  }

  /**
   * Cleanup resources
   */
  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
  }
}
