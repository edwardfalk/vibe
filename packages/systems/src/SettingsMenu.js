/**
 * SettingsMenu.js - In-game settings menu for adjusting audio, visuals, and gameplay values
 */

export class SettingsMenu {
  constructor(audio, effectsConfig, p) {
    this.audio = audio;
    this.effectsConfig = effectsConfig;
    this.p = p;
    
    this.visible = false;
    this.selectedIndex = 0;
    
    // Settings categories and values
    this.settings = [
      {
        category: 'Audio',
        items: [
          { 
            name: 'Master Volume', 
            key: 'masterVolume', 
            min: 0, 
            max: 1, 
            step: 0.1,
            getValue: () => this.audio.volume,
            setValue: (value) => { this.audio.volume = value; }
          },
          { 
            name: 'Player Speech Volume', 
            key: 'playerSpeech', 
            min: 0, 
            max: 1, 
            step: 0.1,
            getValue: () => this.audio.voiceConfig.player.volume,
            setValue: (value) => { this.audio.voiceConfig.player.volume = value; }
          },
          { 
            name: 'Grunt Speech Volume', 
            key: 'gruntSpeech', 
            min: 0, 
            max: 1, 
            step: 0.1,
            getValue: () => this.audio.voiceConfig.grunt.volume,
            setValue: (value) => { this.audio.voiceConfig.grunt.volume = value; }
          },
          { 
            name: 'Stabber Speech Volume', 
            key: 'stabberSpeech', 
            min: 0, 
            max: 1, 
            step: 0.1,
            getValue: () => this.audio.voiceConfig.stabber.volume,
            setValue: (value) => { this.audio.voiceConfig.stabber.volume = value; }
          }
        ]
      },
      {
        category: 'Visual Effects',
        items: [
          { 
            name: 'Enemy Glow Intensity', 
            key: 'enemyGlow', 
            min: 0, 
            max: 200, 
            step: 10,
            getValue: () => this.effectsConfig.grunt.glow.alpha,
            setValue: (value) => { 
              this.effectsConfig.grunt.glow.alpha = value;
              this.effectsConfig.stabber.glow.alpha = value * 0.9;
              this.effectsConfig.rusher.glow.alpha = value * 0.85;
              this.effectsConfig.tank.glow.alpha = value * 0.8;
            }
          }
        ]
      }
    ];
    
    // Flatten all items for navigation
    this.allItems = [];
    this.settings.forEach(category => {
      this.allItems.push({ type: 'category', name: category.category });
      category.items.forEach(item => {
        this.allItems.push({ type: 'setting', ...item });
      });
    });
  }
  
  toggle() {
    this.visible = !this.visible;
    console.log(`⚙️ Settings menu ${this.visible ? 'opened' : 'closed'}`);
  }
  
  handleKey(key) {
    if (!this.visible) return false;
    
    if (key === 'ArrowUp') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      return true;
    }
    
    if (key === 'ArrowDown') {
      this.selectedIndex = Math.min(this.allItems.length - 1, this.selectedIndex + 1);
      return true;
    }
    
    const currentItem = this.allItems[this.selectedIndex];
    if (currentItem && currentItem.type === 'setting') {
      if (key === 'ArrowLeft') {
        const newValue = Math.max(currentItem.min, currentItem.getValue() - currentItem.step);
        currentItem.setValue(newValue);
        console.log(`⚙️ ${currentItem.name}: ${newValue.toFixed(1)}`);
        return true;
      }
      
      if (key === 'ArrowRight') {
        const newValue = Math.min(currentItem.max, currentItem.getValue() + currentItem.step);
        currentItem.setValue(newValue);
        console.log(`⚙️ ${currentItem.name}: ${newValue.toFixed(1)}`);
        return true;
      }
    }
    
    return false;
  }
  
  draw(p) {
    if (!this.visible) return;
    
    p.push();
    
    // Semi-transparent background
    p.fill(0, 0, 0, 150);
    p.rect(0, 0, p.width, p.height);
    
    // Settings panel background
    const panelX = p.width / 2 - 200;
    const panelY = p.height / 2 - 250;
    const panelW = 400;
    const panelH = 500;
    
    p.fill(20, 25, 40);
    p.stroke(100, 150, 255);
    p.strokeWeight(2);
    p.rect(panelX, panelY, panelW, panelH);
    
    // Title
    p.fill(255, 255, 255);
    p.textAlign(p.CENTER, p.TOP);
    p.textSize(24);
    p.text('⚙️ SETTINGS', panelX + panelW / 2, panelY + 20);
    
    // Instructions
    p.fill(150, 150, 150);
    p.textSize(14);
    p.text('Arrow keys to navigate • S to close', panelX + panelW / 2, panelY + 55);
    
    // Settings items
    let yOffset = 90;
    
    this.allItems.forEach((item, index) => {
      const y = panelY + yOffset;
      const isSelected = index === this.selectedIndex;
      
      if (item.type === 'category') {
        // Category header
        p.fill(255, 200, 100);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(18);
        p.text(item.name, panelX + 20, y);
        yOffset += 30;
      } else {
        // Setting item
        if (isSelected) {
          p.fill(50, 100, 200, 100);
          p.noStroke();
          p.rect(panelX + 10, y - 5, panelW - 20, 25);
        }
        
        p.fill(isSelected ? 255 : 200);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(16);
        p.text(item.name, panelX + 20, y);
        
        // Value and controls
        const value = item.getValue();
        const percentage = ((value - item.min) / (item.max - item.min)) * 100;
        
        p.textAlign(p.RIGHT, p.TOP);
        if (isSelected) {
          p.fill(100, 255, 100);
        } else {
          p.fill(150);
        }
        p.text(`${value.toFixed(1)} (${percentage.toFixed(0)}%)`, panelX + panelW - 20, y);
        
        if (isSelected) {
          p.fill(100, 150, 255);
          p.textSize(12);
          p.textAlign(p.RIGHT, p.TOP);
          p.text('← →', panelX + panelW - 20, y + 18);
        }
        
        yOffset += 35;
      }
    });
    
    p.pop();
  }
}