# Group Single Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Group single tabs" context menu toggle that lets users group even a single tab by domain.

**Architecture:** Add a `groupSingleTabs` boolean parameter (default `false`) to `groupTabsByBaseUrl` and `ungroupIfNecessary`. Cache the setting in a module-level variable in `background.ts`, persisted via `chrome.storage.sync`. Expose the toggle via a context menu checkbox on the extension icon.

**Tech Stack:** TypeScript, Chrome Extensions Manifest V3, Jest

**Spec:** `docs/superpowers/specs/2026-03-24-group-single-tabs-design.md`

---

## File Structure

- **Modify:** `src/handlers.ts` — add `groupSingleTabs` parameter to `groupTabsByBaseUrl` and `ungroupIfNecessary`
- **Modify:** `src/handlers.test.ts` — add tests for `groupSingleTabs: true` behavior
- **Modify:** `src/background.ts` — add cached setting, context menu, storage listeners, pass setting to all call sites
- **Modify:** `manifest.json` — add permissions and action entry

---

### Task 1: Add `groupSingleTabs` parameter to `groupTabsByBaseUrl`

**Files:**

- Test: `src/handlers.test.ts`
- Modify: `src/handlers.ts:87-108`

- [ ] **Step 1: Write failing test — single tab gets grouped when `groupSingleTabs` is true**

```typescript
// Add inside describe('groupTabsByBaseUrl', () => { ... })
it('groups a single tab when groupSingleTabs is true', async () => {
  createTab(1, 'https://example.com/page', 1);

  await groupTabsByBaseUrl(true);

  expect(mockGroups).toHaveLength(1);
  expect(mockGroups[0].title).toBe('example.com');
  expect(mockTabs[0].groupId).toBe(mockGroups[0].id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testNamePattern="groups a single tab when groupSingleTabs is true"`
Expected: FAIL — `groupTabsByBaseUrl` does not accept arguments

- [ ] **Step 3: Add `groupSingleTabs` parameter to `groupTabsByBaseUrl`**

In `src/handlers.ts`, change the function signature and threshold:

```typescript
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
        await addToExistingGroup(tabIds, existingGroups[0].id);
      }
    }
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testNamePattern="groups a single tab when groupSingleTabs is true"`
Expected: PASS

- [ ] **Step 5: Run all tests to verify no regressions**

Run: `npm test`
Expected: All tests pass (existing tests call `groupTabsByBaseUrl()` with no args, defaulting to `false`)

- [ ] **Step 6: Commit**

```bash
git add src/handlers.ts src/handlers.test.ts
git commit -m "feat: add groupSingleTabs parameter to groupTabsByBaseUrl"
```

---

### Task 2: Add `groupSingleTabs` parameter to `ungroupIfNecessary`

**Files:**

- Test: `src/handlers.test.ts`
- Modify: `src/handlers.ts:111-125`

- [ ] **Step 1: Write failing test — group with 1 tab is preserved when `groupSingleTabs` is true**

```typescript
// Add inside describe('ungroupIfNecessary', () => { ... })
it('preserves groups with 1 tab when groupSingleTabs is true', async () => {
  createTab(1, 'https://example.com/page1', 1);
  createTab(2, 'https://example.com/page2', 1);

  await groupTabsByBaseUrl(true);
  expect(mockGroups).toHaveLength(1);

  // Simulate removing one tab from the group
  (mockTabs[1] as any).groupId = undefined;

  await ungroupIfNecessary(true);

  // Single tab should remain grouped
  expect(mockTabs[0].groupId).toBe(mockGroups[0].id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testNamePattern="preserves groups with 1 tab when groupSingleTabs is true"`
Expected: FAIL — `ungroupIfNecessary` does not accept arguments, ungroups the single tab

- [ ] **Step 3: Add `groupSingleTabs` parameter to `ungroupIfNecessary`**

In `src/handlers.ts`, change the function:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testNamePattern="preserves groups with 1 tab when groupSingleTabs is true"`
Expected: PASS

- [ ] **Step 5: Run all tests to verify no regressions**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/handlers.ts src/handlers.test.ts
git commit -m "feat: add groupSingleTabs parameter to ungroupIfNecessary"
```

---

### Task 3: Add remaining tests for `groupSingleTabs` behavior

**Files:**

- Test: `src/handlers.test.ts`

- [ ] **Step 1: Write test — group dropping from 3 to 1 tab stays grouped with groupSingleTabs true**

