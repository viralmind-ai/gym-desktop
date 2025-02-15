import type { TrainingPool, CreatePoolInput, UpdatePoolInput } from '$lib/types/forge';
import type { ForgeApp } from '$lib/types/gym';
import { invoke } from '@tauri-apps/api/core';

const API_BASE = 'http://localhost/api/forge';

export async function getAppsForGym(): Promise<ForgeApp[]> {
  const response = await fetch(`${API_BASE}/apps`);

  if (!response.ok) {
    throw new Error('Failed to fetch apps');
  }

  const apps: ForgeApp[] = await response.json();

  // Shuffle apps and limit to 6
  const shuffledApps = apps.sort(() => Math.random() - 0.5).slice(0, 6);

  // For each app, keep only a random subset of tasks
  return shuffledApps.map((app: ForgeApp) => ({
    ...app,
    tasks: app.tasks
      .sort(() => Math.random() - 0.5) // Shuffle tasks
      .slice(0, 3) // Keep max 3 tasks per app
  }));
}

export async function getAppsForHistory(): Promise<ForgeApp[]> {
  // Get recordings to build app map
  const recordings: any[] = await invoke('list_recordings');
  const appMap = new Map<string, ForgeApp>();

  // Build apps from recordings
  recordings.forEach((recording) => {
    if (recording.status === 'completed' && recording.quest) {
      const quest = recording.quest;
      if (!appMap.has(quest.app)) {
        appMap.set(quest.app, {
          name: quest.app,
          domain: quest.icon_url.split('domain=')[1].split('&')[0],
          description: '',
          categories: [],
          tasks: [],
          pool_id: { name: '' },
          seen: true
        });
      }
      const app = appMap.get(quest.app)!;
      if (!app.tasks.some((t) => t.prompt === quest.title)) {
        app.tasks.push({
          prompt: quest.title,
          completed: true,
          recordingId: recording.id
        });
      }
    }
  });

  // Convert map to array and sort by app name
  return Array.from(appMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAppsForSkills(): Promise<ForgeApp[]> {
  // Get completed apps from history
  const historyApps = await getAppsForHistory();
  const appMap = new Map<string, ForgeApp>();

  // Add history apps to map
  historyApps.forEach((app) => {
    appMap.set(app.name, app);
  });

  // Then get apps from API and merge
  try {
    const response = await fetch(`${API_BASE}/apps`);
    if (response.ok) {
      const apiApps: ForgeApp[] = await response.json();
      apiApps.forEach((apiApp) => {
        const existingApp = appMap.get(apiApp.name);
        if (existingApp) {
          // Merge API app info into existing app
          existingApp.domain = apiApp.domain;
          existingApp.description = apiApp.description;
          existingApp.categories = apiApp.categories;
          // Add any new tasks from API
          apiApp.tasks.forEach((apiTask) => {
            if (!existingApp.tasks.some((t) => t.prompt === apiTask.prompt)) {
              existingApp.tasks.push({
                ...apiTask,
                completed: false
              });
            }
          });
        } else {
          // Add new app from API
          appMap.set(apiApp.name, {
            ...apiApp,
            seen: false,
            tasks: apiApp.tasks.map((task) => ({
              ...task,
              completed: false
            }))
          });
        }
      });
    }
  } catch (error) {
    console.error('Failed to fetch apps from API:', error);
  }

  // Convert map to array
  let allApps = Array.from(appMap.values());

  // If we have no apps at all, return empty array
  if (allApps.length === 0) {
    return [];
  }

  // Split into seen and unseen
  const seen = allApps.filter((app) => app.seen);
  const unseen = allApps.filter((app) => !app.seen);

  // Always include all seen apps
  let result = [...seen];

  // Add random unseen apps if we have any
  if (unseen.length > 0) {
    const shuffledUnseen = unseen.sort(() => Math.random() - 0.5);
    // Add up to 3 unseen apps, but don't exceed total of 6 apps
    const unseenToAdd = Math.min(3, Math.max(0, 6 - seen.length));
    result = [...result, ...shuffledUnseen.slice(0, unseenToAdd)];
  }

  return result;
}

export async function listPools(address: string): Promise<TrainingPool[]> {
  const response = await fetch(`${API_BASE}/list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ address })
  });

  if (!response.ok) {
    throw new Error('Failed to fetch training pools');
  }

  return response.json();
}

export async function createPool(input: CreatePoolInput): Promise<TrainingPool> {
  const response = await fetch(`${API_BASE}/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error('Failed to create training pool');
  }

  return response.json();
}

export async function updatePool(input: UpdatePoolInput): Promise<TrainingPool> {
  const response = await fetch(`${API_BASE}/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error('Failed to update training pool');
  }

  return response.json();
}
