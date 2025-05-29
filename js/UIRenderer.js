/**
 * UIRenderer.js - Handles all UI drawing including HUD, game over screen, pause screen, and bomb indicators
 */

class UIRenderer {
    constructor() {
        // UI state
        this.dashElement = null;
        this.gameOverMessages = [
            'GAME OVER',
            'YOU GOT VIBED',
            'ALIEN SUPERIORITY',
            'SPACE REKT',
            'COSMIC FAIL'
        ];
        
        this.funnyComments = [
            'The aliens are laughing at you!',
            'Maybe try not getting exploded?',
            'Space is hard, who knew?',
            'The rushers send their regards',
            'Better luck next time, earthling!'
        ];
    }
    
    // Update HTML UI elements
    updateUI() {
        if (!window.gameState || !window.player) return;
        
        // Update main UI elements with enhanced formatting
        const scoreText = window.gameState.killStreak >= 5 
            ? `Score: ${window.gameState.score.toLocaleString()} (${window.gameState.killStreak}x STREAK!)`
            : `Score: ${window.gameState.score.toLocaleString()}`;
        
        document.getElementById('score').textContent = scoreText;
        document.getElementById('health').textContent = `Health: ${window.player.health}`;
        document.getElementById('level').textContent = `Level: ${window.gameState.level}`;
        
        // Add dash cooldown indicator
        this.updateDashIndicator();
        
        // Update audio system
        if (window.audioManager) {
            window.audioManager.updateTexts();
        }
    }
    
    // Update dash cooldown indicator
    updateDashIndicator() {
        if (!this.dashElement) {
            this.dashElement = document.createElement('div');
            this.dashElement.id = 'dash';
            this.dashElement.style.cssText = 'position: absolute; top: 120px; left: 10px; color: white; font-family: monospace; font-size: 14px;';
            document.body.appendChild(this.dashElement);
        }
        
        if (window.player.dashCooldown > 0) {
            const cooldownSeconds = (window.player.dashCooldown / 60).toFixed(1);
            this.dashElement.textContent = `Dash: ${cooldownSeconds}s`;
            this.dashElement.style.color = '#ff6666';
        } else {
            this.dashElement.textContent = 'Dash: READY (Space)';
            this.dashElement.style.color = '#66ff66';
        }
    }
    
    // Draw game over screen
    drawGameOver() {
        if (!window.gameState) return;
        
        push();
        
        // Semi-transparent overlay
        fill(0, 0, 0, 150);
        rect(0, 0, width, height);
        
        // Check for new high score
        let isNewHighScore = false;
        if (window.gameState.score > window.gameState.highScore) {
            window.gameState.updateHighScore();
            isNewHighScore = true;
        }
        
        // Game over text with animation
        fill(255, 100, 100);
        textAlign(CENTER, CENTER);
        textSize(48 + sin(frameCount * 0.1) * 4);
        const messageIndex = Math.floor(window.gameState.score / 50) % this.gameOverMessages.length;
        text(this.gameOverMessages[messageIndex], width/2, height/2 - 80);
        
        // New high score celebration
        if (isNewHighScore) {
            fill(255, 255, 0);
            textSize(20 + sin(frameCount * 0.2) * 3);
            text('🎉 NEW HIGH SCORE! 🎉', width/2, height/2 - 50);
        }
        
        // Score and level
        fill(255);
        textSize(24);
        text(`Final Score: ${window.gameState.score.toLocaleString()}`, width/2, height/2 - 10);
        text(`Level Reached: ${window.gameState.level}`, width/2, height/2 + 20);
        
        // Stats
        fill(200, 200, 255);
        textSize(16);
        text(`Enemies Killed: ${window.gameState.totalKills}`, width/2, height/2 + 45);
        const accuracy = window.gameState.getAccuracy();
        text(`Accuracy: ${accuracy}%`, width/2, height/2 + 65);
        
        // High score display
        fill(255, 255, 100);
        textSize(18);
        text(`High Score: ${window.gameState.highScore.toLocaleString()}`, width/2, height/2 + 90);
        
        // Funny comment
        fill(255, 255, 100);
        textSize(16);
        const commentIndex = Math.floor(window.gameState.score / 30) % this.funnyComments.length;
        text(this.funnyComments[commentIndex], width/2, height/2 + 115);
        
        // Restart instruction
        fill(255);
        textSize(16);
        text('Press R to restart', width/2, height/2 + 140);
        
        pop();
    }
    
