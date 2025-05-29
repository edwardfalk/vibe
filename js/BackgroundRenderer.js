/**
 * BackgroundRenderer.js - Handles all background drawing including parallax, cosmic effects, and space elements
 */

class BackgroundRenderer {
    constructor() {
        // Parallax background layers
        this.parallaxLayers = [];
        this.parallaxInitialized = false;
    }
    
    // Initialize parallax background layers
    createParallaxBackground() {
        if (this.parallaxInitialized) return;
        
        console.log('🌌 Creating parallax background layers...');
        
        this.parallaxLayers = [
            {
                name: 'distant_stars',
                elements: [],
                speed: 0.1,
                depth: 0.9
            },
            {
                name: 'nebula_clouds',
                elements: [],
                speed: 0.3,
                depth: 0.7
            },
            {
                name: 'medium_stars',
                elements: [],
                speed: 0.5,
                depth: 0.5
            },
            {
                name: 'close_debris',
                elements: [],
                speed: 0.8,
                depth: 0.3
            }
        ];
        
        // Generate elements for each layer
        this.generateLayerElements();
        this.parallaxInitialized = true;
        
        console.log('✅ Parallax background created with', this.parallaxLayers.length, 'layers');
    }
    
    // Generate elements for parallax layers
    generateLayerElements() {
        // Distant stars layer
        const distantStars = this.parallaxLayers[0];
        for (let i = 0; i < 50; i++) {
            distantStars.elements.push({
                x: random(-width, width * 2),
                y: random(-height, height * 2),
                size: random(1, 3),
                brightness: random(0.3, 1),
                twinkleSpeed: random(0.01, 0.03)
            });
        }
        
        // Nebula clouds layer
        const nebulaClouds = this.parallaxLayers[1];
        for (let i = 0; i < 8; i++) {
            nebulaClouds.elements.push({
                x: random(-width, width * 2),
                y: random(-height, height * 2),
                size: random(100, 300),
                color: {
                    r: random(40, 80),
                    g: random(20, 60),
                    b: random(60, 120)
                },
                alpha: random(0.05, 0.15),
                driftSpeed: random(0.1, 0.3)
            });
        }
        
        // Medium stars layer
        const mediumStars = this.parallaxLayers[2];
        for (let i = 0; i < 30; i++) {
            mediumStars.elements.push({
                x: random(-width, width * 2),
                y: random(-height, height * 2),
                size: random(2, 5),
                brightness: random(0.5, 1),
                color: random(['white', 'blue', 'yellow', 'orange'])
            });
        }
        
        // Close debris layer
        const closeDebris = this.parallaxLayers[3];
        for (let i = 0; i < 15; i++) {
            closeDebris.elements.push({
                x: random(-width, width * 2),
                y: random(-height, height * 2),
                size: random(3, 8),
                rotation: random(0, TWO_PI),
                rotationSpeed: random(-0.02, 0.02),
                shape: random(['triangle', 'square', 'diamond'])
            });
        }
    }
    
    // Draw parallax background
    drawParallaxBackground() {
        if (!this.parallaxInitialized) {
            this.createParallaxBackground();
        }
        
        push();
        
        // Get camera offset for parallax calculation
        const cameraX = window.cameraSystem ? window.cameraSystem.x : 0;
        const cameraY = window.cameraSystem ? window.cameraSystem.y : 0;
        
        // Draw each parallax layer
        for (const layer of this.parallaxLayers) {
            this.drawParallaxLayer(layer, cameraX, cameraY);
        }
        
        pop();
    }
    
    // Draw individual parallax layer
    drawParallaxLayer(layer, cameraX, cameraY) {
        push();
        
        // Apply parallax offset
        const parallaxX = cameraX * layer.speed;
        const parallaxY = cameraY * layer.speed;
        translate(-parallaxX, -parallaxY);
        
        // Draw layer elements based on type
        switch (layer.name) {
            case 'distant_stars':
                this.drawDistantStars(layer.elements);
                break;
            case 'nebula_clouds':
                this.drawNebulaClouds(layer.elements);
                break;
            case 'medium_stars':
                this.drawMediumStars(layer.elements);
                break;
            case 'close_debris':
                this.drawCloseDebris(layer.elements);
                break;
        }
        
        pop();
    }
    
