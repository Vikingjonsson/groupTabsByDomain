# Group Single Tabs Setting

## Problem

Users want the option to group even a single tab by domain so the domain label is visible in the tab strip. The current minimum of 2 tabs means solo tabs from a domain have no visual indicator.

## Solution

Add a "Group single tabs" toggle via a Chrome context menu checkbox, persisted in `chrome.storage.sync`.

## Settings Storage & Context Menu

- Add a context menu item "Group single tabs" with `type: "checkbox"` using `chrome.contextMenus` API.
- Use `contexts: ["action"]` so the menu appears on right-click of the extension icon. Add a minimal `"action": {}` entry to `manifest.json` to enable this.
- Store the preference in `chrome.storage.sync` under key `groupSingleTabs` (boolean, default `false`).
- On `chrome.runtime.onInstalled` and `chrome.runtime.onStartup`, read the stored value, create the context menu with the correct checked state, and initialize a module-level `groupSingleTabs` variable. These lifecycle hooks are only for setup — tab event listeners (`onCreated`, `onUpdated`, `onRemoved`) remain registered at the top level as required by MV3 service workers.
- On context menu click, update the module-level variable and persist the new value to `chrome.storage.sync`, then run both `groupTabsByBaseUrl(false)` and `ungroupIfNecessary(false)` — or with `true` — passing the new cached value to both. The ordering is intentional: when toggling OFF, `groupTabsByBaseUrl` is a no-op for single-tab domains (threshold reverts to 2), and `ungroupIfNecessary` then cleans up any single-tab groups.
- Add `"storage"` and `"contextMenus"` permissions to `manifest.json`.

## Cached Setting

- The `groupSingleTabs` value is cached in a module-level variable in `background.ts`, initialized to `false`.
- The variable is updated on startup (from `chrome.storage.sync.get`), on context menu toggle, and via a `chrome.storage.onChanged` listener (to handle cross-device sync and keep the context menu checked state in sync). The `onChanged` listener also triggers a grouping/ungrouping pass so tabs reflect the new setting immediately.
- All call sites (`debouncedGroupTabs`, `onRemoved` handler) read from the cached variable instead of calling `chrome.storage.sync.get` on every event.

## Grouping Logic Changes

- `groupTabsByBaseUrl` accepts a `groupSingleTabs` parameter (boolean, default `false`).
  - When `false` (default): skip domains with fewer than 2 tabs (current behavior).
  - When `true`: group domains with 1 or more tabs.
- `ungroupIfNecessary` accepts the same parameter (boolean, default `false`).
  - When `false`: ungroup when group drops below 2 tabs (current behavior).
  - When `true`: effectively a no-op — Chrome automatically garbage-collects empty groups (0 tabs), so no explicit ungrouping is needed.
- All call sites in `background.ts` are updated to pass the cached setting: `debouncedGroupTabs`, the `onRemoved` handler, and the context menu toggle handler.
- Core functions remain pure — they receive the setting as an argument, not reading storage themselves. The default parameter value of `false` maintains backward compatibility for existing tests.

## Known Limitations

- Manually-created groups or groups from other extensions are treated the same as auto-created groups. `ungroupIfNecessary` will ungroup any group below the threshold regardless of origin. This matches current behavior.
- If the user toggles the setting while a tab is mid-navigation, that tab may not be grouped until its next `onUpdated` event fires. This is acceptable.
- Tabs moved between windows (`onAttached`/`onDetached`) are not re-grouped until the next tab event. This is a pre-existing gap that becomes more visible with single-tab grouping enabled.

## Testing

- Existing tests remain unchanged (they test default `groupSingleTabs: false` behavior, relying on the default parameter value).
- New test cases for `groupSingleTabs: true`:
  - Single tab gets grouped with correct domain title and color.
  - Group with 1 tab is preserved (not ungrouped).
  - Group that drops from 2 to 1 tab stays grouped.
- Regression test for `groupSingleTabs: false` confirming single tab is still not grouped.
- Context menu creation, storage integration, and `storage.onChanged` are not unit tested (they depend on Chrome APIs that are impractical to mock). Verified manually.
