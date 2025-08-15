// CombatOps.js – Extracted combat-related operations from GameLoop.js
import { BulletSystem, BombSystem } from '@vibe/systems';

export function updateBullets() {
  BulletSystem.update();
}

export function updateBombs() {
  BombSystem.update();
}

export function processBulletCollisions() {
  if (window.collisionSystem) {
    window.collisionSystem.checkBulletCollisions();
  }
}

export function processContactCollisions() {
  if (window.collisionSystem) {
    window.collisionSystem.checkContactCollisions();
  }
}
