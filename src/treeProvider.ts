import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from './gitService';
import { GroupManager } from './groupManager';
import { GitFileStatus, GitStatusCode } from './types';

type TreeNode = GroupItem | FileItem | UngroupedItem;

const MIME_TYPE = 'application/vnd.code.tree.gitGroups';

export class GroupItem extends vscode.TreeItem {
  constructor(
    public readonly groupId: string,
    public readonly groupName: string,
    public readonly fileCount: number
  ) {
    super(groupName, vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${fileCount}`;
    this.contextValue = 'group';
    this.iconPath = new vscode.ThemeIcon('tag');
  }
}

export class FileItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly status: GitStatusCode,
    public readonly groupId: string | null,
    private workspaceRoot: string
  ) {
    super(path.basename(filePath), vscode.TreeItemCollapsibleState.None);

    this.description = path.dirname(filePath) === '.' ? '' : path.dirname(filePath);
    this.contextValue = groupId ? 'groupedFile' : 'ungroupedFile';
    this.resourceUri = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), filePath);

    // Status decoration
    this.iconPath = this.getStatusIcon(status);
    this.tooltip = `${filePath} [${status}]`;

    // Click to open diff
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

export class UngroupedItem extends vscode.TreeItem {
  constructor(fileCount: number) {
    super('Ungrouped', vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${fileCount}`;
    this.contextValue = 'ungroupedSection';
    this.iconPath = new vscode.ThemeIcon('folder');
  }
}

export class GitGroupTreeProvider implements vscode.TreeDataProvider<TreeNode>, vscode.TreeDragAndDropController<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Drag and drop
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
    // Only allow dragging FileItems
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
      // Dropped on a file inside a group → add to that group
      targetGroupId = target.groupId;
    } else if (target instanceof UngroupedItem || (target instanceof FileItem && !target.groupId)) {
      // Dropped on Ungrouped → remove from group
      targetGroupId = null;
    }

    for (const file of files) {
      if (targetGroupId) {
        this.groupManager.addFileToGroup(targetGroupId, file.filePath);
      } else if (file.groupId) {
        // Moving to ungrouped = remove from current group
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
      // Root level: groups + ungrouped section
      const items: TreeNode[] = [];
      const groups = this.groupManager.getAllGroups();
      const groupedFiles = this.groupManager.getGroupedFiles();

      for (const group of groups) {
        const validFiles = group.files.filter(f =>
          this.changedFiles.some(cf => cf.path === f)
        );
        items.push(new GroupItem(group.id, group.name, validFiles.length));
      }

      // Ungrouped files
      const ungroupedFiles = this.changedFiles.filter(f => !groupedFiles.has(f.path));
      if (ungroupedFiles.length > 0) {
        items.push(new UngroupedItem(ungroupedFiles.length));
      }

      return items;
    }

    if (element instanceof GroupItem) {
      const group = this.groupManager.getGroup(element.groupId);
      if (!group) return [];

      return group.files
        .filter(f => this.changedFiles.some(cf => cf.path === f))
        .map(filePath => {
          const fileStatus = this.changedFiles.find(cf => cf.path === filePath);
          return new FileItem(
            filePath,
            fileStatus?.status ?? 'M',
            element.groupId,
            this.gitService.getWorkspaceRoot()
          );
        });
    }

    if (element instanceof UngroupedItem) {
      const groupedFiles = this.groupManager.getGroupedFiles();
      return this.changedFiles
        .filter(f => !groupedFiles.has(f.path))
        .map(f => new FileItem(
          f.path,
          f.status,
          null,
          this.gitService.getWorkspaceRoot()
        ));
    }

    return [];
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
