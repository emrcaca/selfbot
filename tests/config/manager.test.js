const configManager = require('../../src/config/manager');

describe('Config Manager', () => {
    let originalEnv;

    beforeEach(() => {
        // Save original env
        originalEnv = { ...process.env };
        // Reset config instance state if needed (assuming singleton with stored config)
        configManager.config = null;
    });

    afterEach(() => {
        // Restore original env
        process.env = originalEnv;
    });

    describe('Config Loading', () => {
        test('should load tokens from TOKENS env var', async () => {
            process.env.TOKENS = 'token1,token2';
            process.env.OWO_ID = '123456';
            
            // Mock console.log to suppress output during test
            const originalLog = console.log;
            console.log = jest.fn();

            const config = await configManager.loadConfig();
            
            expect(config.tokens).toEqual(['token1', 'token2']);
            expect(config.owo_ID).toBe('123456');

            // Restore console.log
            console.log = originalLog;
        });

        test('should use default OWO_ID if not provided', async () => {
            process.env.TOKENS = 'token1';
            delete process.env.OWO_ID;
            
            const originalLog = console.log;
            console.log = jest.fn();

            const config = await configManager.loadConfig();
            
            // Default OWO ID from original code: '408785106942164992'
            expect(config.owo_ID).toBe('408785106942164992');
            
            console.log = originalLog;
        });
    });

    describe('Validation', () => {
        test('should fail if no tokens are provided', () => {
            const invalidConfig = {
                tokens: [],
                owo_ID: '123'
            };
            
            const result = configManager.validateConfig(invalidConfig);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('At least one user token is required in TOKENS environment variable');
        });

        test('should fail if OWO_ID is not numeric', () => {
             const invalidConfig = {
                tokens: ['valid_token'],
                owo_ID: 'not_numeric'
            };
            
            const result = configManager.validateConfig(invalidConfig);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('OWO_ID must be numeric');
        });

        test('should pass with valid config', () => {
            const validConfig = {
                tokens: ['valid_token'],
                owo_ID: '123456',
                enableConsoleLog: true,
                CH_IDS: ['123', '456'] // Add required CH_IDS
            };
            
            const result = configManager.validateConfig(validConfig);
            
            // Debugging output if fails
            if (!result.valid) {
                console.error('Validation errors:', result.errors);
            }

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('Security', () => {
        test('should redact tokens in secure config', async () => {
            process.env.TOKENS = 'secret_token';
            process.env.OWO_ID = '123';
            
            const originalLog = console.log;
            console.log = jest.fn();

            await configManager.loadConfig();
            const secureConfig = configManager.getSecureConfig();
            
            expect(secureConfig.tokens).toContain('[REDACTED]');
            expect(secureConfig.tokens).not.toContain('secret_token');
            
            console.log = originalLog;
        });
    });
});
