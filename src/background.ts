import { groupTabsByBaseUrl, ungroupIfNecessary, isValidTabUrl } from './handlers';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const debouncedGroupTabs = (): void => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      await groupTabsByBaseUrl();
    } catch (error) {
      console.error('Failed to group tabs:', error);
    }
  }, 100);
};

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
  try {
    await ungroupIfNecessary();
  } catch (error) {
    console.error('Failed to ungroup tabs:', error);
  }
});
