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
          shared: false,
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

      expect(mockGroups).toHaveLength(0);
    });

    it('does not group multiple chrome:// URLs together', async () => {
      createTab(1, 'chrome://newtab/', 1);
      createTab(2, 'chrome://newtab/', 1);
      createTab(3, 'chrome://settings/', 1);
      createTab(4, 'chrome://settings/', 1);

      await groupTabsByBaseUrl();

      expect(mockGroups).toHaveLength(0);
    });

    it('ignores chrome-extension:// URLs', async () => {
      createTab(1, 'chrome-extension://abcdef/popup.html', 1);
      createTab(2, 'chrome-extension://abcdef/options.html', 1);

      await groupTabsByBaseUrl();

      expect(mockGroups).toHaveLength(0);
    });

    it('skips tabs with missing url', async () => {
      const tab = createTab(1, '', 1);
      (tab as any).url = undefined;
      createTab(2, 'https://example.com/a', 1);
      createTab(3, 'https://example.com/b', 1);

      await groupTabsByBaseUrl();

      expect(mockGroups).toHaveLength(1);
      expect(mockGroups[0].title).toBe('example.com');
    });

    it('adds tabs to an existing group', async () => {
      createTab(1, 'https://example.com/a', 1);
      createTab(2, 'https://example.com/b', 1);

      await groupTabsByBaseUrl();
      expect(mockGroups).toHaveLength(1);

      createTab(3, 'https://example.com/c', 1);

      await groupTabsByBaseUrl();

      expect(mockGroups).toHaveLength(1);
      expect(mockTabs.filter((t) => t.groupId === mockGroups[0].id)).toHaveLength(3);
    });

    it('assigns consistent colors for the same domain', async () => {
      createTab(1, 'https://example.com/a', 1);
      createTab(2, 'https://example.com/b', 1);

      await groupTabsByBaseUrl();
      const firstColor = mockGroups[0].color;

      clearMocks();

      createTab(3, 'https://example.com/c', 1);
      createTab(4, 'https://example.com/d', 1);

      await groupTabsByBaseUrl();
      const secondColor = mockGroups[0].color;

      expect(firstColor).toBe(secondColor);
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

  describe('ungroupIfNecessary - additional cases', () => {
    it('handles empty groups (0 tabs) without throwing', async () => {
      createTab(1, 'https://example.com/a', 1);
      createTab(2, 'https://example.com/b', 1);

      await groupTabsByBaseUrl();
      expect(mockGroups).toHaveLength(1);

      // Simulate both tabs leaving the group
      (mockTabs[0] as any).groupId = undefined;
      (mockTabs[1] as any).groupId = undefined;

      // Should not throw even when group has 0 tabs
      await expect(ungroupIfNecessary()).resolves.not.toThrow();
    });

    it('only ungroups groups that dropped below 2 tabs', async () => {
      createTab(1, 'https://example.com/a', 1);
      createTab(2, 'https://example.com/b', 1);
      createTab(3, 'https://github.com/a', 1);
      createTab(4, 'https://github.com/b', 1);

      await groupTabsByBaseUrl();
      expect(mockGroups).toHaveLength(2);

      const githubGroup = mockGroups.find((g) => g.title === 'github.com')!;

      // Remove one tab from example.com group
      (mockTabs[1] as any).groupId = undefined;

      await ungroupIfNecessary();

      // example.com tab should be ungrouped
      expect(mockTabs[0].groupId).toBeUndefined();
      // github.com tabs should still be grouped
      expect(mockTabs[2].groupId).toBe(githubGroup.id);
      expect(mockTabs[3].groupId).toBe(githubGroup.id);
    });
  });

  describe('groupTabsByBaseUrl - edge cases', () => {
    it('skips tabs with missing id', async () => {
      const tab = createTab(1, 'https://example.com/a', 1);
      (tab as any).id = undefined;
      createTab(2, 'https://example.com/b', 1);
      createTab(3, 'https://example.com/c', 1);

      await groupTabsByBaseUrl();

      expect(mockGroups).toHaveLength(1);
      expect(mockTabs.filter((t) => t.groupId === mockGroups[0].id)).toHaveLength(2);
    });

    it('skips tabs with invalid URLs', async () => {
      createTab(1, 'not-a-valid-url', 1);
      createTab(2, 'also-invalid', 1);
      createTab(3, 'https://example.com/a', 1);
      createTab(4, 'https://example.com/b', 1);

      await groupTabsByBaseUrl();

      expect(mockGroups).toHaveLength(1);
      expect(mockGroups[0].title).toBe('example.com');
    });

    it('assigns different colors for different domains', async () => {
      createTab(1, 'https://google.com/a', 1);
      createTab(2, 'https://google.com/b', 1);
      createTab(3, 'https://github.com/a', 1);
      createTab(4, 'https://github.com/b', 1);

      await groupTabsByBaseUrl();

      const googleGroup = mockGroups.find((g) => g.title === 'google.com')!;
      const githubGroup = mockGroups.find((g) => g.title === 'github.com')!;

      // Both should have a valid color assigned
      const validColors = [
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
      expect(validColors).toContain(googleGroup.color);
      expect(validColors).toContain(githubGroup.color);
    });

    it('handles mixed groupable and non-groupable tabs across windows', async () => {
      // Window 1: 2 google tabs (groupable) + 1 github tab (not groupable alone)
      createTab(1, 'https://google.com/a', 1);
      createTab(2, 'https://google.com/b', 1);
      createTab(3, 'https://github.com/solo', 1);

      // Window 2: 1 google tab (not groupable alone in this window)
      createTab(4, 'https://google.com/c', 2);

      await groupTabsByBaseUrl();

      expect(mockGroups).toHaveLength(1);
      expect(mockGroups[0].title).toBe('google.com');
      expect(mockGroups[0].windowId).toBe(1);
    });
  });

  describe('isValidTabUrl - additional cases', () => {
    it('accepts chrome:// URLs other than newtab', () => {
      expect(isValidTabUrl('chrome://settings/')).toBe(true);
      expect(isValidTabUrl('chrome://extensions/')).toBe(true);
    });

    it('accepts chrome-extension:// URLs', () => {
      expect(isValidTabUrl('chrome-extension://abcdef/popup.html')).toBe(true);
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

    it('groups then ungroups correctly in sequence', async () => {
      createTab(1, 'https://example.com/a', 1);
      createTab(2, 'https://example.com/b', 1);

      await groupTabsByBaseUrl();
      expect(mockGroups).toHaveLength(1);
      expect(mockTabs.filter((t) => t.groupId === mockGroups[0].id)).toHaveLength(2);

      // Simulate removing one tab from the array (tab closed)
      const removedTab = mockTabs.pop()!;
      (removedTab as any).groupId = undefined;

      await ungroupIfNecessary();

      // Remaining tab should be ungrouped
      expect(mockTabs[0].groupId).toBeUndefined();
    });
  });
});
