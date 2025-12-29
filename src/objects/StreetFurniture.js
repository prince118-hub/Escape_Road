/**
 * StreetFurniture - Urban street elements system (OPTIMIZED)
 * Responsibility: Create and manage street lights, traffic signs, road markings,
 * sidewalks, curbs, crosswalks - optimized for performance
 */

import * as THREE from "three";
import { ROAD_CONFIG } from "../utils/constants.js";

export class StreetFurniture {
  constructor(scene) {
    this.scene = scene;
    this.streetElements = [];
    this.lightCount = 0;
    this.maxLights = 8; // Increased for better visibility
    this._initSharedMaterials();
    this._initSharedGeometries();
  }

  /**
   * Initialize shared materials for street furniture
   * @private
   */
  _initSharedMaterials() {
    this.materials = {
      streetLightPole: new THREE.MeshLambertMaterial({ color: 0x404040 }),
      streetLightHead: new THREE.MeshLambertMaterial({ color: 0x303030 }),
      streetLightBulb: new THREE.MeshBasicMaterial({ color: 0xffffdd }),
      signPole: new THREE.MeshLambertMaterial({ color: 0x606060 }),
      signRed: new THREE.MeshLambertMaterial({ color: 0xff0000 }),
      signYellow: new THREE.MeshLambertMaterial({ color: 0xffdd00 }),
      signBlue: new THREE.MeshLambertMaterial({ color: 0x0066cc }),
      signWhite: new THREE.MeshLambertMaterial({ color: 0xffffff }),
      sidewalk: new THREE.MeshLambertMaterial({ color: 0xa0a0a0 }),
      curb: new THREE.MeshLambertMaterial({ color: 0xb8b8b8 }),
      crosswalk: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      arrowWhite: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      // Traffic light materials
      trafficLightBox: new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
      redLight: new THREE.MeshBasicMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5,
      }),
      yellowLight: new THREE.MeshBasicMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.3,
      }),
      greenLight: new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.5,
      }),
      lightOff: new THREE.MeshLambertMaterial({ color: 0x333333 }),
    };
  }

  /**
   * Initialize shared geometries to reduce memory
   * @private
   */
  _initSharedGeometries() {
    this.geometries = {
      pole: new THREE.CylinderGeometry(0.12, 0.15, 6, 6),
      lightHead: new THREE.BoxGeometry(0.5, 0.3, 0.5),
      bulb: new THREE.SphereGeometry(0.2, 6, 6),
      signPole: new THREE.CylinderGeometry(0.06, 0.08, 2.5, 6),
      signBoard: new THREE.BoxGeometry(0.5, 0.5, 0.05),
      sidewalk: new THREE.BoxGeometry(2, 0.12, 1),
      curb: new THREE.BoxGeometry(0.25, 0.2, 1),
      // Traffic light geometries
      trafficLightPole: new THREE.CylinderGeometry(0.08, 0.1, 4.5, 6),
      trafficLightBox: new THREE.BoxGeometry(0.35, 1.2, 0.25),
      signalLight: new THREE.CircleGeometry(0.12, 8),
      trafficLightHood: new THREE.BoxGeometry(0.4, 0.15, 0.3),
    };
  }

  /**
   * Create a simplified street light
   * @param {number} x - X position
   * @param {number} z - Z position
   * @param {boolean} addLight - Whether to add point light (limited)
   */
  createStreetLight(x, z, addLight = false) {
    const lightGroup = new THREE.Group();

    // Pole
    const pole = new THREE.Mesh(
      this.geometries.pole,
      this.materials.streetLightPole
    );
    pole.position.y = 3;
    lightGroup.add(pole);

    // Light head
    const head = new THREE.Mesh(
      this.geometries.lightHead,
      this.materials.streetLightHead
    );
    head.position.y = 6;
    lightGroup.add(head);

    // Bulb
    const bulb = new THREE.Mesh(
      this.geometries.bulb,
      this.materials.streetLightBulb
    );
    bulb.position.y = 5.8;
    lightGroup.add(bulb);

    // Only add point light if under limit
    if (addLight && this.lightCount < this.maxLights) {
      const pointLight = new THREE.PointLight(0xffffdd, 0.3, 18);
      pointLight.position.y = 5.8;
      lightGroup.add(pointLight);
      this.lightCount++;
    }

    lightGroup.position.set(x, 0, z);
    this.scene.add(lightGroup);
    this.streetElements.push(lightGroup);

    return lightGroup;
  }

  /**
   * Create street lights at intersection (only 2 with actual lights)
   */
  createIntersectionLights(x, z, roadWidth = 18) {
    const offset = roadWidth / 2 + 1.5;

    // Both lights get actual point lights for visibility
    this.createStreetLight(x + offset, z + offset, true);
    this.createStreetLight(x - offset, z - offset, true);
  }

  /**
   * Create simplified traffic sign
   */
  createTrafficSign(x, z, type = "stop") {
    const signGroup = new THREE.Group();

    // Pole
    const pole = new THREE.Mesh(
      this.geometries.signPole,
      this.materials.signPole
    );
    pole.position.y = 1.25;
    signGroup.add(pole);

    // Sign board
    const material =
      type === "stop"
        ? this.materials.signRed
        : type === "yield"
        ? this.materials.signYellow
        : type === "parking"
        ? this.materials.signBlue
        : this.materials.signWhite;

    const sign = new THREE.Mesh(this.geometries.signBoard, material);
    sign.position.y = 3;
    signGroup.add(sign);

    signGroup.position.set(x, 0, z);
    this.scene.add(signGroup);
    this.streetElements.push(signGroup);

    return signGroup;
  }

  /**
   * Create realistic traffic light with red, yellow, green signals
   * @param {number} x - X position
   * @param {number} z - Z position
   * @param {string} activeLight - Which light is on: 'red', 'yellow', 'green'
   * @param {number} rotation - Rotation in radians (which direction it faces)
   */
  createTrafficLight(x, z, activeLight = "red", rotation = 0) {
    const trafficLightGroup = new THREE.Group();

    // Pole
    const pole = new THREE.Mesh(
      this.geometries.trafficLightPole,
      this.materials.signPole
    );
    pole.position.y = 2.25;
    trafficLightGroup.add(pole);

    // Traffic light box (black housing)
    const box = new THREE.Mesh(
      this.geometries.trafficLightBox,
      this.materials.trafficLightBox
    );
    box.position.y = 5.1;
    trafficLightGroup.add(box);

    // Hood/visor on top
    const hood = new THREE.Mesh(
      this.geometries.trafficLightHood,
      this.materials.trafficLightBox
    );
    hood.position.y = 5.75;
    trafficLightGroup.add(hood);

    // Red light (top)
    const redLight = new THREE.Mesh(
      this.geometries.signalLight,
      activeLight === "red" ? this.materials.redLight : this.materials.lightOff
    );
    redLight.position.set(0, 5.5, 0.13);
    trafficLightGroup.add(redLight);

    // Yellow light (middle)
    const yellowLight = new THREE.Mesh(
      this.geometries.signalLight,
      activeLight === "yellow"
        ? this.materials.yellowLight
        : this.materials.lightOff
    );
    yellowLight.position.set(0, 5.1, 0.13);
    trafficLightGroup.add(yellowLight);

    // Green light (bottom)
    const greenLight = new THREE.Mesh(
      this.geometries.signalLight,
      activeLight === "green"
        ? this.materials.greenLight
        : this.materials.lightOff
    );
    greenLight.position.set(0, 4.7, 0.13);
    trafficLightGroup.add(greenLight);

    // Position and rotate
    trafficLightGroup.position.set(x, 0, z);
    trafficLightGroup.rotation.y = rotation;

    this.scene.add(trafficLightGroup);
    this.streetElements.push(trafficLightGroup);

    return trafficLightGroup;
  }

  /**
   * Add traffic lights to all 4 corners of intersection
   * @param {number} x - Intersection center X
   * @param {number} z - Intersection center Z
   * @param {number} roadWidth - Width of the road
   */
  createIntersectionTrafficLights(x, z, roadWidth = 18) {
    const cornerOffset = roadWidth / 2 + 1; // Position at intersection corners

    // Northeast corner - red light facing southwest
    this.createTrafficLight(
      x + cornerOffset,
      z - cornerOffset,
      "red",
      Math.PI / 4
    );

    // Southeast corner - green light facing northwest
    this.createTrafficLight(
      x + cornerOffset,
      z + cornerOffset,
      "green",
      (-Math.PI * 3) / 4
    );

    // Southwest corner - red light facing northeast
    this.createTrafficLight(
      x - cornerOffset,
      z + cornerOffset,
      "red",
      (Math.PI * 3) / 4
    );

    // Northwest corner - green light facing southeast
    this.createTrafficLight(
      x - cornerOffset,
      z - cornerOffset,
      "green",
      -Math.PI / 4
    );
  }

  /**
   * Add sidewalks with instancing for better performance
   */
  addSidewalk(segment, roadWidth = 18, segmentLength = 90) {
    const sidewalkWidth = 2;
    const sidewalkHeight = 0.12;

    // Create instances efficiently
    const geometry = new THREE.BoxGeometry(
      sidewalkWidth,
      sidewalkHeight,
      segmentLength
    );

    const leftSidewalk = new THREE.Mesh(geometry, this.materials.sidewalk);
    leftSidewalk.position.set(
      -(roadWidth / 2 + sidewalkWidth / 2),
      sidewalkHeight / 2,
      -segmentLength / 2
    );
    segment.add(leftSidewalk);

    const rightSidewalk = new THREE.Mesh(geometry, this.materials.sidewalk);
    rightSidewalk.position.set(
      roadWidth / 2 + sidewalkWidth / 2,
      sidewalkHeight / 2,
      -segmentLength / 2
    );
    segment.add(rightSidewalk);

    this.addCurbs(segment, roadWidth, segmentLength);
  }

  /**
   * Add curbs along road edge
   */
  addCurbs(segment, roadWidth = 18, segmentLength = 90) {
    const curbWidth = 0.25;
    const curbHeight = 0.2;

    const geometry = new THREE.BoxGeometry(
      curbWidth,
      curbHeight,
      segmentLength
    );

    const leftCurb = new THREE.Mesh(geometry, this.materials.curb);
    leftCurb.position.set(
      -(roadWidth / 2 + curbWidth / 2),
      curbHeight / 2,
      -segmentLength / 2
    );
    segment.add(leftCurb);

    const rightCurb = new THREE.Mesh(geometry, this.materials.curb);
    rightCurb.position.set(
      roadWidth / 2 + curbWidth / 2,
      curbHeight / 2,
      -segmentLength / 2
    );
    segment.add(rightCurb);
  }

  /**
   * Create crosswalk (reduced stripe count)
   */
  createCrosswalk(x, z, roadWidth = 18, horizontal = true) {
    const crosswalkGroup = new THREE.Group();
    const stripeWidth = 1;
    const stripeLength = 2;
    const stripeSpacing = 0.8;
    const numStripes = 10; // Increased from 6 for visibility

    const stripeGeometry = new THREE.PlaneGeometry(stripeWidth, stripeLength);

    for (let i = 0; i < numStripes; i++) {
      const stripe = new THREE.Mesh(stripeGeometry, this.materials.crosswalk);
      stripe.rotation.x = -Math.PI / 2;

      if (horizontal) {
        stripe.position.set(
          -roadWidth / 2 + i * (stripeWidth + stripeSpacing) + stripeWidth / 2,
          0.05,
          0
        );
      } else {
        stripe.rotation.z = Math.PI / 2;
        stripe.position.set(
          0,
          0.05,
          -roadWidth / 2 + i * (stripeWidth + stripeSpacing) + stripeWidth / 2
        );
      }

      crosswalkGroup.add(stripe);
    }

    crosswalkGroup.position.set(x, 0, z);
    this.scene.add(crosswalkGroup);
    this.streetElements.push(crosswalkGroup);

    return crosswalkGroup;
  }

  /**
   * Add simplified lane arrow
   */
  addLaneArrow(segment, laneX, segmentLength, direction = "forward") {
    const arrowGeometry = new THREE.PlaneGeometry(0.6, 1.2);
    const arrow = new THREE.Mesh(arrowGeometry, this.materials.arrowWhite);
    arrow.rotation.x = -Math.PI / 2;

    if (direction === "left") {
      arrow.rotation.z = Math.PI / 2;
    } else if (direction === "right") {
      arrow.rotation.z = -Math.PI / 2;
    }

    arrow.position.set(laneX, 0.06, -segmentLength / 3);
    segment.add(arrow);
  }

  /**
   * Add road edge lines
   */
  addRoadEdgeLines(segment, roadWidth = 18, segmentLength = 90) {
    const lineWidth = 0.12;
    const lineGeometry = new THREE.PlaneGeometry(lineWidth, segmentLength);
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const leftLine = new THREE.Mesh(lineGeometry, lineMaterial);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(
      -roadWidth / 2 + lineWidth / 2,
      0.05,
      -segmentLength / 2
    );
    segment.add(leftLine);

    const rightLine = new THREE.Mesh(lineGeometry, lineMaterial);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(
      roadWidth / 2 - lineWidth / 2,
      0.05,
      -segmentLength / 2
    );
    segment.add(rightLine);
  }

  /**
   * Create bus stop (simplified)
   */
  createBusStop(x, z, facingRight = true) {
    const busStopGroup = new THREE.Group();

    // Just a pole and sign for performance
    const poleGeometry = new THREE.CylinderGeometry(0.08, 0.08, 3, 6);
    const pole = new THREE.Mesh(poleGeometry, this.materials.signPole);
    pole.position.y = 1.5;
    busStopGroup.add(pole);

    const signGeometry = new THREE.BoxGeometry(0.6, 0.5, 0.05);
    const sign = new THREE.Mesh(signGeometry, this.materials.signBlue);
    sign.position.y = 3.2;
    busStopGroup.add(sign);

    if (!facingRight) {
      busStopGroup.rotation.y = Math.PI;
    }

    busStopGroup.position.set(x, 0, z);
    this.scene.add(busStopGroup);
    this.streetElements.push(busStopGroup);

    return busStopGroup;
  }

  /**
   * Create minimal street furniture for a city tile
   */
  createTileStreetFurniture(x, z, tileSize = 200) {
    // Only add minimal elements
    this.createIntersectionLights(x, z, ROAD_CONFIG.SEGMENT_WIDTH);

    const roadWidth = ROAD_CONFIG.SEGMENT_WIDTH;
    const crosswalkOffset = roadWidth / 2 + 2.5;

    // Only 2 crosswalks instead of 4
    this.createCrosswalk(x, z - crosswalkOffset, roadWidth, true);
    this.createCrosswalk(x + crosswalkOffset, z, roadWidth, false);

    // Fewer signs
    const signOffset = roadWidth / 2 + 1.2;
    if (Math.random() > 0.5) {
      this.createTrafficSign(x + signOffset, z - signOffset - 4, "stop");
    }
  }

  /**
   * Remove street elements that are far from player
   */
  cleanup(playerX, playerZ, maxDistance = 250) {
    for (let i = this.streetElements.length - 1; i >= 0; i--) {
      const element = this.streetElements[i];
      const distance = Math.sqrt(
        Math.pow(element.position.x - playerX, 2) +
          Math.pow(element.position.z - playerZ, 2)
      );

      if (distance > maxDistance) {
        this.scene.remove(element);
        element.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (
            child.material &&
            child.material !== this.materials.streetLightPole
          ) {
            // Don't dispose shared materials
          }
        });
        this.streetElements.splice(i, 1);
      }
    }
  }

  /**
   * Dispose all street furniture
   */
  dispose() {
    this.streetElements.forEach((element) => {
      this.scene.remove(element);
      element.traverse((child) => {
        if (child.geometry && !this.geometries[child.geometry.uuid]) {
          child.geometry.dispose();
        }
      });
    });
    this.streetElements = [];

    // Dispose shared geometries
    Object.values(this.geometries).forEach((geometry) => {
      geometry.dispose();
    });

    // Dispose shared materials
    Object.values(this.materials).forEach((material) => {
      material.dispose();
    });

    this.lightCount = 0;
  }
}
