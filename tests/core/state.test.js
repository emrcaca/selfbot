const { botState, toggleBooleanState, shouldRunLoop, stopBot, resumeBot } = require('../../src/core/state');

describe('Core State', () => {
    beforeEach(() => {
        // Reset state manually before each test
        botState.isRunning = false;
        botState.isOwoEnabled = false;
        botState.isSleeping = false;
        botState.captchaDetected = false;
        botState.isProcessingWhWb = false;
        botState.isProcessingOwo = false;
    });

    describe('State Toggle', () => {
        test('should toggle boolean values', () => {
            botState.isOwoEnabled = false;
            toggleBooleanState('isOwoEnabled');
            expect(botState.isOwoEnabled).toBe(true);
            
            toggleBooleanState('isOwoEnabled');
            expect(botState.isOwoEnabled).toBe(false);
        });
    });

    describe('Loop Control', () => {
        test('should not run loop if bot is not running', () => {
            botState.isRunning = false;
            expect(shouldRunLoop('any')).toBe(false);
        });

        test('should not run loop if sleeping', () => {
            botState.isRunning = true;
            botState.isSleeping = true;
            expect(shouldRunLoop('any')).toBe(false);
        });

        test('should not run loop if captcha detected', () => {
            botState.isRunning = true;
            botState.captchaDetected = true;
            expect(shouldRunLoop('any')).toBe(false);
        });

        test('should run generic loop if all conditions met', () => {
            botState.isRunning = true;
            expect(shouldRunLoop('any')).toBe(true);
        });

        test('should respect owo loop specific conditions', () => {
            botState.isRunning = true;
            botState.isOwoEnabled = false;
            expect(shouldRunLoop('owo')).toBe(false);

            botState.isOwoEnabled = true;
            expect(shouldRunLoop('owo')).toBe(true);

            botState.isProcessingWhWb = true; // Mutual exclusion
            expect(shouldRunLoop('owo')).toBe(false);
        });
    });

    describe('State Initialization', () => {
        test('should initialize config correctly', () => {
            const mockConfig = {
                CH_IDS: ['123', '456'],
                enableConsoleLog: true
            };
            
            const { initializeConfig } = require('../../src/core/state');
            initializeConfig(mockConfig);
            
            expect(botState.channelIds).toEqual(['123', '456']);
            expect(botState.enableConsoleLog).toBe(true);
        });
    });

    describe('Bot Control', () => {
        test('stopBot should set isRunning to false', () => {
            botState.isRunning = true;
            stopBot(false); // don't log to avoid process.send errors in test
            expect(botState.isRunning).toBe(false);
        });

        test('resumeBot should set isRunning to true', () => {
            botState.isRunning = false;
            resumeBot();
            expect(botState.isRunning).toBe(true);
        });

        test('resumeBot should not work if captcha detected', () => {
            botState.isRunning = false;
            botState.captchaDetected = true;
            resumeBot();
            expect(botState.isRunning).toBe(false);
        });
    });
});
