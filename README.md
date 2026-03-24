# Group Tabs by Domain

A Chrome extension that automatically groups tabs by their domain to help organize your browsing experience.

## Features

- **Automatic Grouping**: Groups tabs by domain as you browse (strips `www.` prefix)
- **Window-Specific**: Only groups tabs within the same Chrome window
- **Smart Filtering**: Excludes `chrome://`, `chrome-extension://`, and new tab pages from grouping
- **Consistent Colors**: Assigns deterministic colors per domain (same domain always gets the same color)
- **Auto-Cleanup**: Removes groups when they have fewer than 2 tabs

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Load the `dist/` folder as an unpacked extension in Chrome

## Development

### Scripts

- `npm run dev` - Watch mode for development
- `npm run build` - Build the extension for production
- `npm run package` - Build and create Chrome Web Store zip package
- `npm run lint` - Run ESLint to check for code issues
- `npm run lint:fix` - Automatically fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode

## License

MIT
