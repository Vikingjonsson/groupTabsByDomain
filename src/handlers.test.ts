import { groupTabsByBaseUrl, ungroupIfNecessary, isValidTabUrl } from './handlers';

const mockTabs: chrome.tabs.Tab[] = [];
const mockGroups: chrome.tabGroups.TabGroup[] = [];
let nextGroupId = 1;

const chromeMock = {
  tabs: {
    query: jest.fn().mockImplementation((queryInfo?: chrome.tabs.QueryInfo) => {
      if (queryInfo?.groupId !== undefined) {
        return Promise.resolve(mockTabs.filter((tab) => tab.groupId === queryInfo.groupId));
      }
      return Promise.resolve([...mockTabs]);
    }),

    group: jest.fn().mockImplementation((options: chrome.tabs.GroupOptions) => {
      const groupId = options.groupId || nextGroupId++;
      const tabIds = Array.isArray(options.tabIds) ? options.tabIds : [options.tabIds];

      tabIds.forEach((tabId) => {
        const tab = mockTabs.find((t) => t.id === tabId);
        if (tab) {
          (tab as any).groupId = groupId;
        }
      });

      if (!mockGroups.find((g) => g.id === groupId)) {
        mockGroups.push({
          id: groupId,
          windowId: mockTabs.find((t) => tabIds.includes(t.id!))?.windowId || 1,
          collapsed: false,
          title: '',
          color: 'grey',
        });
      }

      return Promise.resolve(groupId);
    }),

    ungroup: jest.fn().mockImplementation((tabIds: number[]) => {
      tabIds.forEach((tabId) => {
        const tab = mockTabs.find((t) => t.id === tabId);
        if (tab) {
          (tab as any).groupId = undefined;
        }
      });
      return Promise.resolve();
    }),
  },

  tabGroups: {
    query: jest.fn().mockImplementation((queryInfo?: chrome.tabGroups.QueryInfo) => {
      let filteredGroups = [...mockGroups];

      if (queryInfo?.windowId !== undefined) {
        filteredGroups = filteredGroups.filter((g) => g.windowId === queryInfo.windowId);
      }
      if (queryInfo?.title !== undefined) {
        filteredGroups = filteredGroups.filter((g) => g.title === queryInfo.title);
      }

      return Promise.resolve(filteredGroups);
    }),

    update: jest
      .fn()
      .mockImplementation(
        (groupId: number, updateProperties: chrome.tabGroups.UpdateProperties) => {
          const group = mockGroups.find((g) => g.id === groupId);
          if (group) {
            Object.assign(group, updateProperties);
          }
          return Promise.resolve(group);
        }
      ),
  },
};

(globalThis as any).chrome = chromeMock;

const createTab = (id: number, url: string, windowId: number = 1): chrome.tabs.Tab => {
  const tab = {
    id,
    url,
    windowId,
    index: mockTabs.length,
    pinned: false,
    highlighted: false,
    active: false,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
  } as chrome.tabs.Tab;
  mockTabs.push(tab);
  return tab;
};

const clearMocks = (): void => {
  mockTabs.length = 0;
  mockGroups.length = 0;
  nextGroupId = 1;
  jest.clearAllMocks();
};