    // Draw pause screen
    drawPauseScreen() {
        if (!window.gameState) return;
        
        push();
        
        // Semi-transparent overlay
        fill(0, 0, 0, 100);
        rect(0, 0, width, height);
        
        // Pause text
        fill(255, 255, 255);
        textAlign(CENTER, CENTER);
        textSize(48);
        text('PAUSED', width/2, height/2 - 40);
        
        // Instructions
        fill(200, 200, 200);
        textSize(20);
        text('Press P to resume', width/2, height/2 + 20);
        
        // Current stats
        fill(255, 255, 100);
        textSize(16);
        text(`Score: ${window.gameState.score.toLocaleString()}`, width/2, height/2 + 60);
        text(`Level: ${window.gameState.level} | Kills: ${window.gameState.totalKills}`, width/2, height/2 + 80);
        
        if (window.gameState.killStreak >= 5) {
            fill(255, 100, 100);
            text(`🔥 ${window.gameState.killStreak}x KILL STREAK! 🔥`, width/2, height/2 + 100);
        }
        
        pop();
    }
    
    // Draw bomb countdown indicators
    drawBombs() {
        if (!window.activeBombs) return;
        
        push();
        
        // Draw bomb countdown indicators
        for (const bomb of window.activeBombs) {
            const screenX = bomb.x - (window.cameraSystem ? window.cameraSystem.x : 0);
            const screenY = bomb.y - (window.cameraSystem ? window.cameraSystem.y : 0);
            
            // Calculate countdown
            const secondsLeft = Math.ceil(bomb.timer / 60);
            const progress = bomb.timer / bomb.maxTimer;
            
            // Pulsing red warning circle
            const pulseIntensity = 1 + sin(frameCount * 0.3) * 0.3;
            const warningSize = 60 * pulseIntensity;
            
            // Warning circle color (red to yellow as time runs out)
            const red = 255;
            const green = progress * 255;
            const blue = 0;
            
            stroke(red, green, blue, 200);
            strokeWeight(4);
            noFill();
            circle(screenX, screenY, warningSize);
            
            // Countdown text
            fill(255, 255, 255);
            textAlign(CENTER, CENTER);
            textSize(24);
            strokeWeight(2);
            stroke(0, 0, 0);
            text(secondsLeft, screenX, screenY);
            
            // "BOMB" label
            textSize(12);
            fill(255, 0, 0);
            text("BOMB", screenX, screenY - 35);
        }
        
        pop();
    }
    
    // Draw level progress indicator
    drawLevelProgress() {
        if (!window.gameState) return;
        
        push();
        
        const progress = window.gameState.getProgressToNextLevel();
        const barWidth = 200;
        const barHeight = 8;
        const barX = width - barWidth - 20;
        const barY = 20;
        
        // Background bar
        fill(50, 50, 50, 150);
        noStroke();
        rect(barX, barY, barWidth, barHeight);
        
        // Progress bar
        fill(100, 255, 100, 200);
        rect(barX, barY, barWidth * progress, barHeight);
        
        // Border
        stroke(255, 255, 255, 100);
        strokeWeight(1);
        noFill();
        rect(barX, barY, barWidth, barHeight);
        
        // Label
        fill(255, 255, 255);
        textAlign(RIGHT, TOP);
        textSize(12);
        noStroke();
        text(`Level ${window.gameState.level} Progress`, barX + barWidth, barY - 15);
        
        pop();
    }
    
