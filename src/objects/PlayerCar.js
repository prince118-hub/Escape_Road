// New PlayerCar with omnidirectional movement and 3D model
import * as THREE from "three";
import { PLAYER_CONFIG, COLORS } from "../utils/constants.js";
import { clamp } from "../utils/helpers.js";
import { modelLoader } from "../utils/modelLoader.js";

export class PlayerCar {
  constructor(scene) {
    this.scene = scene;
    this.position = { x: 0, y: 0, z: 0 };
    this.velocity = { x: 0, z: 0 };
    this.rotation = Math.PI; // Start facing forward (negative Z direction) - Math.PI = 180 degrees
    this.speed = 0; // Current speed (starts at 0, accelerates over time)
    this.targetSpeed = 0; // Target speed to accelerate towards
    this.isAlive = true;
    this.boostActive = false;
    this.boostCooldownRemaining = 0;
    this.boostTimeRemaining = 0;
    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      boost: false,
    };
    this.distanceTraveled = 0;
    this.mesh = null;
    this.modelLoaded = false;
    this.isFalling = false;
    this.fallSpeed = 0;
    // Building collision crash state (physics-based crash system)
    this.isCrashed = false;
    this.crashStunTimer = 0; // Brief moment of being stunned after crash
    this.crashReverseTimer = 0; // Auto-reverse after stun
    this.crashReverseDirection = { x: 0, z: 0 };
    // Trapped state (completely cornered with no escape)
    this.isTrapped = false;
    this._loadAndCreateMesh();
  }

  async _loadAndCreateMesh() {
    try {
      // Load the 3D model
      const model = await modelLoader.loadModel(
        "/model/player_car/playercar1.glb"
      );

      this.mesh = new THREE.Group();

      // Add the loaded model to the group
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Scale and position the model appropriately
      // Increased scale for better visibility and proportions
      model.scale.set(2.3, 2.3, 2.3);
      // Rotate model to face forward (negative Z direction)
      // Most GLB models face +Z by default, so rotate 180 degrees
      model.rotation.y = Math.PI;

      this.mesh.add(model);

      // Position car with base at ground level
      const config = PLAYER_CONFIG;
      this.mesh.position.set(this.position.x, 0.2, this.position.z);
      this.mesh.rotation.y = this.rotation;

      this.scene.add(this.mesh);
      this.modelLoaded = true;
    } catch (error) {
      console.error("Failed to load player car model:", error);
      // Fallback to simple geometry
      this._createFallbackMesh();
    }
  }

  _createFallbackMesh() {
    const config = PLAYER_CONFIG;
    const bodyGeometry = new THREE.BoxGeometry(
      config.WIDTH,
      config.HEIGHT,
      config.LENGTH
    );
    const bodyMaterial = new THREE.MeshLambertMaterial({
      color: COLORS.PLAYER_CAR,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;

    const cabinGeometry = new THREE.BoxGeometry(
      config.WIDTH * 0.8,
      config.HEIGHT * 0.6,
      config.LENGTH * 0.4
    );
    const cabinMaterial = new THREE.MeshLambertMaterial({
      color: 0x880000,
    });
    const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
    cabin.position.y = config.HEIGHT * 0.7;
    cabin.position.z = -0.2;
    cabin.castShadow = true;

    this.mesh = new THREE.Group();
    this.mesh.add(body);
    this.mesh.add(cabin);

    const config2 = PLAYER_CONFIG;
    this.mesh.position.set(
      this.position.x,
      config2.HEIGHT / 2,
      this.position.z
    );
    this.scene.add(this.mesh);
    this.modelLoaded = true;
  }

  update(deltaTime) {
    if (!this.isAlive || !this.modelLoaded || !this.mesh) return;

    // Handle trapped state (fully cornered with no escape)
    if (this.isTrapped) {
      this.die();
      return;
    }

    // Handle falling animation
    if (this.isFalling) {
      this.updateFalling(deltaTime);
      this._updateMesh();
      return;
    }

    // Handle building crash physics (stun + auto-reverse)
    if (this.isCrashed) {
      // Phase 1: Stun - car is completely stopped, no control
      if (this.crashStunTimer > 0) {
        this.velocity.x = 0;
        this.velocity.z = 0;
        this.speed = 0;
        this.crashStunTimer -= deltaTime;

        // Visual feedback: shake the mesh slightly during stun
        if (this.mesh) {
          const shakeIntensity = 0.05;
          this.mesh.position.x =
            this.position.x + (Math.random() - 0.5) * shakeIntensity;
          this.mesh.position.z =
            this.position.z + (Math.random() - 0.5) * shakeIntensity;
        }

        this._updateMesh();
        return;
      }

      // Phase 2: Auto-reverse - smooth controlled backing away
      if (this.crashReverseTimer > 0) {
        const maxReverseSpeed = 12; // Controlled reverse speed
        const reverseProgress = 1.0 - this.crashReverseTimer / 0.8; // 0 to 1

        // Smooth acceleration curve: slow start, peak in middle, slow end
        let speedMultiplier;
        if (reverseProgress < 0.3) {
          // Accelerate smoothly (0 to 1)
          speedMultiplier = reverseProgress / 0.3;
        } else if (reverseProgress > 0.7) {
          // Decelerate smoothly (1 to 0)
          speedMultiplier = (1.0 - reverseProgress) / 0.3;
        } else {
          // Constant speed in middle
          speedMultiplier = 1.0;
        }

        const currentReverseSpeed = maxReverseSpeed * speedMultiplier;

        // Normalize reverse direction to ensure consistent movement
        const dirLength = Math.sqrt(
          this.crashReverseDirection.x ** 2 + this.crashReverseDirection.z ** 2
        );

        if (dirLength > 0.01) {
          const normX = this.crashReverseDirection.x / dirLength;
          const normZ = this.crashReverseDirection.z / dirLength;

          // Move strictly along reverse direction - no sliding
          this.position.x += normX * currentReverseSpeed * deltaTime;
          this.position.z += normZ * currentReverseSpeed * deltaTime;

          // Keep velocity synced for collision system
          this.velocity.x = normX * currentReverseSpeed;
          this.velocity.z = normZ * currentReverseSpeed;
        }

        this.speed = 0; // Prevent normal speed from interfering
        this.crashReverseTimer -= deltaTime;

        if (this.crashReverseTimer <= 0) {
          // Crash recovery complete - smooth transition back to normal
          this.isCrashed = false;
          this.crashReverseTimer = 0;
          this.crashStunTimer = 0;
          this.crashReverseDirection = { x: 0, z: 0 };

          // Gradual velocity decay instead of instant stop
          this.velocity.x *= 0.3;
          this.velocity.z *= 0.3;
        }

        this._updateMesh();
        return;
      }
    }

    this._updateBoost(deltaTime);
    this._applyInput(deltaTime);
    this._updatePosition(deltaTime);
    this._updateMesh();
    const distDelta =
      Math.sqrt(
        this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z
      ) * deltaTime;
    this.distanceTraveled += distDelta;
  }

  _applyInput(deltaTime) {
    const config = PLAYER_CONFIG;

    // Determine target speed based on input
    if (this.input.backward) {
      // Reverse movement (S key)
      this.targetSpeed = -config.AUTO_FORWARD_SPEED * 0.6; // 60% of forward speed for reverse
    } else {
      // Auto-forward movement
      this.targetSpeed = config.AUTO_FORWARD_SPEED;

      // Boost increases target speed (only when not reversing)
      if (this.boostActive) {
        this.targetSpeed = config.MAX_SPEED * config.BOOST_MULTIPLIER;
      }
    }

    // Accelerate towards target speed
    const acceleration = config.ACCELERATION * 60 * deltaTime; // Scale by deltaTime
    if (this.speed < this.targetSpeed) {
      // Accelerating forward or reducing reverse
      this.speed = Math.min(this.speed + acceleration, this.targetSpeed);
    } else if (this.speed > this.targetSpeed) {
      // Decelerating or accelerating in reverse
      this.speed = Math.max(this.speed - acceleration, this.targetSpeed);
    }

    // Clamp speed to max limits
    const maxForwardSpeed = this.boostActive
      ? config.MAX_SPEED * config.BOOST_MULTIPLIER
      : config.MAX_SPEED;
    const maxReverseSpeed = -config.AUTO_FORWARD_SPEED * 0.6;
    this.speed = clamp(this.speed, maxReverseSpeed, maxForwardSpeed);

    // Left/Right steering only
    if (this.input.left)
      this.rotation += config.ROTATION_SPEED * deltaTime * 60;
    if (this.input.right)
      this.rotation -= config.ROTATION_SPEED * deltaTime * 60;

    // Calculate velocity based on rotation (same system as enemy for consistency)
    // When rotation = Math.PI, car faces negative Z (forward direction)
    this.velocity.x = Math.sin(this.rotation) * this.speed;
    this.velocity.z = Math.cos(this.rotation) * this.speed;
  }

  _updatePosition(deltaTime) {
    // Apply friction/damping to prevent cars from sliding infinitely
    // This allows controlled deceleration when not moving
    const frictionFactor = 0.92; // 92% of velocity retained per frame

    this.position.x += this.velocity.x * deltaTime;
    this.position.z += this.velocity.z * deltaTime;

    // Apply damping to velocity (gradually reduce velocity over time)
    this.velocity.x *= frictionFactor;
    this.velocity.z *= frictionFactor;

    // Stop very small velocities to prevent endless sliding
    if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0;
    if (Math.abs(this.velocity.z) < 0.01) this.velocity.z = 0;
  }

  _updateMesh() {
    if (this.mesh) {
      this.mesh.position.set(this.position.x, 0.2, this.position.z);
      // Rotate the visible model 180 degrees (Math.PI) so it faces correctly
      this.mesh.rotation.y = this.rotation + Math.PI;
    }
  }

  _updateBoost(deltaTime) {
    if (this.boostCooldownRemaining > 0)
      this.boostCooldownRemaining -= deltaTime * 1000;
    if (
      this.input.boost &&
      this.boostCooldownRemaining <= 0 &&
      !this.boostActive
    )
      this.activateBoost();
    if (this.boostActive) {
      this.boostTimeRemaining -= deltaTime * 1000;
      if (this.boostTimeRemaining <= 0) this.deactivateBoost();
    }
  }

  activateBoost() {
    this.boostActive = true;
    this.boostTimeRemaining = PLAYER_CONFIG.BOOST_DURATION;
    // Create boost glow by brightening the car color
    if (
      this.mesh &&
      this.mesh.children[0] &&
      this.mesh.children[0].material &&
      this.mesh.children[0].material.color
    ) {
      this.mesh.children[0].material.color.setHex(0xff6633);
    }
  }

  deactivateBoost() {
    this.boostActive = false;
    this.boostCooldownRemaining = PLAYER_CONFIG.BOOST_COOLDOWN;
    // Restore original car color
    if (
      this.mesh &&
      this.mesh.children[0] &&
      this.mesh.children[0].material &&
      this.mesh.children[0].material.color
    ) {
      this.mesh.children[0].material.color.setHex(COLORS.PLAYER_CAR);
    }
  }

  die() {
    this.isAlive = false;
    this.speed = 0;
  }

  setTrapped() {
    if (!this.isTrapped) {
      this.isTrapped = true;
    }
  }

  startFalling() {
    if (this.isFalling) return; // Already falling
    this.isFalling = true;
    this.fallSpeed = 0;
    this.speed = 0;
    this.velocity.x = 0;
    this.velocity.z = 0;
  }

  updateFalling(deltaTime) {
    if (!this.isFalling) return;

    // Gravity acceleration
    this.fallSpeed += 30 * deltaTime; // Gravity effect
    this.position.y -= this.fallSpeed * deltaTime;

    // Add rotation for dramatic fall effect
    if (this.mesh) {
      this.mesh.rotation.x += deltaTime * 2;
      this.mesh.rotation.z += deltaTime * 1.5;
    }

    // Trigger death after falling below ground
    if (this.position.y < -10) {
      this.die();
    }
  }

  getBoundingBox() {
    // Enlarged bounding box with padding to ensure no pass-through
    const padding = 0.5; // Extra padding for safety
    return {
      min: {
        x: this.position.x - (PLAYER_CONFIG.WIDTH / 2 + padding),
        y: 0,
        z: this.position.z - (PLAYER_CONFIG.LENGTH / 2 + padding),
      },
      max: {
        x: this.position.x + (PLAYER_CONFIG.WIDTH / 2 + padding),
        y: PLAYER_CONFIG.HEIGHT,
        z: this.position.z + (PLAYER_CONFIG.LENGTH / 2 + padding),
      },
    };
  }

  setInput(input) {
    this.input = { ...input };
  }
  getPosition() {
    return { ...this.position };
  }
  getSpeed() {
    return Math.abs(this.speed);
  }
  canBoost() {
    return this.boostCooldownRemaining <= 0;
  }

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
