// Requires p5.js for global utility functions: constrain(), random(), lerp(), etc.
import { CONFIG } from './config.js';
import { randomRange } from './mathUtils.js';

/**
 * CameraSystem.js - Handles camera movement, parallax effects, and screen shake
 */

export class CameraSystem {
    constructor(p) {
        this.p = p;
        // Camera position and targeting
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        
        // Screen shake system
        this.screenShake = { intensity: 0, duration: 0 };
        
        // Camera settings
        this.sensitivity = 0.4; // How much camera follows player movement
        this.maxOffset = 400; // Maximum camera offset from center
        this.interpolationSpeed = 0.15; // How fast camera catches up
    }
    
    // Add screen shake effect
    addShake(intensity, duration = 20) {
        this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity);
        this.screenShake.duration = Math.max(this.screenShake.duration, duration);
    }
    
    // Update camera position based on player
    update() {
        if (!window.player) return;
        const p = this.p;
        // Calculate target position based on player movement
        const playerVelocity = window.player.velocity || { x: 0, y: 0 };
        
        // Camera follows player with offset based on movement direction
        this.targetX = window.player.x + playerVelocity.x * 50 * this.sensitivity;
        this.targetY = window.player.y + playerVelocity.y * 50 * this.sensitivity;
        
        // Use canonical world bounds from config.js
        const WORLD_WIDTH = CONFIG.GAME_SETTINGS.WORLD_WIDTH;
        const WORLD_HEIGHT = CONFIG.GAME_SETTINGS.WORLD_HEIGHT;
        
        // Camera bounds calculated so viewport edges align with world edges
        // When player reaches world edge, camera should position so no empty space is visible
        // WORLD_WIDTH and WORLD_HEIGHT are now 1150x850 (see config.js)
        // Camera position + viewport/2 = world edge
        // So camera max = world edge - viewport/2
        const VIEWPORT_WIDTH = p.width;
        const VIEWPORT_HEIGHT = p.height;
        const cameraMaxX = WORLD_WIDTH/2 - VIEWPORT_WIDTH/2;   // 1150/2 - 800/2 = 575 - 400 = 175
        const cameraMaxY = WORLD_HEIGHT/2 - VIEWPORT_HEIGHT/2; // 850/2 - 600/2 = 425 - 300 = 125
        this.targetX = p.constrain(this.targetX, -cameraMaxX, cameraMaxX);
        this.targetY = p.constrain(this.targetY, -cameraMaxY, cameraMaxY);
        
        // Smooth camera interpolation
        this.x = p.lerp(this.x, this.targetX, this.interpolationSpeed);
        this.y = p.lerp(this.y, this.targetY, this.interpolationSpeed);
    }
    
    // Apply camera transform (call before drawing world objects)
    applyTransform() {
        const p = this.p;
        p.push();
        
        // Apply screen shake
        if (this.screenShake.duration > 0) {
            this.screenShake.duration--;
            const shakeX = randomRange(-this.screenShake.intensity, this.screenShake.intensity);
            const shakeY = randomRange(-this.screenShake.intensity, this.screenShake.intensity);
            p.translate(shakeX, shakeY);
        }
        
        // Apply camera offset
        p.translate(p.width/2 - this.x, p.height/2 - this.y);
    }
    
    // Remove camera transform (call after drawing world objects)
    removeTransform() {
        this.p.pop();
    }
    
    // Convert world coordinates to screen coordinates
    worldToScreen(worldX, worldY) {
        const p = this.p;
        return {
            x: worldX - this.x + p.width/2,
            y: worldY - this.y + p.height/2
        };
    }
    
    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        const p = this.p;
        return {
            x: screenX + this.x - p.width/2,
            y: screenY + this.y - p.height/2
        };
    }
    
    // Check if a world position is visible on screen
    isVisible(worldX, worldY, margin = 50) {
        const p = this.p;
        const screen = this.worldToScreen(worldX, worldY);
        return screen.x >= -margin && 
               screen.x <= p.width + margin && 
               screen.y >= -margin && 
               screen.y <= p.height + margin;
    }
    
    // Get camera bounds in world coordinates
    getBounds() {
        const p = this.p;
        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(p.width, p.height);
        
        return {
            left: topLeft.x,
            top: topLeft.y,
            right: bottomRight.x,
            bottom: bottomRight.y,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y
        };
    }
    
    // Reset camera to center
    reset() {
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.screenShake = { intensity: 0, duration: 0 };
    }
} 