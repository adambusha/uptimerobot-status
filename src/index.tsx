import React from "react";
import {
  ActionPanel,
  Action,
  List,
  Toast,
  showToast,
  getPreferenceValues,
  open,
  Icon,
  Color,
  Clipboard,
  Cache,
} from "@raycast/api";
import { useEffect, useState } from "react";
import * as https from "https";
import { IncomingMessage } from "http";

// Types
interface Preferences {
  apiKey: string;
  debugMode: boolean;
  forceRefresh: boolean;
}

interface Monitor {
  id: number;
  friendly_name: string;
  url: string;
  status: number;
  all_time_uptime_ratio: string;
}

interface UptimeRobotResponse {
  stat: string;
  pagination?: {
    offset: number;
    limit: number;
    total: number;
  };
  monitors: Monitor[];
}

// Status codes
const STATUS_CODES = {
  PAUSED: 0,
  NOT_CHECKED: 1,
  UP: 2,
  SEEMS_DOWN: 8,
  DOWN: 9,
};

// Status icons and colors
const STATUS_INFO: Record<number, { name: string; icon: any; color: any }> = {
  0: { name: "Paused", icon: Icon.Pause, color: Color.SecondaryText },
  1: { name: "Not Checked Yet", icon: Icon.Clock, color: Color.SecondaryText },
  2: { name: "Up", icon: Icon.Checkmark, color: Color.Green },
  8: { name: "Seems Down", icon: Icon.ExclamationMark, color: Color.Orange },
  9: { name: "Down", icon: Icon.XmarkCircle, color: Color.Red },
};

// Cache settings
const cache = new Cache();
const CACHE_KEY = "uptimerobot-data";
const CACHE_DURATION = 60; // 1 minute in seconds

// Fetch a single page of monitors using Node.js https module
function fetchMonitorsPage(apiKey: string, offset: number, limit: number): Promise<UptimeRobotResponse> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      api_key: apiKey,
      format: "json",
      logs: 0,
      offset,
      limit,
    });

    const options = {
      hostname: "api.uptimerobot.com",
      port: 443,
      path: "/v2/getMonitors",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        "Cache-Control": "no-cache",
      },
    };

    const req = https.request(options, (res: IncomingMessage) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk.toString();
      });

      res.on("end", () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`API request failed: ${res.statusCode} ${res.statusMessage}`));
            return;
          }

          const parsedData = JSON.parse(data) as UptimeRobotResponse;
          
          if (parsedData.stat !== "ok") {
            reject(new Error(`API returned error: ${parsedData.stat}`));
            return;
          }
          
          resolve(parsedData);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Fetch all monitors with pagination
async function fetchAllMonitors(apiKey: string): Promise<Monitor[]> {
  const limit = 50; // API default is 50
  let offset = 0;
  let allMonitors: Monitor[] = [];
  let total = 0;
  
  try {
    // Fetch first page
    const firstPage = await fetchMonitorsPage(apiKey, offset, limit);
    allMonitors = [...firstPage.monitors];
    
    // Check if pagination info exists
    if (firstPage.pagination) {
      total = firstPage.pagination.total;
      
      // Fetch remaining pages if needed
      offset += limit;
      while (offset < total) {
        const nextPage = await fetchMonitorsPage(apiKey, offset, limit);
        allMonitors = [...allMonitors, ...nextPage.monitors];
        offset += limit;
      }
    }
    
    // Save to cache
    cache.set(
      CACHE_KEY,
      JSON.stringify({
        data: allMonitors,
        timestamp: Math.floor(Date.now() / 1000),
      })
    );
    
    return allMonitors;
  } catch (error) {
    console.error("Error fetching all monitors:", error);
    throw error;
  }
}

// Get monitors from cache or API
async function getMonitors(apiKey: string, forceRefresh = false): Promise<Monitor[]> {
  try {
    // Check cache first if not force refreshing
    if (!forceRefresh) {
      const cachedData = cache.get(CACHE_KEY);
      if (cachedData) {
        try {
          const { data, timestamp } = JSON.parse(cachedData);
          const now = Math.floor(Date.now() / 1000);
          
          if (now - timestamp < CACHE_DURATION) {
            console.log(`Using cached data with ${data.length} monitors`);
            return data;
          }
        } catch (error) {
          // Cache data is invalid, continue to fetch fresh data
          console.log("Cache invalid, fetching fresh data");
        }
      }
    }
    
    // Fetch fresh data
    console.log("Fetching monitors from API");
    return await fetchAllMonitors(apiKey);
  } catch (error) {
    console.error("Error in getMonitors:", error);
    throw error;
  }
}

