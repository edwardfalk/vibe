/**
 * Configuration file for Vibe game
 * Set your API keys and settings here
 */

const CONFIG = {
    // Google Cloud Text-to-Speech API Key
    // Get your API key from: https://console.cloud.google.com/apis/credentials
    // Make sure to enable the Text-to-Speech API for your project
    GOOGLE_CLOUD_TTS_API_KEY: 'AIzaSyDU_4kdSpkB_Rs4Aas3fv3DaMEciUvlCoY',
    
    // TTS Settings
    TTS_SETTINGS: {
        // Set to true to use Google Cloud TTS (requires API key)
        // Set to false to use browser's built-in Web Speech API
        USE_CLOUD_TTS: false,
        
        // Volume multiplier for all TTS (0.0 to 1.0)
        TTS_VOLUME: 0.6,
        
        // Enable audio effects (reverb, distortion, etc.)
        ENABLE_AUDIO_EFFECTS: true,
        
        // Cache TTS audio to improve performance
        ENABLE_AUDIO_CACHE: true
    },
    
    // Game Settings
    GAME_SETTINGS: {
        // Enable verbose logging for debugging
        DEBUG_MODE: false,
        
        // Speech frequency (seconds between ambient speech)
        SPEECH_FREQUENCY: {
            MIN: 5,
            MAX: 15
        }
    }
};

// Export for use in other files
window.CONFIG = CONFIG; 