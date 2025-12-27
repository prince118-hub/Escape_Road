// New PlayerCar with omnidirectional movement will be created
import * as THREE from "three";
import { PLAYER_CONFIG, COLORS } from "../utils/constants.js";
import { clamp } from "../utils/helpers.js";

export class PlayerCar {
  constructor(scene) {
    this.scene = scene;
    this.position = { x: 0, y: 0, z: 0 };
    this.velocity = { x: 0, z: 0 };
    this.rotation = Math.PI; // Start facing forward (negative Z direction) - Math.PI = 180 degrees
    this.speed = 0; // Current speed (starts at 0, accelerates over time)
    this.targetSpeed = 0; // Target speed to accelerate towards
    this.health = PLAYER_CONFIG.MAX_HEALTH;
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
    this.wheels = [];
    this.isFalling = false;
    this.fallSpeed = 0;
    // Collision reverse state (used by CollisionSystem for building collisions)
    this.isColliding = false;
    this.collisionReverseTimer = 0;
    this.collisionReverseDirection = { x: 0, z: 0 };
    // Caught by police state
    this.isCaught = false;
    this.caughtTimer = 0;
    this._createMesh();
  }

  _createMesh() {
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
    body.castShadow = false;

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
    cabin.castShadow = false;

    this.wheels = this._createWheels();
    this.mesh = new THREE.Group();
    this.mesh.add(body);
    this.mesh.add(cabin);
    this.wheels.forEach((wheel) => this.mesh.add(wheel));
    // Position car with base at ground level (y = height/2)
    this.mesh.position.set(this.position.x, config.HEIGHT / 2, this.position.z);
    this.scene.add(this.mesh);
  }

  _createWheels() {
    const config = PLAYER_CONFIG;
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

  update(deltaTime) {
    if (!this.isAlive) return;

    // Handle caught state countdown
    if (this.isCaught) {
      this.caughtTimer -= deltaTime;
      if (this.caughtTimer <= 0) {
        // Finally caught after 3 seconds
        this.die();
      }
      // Disable input while being caught
      this._updateMesh();
      return;
    }

    // Handle falling animation
    if (this.isFalling) {
      this.updateFalling(deltaTime);
      this._updateMesh();
      return;
    }

    // Handle collision reverse movement
    if (this.isColliding && this.collisionReverseTimer > 0) {
      const reverseSpeed = 8;
      this.position.x +=
        this.collisionReverseDirection.x * reverseSpeed * deltaTime;
      this.position.z +=
        this.collisionReverseDirection.z * reverseSpeed * deltaTime;

      this.velocity.x = 0;
      this.velocity.z = 0;

      this.collisionReverseTimer -= deltaTime;
      if (this.collisionReverseTimer <= 0) {
        this.isColliding = false;
        this.collisionReverseTimer = 0;
        this.collisionReverseDirection = { x: 0, z: 0 };
      }

      this._animateWheels(deltaTime);
      this._updateMesh();
      const distDelta =
        Math.sqrt(
          this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z
        ) * deltaTime;
      this.distanceTraveled += distDelta;
      return;
    }

    this._updateBoost(deltaTime);
    this._applyInput(deltaTime);
    this._updatePosition(deltaTime);
    this._animateWheels(deltaTime);
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

  _animateWheels(deltaTime) {
    const wheelRotationSpeed = this.speed * deltaTime * 2;
    this.wheels.forEach((wheel, index) => {
      if (index < 2) {
        if (this.input.left) wheel.rotation.y = 0.3;
        else if (this.input.right) wheel.rotation.y = -0.3;
        else wheel.rotation.y = 0;
      }
      wheel.rotation.x += wheelRotationSpeed;
    });
  }

  _updateMesh() {
    this.mesh.position.x = this.position.x;
    this.mesh.position.z = this.position.z;
    this.mesh.rotation.y = this.rotation;
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
    this.mesh.children[0].material.color.setHex(0xff6633);
  }

  deactivateBoost() {
    this.boostActive = false;
    this.boostCooldownRemaining = PLAYER_CONFIG.BOOST_COOLDOWN;
    // Restore original car color
    this.mesh.children[0].material.color.setHex(COLORS.PLAYER_CAR);
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.die();
  }

  die() {
    this.isAlive = false;
    this.speed = 0;
  }

  setCaught() {
    if (!this.isCaught) {
      this.isCaught = true;
      this.caughtTimer = 3.0; // 3 second countdown
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
    return {
      min: {
        x: this.position.x - PLAYER_CONFIG.WIDTH / 2,
        y: 0,
        z: this.position.z - PLAYER_CONFIG.LENGTH / 2,
      },
      max: {
        x: this.position.x + PLAYER_CONFIG.WIDTH / 2,
        y: PLAYER_CONFIG.HEIGHT,
        z: this.position.z + PLAYER_CONFIG.LENGTH / 2,
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
  getHealthPercent() {
    return (this.health / PLAYER_CONFIG.MAX_HEALTH) * 100;
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
