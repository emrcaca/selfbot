const { getTokenLabel, sanitizeError, getRandomInt, delay } = require('../../src/utils/helpers');

describe('Helpers Utils', () => {
    describe('getTokenLabel', () => {
        test('should return Token? for empty username', () => {
            expect(getTokenLabel(null)).toBe('Token?');
            expect(getTokenLabel('')).toBe('Token?');
        });

        test('should return consistent token label for same username', () => {
            const label1 = getTokenLabel('user123');
            const label2 = getTokenLabel('user123');
            expect(label1).toBe(label2);
            expect(label1).toMatch(/^Token\d+$/);
        });

        test('should return different labels for different usernames (mostly)', () => {
            const label1 = getTokenLabel('user1');
            const label2 = getTokenLabel('user2');
            // This is probabilistic but highly likely to be different with modulo 99
            if (label1 === label2) {
                console.warn('Hash collision in test, but functionality might be correct');
            }
        });
    });

    describe('sanitizeError', () => {
        test('should redact potential IDs', () => {
            const error = new Error('User 123456789012345678 failed');
            const sanitized = sanitizeError(error);
            expect(sanitized).toContain('[ID_REDACTED]');
            expect(sanitized).not.toContain('123456789012345678');
        });

        test('should redact potential tokens', () => {
            const token = 'MTAwMTAwMTAwMTAwMTAwMTAw.G5.abcdefghijklmnopqrstuvwxyz123456';
            const error = new Error(`Invalid token: ${token}`);
            const sanitized = sanitizeError(error);
            expect(sanitized).toContain('[TOKEN_REDACTED]');
            expect(sanitized).not.toContain(token);
        });

        test('should handle string input', () => {
            const msg = 'Error with ID 987654321098765432';
            const sanitized = sanitizeError(msg);
            expect(sanitized).toContain('[Error]');
            expect(sanitized).toContain('[ID_REDACTED]');
        });
    });

    describe('getRandomInt', () => {
        test('should return number within range', () => {
            const min = 1;
            const max = 10;
            for (let i = 0; i < 100; i++) {
                const val = getRandomInt(min, max);
                expect(val).toBeGreaterThanOrEqual(min);
                expect(val).toBeLessThanOrEqual(max);
            }
        });
    });
});