    // Draw distant stars with twinkling
    drawDistantStars(stars) {
        noStroke();
        for (const star of stars) {
            const twinkle = sin(frameCount * star.twinkleSpeed) * 0.5 + 0.5;
            const alpha = star.brightness * twinkle * 255;
            
            fill(255, 255, 255, alpha);
            ellipse(star.x, star.y, star.size, star.size);
        }
    }
    
    // Draw nebula clouds
    drawNebulaClouds(clouds) {
        noStroke();
        for (const cloud of clouds) {
            const drift = sin(frameCount * cloud.driftSpeed) * 20;
            const alpha = cloud.alpha * 255;
            
            fill(cloud.color.r, cloud.color.g, cloud.color.b, alpha);
            ellipse(cloud.x + drift, cloud.y, cloud.size, cloud.size * 0.6);
        }
    }
    
    // Draw medium stars
    drawMediumStars(stars) {
        noStroke();
        for (const star of stars) {
            switch (star.color) {
                case 'blue':
                    fill(173, 216, 230, star.brightness * 255);
                    break;
                case 'yellow':
                    fill(255, 255, 224, star.brightness * 255);
                    break;
                case 'orange':
                    fill(255, 165, 0, star.brightness * 255);
                    break;
                default:
                    fill(255, 255, 255, star.brightness * 255);
            }
            ellipse(star.x, star.y, star.size, star.size);
        }
    }
    
    // Draw close debris
    drawCloseDebris(debris) {
        stroke(100, 100, 100, 150);
        strokeWeight(1);
        noFill();
        
        for (const piece of debris) {
            push();
            translate(piece.x, piece.y);
            rotate(piece.rotation);
            piece.rotation += piece.rotationSpeed;
            
            switch (piece.shape) {
                case 'triangle':
                    triangle(-piece.size/2, piece.size/2, piece.size/2, piece.size/2, 0, -piece.size/2);
                    break;
                case 'square':
                    rect(-piece.size/2, -piece.size/2, piece.size, piece.size);
                    break;
                case 'diamond':
                    quad(0, -piece.size/2, piece.size/2, 0, 0, piece.size/2, -piece.size/2, 0);
                    break;
            }
            pop();
        }
    }
    
    // Draw cosmic aurora background
    drawCosmicAuroraBackground() {
        push();
        
        // Create a clean gradient using rectangles
        const gradientSteps = 8;
        const stepHeight = height / gradientSteps;
        
        for (let i = 0; i < gradientSteps; i++) {
            const inter = i / (gradientSteps - 1);
            
            // Cosmic aurora gradient colors
            let r, g, b;
            if (inter < 0.3) {
                // Deep space black to purple
                const t = map(inter, 0, 0.3, 0, 1);
                r = lerp(8, 25, t);
                g = lerp(5, 15, t);
                b = lerp(20, 45, t);
            } else if (inter < 0.7) {
                // Purple to cosmic blue
                const t = map(inter, 0.3, 0.7, 0, 1);
                r = lerp(25, 20, t);
                g = lerp(15, 30, t);
                b = lerp(45, 65, t);
            } else {
                // Cosmic blue to deep purple
                const t = map(inter, 0.7, 1, 0, 1);
                r = lerp(20, 30, t);
                g = lerp(30, 20, t);
                b = lerp(65, 50, t);
            }
            
            // Subtle time-based variation
            const timeShift = sin(frameCount * 0.005 + inter) * 8;
            r += timeShift * 0.5;
            g += timeShift * 0.3;
            b += timeShift * 0.8;
            
            fill(r, g, b);
            noStroke();
            rect(0, i * stepHeight, width, stepHeight + 1);
        }
        
        pop();
    }
    
