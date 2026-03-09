import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface SavedTab {
  filePath: string;
  dirty: boolean;
  cursorLine: number;
  cursorColumn: number;
  scrollTop: number;
  scrollLeft: number;
  content?: string;
}

export const useEditorStore = defineStore('editor', () => {
  const savedTabs = ref<SavedTab[]>([]);
  const savedActiveFile = ref('');
  const expandedDirs = ref<Set<string>>(new Set());

  function saveTabs(tabs: SavedTab[], activeFile: string) {
    savedTabs.value = tabs;
    savedActiveFile.value = activeFile;
  }

  function clearTabs() {
    savedTabs.value = [];
    savedActiveFile.value = '';
  }

  function saveExpandedDir(path: string) {
    expandedDirs.value.add(path);
  }

  function removeExpandedDir(path: string) {
    expandedDirs.value.delete(path);
  }

  function isExpanded(path: string): boolean {
    return expandedDirs.value.has(path);
  }

  function removeExpandedDirsUnder(path: string) {
    for (const dir of expandedDirs.value) {
      if (dir === path || dir.startsWith(path + '/')) {
        expandedDirs.value.delete(dir);
      }
    }
  }

  function removeTabByPath(path: string) {
    savedTabs.value = savedTabs.value.filter(t => t.filePath !== path && !t.filePath.startsWith(path + '/'));
    if (savedActiveFile.value === path || savedActiveFile.value.startsWith(path + '/')) {
      savedActiveFile.value = '';
    }
  }

  function updateTabPath(oldPath: string, newPath: string) {
    for (const tab of savedTabs.value) {
      if (tab.filePath === oldPath) {
        tab.filePath = newPath;
      } else if (tab.filePath.startsWith(oldPath + '/')) {
        tab.filePath = newPath + tab.filePath.slice(oldPath.length);
      }
    }
    if (savedActiveFile.value === oldPath) {
      savedActiveFile.value = newPath;
    } else if (savedActiveFile.value.startsWith(oldPath + '/')) {
      savedActiveFile.value = newPath + savedActiveFile.value.slice(oldPath.length);
    }
  }

  function updateExpandedDirs(oldPath: string, newPath: string) {
    const toAdd: string[] = [];
    for (const dir of expandedDirs.value) {
      if (dir === oldPath) {
        expandedDirs.value.delete(dir);
        toAdd.push(newPath);
      } else if (dir.startsWith(oldPath + '/')) {
        expandedDirs.value.delete(dir);
        toAdd.push(newPath + dir.slice(oldPath.length));
      }
    }
    for (const p of toAdd) {
      expandedDirs.value.add(p);
    }
  }

  return {
    savedTabs, savedActiveFile, expandedDirs,
    saveTabs, clearTabs,
    saveExpandedDir, removeExpandedDir, isExpanded,
    removeExpandedDirsUnder, removeTabByPath, updateTabPath,
    updateExpandedDirs,
  };
});
