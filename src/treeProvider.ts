import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from './gitService';
import { GroupManager } from './groupManager';
import { GitFileStatus, GitStatusCode } from './types';

type TreeNode = SectionItem | GroupItem | FileItem;

const MIME_TYPE = 'application/vnd.code.tree.gitGroups';

/** Top-level section: "Staged Changes" or "Changes" */
export class SectionItem extends vscode.TreeItem {
  constructor(
    public readonly section: 'staged' | 'changes',
    fileCount: number
  ) {
    super(
      section === 'staged' ? 'Staged Changes' : 'Changes',
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.description = `${fileCount}`;
    this.contextValue = section === 'staged' ? 'stagedSection' : 'changesSection';
  }
}

/** A group inside a section */
export class GroupItem extends vscode.TreeItem {
  constructor(
    public readonly groupId: string,
    public readonly groupName: string,
    public readonly fileCount: number,
    public readonly section: 'staged' | 'changes'
  ) {
    super(groupName, vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${fileCount}`;
    this.contextValue = 'group';
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
      command: 'gitGroupCommit.openDiff',
      title: 'Open Changes',
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

    if (target instanceof GroupItem && target.groupId !== '__ungrouped__') {
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
      if (unstagedFiles.length > 0) {
        items.push(new SectionItem('changes', unstagedFiles.length));
      }

      return items;
    }

    // Section → show groups inside
    if (element instanceof SectionItem) {
      const isStaged = element.section === 'staged';
      const sectionFiles = this.changedFiles.filter(f => f.staged === isStaged);
      const groups = this.groupManager.getAllGroups();
      const groupedFiles = this.groupManager.getGroupedFiles();
      const items: TreeNode[] = [];

      // Groups that have files in this section
      for (const group of groups) {
        const filesInGroup = sectionFiles.filter(f => group.files.includes(f.path));
        if (filesInGroup.length > 0) {
          items.push(new GroupItem(group.id, group.name, filesInGroup.length, element.section));
        }
      }

      // Ungrouped files in this section
      const ungrouped = sectionFiles.filter(f => !groupedFiles.has(f.path));
      if (ungrouped.length > 0) {
        items.push(new GroupItem('__ungrouped__', 'Ungrouped', ungrouped.length, element.section));
      }

      // If no groups at all, just show files directly
      if (items.length === 0) {
        return sectionFiles.map(f => new FileItem(
          f.path, f.status, null,
          this.gitService.getWorkspaceRoot(), isStaged
        ));
      }

      return items;
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
