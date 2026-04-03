import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from './gitService';
import { GroupManager } from './groupManager';
import { GitFileStatus, GitStatusCode } from './types';

type TreeNode = SectionItem | SeparatorItem | GroupItem | FileItem | StashItem | StashFileItem;

const MIME_TYPE = 'application/vnd.code.tree.gitGroups';

export class SeparatorItem extends vscode.TreeItem {
  constructor() {
    super('──────────', vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'separator';
  }
}

export class StashItem extends vscode.TreeItem {
  constructor(
    public readonly stashIndex: number,
    public readonly stashMessage: string,
    public readonly fileCount: number,
    public readonly external: boolean = false
  ) {
    super(stashMessage, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = external ? `${fileCount} files (external)` : `${fileCount} files`;
    this.contextValue = external ? 'externalStashItem' : 'stashItem';
    this.iconPath = external
      ? new vscode.ThemeIcon('archive', new vscode.ThemeColor('disabledForeground'))
      : new vscode.ThemeIcon('archive');
  }
}

export class StashFileItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string
  ) {
    super(path.basename(filePath), vscode.TreeItemCollapsibleState.None);
    this.description = path.dirname(filePath) === '.' ? '' : path.dirname(filePath);
    this.contextValue = 'stashFile';
    this.iconPath = new vscode.ThemeIcon('file');
  }
}

/** Top-level section: "Staged Changes" or "Changes" */
export class SectionItem extends vscode.TreeItem {
  constructor(
    public readonly section: 'staged' | 'changes' | 'stashes',
    fileCount: number
  ) {
    const labels: Record<string, string> = {
      staged: 'Staged Changes',
      changes: 'Changes',
      stashes: 'Stashes',
    };
    super(labels[section], vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${fileCount}`;
    this.contextValue = `${section}Section`;
  }
}

/** A group inside a section */
export class GroupItem extends vscode.TreeItem {
  constructor(
    public readonly groupId: string,
    public readonly groupName: string,
    public readonly fileCount: number,
    public readonly section: 'staged' | 'changes' | 'stashes'
  ) {
    super(groupName, vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${fileCount}`;
    this.contextValue = section === 'staged' ? 'stagedGroup' : 'changesGroup';
    this.iconPath = groupId === '__ungrouped__'
      ? new vscode.ThemeIcon('folder')
      : new vscode.ThemeIcon('tag');
  }
}

export class FileItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly status: GitStatusCode,
    public readonly groupId: string | null,
    private workspaceRoot: string,
    public readonly staged: boolean = false
  ) {
    super(path.basename(filePath), vscode.TreeItemCollapsibleState.None);

    this.description = path.dirname(filePath) === '.' ? '' : path.dirname(filePath);
    this.contextValue = staged ? 'stagedFile' : (groupId ? 'groupedFile' : 'ungroupedFile');
    this.resourceUri = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), filePath);

    this.iconPath = this.getStatusIcon(status);
    this.tooltip = `${filePath} [${status}]`;

    this.command = {
      command: 'gitGroupCommit.openDiffAndCopy',
      title: 'Open Changes & Copy Path',
      arguments: [this],
    };
  }

  private getStatusIcon(status: GitStatusCode): vscode.ThemeIcon {
    switch (status) {
      case 'M': return new vscode.ThemeIcon('diff-modified', new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'));
      case 'A': return new vscode.ThemeIcon('diff-added', new vscode.ThemeColor('gitDecoration.addedResourceForeground'));
      case 'D': return new vscode.ThemeIcon('diff-removed', new vscode.ThemeColor('gitDecoration.deletedResourceForeground'));
      case '?': return new vscode.ThemeIcon('diff-added', new vscode.ThemeColor('gitDecoration.untrackedResourceForeground'));
      case 'U': return new vscode.ThemeIcon('diff-ignored', new vscode.ThemeColor('gitDecoration.conflictingResourceForeground'));
      default: return new vscode.ThemeIcon('file');
    }
  }
}