    // Draw enhanced space elements
    drawEnhancedSpaceElements() {
        push();
        
        // Flowing nebula streams
        fill(64, 224, 208, 12);
        noStroke();
        for (let i = 0; i < 12; i++) {
            const streamX = (i * 97 + frameCount * 0.15) % (width + 150) - 75;
            const streamY = (i * 143) % height;
            const streamSize = 80 + sin(frameCount * 0.008 + i) * 30;
            const streamFlow = sin(frameCount * 0.01 + i * 0.5) * 20;
            
            // Create flowing stream effect
            for (let j = 0; j < 5; j++) {
                const segmentX = streamX + j * 15 + streamFlow;
                const segmentY = streamY + sin(frameCount * 0.006 + i + j) * 10;
                const segmentAlpha = 12 - j * 2;
                fill(64 + j * 10, 224 - j * 5, 208 + j * 8, segmentAlpha);
                ellipse(segmentX, segmentY, streamSize - j * 10, (streamSize - j * 10) * 0.6);
            }
        }
        
        // Enhanced aurora wisps
        for (let i = 0; i < 8; i++) {
            const wispX = (i * 127 + frameCount * 0.08) % (width + 100) - 50;
            const wispY = (i * 179) % height;
            const wispSize = 100 + cos(frameCount * 0.006 + i) * 35;
            const colorPhase = frameCount * 0.01 + i;
            
            const r = 138 + sin(colorPhase) * 50;
            const g = 43 + cos(colorPhase * 1.3) * 40;
            const b = 226 + sin(colorPhase * 0.7) * 30;
            
            fill(r, g, b, 15);
            ellipse(wispX, wispY, wispSize, wispSize * 0.4);
            
            fill(r * 0.8, g * 0.8, b * 0.8, 8);
            ellipse(wispX - 20, wispY, wispSize * 0.7, wispSize * 0.3);
        }
        
        // Shooting stars
        for (let i = 0; i < 3; i++) {
            const starLife = (frameCount + i * 200) % 600;
            if (starLife < 120) {
                const progress = starLife / 120;
                const startX = -50 + i * 300;
                const startY = 50 + i * 150;
                const endX = width + 100;
                const endY = height - 100 - i * 100;
                
                const starX = lerp(startX, endX, progress);
                const starY = lerp(startY, endY, progress);
                
                // Shooting star trail
                stroke(255, 215, 0, 150 * (1 - progress));
                strokeWeight(3);
                line(starX, starY, starX - 30, starY + 15);
                
                // Shooting star core
                fill(255, 255, 255, 200 * (1 - progress));
                noStroke();
                ellipse(starX, starY, 4, 4);
                
                // Sparkle trail
                for (let j = 1; j <= 5; j++) {
                    const trailX = starX - j * 8;
                    const trailY = starY + j * 4;
                    const trailAlpha = (150 * (1 - progress)) / j;
                    fill(255, 215 - j * 20, 0, trailAlpha);
                    ellipse(trailX, trailY, 3 - j * 0.4, 3 - j * 0.4);
                }
            }
        }
        
        // Enhanced distant sparkles
        for (let i = 0; i < 20; i++) {
            const sparkleX = (i * 67) % width;
            const sparkleY = (i * 103) % height;
            const twinkle = sin(frameCount * 0.02 + i * 2) * 0.5 + 0.5;
            const colorPhase = frameCount * 0.008 + i;
            
            const sparkleColors = [
                [255, 215, 0],   // Gold
                [255, 182, 193], // Light pink
                [173, 216, 230], // Light blue
                [221, 160, 221], // Plum
                [255, 255, 224]  // Light yellow
            ];
            
            const colorIndex = Math.floor(colorPhase) % sparkleColors.length;
            const currentColor = sparkleColors[colorIndex];
            const alpha = 30 + twinkle * 40;
            
            fill(currentColor[0], currentColor[1], currentColor[2], alpha);
            noStroke();
            ellipse(sparkleX, sparkleY, 2 + twinkle, 2 + twinkle);
            
            // Add cross sparkle for brighter ones
            if (twinkle > 0.7) {
                stroke(currentColor[0], currentColor[1], currentColor[2], alpha * 0.8);
                strokeWeight(1);
                const sparkleSize = 4 + twinkle * 2;
                line(sparkleX - sparkleSize, sparkleY, sparkleX + sparkleSize, sparkleY);
                line(sparkleX, sparkleY - sparkleSize, sparkleX, sparkleY + sparkleSize);
                noStroke();
            }
        }
        
        // Distant galaxies
        for (let i = 0; i < 4; i++) {
            const galaxyX = (i * 200 + 100) % width;
            const galaxyY = (i * 150 + 80) % height;
            const rotation = frameCount * 0.002 + i;
            const galaxySize = 60 + sin(frameCount * 0.005 + i) * 15;
            
            push();
            translate(galaxyX, galaxyY);
            rotate(rotation);
            
            // Galaxy spiral arms
            for (let arm = 0; arm < 3; arm++) {
                push();
                rotate(arm * TWO_PI / 3);
                
                for (let r = 0; r < galaxySize; r += 3) {
                    const armAngle = r * 0.1;
                    const armX = cos(armAngle) * r;
                    const armY = sin(armAngle) * r;
                    const armAlpha = map(r, 0, galaxySize, 20, 2);
                    
                    fill(200, 150, 255, armAlpha);
                    ellipse(armX, armY, 3, 1);
                }
                pop();
            }
            
            // Galaxy core
            fill(255, 200, 255, 40);
            ellipse(0, 0, galaxySize * 0.3, galaxySize * 0.3);
            
            pop();
        }
        
        pop();
    }
    
