import { floor } from '../mathUtils.js';
import { GAME_OVER_MESSAGES, FUNNY_COMMENTS } from './UIConstants.js';

/**
 * Full-screen overlay renderers for game over and pause states.
 * Pure functions — only read from gameState.
 */

export function drawGameOver(p, gameState) {
  if (!gameState) return;

  p.push();

  // Semi-transparent overlay
  p.fill(0, 0, 0, 150);
  p.rect(0, 0, p.width, p.height);

  const messageIndex =
    GAME_OVER_MESSAGES.length > 0
      ? floor(gameState.score / 50) % GAME_OVER_MESSAGES.length
      : 0;
  const gameOverMessage =
    GAME_OVER_MESSAGES.length > 0
      ? (GAME_OVER_MESSAGES[messageIndex] ?? '')
      : '';
  const isNewHighScore = gameState.score > gameState.highScore;

  // Game over text with animation
  p.textFont('monospace');
  p.fill(255, 20, 147); // Hot pink
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(48 + p.sin(p.frameCount * 0.1) * 4);

  // Additive glow for title
  p.blendMode(p.ADD);
  p.text(gameOverMessage, p.width / 2, p.height / 2 - 80);
  p.blendMode(p.BLEND);

  p.stroke(255, 255, 255);
  p.strokeWeight(2);
  p.text(gameOverMessage, p.width / 2, p.height / 2 - 80);
  p.noStroke();

  // New high score celebration
  if (isNewHighScore) {
    p.fill(0, 255, 255); // Cyan
    p.textSize(20 + p.sin(p.frameCount * 0.2) * 3);
    p.text('NEW HIGH SCORE! 🎉', p.width / 2, p.height / 2 - 50);
  }

  // Score and level
  p.fill(255);
  p.textSize(24);
  p.text(
    `FINAL SCORE: ${gameState.score.toLocaleString()}`,
    p.width / 2,
    p.height / 2 - 10
  );
  p.text(`LEVEL REACHED: ${gameState.level}`, p.width / 2, p.height / 2 + 20);

  // Stats
  p.fill(0, 255, 255); // Cyan
  p.textSize(16);
  p.text(
    `ENEMIES KILLED: ${gameState.totalKills}`,
    p.width / 2,
    p.height / 2 + 45
  );
  const accuracy = gameState.getAccuracy();
  p.text(`ACCURACY: ${accuracy}%`, p.width / 2, p.height / 2 + 65);

  // High score display
  p.fill(255, 215, 0); // Gold
  p.textSize(18);
  p.text(
    `HIGH SCORE: ${gameState.highScore.toLocaleString()}`,
    p.width / 2,
    p.height / 2 + 90
  );

  // Funny comment
  p.fill(255, 20, 147); // Pink
  p.textSize(16);
  const commentIndex =
    FUNNY_COMMENTS.length > 0
      ? floor(gameState.score / 30) % FUNNY_COMMENTS.length
      : 0;
  p.text(FUNNY_COMMENTS[commentIndex] ?? '', p.width / 2, p.height / 2 + 115);

  // Restart instruction
  p.fill(255);
  p.textSize(16);
  // Blinking effect
  if (p.frameCount % 60 < 40) {
    p.text('PRESS R TO RESTART', p.width / 2, p.height / 2 + 145);
  }

  p.pop();
}

export function drawPauseScreen(p, gameState) {
  if (!gameState) return;

  p.push();
  p.textFont('monospace');

  // Semi-transparent overlay
  p.fill(5, 2, 15, 200); // Darker blue-purple tint
  p.rect(0, 0, p.width, p.height);

  // Pause text with synthwave style
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(48);

  // Cyan glow layer
  p.blendMode(p.ADD);
  p.fill(0, 255, 255, 150);
  p.text('PAUSED', p.width / 2, p.height / 2 - 40);
  p.blendMode(p.BLEND);

  // Sharp white core text with cyan border
  p.stroke(0, 255, 255);
  p.strokeWeight(2);
  p.fill(255, 255, 255);
  p.text('PAUSED', p.width / 2, p.height / 2 - 40);
  p.noStroke();

  // Instructions
  p.fill(0, 255, 255);
  p.textSize(20);
  if (p.frameCount % 60 < 40) {
    p.text('PRESS P TO RESUME', p.width / 2, p.height / 2 + 20);
  }

  // Current stats
  p.fill(255, 20, 147); // Hot pink
  p.textSize(16);
  p.text(
    `SCORE: ${gameState.score.toLocaleString()}`,
    p.width / 2,
    p.height / 2 + 60
  );
  p.text(
    `LEVEL: ${gameState.level} | KILLS: ${gameState.totalKills}`,
    p.width / 2,
    p.height / 2 + 80
  );

  if (gameState.killStreak >= 5) {
    p.fill(255, 215, 0); // Gold for streak
    p.text(
      `⚡ ${gameState.killStreak}X KILL STREAK! ⚡`,
      p.width / 2,
      p.height / 2 + 100
    );
  }

  p.pop();
}
