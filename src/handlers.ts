const NEW_TAB_URL = 'chrome://newtab/';

const GROUP_COLORS: chrome.tabGroups.ColorEnum[] = [
  'blue',
  'cyan',
  'green',
  'grey',
  'orange',
  'pink',
  'purple',
  'red',
  'yellow',
];

const getBaseDomain = (url: string): string | null => {
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol === 'chrome:' || protocol === 'chrome-extension:') {
      return null;
    }
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

const getColorForDomain = (domain: string): chrome.tabGroups.ColorEnum => {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash * 31 + domain.charCodeAt(i)) | 0;
  }
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
};

const buildDomainMap = (tabs: chrome.tabs.Tab[]): Record<number, Record<string, number[]>> => {
  const domainMap: Record<number, Record<string, number[]>> = {};

  for (const tab of tabs) {
    if (!tab.url || !tab.id || tab.windowId === undefined) continue;

    const domain = getBaseDomain(tab.url);
    if (!domain) continue;

    const windowId = tab.windowId;

    if (!domainMap[windowId]) {
      domainMap[windowId] = {};
    }

    if (!domainMap[windowId][domain]) {
      domainMap[windowId][domain] = [];
    }

    domainMap[windowId][domain].push(tab.id);
  }

  return domainMap;
};

const createNewGroup = async (
  tabIds: number[],
  domain: string,
  windowId: number
): Promise<void> => {
  const groupId = await chrome.tabs.group({
    tabIds,
    createProperties: { windowId },
  });

  await chrome.tabGroups.update(groupId, {
    title: domain,
    color: getColorForDomain(domain),
  });
};

const addToExistingGroup = async (tabIds: number[], groupId: number): Promise<void> => {
  await chrome.tabs.group({ tabIds, groupId });
};

export const groupTabsByBaseUrl = async (): Promise<void> => {
  const tabs = await chrome.tabs.query({});
  const domainMap = buildDomainMap(tabs);

  for (const [windowId, domains] of Object.entries(domainMap)) {
    const winId = parseInt(windowId, 10);

    for (const [domain, tabIds] of Object.entries(domains)) {
      if (tabIds.length < 2) continue;

      const existingGroups = await chrome.tabGroups.query({
        windowId: winId,
        title: domain,
      });

      if (existingGroups.length === 0) {
        await createNewGroup(tabIds, domain, winId);
      } else {
        await addToExistingGroup(tabIds, existingGroups[0].id);
      }
    }
  }
};

export const ungroupIfNecessary = async (): Promise<void> => {
  const groups = await chrome.tabGroups.query({});

  for (const group of groups) {
    const groupTabs = await chrome.tabs.query({ groupId: group.id });

    if (groupTabs.length < 2) {
      const tabIds = groupTabs.map((tab) => tab.id).filter((id): id is number => id !== undefined);

      await chrome.tabs.ungroup(tabIds);
    }
  }
};

export const isValidTabUrl = (url: string | undefined): boolean => {
  return !!url && url !== NEW_TAB_URL;
};
