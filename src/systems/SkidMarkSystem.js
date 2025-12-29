/**
 * SkidMarkSystem - Manages tire skid marks and traces
 * Responsibility: Create, update, and fade skid marks for visual feedback
 * Uses object pooling for performance optimization
 */

import * as THREE from "three";

export class SkidMarkSystem {
  constructor(scene) {
    this.scene = scene;
    this.skidMarks = [];
    this.maxMarks = 300; // Increased limit for longer-lasting marks
    this.markPool = [];

    // Shared material for all skid marks
    this.skidMaterial = new THREE.MeshBasicMaterial({
      color: 0x1a1a1a,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
  }

  /**
   * Create a skid mark at specified position
   * @param {number} x - X position
   * @param {number} z - Z position
   * @param {number} rotation - Rotation angle
   * @param {number} intensity - Mark intensity (0-1)
   * @param {number} width - Mark width
   */
  createSkidMark(x, z, rotation, intensity = 1.0, width = 0.15) {
    // Reuse or create new mark
    let mark =
      this.markPool.length > 0 ? this.markPool.pop() : this._createNewMark();

    // Configure mark
    const length = 1.2; // Increased length for visibility
    mark.geometry.dispose();
    mark.geometry = new THREE.PlaneGeometry(width * 1.5, length); // Wider marks
    mark.position.set(x, 0.05, z); // Slightly higher to prevent z-fighting
    mark.rotation.x = -Math.PI / 2;
    mark.rotation.z = rotation;
    mark.material.opacity = 0.85 * intensity; // Higher opacity
    mark.visible = true;

    // Mark lifetime and fading
    mark.userData.lifetime = 0;
    mark.userData.maxLifetime = 15000; // 15 seconds - realistic tire marks
    mark.userData.initialOpacity = 0.85 * intensity;

    this.scene.add(mark);
    this.skidMarks.push(mark);

    // Remove oldest if exceeding limit
    if (this.skidMarks.length > this.maxMarks) {
      this._removeMark(0);
    }
  }

  /**
   * Create continuous skid marks for a car
   * @param {Object} carPosition - Car position {x, z}
   * @param {number} carRotation - Car rotation
   * @param {number} velocity - Current velocity
   * @param {number} steering - Steering input (-1 to 1)
   * @param {boolean} isBrakingOrAccel - Is car braking or accelerating rapidly
   * @param {boolean} isSharpTurn - Is car making a sharp turn
   */
  addCarSkidMarks(
    carPosition,
    carRotation,
    velocity,
    steering,
    isBrakingOrAccel = false,
    isSharpTurn = false
  ) {
    const speed = Math.abs(velocity);

    // Only create marks if car is moving with sufficient speed
    if (speed < 6) return;

    // Calculate intensity based on realistic conditions
    let intensity = 0;

    // Braking/Acceleration intensity - high speed + rapid speed change
    if (isBrakingOrAccel && speed > 8) {
      intensity = Math.min(1.0, speed / 22);
    }

    // Sharp turn intensity - depends on speed and steering angle
    if (isSharpTurn) {
      const turnIntensity = Math.abs(steering) * Math.min(1.0, speed / 15);
      intensity = Math.max(intensity, turnIntensity * 1.3); // Turns create stronger marks
    }

    // Don't create marks if intensity is too low (no significant action)
    if (intensity < 0.1) return;

    // Create marks for rear wheels (dual marks)
    const wheelOffset = 0.8; // Distance from center to wheel
    const rearOffset = -1.5; // Distance behind center

    // Calculate wheel positions
    const cos = Math.cos(carRotation);
    const sin = Math.sin(carRotation);

    // Left rear wheel
    const leftX = carPosition.x + (-wheelOffset * cos - rearOffset * sin);
    const leftZ = carPosition.z + (-wheelOffset * sin + rearOffset * cos);

    // Right rear wheel
    const rightX = carPosition.x + (wheelOffset * cos - rearOffset * sin);
    const rightZ = carPosition.z + (wheelOffset * sin + rearOffset * cos);

    // Adjust rotation for drift angle if turning
    const driftAngle = steering * 0.3; // Slight angle based on steering
    const markRotation = carRotation + driftAngle;

    // Create marks with increased width
    this.createSkidMark(leftX, leftZ, markRotation, intensity, 0.18);
    this.createSkidMark(rightX, rightZ, markRotation, intensity, 0.18);
  }

  /**
   * Create a new mark mesh
   * @private
   */
  _createNewMark() {
    const geometry = new THREE.PlaneGeometry(0.27, 1.2); // Larger default size
    const mark = new THREE.Mesh(geometry, this.skidMaterial);
    mark.userData = { lifetime: 0, maxLifetime: 15000, initialOpacity: 0.85 };
    return mark;
  }

  /**
   * Remove a mark and return to pool
   * @private
   */
  _removeMark(index) {
    const mark = this.skidMarks[index];
    mark.visible = false;
    this.scene.remove(mark);
    this.markPool.push(mark);
    this.skidMarks.splice(index, 1);
  }

  /**
   * Update all marks - handle fading
   * @param {number} deltaTime - Time since last frame (seconds)
   */
  update(deltaTime) {
    const deltaMs = deltaTime * 1000;

    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      const mark = this.skidMarks[i];
      mark.userData.lifetime += deltaMs;

      // Calculate fade
      const fadeProgress = mark.userData.lifetime / mark.userData.maxLifetime;

      if (fadeProgress >= 1.0) {
        // Remove completely faded marks
        this._removeMark(i);
      } else {
        // Realistic fade: stay visible for most of lifetime, then fade at the end
        let fadeMultiplier;
        if (fadeProgress < 0.7) {
          // First 70% - stay at full opacity (realistic tire marks)
          fadeMultiplier = 1.0;
        } else {
          // Last 30% - gradual fade out
          const fadePhase = (fadeProgress - 0.7) / 0.3; // 0 to 1
          fadeMultiplier = 1.0 - Math.pow(fadePhase, 2); // Quadratic fade
        }
        mark.material.opacity = mark.userData.initialOpacity * fadeMultiplier;
      }
    }
  }

  /**
   * Clear all marks
   */
  clear() {
    this.skidMarks.forEach((mark) => {
      this.scene.remove(mark);
      mark.geometry.dispose();
    });
    this.skidMarks = [];

    this.markPool.forEach((mark) => {
      mark.geometry.dispose();
    });
    this.markPool = [];
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.clear();
    this.skidMaterial.dispose();
  }
}
