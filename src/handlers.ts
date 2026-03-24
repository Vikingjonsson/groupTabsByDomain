const NEW_TAB_URL = 'chrome://newtab/';

type GroupColor = `${chrome.tabGroups.Color}`;

const GROUP_COLORS: GroupColor[] = [
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

const getColorForDomain = (domain: string): GroupColor => {
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

const asNonEmpty = (ids: number[]): [number, ...number[]] => {
  if (ids.length === 0) throw new Error('Expected non-empty array');
  return ids as [number, ...number[]];
};

const createNewGroup = async (
  tabIds: number[],
  domain: string,
  windowId: number
): Promise<void> => {
  const groupId = await chrome.tabs.group({
    tabIds: asNonEmpty(tabIds),
    createProperties: { windowId },
  });

  await chrome.tabGroups.update(groupId, {
    title: domain,
    color: getColorForDomain(domain),
  });
};

const addToExistingGroup = async (
  tabIds: number[],
  domain: string,
  windowId: number,
  groupId: number
): Promise<void> => {
  try {
    await chrome.tabs.group({ tabIds: asNonEmpty(tabIds), groupId });
  } catch {
    await createNewGroup(tabIds, domain, windowId);
  }
};

export const groupTabsByBaseUrl = async (groupSingleTabs = false): Promise<void> => {
  const tabs = await chrome.tabs.query({});
  const domainMap = buildDomainMap(tabs);
  const minTabs = groupSingleTabs ? 1 : 2;

  for (const [windowId, domains] of Object.entries(domainMap)) {
    const winId = parseInt(windowId, 10);

    for (const [domain, tabIds] of Object.entries(domains)) {
      if (tabIds.length < minTabs) continue;

      const existingGroups = await chrome.tabGroups.query({
        windowId: winId,
        title: domain,
      });

      if (existingGroups.length === 0) {
        await createNewGroup(tabIds, domain, winId);
      } else {
        await addToExistingGroup(tabIds, domain, winId, existingGroups[0].id);
      }
    }
  }
};

export const ungroupIfNecessary = async (groupSingleTabs = false): Promise<void> => {
  const groups = await chrome.tabGroups.query({});
  const minTabs = groupSingleTabs ? 1 : 2;

  for (const group of groups) {
    const groupTabs = await chrome.tabs.query({ groupId: group.id });

    if (groupTabs.length < minTabs) {
      const tabIds = groupTabs.map((tab) => tab.id).filter((id): id is number => id !== undefined);

      if (tabIds.length > 0) {
        await chrome.tabs.ungroup(asNonEmpty(tabIds));
      }
    }
  }
};

export const isValidTabUrl = (url: string | undefined): boolean => {
  return !!url && url !== NEW_TAB_URL;
};
