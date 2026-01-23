# TeamSpeak 3 Stream Deck Plugin

This is a simple plugin that enables control of TeamSpeak 3 directly from your Stream Deck.

## Features

- **Toggle Mute** - Mute/unmute your microphone
- **Toggle Deafen** - Enable/disable speaker output (deafen yourself)
- **Toggle Away** - Set or clear your away status
- **Switch Channel** - Quickly switch to a specific TeamSpeak channel

All buttons display real-time status updates that sync with TeamSpeak, reflecting changes made either through the Stream Deck or directly in the TeamSpeak client.

## Requirements

- Elgato Stream Deck (software version 6.9 or later)
- TeamSpeak 3 client
- [TeamSpeak ClientQuery Plugin](https://www.myteamspeak.com/addons/L2FkZG9ucy85NDNkZDgxNi03ZWYyLTQ4ZDctODJiOC1kNjBjM2I5YjEwYjM%3D)

## Installation

### 1. Install the TeamSpeak ClientQuery Plugin

1. Download and install the [ClientQuery plugin](https://www.myteamspeak.com/addons/L2FkZG9ucy85NDNkZDgxNi03ZWYyLTQ4ZDctODJiOC1kNjBjM2I5YjEwYjM%3D) in your TeamSpeak 3 client
2. After installation, the plugin will generate an API key
3. Copy this API key - you'll need it in the next step

### 2. Install the Stream Deck Plugin

Find the plugin by searching for "TeamSpeak 3" in the Stream Deck or in the Elgato Marketplace. Note that there is another plugin called "TeamSpeak 3 _Integration_"... this is not that!

### 3. Configure the Plugin

1. Open Stream Deck software
2. Add any TeamSpeak 3 action to your Stream Deck
3. Click the gear icon to open global plugin settings
4. Enter your configuration:
    - **API Key**: Paste the API key from the ClientQuery plugin
    - **Host**: `localhost` (default) or your TeamSpeak server address
    - **Port**: `25639` (default ClientQuery port)
5. Save the settings

## Usage

### Toggle Mute

Add this action to mute/unmute your microphone. The button state reflects your current mute status.

### Toggle Deafen

Add this action to enable/disable speaker output (deafen). When deafened, you cannot hear anyone in TeamSpeak.

### Toggle Away

Add this action to set or clear your away status in TeamSpeak.

### Switch Channel

Add this action to quickly switch to a specific channel:

1. Add the action to your Stream Deck
2. Click the action settings
3. Enter the channel ID or name you want to switch to
4. Press the button to instantly join that channel

## Connection Behavior

The plugin automatically handles connection issues:

- **Automatic Reconnection**: If the connection to TeamSpeak is lost, the plugin will automatically attempt to reconnect
- **Exponential Backoff**: Failed connection attempts use exponential backoff (1s, 2s, 4s, ... up to 60s)
- **Manual Retry**: Press any action button to immediately retry the connection, bypassing the backoff delay
- **State Synchronization**: The plugin polls TeamSpeak every 0.5 seconds to keep button states in sync

## Development

### Prerequisites

- Node.js 20+
- npm or yarn
- Elgato Stream Deck software

### Setup

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Watch mode (auto-rebuild and restart plugin on changes)
npm run watch
```

## Troubleshooting

### Plugin log shows "Not connected" errors

1. Verify TeamSpeak 3 is running
2. Confirm the ClientQuery plugin is installed and enabled in TeamSpeak
3. Check that the API key in Stream Deck settings matches the one from ClientQuery
4. Ensure the host and port settings are correct (default: `localhost:25639`)

### Buttons don't update state

The plugin polls TeamSpeak every 0.5 seconds. If buttons aren't updating:

1. Check the Stream Deck console for error messages
2. Verify the TeamSpeak ClientQuery plugin is responding
3. Try pressing a button to trigger a manual reconnection

### Channel switching doesn't work

Make sure you're using the correct channel name. The plugin will escape special characters in channel names to pass in a format TeamSpeak expects, so ensure names match exactly. Also check to see if the channel requires a password, and if so, that the password is set correctly.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

Travis Mehlinger

## Links

- [GitHub Repository](https://github.com/tmehlinger/streamdeck-ts3)
- [ClientQuery plugin](https://www.myteamspeak.com/addons/L2FkZG9ucy85NDNkZDgxNi03ZWYyLTQ4ZDctODJiOC1kNjBjM2I5YjEwYjM%3D)
- [Elgato Stream Deck SDK](https://docs.elgato.com/sdk/)
