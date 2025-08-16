// errorHandler.js (migrated from js/ to packages/tooling/src/)
// Centralized error handling utilities for Vibe

import { CONFIG } from '../../core/src/config.js';
import fs from 'fs/promises';
import path from 'path';
import { DebugLogger } from './DebugLogger.js';

process.on('uncaughtException', (err) => {
  DebugLogger.log('Uncaught Exception', err);
  // In production, you may want to gracefully shutdown
  if (CONFIG.ENVIRONMENT === 'production') {
    // Perform cleanup and exit
    process.exit(1);
  }
});

process.on('unhandledRejection', (err) => {
  DebugLogger.log('Unhandled Rejection', err);
  // In production, you may want to gracefully shutdown
  if (CONFIG.ENVIRONMENT === 'production') {
    // Perform cleanup and exit
    process.exit(1);
  }
});

/**
 * Enhanced error class with context
 */
export class VibeError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'VibeError';
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Safely create directory with error handling
 */
export async function ensureDirectory(dirPath, options = { recursive: true }) {
  try {
    await fs.mkdir(dirPath, options);
    console.log(`📁 Directory created: ${dirPath}`);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') {
      // Directory already exists, that's fine
      return true;
    }
    console.error(`❌ Failed to create directory ${dirPath}:`, error.message);
    throw new VibeError(`Directory creation failed: ${dirPath}`, {
      originalError: error,
      path: dirPath,
      operation: 'mkdir',
    });
  }
}

/**
 * Safely read file with error handling
 */
export async function safeReadFile(filePath, encoding = 'utf8') {
  try {
    const content = await fs.readFile(filePath, encoding);
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`⚠️ File not found: ${filePath}`);
      return null;
    }
    console.error(`❌ Failed to read file ${filePath}:`, error.message);
    throw new VibeError(`File read failed: ${filePath}`, {
      originalError: error,
      path: filePath,
      operation: 'readFile',
    });
  }
}

/**
 * Safely write file with error handling
 */
export async function safeWriteFile(filePath, content, options = {}) {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await ensureDirectory(dir);
    await fs.writeFile(filePath, content, options);
    console.log(`💾 File written: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to write file ${filePath}:`, error.message);
    throw new VibeError(`File write failed: ${filePath}`, {
      originalError: error,
      path: filePath,
      operation: 'writeFile',
    });
  }
}

/**
 * Retry function with exponential backoff
 */
export async function retryOperation(
  operation,
  maxRetries = 3,
  baseDelay = 1000
) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) {
        break;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(
        `⚠️ Attempt ${attempt} failed, retrying in ${delay}ms:`,
        error.message
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new VibeError(`Operation failed after ${maxRetries} attempts`, {
    originalError: lastError,
    attempts: maxRetries,
  });
}

/**
 * Validate import availability
 */
export async function validateImport(modulePath) {
  try {
    await import(modulePath);
    return true;
  } catch (error) {
    console.error(`❌ Failed to import ${modulePath}:`, error.message);
    throw new VibeError(`Import validation failed: ${modulePath}`, {
      originalError: error,
      module: modulePath,
    });
  }
}

/**
 * Log error with context
 */
export function logError(error, context = {}) {
  const errorInfo = {
    message: error.message,
    name: error.name,
    timestamp: new Date().toISOString(),
    context,
  };
  if (error instanceof VibeError) {
export function validateApiResponse(response, context = {}) {
  if (!response) {
    throw new VibeError('API response is null or undefined', context);
  }
  if (!response.ok) {
    throw new VibeError(
      `API request failed: ${response.status} ${response.statusText}`,
      {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        ...context,
      }
    );
  }
  return response;
}
      `API request failed: ${response.status} ${response.statusText}`,
      {
        status: response.status,
        statusText: response.statusText,
export function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('⚠️ Failed to parse JSON, returning default value');
    // Only log a truncated version to avoid exposing sensitive data
    const truncatedInput =
      jsonString && jsonString.length > 100
        ? jsonString.substring(0, 100) + '...'
        : jsonString;
    logError(error, {
      operation: 'jsonParse',
      inputLength: jsonString?.length,
      inputPreview: truncatedInput,
    });
    return defaultValue;
  }
}
 * Safe JSON parse with error handling
 */
export function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('⚠️ Failed to parse JSON, returning default value');
    logError(error, { operation: 'jsonParse', input: jsonString });
    return defaultValue;
  }
}
