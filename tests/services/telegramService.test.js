const telegramService = require('../../src/services/telegramService');
const axios = require('axios');
const configManager = require('../../src/config/manager');

jest.mock('axios');
jest.mock('../../src/config/manager', () => ({
    getConfig: jest.fn()
}));

describe('Telegram Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        configManager.getConfig.mockReturnValue({
            telegramBotToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
            telegramChatId: '987654321'
        });
    });

    describe('Initialization', () => {
        test('should detect if telegram is enabled', () => {
            expect(telegramService.isTelegramEnabled()).toBe(true);
        });

        test('should detect if telegram is disabled', () => {
            configManager.getConfig.mockReturnValue({});
            expect(telegramService.isTelegramEnabled()).toBe(false);
        });
    });

    describe('Sending Messages', () => {
        test('should send message successfully', async () => {
            axios.post.mockResolvedValue({ data: { ok: true } });
            
            const result = await telegramService.sendTelegramMessage('Hello World');
            
            expect(result).toBe(true);
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('https://api.telegram.org/bot123456'),
                expect.objectContaining({
                    chat_id: '987654321',
                    text: 'Hello World'
                }),
                expect.any(Object)
            );
        });

        test('should handle API errors', async () => {
            axios.post.mockResolvedValue({ data: { ok: false, description: 'Bad Request' } });
            
            const result = await telegramService.sendTelegramMessage('Hello World');
            expect(result).toBe(false);
        });

        test('should handle network errors', async () => {
            axios.post.mockRejectedValue(new Error('Network Error'));
            
            const result = await telegramService.sendTelegramMessage('Hello World');
            expect(result).toBe(false);
        });
    });
});