```typescript
// Add inside describe('ungroupIfNecessary', () => { ... })
it('preserves group dropping from 3 to 1 tab when groupSingleTabs is true', async () => {
  createTab(1, 'https://example.com/a', 1);
  createTab(2, 'https://example.com/b', 1);
  createTab(3, 'https://example.com/c', 1);

  await groupTabsByBaseUrl(true);
  expect(mockGroups).toHaveLength(1);
  const groupId = mockGroups[0].id;

  // Simulate two tabs leaving the group
  (mockTabs[1] as any).groupId = undefined;
  (mockTabs[2] as any).groupId = undefined;

  await ungroupIfNecessary(true);

  expect(mockTabs[0].groupId).toBe(groupId);
});
```

- [ ] **Step 2: Write regression test — single tab is NOT grouped when `groupSingleTabs` is false**

```typescript
// Add inside describe('groupTabsByBaseUrl', () => { ... })
it('does not group single tabs when groupSingleTabs is false (explicit)', async () => {
  createTab(1, 'https://example.com/page', 1);

  await groupTabsByBaseUrl(false);

  expect(mockGroups).toHaveLength(0);
});
```

- [ ] **Step 3: Write test — single tab gets correct color**

```typescript
// Add inside describe('groupTabsByBaseUrl', () => { ... })
it('assigns correct color to single-tab group', async () => {
  createTab(1, 'https://example.com/page', 1);

  await groupTabsByBaseUrl(true);

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
  expect(validColors).toContain(mockGroups[0].color);
});
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/handlers.test.ts
git commit -m "test: add groupSingleTabs test coverage"
```

---

### Task 4: Update manifest.json

**Files:**

- Modify: `manifest.json`

- [ ] **Step 1: Add permissions and action entry**

Update `manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Group Tabs by Domain",
  "version": "1.1.0",
  "description": "Automatically groups tabs by domain to keep your browsing organized",
  "permissions": ["tabs", "tabGroups", "storage", "contextMenus"],
  "action": {},
  "background": {
    "service_worker": "background.js"
  },
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: Build to verify manifest is valid**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: add storage, contextMenus permissions and action entry"
```

---

### Task 5: Update background.ts with cached setting, context menu, and storage listeners

**Files:**

- Modify: `src/background.ts`

- [ ] **Step 1: Rewrite background.ts**

```typescript
import { groupTabsByBaseUrl, ungroupIfNecessary, isValidTabUrl } from './handlers';

const STORAGE_KEY = 'groupSingleTabs';
const MENU_ID = 'group-single-tabs';

let groupSingleTabs = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const debouncedGroupTabs = (): void => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      await groupTabsByBaseUrl(groupSingleTabs);
    } catch (error) {
      console.error('Failed to group tabs:', error);
    }
  }, 100);
};

const applySettings = async (): Promise<void> => {
  try {
    await groupTabsByBaseUrl(groupSingleTabs);
    await ungroupIfNecessary(groupSingleTabs);
  } catch (error) {
    console.error('Failed to apply settings:', error);
  }
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
  groupSingleTabs = result[STORAGE_KEY];
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
    groupSingleTabs = changes[STORAGE_KEY].newValue ?? false;
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
  try {
    await ungroupIfNecessary(groupSingleTabs);
  } catch (error) {
    console.error('Failed to ungroup tabs:', error);
  }
});
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual verification checklist**

Load the extension from `dist/` as an unpacked extension in Chrome and verify:

1. Right-click the extension icon — "Group single tabs" checkbox appears, unchecked by default
2. Check the checkbox — single tabs from a domain get grouped with the domain name
3. Uncheck the checkbox — single-tab groups are dissolved, multi-tab groups remain
4. Reload the extension — checkbox state persists

- [ ] **Step 5: Commit**

```bash
git add src/background.ts
git commit -m "feat: add context menu toggle and cached groupSingleTabs setting"
```

---

### Task 6: Final verification and docs

**Files:**

- Modify: `CLAUDE.md` (if needed)
- Modify: `README.md`

- [ ] **Step 1: Run full verification**

Run: `npm run lint && npm run format:check && npm test && npm run build`
Expected: All pass

- [ ] **Step 2: Fix formatting if needed**

Run: `npm run format`

- [ ] **Step 3: Update README features list**

Add to the Features section in `README.md`:

```markdown
- **Optional Single-Tab Groups**: Right-click the extension icon to toggle grouping for single tabs
```

- [ ] **Step 4: Run final build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add single-tab grouping feature to README"
```