export class GitGroupTreeProvider implements vscode.TreeDataProvider<TreeNode>, vscode.TreeDragAndDropController<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  readonly dropMimeTypes = [MIME_TYPE];
  readonly dragMimeTypes = [MIME_TYPE];

  private changedFiles: GitFileStatus[] = [];
  private stashes: Array<{ index: number; message: string; files: string[]; external: boolean }> = [];


  constructor(
    private gitService: GitService,
    private groupManager: GroupManager
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async updateChangedFiles(): Promise<void> {
    this.changedFiles = await this.gitService.getChangedFiles();
    this.groupManager.pruneStaleFiles(this.changedFiles.map(f => f.path));

    // Load stashes: groupManager (ours) + git stash list (external)
    const stashedGroups = this.groupManager.getStashedGroups();
    const managedIndexes = new Set(stashedGroups.map(sg => sg.stashIndex));

    this.stashes = stashedGroups.map(sg => ({
      index: sg.stashIndex,
      message: sg.name,
      files: sg.files,
      external: false,
    }));

    try {
      const gitStashes = await this.gitService.getStashList();
      for (const gs of gitStashes) {
        if (!managedIndexes.has(gs.index)) {
          const files = await this.gitService.getStashFiles(gs.index);
          this.stashes.push({
            index: gs.index,
            message: gs.message,
            files,
            external: true,
          });
        }
      }
      // Sort by index
      this.stashes.sort((a, b) => a.index - b.index);
    } catch {
      // git stash list failed, just show managed ones
    }

    this.refresh();
  }

  // --- Drag & Drop ---

  handleDrag(source: readonly TreeNode[], dataTransfer: vscode.DataTransfer): void {
    const fileItems = source.filter((s): s is FileItem => s instanceof FileItem);
    if (fileItems.length === 0) return;

    const data = fileItems.map(f => ({
      filePath: f.filePath,
      groupId: f.groupId,
    }));
    dataTransfer.set(MIME_TYPE, new vscode.DataTransferItem(JSON.stringify(data)));
  }

  async handleDrop(target: TreeNode | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    const raw = dataTransfer.get(MIME_TYPE);
    if (!raw) return;

    const files: Array<{ filePath: string; groupId: string | null }> = JSON.parse(raw.value);
    if (files.length === 0) return;

    let targetGroupId: string | null = null;

    if (target instanceof GroupItem) {
      targetGroupId = target.groupId;
    } else if (target instanceof FileItem && target.groupId) {
      targetGroupId = target.groupId;
    }

    for (const file of files) {
      if (targetGroupId) {
        this.groupManager.addFileToGroup(targetGroupId, file.filePath);
      } else if (file.groupId) {
        this.groupManager.removeFileFromGroup(file.groupId, file.filePath);
      }
    }

    await this.updateChangedFiles();
  }

  // --- Tree Data ---

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      // Root: Staged Changes + Changes
      const items: TreeNode[] = [];

      const stagedFiles = this.changedFiles.filter(f => f.staged);
      if (stagedFiles.length > 0) {
        items.push(new SectionItem('staged', stagedFiles.length));
      }

      const unstagedFiles = this.changedFiles.filter(f => !f.staged);
      const hasGroups = this.groupManager.getAllGroups().length > 0;

      // Separator between staged and changes
      if (stagedFiles.length > 0 && (unstagedFiles.length > 0 || hasGroups)) {
        items.push(new SeparatorItem());
      }

      if (unstagedFiles.length > 0 || hasGroups) {
        items.push(new SectionItem('changes', unstagedFiles.length));
      }

      // Stashes
      if (this.stashes.length > 0) {
        const hasItemsAbove = stagedFiles.length > 0 || unstagedFiles.length > 0 || hasGroups;
        if (hasItemsAbove) {
          items.push(new SeparatorItem());
        }
        items.push(new SectionItem('stashes', this.stashes.length));
      }

      return items;
    }

    // Section → show groups inside
    if (element instanceof SectionItem) {
      // Stashes section
      if (element.section === 'stashes') {
        return this.stashes.map(s => new StashItem(s.index, s.message, s.files.length, s.external));
      }

      const isStaged = element.section === 'staged';
      const sectionFiles = this.changedFiles.filter(f => f.staged === isStaged);
      const groups = this.groupManager.getAllGroups();
      const groupedFiles = this.groupManager.getGroupedFiles();
      const items: TreeNode[] = [];

      // Groups: show if has files, or in changes section when no files are staged for this group
      for (const group of groups) {
        const filesInGroup = sectionFiles.filter(f => group.files.includes(f.path));
        const stagedFilesInGroup = this.changedFiles.filter(f => f.staged && group.files.includes(f.path));

        if (filesInGroup.length > 0) {
          // Has files in this section → show
          items.push(new GroupItem(group.id, group.name, filesInGroup.length, element.section));
        } else if (!isStaged && stagedFilesInGroup.length === 0) {
          // Empty in changes AND nothing staged → show empty group for drag & drop
          items.push(new GroupItem(group.id, group.name, 0, element.section));
        }
      }

      // Ungrouped files
      const ungrouped = sectionFiles.filter(f => !groupedFiles.has(f.path));
      if (ungrouped.length > 0) {
        const showAsGroup = vscode.workspace.getConfiguration('gitGroups').get<boolean>('showUngroupedSection', false);
        if (showAsGroup) {
          items.push(new GroupItem('__ungrouped__', 'Ungrouped', ungrouped.length, element.section));
        } else {
          for (const f of ungrouped) {
            items.push(new FileItem(
              f.path, f.status, null,
              this.gitService.getWorkspaceRoot(), isStaged
            ));
          }
        }
      }

      return items;
    }

    // Stash → show files
    if (element instanceof StashItem) {
      const stash = this.stashes.find(s => s.index === element.stashIndex);
      if (!stash) return [];
      return stash.files.map(f => new StashFileItem(f));
    }

    // Group → show files
    if (element instanceof GroupItem) {
      const isStaged = element.section === 'staged';
      const sectionFiles = this.changedFiles.filter(f => f.staged === isStaged);

      if (element.groupId === '__ungrouped__') {
        const groupedFiles = this.groupManager.getGroupedFiles();
        return sectionFiles
          .filter(f => !groupedFiles.has(f.path))
          .map(f => new FileItem(
            f.path, f.status, null,
            this.gitService.getWorkspaceRoot(), isStaged
          ));
      }

      const group = this.groupManager.getGroup(element.groupId);
      if (!group) return [];

      return group.files
        .filter(filePath => sectionFiles.some(cf => cf.path === filePath))
        .map(filePath => {
          const fileStatus = sectionFiles.find(cf => cf.path === filePath);
          return new FileItem(
            filePath,
            fileStatus?.status ?? 'M',
            element.groupId,
            this.gitService.getWorkspaceRoot(),
            isStaged
          );
        });
    }

    return [];
  }

  getParent(element: TreeNode): TreeNode | undefined {
    if (element instanceof FileItem) {
      // Find parent group or section
      const isStaged = element.staged;
      const groups = this.groupManager.getAllGroups();
      if (element.groupId && element.groupId !== '__ungrouped__') {
        const group = groups.find(g => g.id === element.groupId);
        if (group) {
          const sectionFiles = this.changedFiles.filter(f => f.staged === isStaged);
          const filesInGroup = sectionFiles.filter(f => group.files.includes(f.path));
          return new GroupItem(group.id, group.name, filesInGroup.length, isStaged ? 'staged' : 'changes');
        }
      }
      return new SectionItem(isStaged ? 'staged' : 'changes', 0);
    }
    if (element instanceof GroupItem) {
      return new SectionItem(element.section, 0);
    }
    return undefined;
  }

  getRoots(): TreeNode[] {
    return this.getChildren();
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
