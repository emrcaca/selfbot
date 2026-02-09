const { setTrackedTimeout, clearAllTrackedTimeouts } = require('../../src/services/discordService');

describe('Discord Service', () => {
    describe('Timeout Tracking', () => {
        beforeEach(() => {
            clearAllTrackedTimeouts();
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should execute callback after delay', () => {
            const callback = jest.fn();
            setTrackedTimeout(callback, 1000);
            
            expect(callback).not.toHaveBeenCalled();
            jest.advanceTimersByTime(1000);
            expect(callback).toHaveBeenCalled();
        });

        test('should cancel timeout correctly', () => {
            const callback = jest.fn();
            const timeout = setTrackedTimeout(callback, 1000);
            
            timeout.cancel();
            jest.advanceTimersByTime(1000);
            expect(callback).not.toHaveBeenCalled();
        });

        test('clearAllTrackedTimeouts should cancel all pending timeouts', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            
            setTrackedTimeout(callback1, 1000);
            setTrackedTimeout(callback2, 2000);
            
            clearAllTrackedTimeouts();
            jest.advanceTimersByTime(3000);
            
            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
        });
    });
});