describe('Tab Grouping Handlers', () => {
  beforeEach(clearMocks);

  describe('isValidTabUrl', () => {
    it('rejects chrome://newtab/', () => {
      expect(isValidTabUrl('chrome://newtab/')).toBe(false);
    });

    it('rejects undefined and empty URLs', () => {
      expect(isValidTabUrl(undefined)).toBe(false);
      expect(isValidTabUrl('')).toBe(false);
    });

    it('accepts valid URLs', () => {
      expect(isValidTabUrl('https://google.com')).toBe(true);
      expect(isValidTabUrl('https://example.com/page')).toBe(true);
    });
  });

  describe('groupTabsByBaseUrl', () => {
    it('does not group single tabs', async () => {
      createTab(1, 'https://google.com', 1);

      await groupTabsByBaseUrl();

      expect(mockGroups).toHaveLength(0);
    });

    it('groups multiple tabs from same domain', async () => {
      createTab(1, 'https://google.com/search', 1);
      createTab(2, 'https://google.com/images', 1);

      await groupTabsByBaseUrl();

      expect(mockGroups).toHaveLength(1);
      expect(mockGroups[0].title).toBe('google.com');
      expect(mockTabs.filter((t) => t.groupId === mockGroups[0].id)).toHaveLength(2);
    });

    it('removes www prefix when grouping', async () => {
      createTab(1, 'https://www.example.com/page1', 1);
      createTab(2, 'https://example.com/page2', 1);

      await groupTabsByBaseUrl();

      expect(mockGroups).toHaveLength(1);
      expect(mockGroups[0].title).toBe('example.com');
    });

    it('only groups tabs within same window', async () => {
      createTab(1, 'https://google.com/search', 1);
      createTab(2, 'https://google.com/images', 1);
      createTab(3, 'https://google.com/maps', 2);
      createTab(4, 'https://google.com/news', 2);

      await groupTabsByBaseUrl();

      expect(mockGroups).toHaveLength(2);
      expect(mockGroups.every((g) => g.windowId === 1 || g.windowId === 2)).toBe(true);
    });

    it('creates separate groups for different domains', async () => {
      createTab(1, 'https://google.com/search', 1);
      createTab(2, 'https://google.com/images', 1);
      createTab(3, 'https://github.com/repo1', 1);
      createTab(4, 'https://github.com/repo2', 1);

      await groupTabsByBaseUrl();

      expect(mockGroups).toHaveLength(2);
      const titles = mockGroups.map((g) => g.title).sort();
      expect(titles).toEqual(['github.com', 'google.com']);
    });

    it('ignores chrome:// URLs', async () => {
      createTab(1, 'chrome://newtab/', 1);
      createTab(2, 'chrome://settings/', 1);
      createTab(3, 'https://example.com', 1);

      await groupTabsByBaseUrl();

      expect(mockGroups).toHaveLength(0); // Only one valid domain tab
    });
  });

  describe('ungroupIfNecessary', () => {
    it('ungroups groups with single tab', async () => {
      createTab(1, 'https://example.com/page1', 1);
      createTab(2, 'https://example.com/page2', 1);

      await groupTabsByBaseUrl();
      expect(mockGroups).toHaveLength(1);

      // Simulate removing one tab
      (mockTabs[1] as any).groupId = undefined;

      await ungroupIfNecessary();

      expect(mockTabs[0].groupId).toBeUndefined();
    });

    it('preserves groups with 2+ tabs', async () => {
      createTab(1, 'https://example.com/page1', 1);
      createTab(2, 'https://example.com/page2', 1);
      createTab(3, 'https://example.com/page3', 1);

      await groupTabsByBaseUrl();
      expect(mockGroups).toHaveLength(1);

      await ungroupIfNecessary();

      expect(mockGroups).toHaveLength(1);
      expect(mockTabs.filter((t) => t.groupId === mockGroups[0].id)).toHaveLength(3);
    });
  });

  describe('integration scenarios', () => {
    it('handles multi-window scenarios', async () => {
      // Window 1
      createTab(1, 'https://google.com/search', 1);
      createTab(2, 'https://google.com/images', 1);

      // Window 2
      createTab(3, 'https://stackoverflow.com/q1', 2);
      createTab(4, 'https://stackoverflow.com/q2', 2);

      await groupTabsByBaseUrl();

      expect(mockGroups).toHaveLength(2);
      expect(mockGroups.find((g) => g.windowId === 1)?.title).toBe('google.com');
      expect(mockGroups.find((g) => g.windowId === 2)?.title).toBe('stackoverflow.com');
    });
  });
});
