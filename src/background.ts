import { groupTabsByBaseUrl, ungroupIfNecessary, isValidTabUrl } from './handlers';

const STORAGE_KEY = 'groupSingleTabs';
const MENU_ID = 'group-single-tabs';

let groupSingleTabs = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const debouncedGroupTabs = (): void => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    await groupTabsByBaseUrl(groupSingleTabs);
  }, 100);
};

const applySettings = async (): Promise<void> => {
  await groupTabsByBaseUrl(groupSingleTabs);
  await ungroupIfNecessary(groupSingleTabs);
};

const setupContextMenu = (checked: boolean): void => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Group single tabs',
      type: 'checkbox',
      checked,
      contexts: ['action'],
    });
  });
};

const initSettings = async (): Promise<void> => {
  const result = await chrome.storage.sync.get({ [STORAGE_KEY]: false });
  groupSingleTabs = result[STORAGE_KEY] as boolean;
  setupContextMenu(groupSingleTabs);
};

chrome.runtime.onInstalled.addListener(() => {
  initSettings();
});

chrome.runtime.onStartup.addListener(() => {
  initSettings();
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === MENU_ID) {
    groupSingleTabs = !!info.checked;
    await chrome.storage.sync.set({ [STORAGE_KEY]: groupSingleTabs });
    await applySettings();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes[STORAGE_KEY]) {
    groupSingleTabs = (changes[STORAGE_KEY].newValue ?? false) as boolean;
    setupContextMenu(groupSingleTabs);
    applySettings();
  }
});

chrome.tabs.onCreated.addListener((tab: chrome.tabs.Tab) => {
  if (isValidTabUrl(tab.url)) {
    debouncedGroupTabs();
  }
});

chrome.tabs.onUpdated.addListener((_tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
  if (changeInfo.status === 'complete') {
    debouncedGroupTabs();
  }
});

chrome.tabs.onRemoved.addListener(async () => {
  await ungroupIfNecessary(groupSingleTabs);
});