    // Draw subtle space elements
    drawSubtleSpaceElements() {
        push();
        noStroke();
        
        // Subtle nebula hints
        fill(60, 40, 80, 15);
        ellipse(width * 0.2, height * 0.3, 200, 150);
        
        fill(50, 60, 90, 12);
        ellipse(width * 0.8, height * 0.7, 180, 120);
        
        // Static distant stars
        fill(200, 200, 255, 40);
        for (let i = 0; i < 6; i++) {
            const x = (i * width / 6) + (width / 12);
            const y = height * 0.15 + (i % 2) * height * 0.1;
            ellipse(x, y, 1, 1);
        }
        
        pop();
    }
    
    // Draw interactive background effects that respond to gameplay
    drawInteractiveBackgroundEffects() {
        push();
        
        // Player movement ripples
        if (window.player && window.player.isMoving) {
            const rippleIntensity = map(window.player.speed, 0, 5, 0, 1);
            for (let i = 0; i < 3; i++) {
                const rippleRadius = (frameCount * 2 + i * 20) % 100;
                const rippleAlpha = map(rippleRadius, 0, 100, 30 * rippleIntensity, 0);
                
                stroke(64, 224, 208, rippleAlpha);
                strokeWeight(2);
                noFill();
                ellipse(window.player.x, window.player.y, rippleRadius, rippleRadius);
            }
        }
        
        // Health-based background tint
        if (window.player) {
            const healthPercent = window.player.health / window.player.maxHealth;
            if (healthPercent < 0.3) {
                // Red danger tint when low health
                const dangerPulse = sin(frameCount * 0.2) * 0.5 + 0.5;
                fill(255, 0, 0, dangerPulse * 15 * (1 - healthPercent));
                noStroke();
                rect(0, 0, width, height);
            } else if (healthPercent > 0.9) {
                // Subtle blue healing glow when healthy
                fill(0, 150, 255, 8);
                noStroke();
                rect(0, 0, width, height);
            }
        }
        
        // Score-based cosmic energy
        if (window.gameState && window.gameState.score > 0) {
            const energyLevel = min(window.gameState.score / 1000, 1);
            for (let i = 0; i < 5; i++) {
                const energyX = random(width);
                const energyY = random(height);
                const energySize = random(10, 30) * energyLevel;
                const energyAlpha = random(5, 15) * energyLevel;
                
                fill(255, 215, 0, energyAlpha);
                noStroke();
                ellipse(energyX, energyY, energySize, energySize);
            }
        }
        
        // Kill streak effects
        if (window.gameState && window.gameState.killStreak >= 5) {
            const streakIntensity = min(window.gameState.killStreak / 10, 1);
            
            // Pulsing border effect
            const borderPulse = sin(frameCount * 0.3) * 0.5 + 0.5;
            stroke(255, 100, 255, borderPulse * 100 * streakIntensity);
            strokeWeight(4);
            noFill();
            rect(5, 5, width - 10, height - 10);
            
            // Floating energy orbs
            for (let i = 0; i < window.gameState.killStreak && i < 15; i++) {
                const orbX = 50 + (i % 5) * 40;
                const orbY = 50 + Math.floor(i / 5) * 30;
                const orbPulse = sin(frameCount * 0.1 + i) * 0.5 + 0.5;
                
                fill(255, 100, 255, orbPulse * 150);
                noStroke();
                ellipse(orbX, orbY, 8 + orbPulse * 4, 8 + orbPulse * 4);
            }
        }
        
        pop();
    }
    
    // Reset background renderer
    reset() {
        this.parallaxLayers = [];
        this.parallaxInitialized = false;
    }
}

// Create global background renderer instance
window.backgroundRenderer = new BackgroundRenderer(); 