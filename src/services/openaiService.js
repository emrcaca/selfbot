/**
 * OpenAI Compatible API Service
 * 
 * Handles communication with OpenAI-compatible APIs including NVIDIA NIM.
 * Used for AI-powered responses to bot mentions.
 * 
 * @module services/openaiService
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const configManager = require('../config/manager');
const { Loggers } = require('../utils/logger');

// ============================================================================
// CONSTANTS
// ============================================================================

/** Path to system prompt file */
const SYSTEM_PROMPT_PATH = path.join(__dirname, '..', 'config', 'prompt.md');

/** Maximum response length for Discord messages */
const MAX_RESPONSE_LENGTH = 2000;

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT = 30000; // 30 seconds

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Cached API configuration */
let apiConfig = null;

/** Cached system prompt */
let cachedSystemPrompt = null;

/**
 * Load system prompt from file
 * 
 * @returns {string} System prompt content
 */
function loadSystemPrompt() {
    if (cachedSystemPrompt) {
        return cachedSystemPrompt;
    }

    try {
        if (fs.existsSync(SYSTEM_PROMPT_PATH)) {
            const content = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8').trim();
            if (content) {
                cachedSystemPrompt = content;
                Loggers.Bot.info('System prompt loaded from file');
                return cachedSystemPrompt;
            }
        }
    } catch (error) {
        Loggers.Bot.warn(`Failed to load system prompt from file: ${error.message}`);
    }

    // Fallback to empty prompt
    Loggers.Bot.warn('Using empty system prompt (file not found or empty)');
    cachedSystemPrompt = '';
    return cachedSystemPrompt;
}

/**
 * Reset cached system prompt (for reloading)
 */
function resetSystemPrompt() {
    cachedSystemPrompt = null;
}

/**
 * Get OpenAI API configuration
 * 
 * @returns {Object|null} API config or null if not configured
 */
function getApiConfig() {
    if (!apiConfig) {
        const config = configManager.getConfig();
        
        if (config && config.openaiApiKey && config.openaiApiUrl) {
            apiConfig = {
                apiKey: config.openaiApiKey,
                apiUrl: config.openaiApiUrl,
                model: config.openaiModel || 'OpenAI/gpt-oss-120b'
            };
        }
    }
    
    return apiConfig;
}

/**
 * Check if OpenAI API is configured
 * 
 * @returns {boolean} Whether API is configured
 */
function isApiEnabled() {
    const config = getApiConfig();
    return config !== null;
}

/**
 * Reset cached API configuration
 */
function resetApiConfig() {
    apiConfig = null;
}

// ============================================================================
// API INTERACTIONS
// ============================================================================

/**
 * Send a message to the OpenAI-compatible API
 * 
 * @param {string} userMessage - User's message
 * @param {string} systemPrompt - Optional system prompt override
 * @returns {Promise<string|null>} AI response or null if failed
 */
async function sendMessageToAI(userMessage, systemPrompt = null) {
    const config = getApiConfig();
    
    if (!config) {
        Loggers.Bot.warn('OpenAI API not configured, skipping AI response');
        return null;
    }
    
    // Use provided prompt, or load from file, or use default
    const finalPrompt = systemPrompt || loadSystemPrompt();
    
    try {
        const response = await axios.post(
            `${config.apiUrl}/chat/completions`,
            {
                model: config.model,
                messages: [
                    { role: 'system', content: finalPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7,
                max_tokens: 4096
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                timeout: REQUEST_TIMEOUT
            }
        );
        
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            const aiResponse = response.data.choices[0].message.content.trim();
            Loggers.Bot.info(`AI response received (${aiResponse.length} chars)`);
            return aiResponse.substring(0, MAX_RESPONSE_LENGTH);
        } else {
            Loggers.Bot.error('Invalid API response structure');
            return null;
        }
        
    } catch (error) {
        if (error.response) {
            Loggers.Bot.error(`API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            Loggers.Bot.error(`No response from API: ${error.message}`);
        } else {
            Loggers.Bot.error(`API request error: ${error.message}`);
        }
        return null;
    }
}

/**
 * Test API connection
 * 
 * @returns {Promise<Object>} Test result
 */
async function testConnection() {
    const config = getApiConfig();
    
    if (!config) {
        return {
            success: false,
            error: 'API not configured'
        };
    }
    
    try {
        const response = await sendMessageToAI('Say "test successful" in exactly 3 words.');
        
        if (response) {
            return {
                success: true,
                response: response
            };
        } else {
            return {
                success: false,
                error: 'No response from API'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    isApiEnabled,
    resetApiConfig,
    loadSystemPrompt,
    resetSystemPrompt,
    sendMessageToAI,
    testConnection
};
