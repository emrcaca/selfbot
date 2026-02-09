const { handleIncomingMessage } = require('../../src/handlers/messageHandler');
const { botState } = require('../../src/core/state');
const configManager = require('../../src/config/manager');
const telegramService = require('../../src/services/telegramService');
const discordService = require('../../src/services/discordService');

// Mock dependencies
jest.mock('../../src/core/state', () => ({
    botState: {
        monitoring: false,
        isOwoEnabled: true,
        timedChannels: {},
        channelIds: [],
        activeTimedFarm: {},
        captchaDetected: false,
        isCaptchaDmHandlerEnabled: true,
        isRunning: true
    },
    CAPTCHA_KEYWORDS: ['verify', 'human'],
    stopBot: jest.fn(),
    resumeBot: jest.fn()
}));

jest.mock('../../src/config/manager', () => ({
    getConfig: jest.fn().mockReturnValue({ owo_ID: '408785106942164992' }),
    getOwoId: jest.fn().mockReturnValue('408785106942164992')
}));

jest.mock('../../src/services/telegramService', () => ({
    sendCaptchaNotification: jest.fn().mockResolvedValue({ success: true }),
    sendCaptchaSolvedNotification: jest.fn(),
    sendChannelAlert: jest.fn()
}));

jest.mock('../../src/services/discordService', () => ({
    setTrackedTimeout: jest.fn(),
    clearAllCaches: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
    Loggers: {
        Captcha: {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        }
    }
}));

// Mock process.send if needed
process.send = jest.fn();

describe('Message Handler', () => {
    let mockClient;
    let mockMessage;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockClient = {
            user: {
                id: '123456789',
                username: 'TestBot'
            }
        };

        mockMessage = {
            id: 'msg123',
            content: '',
            channel: {
                id: 'chan123',
                type: 'GUILD_TEXT'
            },
            guild: {
                id: 'guild123'
            },
            author: {
                id: 'user123',
                username: 'User',
                bot: false
            }
        };
        
        // Reset state
        botState.captchaDetected = false;
        botState.monitoring = false;
    });

    describe('Monitoring Alert', () => {
        test('should send alert if monitoring is enabled and message is in tracked channel', async () => {
            botState.monitoring = true;
            botState.channelIds = ['chan123'];
            
            // Message from another user in tracked channel
            mockMessage.content = 'Hello there';
            
            await handleIncomingMessage(mockClient, mockMessage);

            expect(telegramService.sendChannelAlert).toHaveBeenCalledWith({
                channelId: 'chan123',
                author: 'User',
                content: 'Hello there'
            });
            expect(process.send).toHaveBeenCalledWith(expect.objectContaining({
                type: 'channel_monitor_alert'
            }));
            
            // Should disable OWO
            expect(botState.isOwoEnabled).toBe(false);
        });

        test('should NOT send alert if monitoring is disabled', async () => {
            botState.monitoring = false;
            botState.channelIds = ['chan123'];
            
            mockMessage.content = 'Hello there';
            
            await handleIncomingMessage(mockClient, mockMessage);

            expect(telegramService.sendChannelAlert).not.toHaveBeenCalled();
        });
    });

    describe('Captcha Detection', () => {
        test('should detect CAPTCHA keyword from OWO bot mention', async () => {
            // Setup message from OWO bot
            mockMessage.author.id = '408785106942164992'; // Matches mock config owo_ID
            // Mention the bot and include keyword
            mockMessage.content = `<@${mockClient.user.id}> please verify that you are human!`;
            
            await handleIncomingMessage(mockClient, mockMessage);

            expect(botState.captchaDetected).toBe(true);
            expect(telegramService.sendCaptchaNotification).toHaveBeenCalled();
            expect(process.send).toHaveBeenCalledWith(expect.objectContaining({
                type: 'captcha'
            }));
        });

        test('should ignore message if author is not OWO bot', async () => {
            mockMessage.author.id = '999999999999999999'; // Not OWO
            mockMessage.content = `<@${mockClient.user.id}> verify human`;
            
            await handleIncomingMessage(mockClient, mockMessage);

            expect(botState.captchaDetected).toBe(false);
            expect(telegramService.sendCaptchaNotification).not.toHaveBeenCalled();
        });

        test('should ignore message if no keyword found', async () => {
            mockMessage.author.id = '408785106942164992';
            mockMessage.content = `<@${mockClient.user.id}> just saying hi`; // No 'verify' or 'human'
            
            await handleIncomingMessage(mockClient, mockMessage);

            expect(botState.captchaDetected).toBe(false);
            expect(telegramService.sendCaptchaNotification).not.toHaveBeenCalled();
        });
    });
});
