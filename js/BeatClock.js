/**
 * BeatClock - Musical Timing System for Vibe Game
 * 
 * Creates a subtle rhythmic foundation where enemy combat actions sync to musical beats.
 * The player can shoot freely, but enemies create the musical structure:
 * - Player = Free shooting (creates natural hi-hat feel)
 * - Grunts = Snare (beats 2 & 4) 
 * - Tanks = Bass drum (beat 1)
 * - Stabbers = Off-beat accent (beat 3.5)
 * 
 * This creates an emergent musical experience that players discover organically.
 */

class BeatClock {
    constructor(bpm = 120) {
        this.bpm = bpm;
        this.beatInterval = (60 / bpm) * 1000; // milliseconds per beat
        this.startTime = Date.now();
        this.tolerance = 100; // ms tolerance for "on beat" detection
        
        // Beat pattern tracking (4/4 time signature)
        this.beatsPerMeasure = 4;
        
        console.log(`🎵 BeatClock initialized: ${bpm} BPM (${this.beatInterval}ms per beat)`);
    }
    
    // Get current beat number (0-based, resets every measure)
    getCurrentBeat() {
        const elapsed = Date.now() - this.startTime;
        const totalBeats = Math.floor(elapsed / this.beatInterval);
        return totalBeats % this.beatsPerMeasure; // 0, 1, 2, 3, 0, 1, 2, 3...
    }
    
    // Get total beats since start (for longer patterns)
    getTotalBeats() {
        const elapsed = Date.now() - this.startTime;
        return Math.floor(elapsed / this.beatInterval);
    }
    
    // Time until next beat
    getTimeToNextBeat() {
        const elapsed = Date.now() - this.startTime;
        const timeSinceLastBeat = elapsed % this.beatInterval;
        return this.beatInterval - timeSinceLastBeat;
    }
    
    // Check if we're currently on a beat (within tolerance)
    // Can optionally accept an array of beat numbers to check against
    isOnBeat(beats = null) {
        const timeToNext = this.getTimeToNextBeat();
        const onBeat = timeToNext <= this.tolerance || timeToNext >= (this.beatInterval - this.tolerance);
        
        // If no specific beats requested, return general on-beat status
        if (!beats || !Array.isArray(beats)) {
            return onBeat;
        }
        
        // If specific beats requested, check if current beat is in the array
        if (!onBeat) return false;
        
        const currentBeat = this.getCurrentBeat() + 1; // Convert to 1-indexed for comparison
        return beats.includes(currentBeat);
    }
    
    // PLAYER TIMING: Free shooting (not restricted, but creates natural hi-hat feel)
    canPlayerShoot() {
        return this.isOnBeat(); // Available for audio timing, but player shooting is unrestricted
    }
    
    // NEW: PLAYER QUARTER-BEAT SHOOTING - 4x faster while staying synced to cosmic beat
    canPlayerShootQuarterBeat() {
        const elapsed = Date.now() - this.startTime;
        const quarterBeatInterval = this.beatInterval / 4; // 125ms at 120 BPM
        const timeSinceLastQuarterBeat = elapsed % quarterBeatInterval;
        
        // Allow shooting within tolerance of any quarter beat
        return timeSinceLastQuarterBeat <= this.tolerance || 
               timeSinceLastQuarterBeat >= (quarterBeatInterval - this.tolerance);
    }
    
    // Get time until next quarter beat for queuing
    getTimeToNextQuarterBeat() {
        const elapsed = Date.now() - this.startTime;
        const quarterBeatInterval = this.beatInterval / 4;
        const timeSinceLastQuarterBeat = elapsed % quarterBeatInterval;
        return quarterBeatInterval - timeSinceLastQuarterBeat;
    }
    
    // GRUNT TIMING: Beats 2 and 4 (snare pattern)
    canGruntShoot() {
        if (!this.isOnBeat()) return false;
        const currentBeat = this.getCurrentBeat();
        return currentBeat === 1 || currentBeat === 3; // Beats 2 and 4 (0-indexed)
    }
    
    // TANK TIMING: Beat 1 only (bass drum pattern)
    canTankShoot() {
        if (!this.isOnBeat()) return false;
        const currentBeat = this.getCurrentBeat();
        return currentBeat === 0; // Beat 1 (0-indexed)
    }
    
    // STABBER TIMING: Off-beat (syncopated, creates tension)
    canStabberAttack() {
        const elapsed = Date.now() - this.startTime;
        const beatPosition = (elapsed % this.beatInterval) / this.beatInterval;
        
        // Attack on beat 3.5 (75% through beat 3, or 25% through beat 4)
        const currentBeat = this.getCurrentBeat();
        if (currentBeat === 2) { // Beat 3 (0-indexed)
            return beatPosition >= 0.75; // Last quarter of beat 3
        }
        if (currentBeat === 3) { // Beat 4 (0-indexed)
            return beatPosition <= 0.25; // First quarter of beat 4
        }
        return false;
    }
    
    // RUSHER TIMING: Can charge on any beat, but explode on strong beats (1 or 3)
    canRusherCharge() {
        return this.isOnBeat();
    }
    
    canRusherExplode() {
        if (!this.isOnBeat()) return false;
        const currentBeat = this.getCurrentBeat();
        return currentBeat === 0 || currentBeat === 2; // Beats 1 and 3 (0-indexed)
    }
    
    // Get beat info for debugging
    getBeatInfo() {
        return {
            currentBeat: this.getCurrentBeat() + 1, // 1-indexed for display
            totalBeats: this.getTotalBeats(),
            timeToNext: Math.round(this.getTimeToNextBeat()),
            onBeat: this.isOnBeat(),
            bpm: this.bpm
        };
    }
    
    // Adjust tempo (for dynamic music)
    setBPM(newBPM) {
        this.bpm = newBPM;
        this.beatInterval = (60 / newBPM) * 1000;
        console.log(`🎵 Tempo changed to ${newBPM} BPM`);
    }
    
    // Reset timing (for level transitions)
    reset() {
        this.startTime = Date.now();
        console.log('🎵 BeatClock reset');
    }
}

// Global beat clock instance
window.beatClock = new BeatClock(120); // Start at 120 BPM 