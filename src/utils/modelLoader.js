/**
 * Model Loader Utility
 * Handles loading GLB/GLTF models for cars
 */

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class ModelLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.loadedModels = new Map();
  }

  /**
   * Load a GLB model
   * @param {string} path - Path to the model file
   * @returns {Promise<Object>} - Loaded model
   */
  async loadModel(path) {
    // Check if already loaded
    if (this.loadedModels.has(path)) {
      return this.loadedModels.get(path).clone();
    }

    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => {
          // Store original for cloning
          this.loadedModels.set(path, gltf.scene);
          resolve(gltf.scene.clone());
        },
        undefined,
        (error) => {
          console.error(`Error loading model ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Preload multiple models
   * @param {Array<string>} paths - Array of model paths
   * @returns {Promise<Array>} - Array of loaded models
   */
  async preloadModels(paths) {
    const promises = paths.map((path) => this.loadModel(path));
    return Promise.all(promises);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.loadedModels.clear();
  }
}

// Singleton instance
export const modelLoader = new ModelLoader();
