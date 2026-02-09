const { getCurrentChannelId } = require('../../src/core/farming');
const { botState } = require('../../src/core/state');

// Mock dependencies
jest.mock('../../src/services/discordService', () => ({
    sendTyping: jest.fn(),
    sendMessage: jest.fn()
}));

jest.mock('../../src/utils/helpers', () => ({
    delay: jest.fn().mockResolvedValue(),
    getRandomInt: jest.fn().mockReturnValue(1000)
}));

describe('Farming Core', () => {
    beforeEach(() => {
        botState.channelIds = [];
        botState.tempFarmChannel = null;
        botState.currentChannelIndex = 0;
    });

    describe('getCurrentChannelId', () => {
        test('should return temp channel if set', () => {
            botState.tempFarmChannel = 'temp-channel';
            expect(getCurrentChannelId()).toBe('temp-channel');
        });

        test('should return null if no channels configured', () => {
            botState.channelIds = [];
            expect(getCurrentChannelId()).toBeNull();
        });

        test('should return current channel from rotation', () => {
            botState.channelIds = ['chan1', 'chan2'];
            botState.currentChannelIndex = 0;
            expect(getCurrentChannelId()).toBe('chan1');

            botState.currentChannelIndex = 1;
            expect(getCurrentChannelId()).toBe('chan2');
        });
    });
});
