import * as vscode from 'vscode';
import { GitService } from './gitService';
import { GroupManager } from './groupManager';
import { GitGroupTreeProvider, GroupItem, FileItem } from './treeProvider';

export async function activate(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const gitService = new GitService(workspaceRoot);
  const groupManager = new GroupManager(workspaceRoot);
  await groupManager.load();

  const treeProvider = new GitGroupTreeProvider(gitService, groupManager);

  const treeView = vscode.window.createTreeView('gitGroups', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
    dragAndDropController: treeProvider,
    canSelectMany: true,
  });

  // Initial load
  await treeProvider.updateChangedFiles();

  // Watch for file changes to refresh
  const fsWatcher = vscode.workspace.createFileSystemWatcher('**/*');
  let refreshTimeout: ReturnType<typeof setTimeout> | undefined;

  const debouncedRefresh = () => {
    if (refreshTimeout) clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(() => treeProvider.updateChangedFiles(), 1000);
  };

  fsWatcher.onDidChange(debouncedRefresh);
  fsWatcher.onDidCreate(debouncedRefresh);
  fsWatcher.onDidDelete(debouncedRefresh);

  // Also refresh when group manager changes
  groupManager.onDidChange(() => treeProvider.refresh());

  // --- Commands ---

  const createGroup = vscode.commands.registerCommand('gitGroupCommit.createGroup', async () => {
    const name = await vscode.window.showInputBox({
      prompt: 'Group name',
      placeHolder: 'e.g. Login feature, Bug fix...',
    });
    if (name) {
      groupManager.createGroup(name);
      await treeProvider.updateChangedFiles();
    }
  });

  const deleteGroup = vscode.commands.registerCommand('gitGroupCommit.deleteGroup', async (item: GroupItem) => {
    if (!item) return;
    const confirm = await vscode.window.showWarningMessage(
      `Delete group "${item.groupName}"?`,
      { modal: true },
      'Delete'
    );
    if (confirm === 'Delete') {
      groupManager.deleteGroup(item.groupId);
      await treeProvider.updateChangedFiles();
    }
  });

  const renameGroup = vscode.commands.registerCommand('gitGroupCommit.renameGroup', async (item?: GroupItem) => {
    // If called from keybinding (no arg), get from tree selection
    if (!item) {
      const selected = treeView.selection[0];
      if (selected instanceof GroupItem) {
        item = selected;
      }
    }
    if (!item) return;
    const newName = await vscode.window.showInputBox({
      prompt: 'New group name',
      value: item.groupName,
    });
    if (newName) {
      groupManager.renameGroup(item.groupId, newName);
      await treeProvider.updateChangedFiles();
    }
  });

  const addToGroup = vscode.commands.registerCommand('gitGroupCommit.addToGroup', async (item: FileItem) => {
    if (!item) return;
    const groups = groupManager.getAllGroups();
    if (groups.length === 0) {
      vscode.window.showInformationMessage('No groups yet. Create a group first.');
      return;
    }

    const picked = await vscode.window.showQuickPick(
      groups.map(g => ({ label: g.name, groupId: g.id })),
      { placeHolder: 'Select a group' }
    );
    if (picked) {
      groupManager.addFileToGroup(picked.groupId, item.filePath);
      await treeProvider.updateChangedFiles();
    }
  });

  const removeFromGroup = vscode.commands.registerCommand('gitGroupCommit.removeFromGroup', async (item: FileItem) => {
    if (!item || !item.groupId) return;
    groupManager.removeFileFromGroup(item.groupId, item.filePath);
    await treeProvider.updateChangedFiles();
  });

  const stageGroup = vscode.commands.registerCommand('gitGroupCommit.stageGroup', async (item: GroupItem) => {
    if (!item) return;
    const group = groupManager.getGroup(item.groupId);
    if (!group || group.files.length === 0) {
      vscode.window.showWarningMessage('No files in this group.');
      return;
    }

    try {
      await gitService.stageFiles(group.files);
      vscode.window.showInformationMessage(`Staged ${group.files.length} files from "${group.name}".`);
      await treeProvider.updateChangedFiles();
    } catch (err: any) {
      vscode.window.showErrorMessage(`Stage failed: ${err.message}`);
    }
  });

  const commitGroup = vscode.commands.registerCommand('gitGroupCommit.commitGroup', async (item: GroupItem) => {
    if (!item) return;
    const group = groupManager.getGroup(item.groupId);
    if (!group || group.files.length === 0) {
      vscode.window.showWarningMessage('No files in this group.');
      return;
    }

    const message = await vscode.window.showInputBox({
      prompt: `Commit message for "${group.name}"`,
      placeHolder: 'Enter commit message...',
    });
    if (!message) return;

    try {
      await gitService.stageAndCommit(group.files, message);
      vscode.window.showInformationMessage(`Committed "${group.name}" (${group.files.length} files).`);
      groupManager.deleteGroup(group.id);
      await treeProvider.updateChangedFiles();
    } catch (err: any) {
      vscode.window.showErrorMessage(`Commit failed: ${err.message}`);
    }
  });

  const refresh = vscode.commands.registerCommand('gitGroupCommit.refresh', async () => {
    await treeProvider.updateChangedFiles();
  });

  const openFile = vscode.commands.registerCommand('gitGroupCommit.openFile', async (item: FileItem) => {
    if (!item) return;
    const uri = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), item.filePath);
    await vscode.commands.executeCommand('vscode.open', uri);
  });

  const openDiff = vscode.commands.registerCommand('gitGroupCommit.openDiff', async (item: FileItem) => {
    if (!item) return;
    const uri = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), item.filePath);
    await vscode.commands.executeCommand('git.openChange', uri);
  });

  context.subscriptions.push(
    treeView,
    fsWatcher,
    groupManager,
    treeProvider,
    createGroup,
    deleteGroup,
    renameGroup,
    addToGroup,
    removeFromGroup,
    stageGroup,
    commitGroup,
    refresh,
    openFile,
    openDiff
  );
}

export function deactivate() {}
