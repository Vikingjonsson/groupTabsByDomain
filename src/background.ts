import { groupTabsByBaseUrl, ungroupIfNecessary, isValidTabUrl } from './handlers';

chrome.tabs.onCreated.addListener(async (tab: chrome.tabs.Tab) => {
  if (isValidTabUrl(tab.url)) {
    await groupTabsByBaseUrl();
  }
});

chrome.tabs.onUpdated.addListener(async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
  if (changeInfo.status === 'complete') {
    if (isValidTabUrl(changeInfo.url)) {
      await groupTabsByBaseUrl();
    } else {
      setTimeout(async () => {
        const tab = await chrome.tabs.get(tabId);
        if (isValidTabUrl(tab.url)) {
          await groupTabsByBaseUrl();
        }
      }, 100);
    }
  }
});

chrome.tabs.onRemoved.addListener(async () => {
  await ungroupIfNecessary();
});
