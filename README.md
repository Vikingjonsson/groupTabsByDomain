# Group Tabs by Domain

A Chrome extension that automatically groups tabs by their domain to help organize your browsing experience.

## Features

- **Automatic Grouping**: Groups tabs by domain as you browse
- **Window-Specific**: Only groups tabs within the same Chrome window
- **Smart Filtering**: Excludes `chrome://newtab/` tabs from grouping
- **Dynamic Colors**: Assigns random colors to each domain group
- **Auto-Cleanup**: Removes groups when they have fewer than 2 tabs

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Load the `dist/` folder as an unpacked extension in Chrome

## Development

### Scripts

- `npm run build` - Build the extension for production
- `npm run lint` - Run ESLint to check for code issues
- `npm run lint:fix` - Automatically fix linting issues
- `npm test` - Run unit tests
- `npm test:watch` - Run tests in watch mode

## How It Works

The extension listens for Chrome tab events and automatically:

1. **Groups tabs by domain** when new tabs are created or updated
2. **Preserves window separation** - tabs are only grouped within their respective windows
3. **Filters out special tabs** like `chrome://newtab/` to avoid grouping system tabs
4. **Maintains groups dynamically** by removing groups that drop below 2 tabs