    // Draw kill streak indicator
    drawKillStreakIndicator() {
        if (!window.gameState || window.gameState.killStreak < 3) return;
        
        push();
        
        const streak = window.gameState.killStreak;
        const x = width / 2;
        const y = 80;
        
        // Pulsing effect for high streaks
        const pulse = sin(frameCount * 0.2) * 0.5 + 0.5;
        const intensity = Math.min(streak / 10, 1);
        
        // Background glow
        fill(255, 100, 100, 50 + pulse * 50 * intensity);
        noStroke();
        ellipse(x, y, 120 + pulse * 20, 40 + pulse * 10);
        
        // Text
        fill(255, 255, 255);
        textAlign(CENTER, CENTER);
        textSize(16 + pulse * 4);
        text(`${streak}x KILL STREAK!`, x, y);
        
        // Fire effects for high streaks
        if (streak >= 10) {
            fill(255, 150, 0, 100 + pulse * 100);
            textSize(20 + pulse * 6);
            text('🔥 ON FIRE! 🔥', x, y + 25);
        }
        
        pop();
    }
    
    // Draw health bar
    drawHealthBar() {
        if (!window.player) return;
        
        push();
        
        const healthPercent = window.player.health / window.player.maxHealth;
        const barWidth = 150;
        const barHeight = 12;
        const barX = 20;
        const barY = height - 40;
        
        // Background bar
        fill(50, 50, 50, 150);
        noStroke();
        rect(barX, barY, barWidth, barHeight);
        
        // Health bar color based on health level
        if (healthPercent > 0.6) {
            fill(100, 255, 100, 200); // Green
        } else if (healthPercent > 0.3) {
            fill(255, 255, 100, 200); // Yellow
        } else {
            fill(255, 100, 100, 200); // Red
        }
        
        rect(barX, barY, barWidth * healthPercent, barHeight);
        
        // Border
        stroke(255, 255, 255, 100);
        strokeWeight(1);
        noFill();
        rect(barX, barY, barWidth, barHeight);
        
        // Health text
        fill(255, 255, 255);
        textAlign(LEFT, BOTTOM);
        textSize(12);
        noStroke();
        text(`Health: ${window.player.health}/${window.player.maxHealth}`, barX, barY - 5);
        
        pop();
    }
    
    // Draw all UI elements
    drawUI() {
        // Draw in-game UI elements
        this.drawLevelProgress();
        this.drawKillStreakIndicator();
        this.drawHealthBar();
        this.drawBombs();
        
        // Draw overlays based on game state
        if (window.gameState) {
            switch (window.gameState.gameState) {
                case 'gameOver':
                    this.drawGameOver();
                    break;
                case 'paused':
                    this.drawPauseScreen();
                    break;
            }
        }
    }
    
    // Handle key presses for UI
    handleKeyPress(key) {
        if (!window.gameState) return false;
        
        if (key === 'r' || key === 'R') {
            if (window.gameState.gameState === 'gameOver') {
                window.gameState.restart();
                return true;
            }
        }
        
        if (key === 'p' || key === 'P') {
            if (window.gameState.gameState === 'playing') {
                window.gameState.setGameState('paused');
                console.log('⏸️ Game paused');
                return true;
            } else if (window.gameState.gameState === 'paused') {
                window.gameState.setGameState('playing');
                console.log('▶️ Game resumed');
                return true;
            }
        }
        
        if (key === 'm' || key === 'M') {
            if (window.audio) {
                const soundEnabled = window.audio.toggle();
                console.log('Sound ' + (soundEnabled ? 'enabled' : 'disabled'));
                document.getElementById('soundStatus').textContent = soundEnabled 
                    ? '🔊 Sound ON (M to toggle)' 
                    : '🔇 Sound OFF (M to toggle)';
                return true;
            }
        }
        
        if (key === 't' || key === 'T') {
            // Toggle test mode using the new modular system
            if (window.testModeManager) {
                const enabled = window.testModeManager.toggle();
                return true;
            }
        }
        
        if (key === ' ') {
            // Dash with spacebar
            if (window.gameState.gameState === 'playing' && window.player && window.player.dash()) {
                console.log('💨 Player dash activated!');
                // Add screen shake for dramatic dash effect
                if (window.cameraSystem) {
                    window.cameraSystem.addShake(6, 12);
                }
                return true;
            }
        }
        
        return false;
    }
    
    // Reset UI renderer
    reset() {
        if (this.dashElement) {
            this.dashElement.remove();
            this.dashElement = null;
        }
    }
}

// Create global UI renderer instance
window.uiRenderer = new UIRenderer(); 