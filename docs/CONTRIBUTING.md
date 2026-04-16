# Contributing Guide

Thank you for your interest in contributing to the Discord Selfbot project!

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Git
- Discord account(s) for testing

### Setup

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/selfbot.git
   cd selfbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run the application**
   ```bash
   npm start
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names:
- `feature/feature-name`
- `bugfix/bug-description`
- `refactor/refactor-description`
- `docs/documentation-update`

### Commit Messages

Follow conventional commit format:
- `feat: add new feature`
- `fix: fix bug description`
- `refactor: refactor code structure`
- `docs: update documentation`
- `style: format code`
- `test: add tests`
- `chore: update dependencies`

Example:
```
feat: add emoji monitoring feature

- Add emoji monitoring service
- Add emoji monitoring handler
- Add slash command for emoji monitoring
- Update documentation
```

### Code Style

- Use 4 spaces for indentation
- Use camelCase for variables and functions
- Use PascalCase for classes
- Use UPPER_SNAKE_CASE for constants
- Add JSDoc comments for all public functions
- Follow existing code style and conventions

### Code Organization

- Keep modules focused and single-purpose
- Use services for business logic
- Use handlers for event processing
- Use utilities for reusable functions
- Follow the existing directory structure

## Testing

### Running Tests

```bash
npm test
```

### Writing Tests

- Write tests for new features
- Test edge cases and error conditions
- Mock external dependencies
- Keep tests independent and fast

## Documentation

### Updating Documentation

- Update API documentation for new functions
- Update architecture documentation for structural changes
- Update README for user-facing changes
- Add JSDoc comments for all public APIs

### Code Comments

- Add JSDoc comments for all public functions
- Comment complex logic
- Explain why, not what
- Keep comments up to date

## Pull Request Process

1. **Update your branch**
   ```bash
   git pull origin main
   ```

2. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

3. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create Pull Request**
   - Describe your changes
   - Reference related issues
   - Add screenshots if applicable
   - Ensure CI passes

### Pull Request Checklist

- [ ] Code follows project style guidelines
- [ ] Tests pass locally
- [ ] Documentation is updated
- [ ] Commit messages are clear
- [ ] No console.log or debug code
- [ ] No sensitive data in code
- [ ] Changes are backwards compatible

## Project Structure

```
src/
├── config/              # Configuration management
├── core/                # Core functionality
│   ├── events/          # Event system
│   ├── farming.js       # Farming operations
│   └── state/           # State management
├── handlers/            # Event handlers
├── process/             # Process implementations
├── services/            # Business logic services
├── utils/               # Utility functions
│   ├── cache/           # Caching utilities
│   └── managers/        # Resource managers
├── types/               # Type definitions
└── index.js             # Application entry point
```

## Common Tasks

### Adding a New Feature

1. Create feature branch
2. Implement feature in appropriate module
3. Add tests
4. Update documentation
5. Submit pull request

### Fixing a Bug

1. Create bugfix branch
2. Identify root cause
3. Implement fix
4. Add regression tests
5. Update documentation
6. Submit pull request

### Refactoring Code

1. Create refactor branch
2. Identify areas for improvement
3. Make incremental changes
4. Ensure tests pass
5. Update documentation
6. Submit pull request

## Guidelines

### Security

- Never commit sensitive data (tokens, passwords)
- Use environment variables for configuration
- Validate all user input
- Handle errors gracefully
- Follow security best practices

### Performance

- Use caching where appropriate
- Avoid blocking operations
- Use async/await for async operations
- Clean up resources properly
- Monitor memory usage

### Error Handling

- Handle errors at appropriate levels
- Provide meaningful error messages
- Log errors with context
- Gracefully degrade on errors
- Don't expose sensitive information

### Testing

- Write tests for new code
- Test edge cases
- Mock external dependencies
- Keep tests fast and independent
- Maintain test coverage

## Getting Help

- Check existing documentation
- Search for similar issues
- Ask questions in discussions
- Create an issue for bugs
- Contact maintainers

## Code Review

### Reviewing Code

- Check for security issues
- Verify functionality
- Check code style
- Suggest improvements
- Be constructive and respectful

### Responding to Reviews

- Address all feedback
- Explain your decisions
- Make requested changes
- Ask for clarification
- Be responsive

## Release Process

Releases are managed by maintainers:

1. Update version number
2. Update CHANGELOG
3. Create release tag
4. Publish release notes
5. Deploy to production

## License

By contributing, you agree that your contributions will be licensed under the project's license.

## Questions?

If you have questions about contributing, please:
- Open an issue
- Start a discussion
- Contact maintainers

Thank you for contributing!
