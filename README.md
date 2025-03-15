# UptimeRobot Status for Raycast

A Raycast extension to quickly check your UptimeRobot monitored websites and view any sites that are currently down.

## Features

- 🚀 Quick access to UptimeRobot status from Raycast
- 📄 Automatic pagination to handle large monitor lists (more than default limit of 50)
- 🔴 Visual list of down websites with status indicators
- 🔍 Search functionality to find specific monitors
- 🔄 Cached results to reduce API calls
- 🔗 Quick access to monitored websites and UptimeRobot dashboard
- 🐞 Debug mode to view all monitors regardless of status
- 🔄 Refresh option to get the latest data

## Setup

1. Install the extension in Raycast
2. Add your UptimeRobot API key in the extension preferences
   - To get your API key, log in to your UptimeRobot account
   - Go to "My Settings" and find the "API Settings" section
   - Either use your Main API Key or create a Read-Only API key

## Usage

1. Open Raycast and search for "Check UptimeRobot Status"
2. The extension will display one of two views:
   - "All Systems Operational" if all your sites are up
   - A list of down sites with status indicators if any sites are down
3. You can:
   - Press ⌘+R to refresh the data
   - Search for specific monitors by name
   - Click on any monitor to see available actions
   - Enable "Debug Mode" in preferences to see all monitors regardless of status

## Available Actions

For each monitor, you can:
- Open the website directly
- Open the monitor in UptimeRobot dashboard
- Copy the monitor details to clipboard
- Refresh all monitors to get the latest status

### Troubleshooting

If the extension isn't showing sites you know are down:

1. Enable "Force Refresh" in the extension preferences to bypass the cache and get fresh data
2. Enable "Debug Mode" to see the status of all your monitors
3. Make sure your API key has permission to access all monitors
4. Check that the down site shows status 8 or 9 (Seems Down or Down) in UptimeRobot

## Privacy

This extension only communicates with the UptimeRobot API service. Your API key is securely stored in Raycast's encrypted preferences and is only used for authentication with UptimeRobot.