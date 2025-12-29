/**
 * Road - Infinite scrolling road system
 * Responsibility: Manage road segments, recycling, and infinite scrolling effect
 * Uses object pooling for performance optimization
 */

import * as THREE from "three";
import { ROAD_CONFIG, COLORS } from "../utils/constants.js";
import { StreetFurniture } from "./StreetFurniture.js";

export class Road {
  constructor(scene) {
    this.scene = scene;

    // Road segments pool
    this.segments = [];
    this.activeSegments = [];

    // Ground plane (grass on sides)
    this.ground = null;

    // Track player position for segment recycling
    this.playerZ = 0;

    // Street furniture helper (for adding sidewalks/lines to segments)
    this.streetFurniture = new StreetFurniture(scene);

    this._createGround();
    this._initializeSegments();
  }

  /**
   * Create the ground plane (urban pavement)
   * @private
   */
  _createGround() {
    const groundGeometry = new THREE.PlaneGeometry(200, 500);
    const groundMaterial = new THREE.MeshLambertMaterial({
      color: COLORS.GRASS, // Now set to urban concrete color
    });

    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.1;
    this.ground.receiveShadow = false;

    this.scene.add(this.ground);
  }

  /**
   * Initialize road segments
   * @private
   */
  _initializeSegments() {
    const config = ROAD_CONFIG;

    // Create initial visible segments
    for (let i = 0; i < config.VISIBLE_SEGMENTS; i++) {
      const segment = this._createSegment();
      segment.position.z = -i * config.SEGMENT_LENGTH;
      this.activeSegments.push(segment);
      this.scene.add(segment);
    }
  }

  /**
   * Create a single road segment
   * @private
   */
  _createSegment() {
    const config = ROAD_CONFIG;
    const segment = new THREE.Group();

    // Main road surface - positioned slightly above ground to prevent z-fighting
    const roadGeometry = new THREE.PlaneGeometry(
      config.SEGMENT_WIDTH,
      config.SEGMENT_LENGTH
    );
    const roadMaterial = new THREE.MeshLambertMaterial({
      color: config.ROAD_COLOR,
    });

    const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.y = 0.02; // Raised to prevent z-fighting
    roadMesh.receiveShadow = true;
    segment.add(roadMesh);

    // Lane markers
    this._addLaneMarkers(segment);

    // Add sidewalks and curbs (integrated into segment)
    this.streetFurniture.addSidewalk(
      segment,
      config.SEGMENT_WIDTH,
      config.SEGMENT_LENGTH
    );

    // Add edge lines
    this.streetFurniture.addRoadEdgeLines(
      segment,
      config.SEGMENT_WIDTH,
      config.SEGMENT_LENGTH
    );

    return segment;
  }

  /**
   * Add lane markers to a segment
   * @private
   */
  _addLaneMarkers(segment) {
    const config = ROAD_CONFIG;
    const markerWidth = 0.3;
    const markerLength = 3;
    const markerSpacing = 12; // Increased from 8 - fewer markers
    const numMarkers = Math.floor(config.SEGMENT_LENGTH / markerSpacing);

    const markerGeometry = new THREE.PlaneGeometry(markerWidth, markerLength);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: config.LANE_MARKER_COLOR,
    });

    // Create markers for each lane division
    const lanePositions = [-config.LANE_WIDTH, config.LANE_WIDTH];

    for (const laneX of lanePositions) {
      for (let i = 0; i < numMarkers; i++) {
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.rotation.x = -Math.PI / 2;
        marker.position.set(
          laneX,
          0.03, // Above road surface
          -i * markerSpacing - markerSpacing / 2
        );
        segment.add(marker);
      }
    }

    // Center dashed line for clearer road guidance
    const centerGeometry = new THREE.PlaneGeometry(
      config.CENTER_LINE_WIDTH,
      config.CENTER_LINE_LENGTH
    );
    const centerMaterial = new THREE.MeshBasicMaterial({
      color: config.CENTER_LINE_COLOR,
    });
    const centerSpacing = 12; // Increased from 8
    const centerCount = Math.floor(config.SEGMENT_LENGTH / centerSpacing);

    for (let i = 0; i < centerCount; i++) {
      const centerStrip = new THREE.Mesh(centerGeometry, centerMaterial);
      centerStrip.rotation.x = -Math.PI / 2;
      centerStrip.position.set(
        0,
        0.04, // Above lane markers
        -i * centerSpacing - centerSpacing / 2
      );
      segment.add(centerStrip);
    }
  }

  /**
   * Update road based on player position
   * Recycle segments that are behind the player
   * @param {number} playerZ - Player's Z position
   */
  update(playerZ) {
    this.playerZ = playerZ;
    const config = ROAD_CONFIG;

    // Check if we need to recycle segments
    for (let i = this.activeSegments.length - 1; i >= 0; i--) {
      const segment = this.activeSegments[i];

      // If segment is far behind player, recycle it
      if (segment.position.z > playerZ + config.SEGMENT_LENGTH * 2) {
        // Move segment to front
        const frontSegment = this.activeSegments[0];
        segment.position.z = frontSegment.position.z - config.SEGMENT_LENGTH;

        // Reorder array
        this.activeSegments.splice(i, 1);
        this.activeSegments.unshift(segment);
      }
    }

    // Update ground to follow player
    this.ground.position.z = playerZ - 100;
  }

  /**
   * Get the road width (for collision bounds)
   */
  getRoadWidth() {
    return ROAD_CONFIG.SEGMENT_WIDTH;
  }

  /**
   * Get lane positions (for AI and spawning)
   */
  getLanePositions() {
    const config = ROAD_CONFIG;
    const laneWidth = config.LANE_WIDTH;

    return [
      -laneWidth, // Left lane
      0, // Center lane
      laneWidth, // Right lane
    ];
  }

  /**
   * Check if position is on road
   * @param {number} x - X position to check
   */
  isOnRoad(x) {
    const halfWidth = ROAD_CONFIG.SEGMENT_WIDTH / 2;
    return x >= -halfWidth && x <= halfWidth;
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.activeSegments.forEach((segment) => {
      this.scene.remove(segment);
      segment.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });

    if (this.ground) {
      this.scene.remove(this.ground);
      this.ground.geometry.dispose();
      this.ground.material.dispose();
    }

    // Dispose street furniture
    if (this.streetFurniture) {
      this.streetFurniture.dispose();
    }
  }
}