export default function Command() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const { apiKey, debugMode = false, forceRefresh = false } = getPreferenceValues<Preferences>();
  
  async function loadMonitors() {
    try {
      setIsLoading(true);
      console.log("Loading monitors. Force refresh:", forceRefresh);
      const data = await getMonitors(apiKey, forceRefresh);
      console.log(`Loaded ${data.length} monitors`);
      setMonitors(data);
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading monitors:", error);
      setIsLoading(false);
      setError(String(error));
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to load monitors",
        message: String(error),
      });
    }
  }
  
  useEffect(() => {
    console.log("Initial load");
    loadMonitors();
  }, []);
  
  // Filter monitors based on search and debug mode
  const filteredMonitors = monitors.filter((monitor) => {
    // Apply search filter
    if (searchText && !monitor.friendly_name.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }
    
    // In normal mode, only show down monitors
    if (!debugMode) {
      return monitor.status === STATUS_CODES.DOWN || monitor.status === STATUS_CODES.SEEMS_DOWN;
    }
    
    // In debug mode, show all monitors
    return true;
  });
  
  // Sort monitors (down first, then by name)
  const sortedMonitors = [...filteredMonitors].sort((a, b) => {
    // First by status
    if (a.status === STATUS_CODES.DOWN && b.status !== STATUS_CODES.DOWN) return -1;
    if (b.status === STATUS_CODES.DOWN && a.status !== STATUS_CODES.DOWN) return 1;
    
    // Then by name
    return a.friendly_name.localeCompare(b.friendly_name);
  });
  
  // Count stats
  const downCount = monitors.filter(m => m.status === STATUS_CODES.DOWN || m.status === STATUS_CODES.SEEMS_DOWN).length;
  const upCount = monitors.filter(m => m.status === STATUS_CODES.UP).length;
  const otherCount = monitors.length - downCount - upCount;
  
  // Empty state messaging
  let emptyViewTitle = "No Monitors Found";
  let emptyViewDescription = "Make sure your API key is correct.";
  
  if (error) {
    emptyViewTitle = "Error Loading Monitors";
    emptyViewDescription = error;
  } else if (monitors.length > 0) {
    if (!debugMode && downCount === 0) {
      emptyViewTitle = "All Systems Operational";
      emptyViewDescription = `All ${monitors.length} monitors are up and running.`;
    } else if (filteredMonitors.length === 0 && searchText) {
      emptyViewTitle = "No Matching Monitors";
      emptyViewDescription = `No monitors match your search "${searchText}".`;
    }
  }
  
  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search monitors by name..."
      onSearchTextChange={setSearchText}
      searchText={searchText}
    >
      <List.Section
        title={debugMode ? "All Monitors" : "Problem Monitors"}
        subtitle={`${monitors.length} Total • ${downCount > 0 ? `🔴 ${downCount} Down` : `✅ ${downCount} Down`} • ${upCount} Up${otherCount > 0 ? ` • ${otherCount} Other` : ""}`}
      >
        {sortedMonitors.map((monitor) => {
          const status = STATUS_INFO[monitor.status] || 
                        { name: `Unknown (${monitor.status})`, icon: Icon.QuestionMark, color: Color.SecondaryText };
          
          return (
            <List.Item
              key={monitor.id}
              title={monitor.friendly_name}
              subtitle={monitor.url}
              icon={{ source: status.icon, tintColor: status.color }}
              accessories={[{ text: status.name }]}
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
                    <Action 
                      title="Open in UptimeRobot Dashboard" 
                      icon={Icon.Link}
                      onAction={() => open(`https://uptimerobot.com/dashboard#${monitor.id}`)}
                      primary
                    />
                    <Action title="Open Website" icon={Icon.Globe} onAction={() => open(monitor.url)} />
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    <Action
                      title="Copy Monitor Details"
                      icon={Icon.Clipboard}
                      onAction={() => {
                        Clipboard.copy(
                          `Monitor: ${monitor.friendly_name}\n` +
                          `URL: ${monitor.url}\n` +
                          `Status: ${status.name}\n` +
                          `ID: ${monitor.id}\n` +
                          `Uptime Ratio: ${monitor.all_time_uptime_ratio}%`
                        );
                        showToast({
                          style: Toast.Style.Success,
                          title: "Monitor details copied to clipboard",
                        });
                      }}
                    />
                    <Action
                      title="Refresh Monitors"
                      icon={Icon.ArrowClockwise}
                      shortcut={{ modifiers: ["cmd"], key: "r" }}
                      onAction={async () => {
                        try {
                          setIsLoading(true);
                          const freshData = await getMonitors(apiKey, true);
                          setMonitors(freshData);
                          setIsLoading(false);
                          showToast({
                            style: Toast.Style.Success,
                            title: `Loaded ${freshData.length} monitors`,
                          });
                        } catch (error) {
                          setIsLoading(false);
                          setError(String(error));
                          showToast({
                            style: Toast.Style.Failure,
                            title: "Failed to refresh monitors",
                            message: String(error),
                          });
                        }
                      }}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
      
      {sortedMonitors.length === 0 && (
        <List.EmptyView
          icon={error ? Icon.ExclamationMark : (downCount === 0 ? Icon.Checkmark : Icon.ExclamationMark)}
          title={emptyViewTitle}
          description={emptyViewDescription}
          actions={
            <ActionPanel>
              <Action
                title="Open UptimeRobot Dashboard"
                icon={Icon.Globe}
                onAction={() => open("https://uptimerobot.com/dashboard")}
              />
              <Action
                title="Refresh Monitors"
                icon={Icon.ArrowClockwise}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
                onAction={async () => {
                  try {
                    setIsLoading(true);
                    setError(null);
                    const freshData = await getMonitors(apiKey, true);
                    setMonitors(freshData);
                    setIsLoading(false);
                    showToast({
                      style: Toast.Style.Success,
                      title: `Loaded ${freshData.length} monitors`,
                    });
                  } catch (error) {
                    setIsLoading(false);
                    setError(String(error));
                    showToast({
                      style: Toast.Style.Failure,
                      title: "Failed to refresh monitors",
                      message: String(error),
                    });
                  }
                }}
              />
              {!debugMode && monitors.length > 0 && (
                <Action
                  title="Show All Monitors"
                  icon={Icon.Eye}
                  shortcut={{ modifiers: ["cmd"], key: "d" }}
                  onAction={() => {
                    // Open Raycast preferences to toggle debug mode
                    open("raycast://preferences?parent=Extensions&section=Uptimerobot%20Status");
                  }}
                />
              )}
            </ActionPanel>
          }
        />
      )}
    </List>
  );
} 