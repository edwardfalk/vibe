/**
 * CameraSystem.js - Handles camera movement, parallax effects, and screen shake
 */

class CameraSystem {
    constructor() {
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
        
        // Calculate target position based on player movement
        const playerVelocity = window.player.velocity || { x: 0, y: 0 };
        
        // Camera follows player with offset based on movement direction
        this.targetX = window.player.x + playerVelocity.x * 50 * this.sensitivity;
        this.targetY = window.player.y + playerVelocity.y * 50 * this.sensitivity;
        
        // Limit camera offset to prevent going too far from center
        const centerX = width / 2;
        const centerY = height / 2;
        
        this.targetX = constrain(this.targetX, centerX - this.maxOffset, centerX + this.maxOffset);
        this.targetY = constrain(this.targetY, centerY - this.maxOffset, centerY + this.maxOffset);
        
        // Smooth camera interpolation
        this.x = lerp(this.x, this.targetX, this.interpolationSpeed);
        this.y = lerp(this.y, this.targetY, this.interpolationSpeed);
    }
    
    // Apply camera transform (call before drawing world objects)
    applyTransform() {
        push();
        
        // Apply screen shake
        if (this.screenShake.duration > 0) {
            this.screenShake.duration--;
            const shakeX = random(-this.screenShake.intensity, this.screenShake.intensity);
            const shakeY = random(-this.screenShake.intensity, this.screenShake.intensity);
            translate(shakeX, shakeY);
        }
        
        // Apply camera offset
        translate(width/2 - this.x, height/2 - this.y);
    }
    
    // Remove camera transform (call after drawing world objects)
    removeTransform() {
        pop();
    }
    
    // Convert world coordinates to screen coordinates
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.x + width/2,
            y: worldY - this.y + height/2
        };
    }
    
    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        return {
            x: screenX + this.x - width/2,
            y: screenY + this.y - height/2
        };
    }
    
    // Check if a world position is visible on screen
    isVisible(worldX, worldY, margin = 50) {
        const screen = this.worldToScreen(worldX, worldY);
        return screen.x >= -margin && 
               screen.x <= width + margin && 
               screen.y >= -margin && 
               screen.y <= height + margin;
    }
    
    // Get camera bounds in world coordinates
    getBounds() {
        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(width, height);
        
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