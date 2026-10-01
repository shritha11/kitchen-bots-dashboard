import { adminFetch } from './adminClient';

export interface AdminSettingsState {
  id?: string;
  instanceName: string;
  defaultLanguage: string;
  timezone: string;
  emailReports: boolean;
  pushAlerts: boolean;
  billingUpdates: boolean;
  themeColor: string;
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettingsState = {
  id: 'cfg-default-1',
  instanceName: 'KitchenBots India Central',
  defaultLanguage: 'English (India)',
  timezone: '(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi',
  emailReports: true,
  pushAlerts: false,
  billingUpdates: true,
  themeColor: 'primary',
};

let localSettings: AdminSettingsState = { ...DEFAULT_ADMIN_SETTINGS };

export const settingsApi = {
  getSettings: async (): Promise<AdminSettingsState> => {
    try {
      const json = await adminFetch<{ success: boolean; data: any }>('/v1/admin/settings');
      if (json && json.success && json.data && Object.keys(json.data).length > 0) {
        localSettings = { ...DEFAULT_ADMIN_SETTINGS, ...json.data };
        return localSettings;
      }
    } catch (err) {
      console.warn('Failed to fetch settings from API, falling back to local settings', err);
    }
    return { ...localSettings };
  },

  updateSettings: async (updates: Partial<AdminSettingsState>): Promise<AdminSettingsState> => {
    const updatedState = { ...localSettings, ...updates };
    localSettings = updatedState;

    try {
      const json = await adminFetch<{ success: boolean; data: any }>('/v1/admin/settings', {
        method: 'POST',
        body: JSON.stringify(updatedState),
      });
      if (json && json.success && json.data) {
        localSettings = { ...DEFAULT_ADMIN_SETTINGS, ...json.data };
        return localSettings;
      }
    } catch (err) {
      console.warn('Failed to persist settings to backend API', err);
    }

    return { ...localSettings };
  },
};
