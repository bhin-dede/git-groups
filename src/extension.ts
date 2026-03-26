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
    showCollapseAll: false,
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
      value: group.name,
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

  const commitStaged = vscode.commands.registerCommand('gitGroupCommit.commitStaged', async () => {
    const changedFiles = await gitService.getChangedFiles();
    const stagedFiles = changedFiles.filter(f => f.staged);
    if (stagedFiles.length === 0) {
      vscode.window.showWarningMessage('No staged files to commit.');
      return;
    }

    const groups = groupManager.getAllGroups();
    const groupedFiles = groupManager.getGroupedFiles();

    // Build list: groups with staged files + ungrouped staged files
    interface CommitItem extends vscode.QuickPickItem {
      groupId?: string;
      files: string[];
      commitMessage: string;
    }

    const items: CommitItem[] = [];

    for (const group of groups) {
      const stagedInGroup = stagedFiles.filter(f => group.files.includes(f.path));
      if (stagedInGroup.length > 0) {
        items.push({
          label: `$(tag) ${group.name}`,
          description: `${stagedInGroup.length} files`,
          picked: true,
          groupId: group.id,
          files: stagedInGroup.map(f => f.path),
          commitMessage: group.name,
        });
      }
    }

    // Ungrouped staged files
    const ungroupedStaged = stagedFiles.filter(f => !groupedFiles.has(f.path));
    if (ungroupedStaged.length > 0) {
      items.push({
        label: `$(file) Ungrouped`,
        description: `${ungroupedStaged.length} files`,
        picked: true,
        files: ungroupedStaged.map(f => f.path),
        commitMessage: '',
      });
    }

    if (items.length === 0) return;

    // If only ungrouped files, just do a normal commit
    if (items.length === 1 && !items[0].groupId) {
      const message = await vscode.window.showInputBox({
        prompt: 'Commit message',
        placeHolder: 'Enter commit message...',
      });
      if (!message) return;
      try {
        await gitService.commit(message);
        vscode.window.showInformationMessage(`Committed: "${message}"`);
        await treeProvider.updateChangedFiles();
      } catch (err: any) {
        vscode.window.showErrorMessage(`Commit failed: ${err.message}`);
      }
      return;
    }

    // Show QuickPick with groups
    const selected = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      placeHolder: 'Select groups to commit (each group = separate commit)',
    });

    if (!selected || selected.length === 0) return;

    try {
      for (const item of selected) {
        let message = item.commitMessage;

        if (!message) {
          const input = await vscode.window.showInputBox({
            prompt: `Commit message for "${item.label}"`,
            placeHolder: 'Enter commit message...',
          });
          if (!input) continue;
          message = input;
        }

        // Unstage everything, then stage only this group's files, then commit
        const allStaged = (await gitService.getChangedFiles()).filter(f => f.staged).map(f => f.path);
        if (allStaged.length > 0) {
          await gitService.unstageFiles(allStaged);
        }
        await gitService.stageFiles(item.files);
        await gitService.commit(message);

        // Clean up group
        if (item.groupId) {
          groupManager.deleteGroup(item.groupId);
        }
      }

      // Re-stage files that were originally staged but not committed
      const originalStaged = stagedFiles.map(f => f.path);
      const committedFiles = selected.flatMap(s => s.files);
      const toRestage = originalStaged.filter(f => !committedFiles.includes(f));
      if (toRestage.length > 0) {
        await gitService.stageFiles(toRestage);
      }

      vscode.window.showInformationMessage(`Committed ${selected.length} group(s).`);
      await treeProvider.updateChangedFiles();
    } catch (err: any) {
      vscode.window.showErrorMessage(`Commit failed: ${err.message}`);
    }
  });

  const unstageGroup = vscode.commands.registerCommand('gitGroupCommit.unstageGroup', async (item: GroupItem) => {
    if (!item) return;
    const group = groupManager.getGroup(item.groupId);
    if (!group || group.files.length === 0) return;
    try {
      await gitService.unstageFiles(group.files);
      await treeProvider.updateChangedFiles();
    } catch (err: any) {
      vscode.window.showErrorMessage(`Unstage failed: ${err.message}`);
    }
  });

  const discardGroup = vscode.commands.registerCommand('gitGroupCommit.discardGroup', async (item: GroupItem) => {
    if (!item) return;
    const group = groupManager.getGroup(item.groupId);
    if (!group || group.files.length === 0) return;
    const confirm = await vscode.window.showWarningMessage(
      `Discard all changes in "${group.name}"?`, { modal: true }, 'Discard'
    );
    if (confirm !== 'Discard') return;
    try {
      await gitService.discardFiles(group.files);
      await treeProvider.updateChangedFiles();
    } catch (err: any) {
      vscode.window.showErrorMessage(`Discard failed: ${err.message}`);
    }
  });

  const stageFile = vscode.commands.registerCommand('gitGroupCommit.stageFile', async (item: FileItem) => {
    if (!item) return;
    try {
      await gitService.stageFiles([item.filePath]);
      await treeProvider.updateChangedFiles();
    } catch (err: any) {
      vscode.window.showErrorMessage(`Stage failed: ${err.message}`);
    }
  });

  const unstageFile = vscode.commands.registerCommand('gitGroupCommit.unstageFile', async (item: FileItem) => {
    if (!item) return;
    try {
      await gitService.unstageFiles([item.filePath]);
      await treeProvider.updateChangedFiles();
    } catch (err: any) {
      vscode.window.showErrorMessage(`Unstage failed: ${err.message}`);
    }
  });

  const discardFile = vscode.commands.registerCommand('gitGroupCommit.discardFile', async (item: FileItem) => {
    if (!item) return;
    const confirm = await vscode.window.showWarningMessage(
      `Discard changes in "${item.filePath}"?`, { modal: true }, 'Discard'
    );
    if (confirm !== 'Discard') return;
    try {
      await gitService.discardFiles([item.filePath]);
      await treeProvider.updateChangedFiles();
    } catch (err: any) {
      vscode.window.showErrorMessage(`Discard failed: ${err.message}`);
    }
  });

  const generateGroupName = vscode.commands.registerCommand('gitGroupCommit.generateGroupName', async (item: GroupItem) => {
    if (!item) return;
    const group = groupManager.getGroup(item.groupId);
    if (!group || group.files.length === 0) return;

    try {
      // Get diffs for files in this group
      const diffs: string[] = [];
      for (const filePath of group.files) {
        try {
          const isStaged = item.section === 'staged';
          const diff = await gitService.getDiff(filePath, isStaged);
          if (diff) {
            diffs.push(`--- ${filePath} ---\n${diff.substring(0, 500)}`);
          }
        } catch {
          diffs.push(`--- ${filePath} (no diff) ---`);
        }
      }

      const diffSummary = diffs.join('\n\n');

      // Use VS Code Language Model API
      const models = await vscode.lm.selectChatModels({ family: 'gpt-4o' });
      let model = models[0];
      if (!model) {
        const allModels = await vscode.lm.selectChatModels();
        model = allModels[0];
      }
      if (!model) {
        vscode.window.showWarningMessage('No AI model available. Please install GitHub Copilot.');
        return;
      }

      const messages = [
        vscode.LanguageModelChatMessage.User(
          `Based on the following git diff, suggest a concise group name that describes what was changed. Format: "type: description" (e.g. "feat: add user authentication", "fix: resolve login timeout", "refactor: extract validation logic"). The description should be specific about WHAT was done, not just the type. Max 8 words total. Reply with ONLY the group name, nothing else.\n\nFiles: ${group.files.join(', ')}\n\nDiff:\n${diffSummary}`
        ),
      ];

      const response = await model.sendRequest(messages, {});
      let name = '';
      for await (const chunk of response.text) {
        name += chunk;
      }

      name = name.trim().replace(/^["']|["']$/g, '');
      if (!name) return;

      groupManager.renameGroup(item.groupId, name);
      await treeProvider.updateChangedFiles();
    } catch (err: any) {
      if (err?.message?.includes('consent')) {
        vscode.window.showWarningMessage('Please allow Copilot access for Git Groups extension.');
      } else {
        vscode.window.showErrorMessage(`AI generation failed: ${err.message}`);
      }
    }
  });

  const stageAll = vscode.commands.registerCommand('gitGroupCommit.stageAll', async () => {
    const changedFiles = await gitService.getChangedFiles();
    const unstaged = changedFiles.filter(f => !f.staged).map(f => f.path);
    if (unstaged.length === 0) return;
    try {
      await gitService.stageFiles(unstaged);
      await treeProvider.updateChangedFiles();
    } catch (err: any) {
      vscode.window.showErrorMessage(`Stage all failed: ${err.message}`);
    }
  });

  const unstageAll = vscode.commands.registerCommand('gitGroupCommit.unstageAll', async () => {
    const changedFiles = await gitService.getChangedFiles();
    const staged = changedFiles.filter(f => f.staged).map(f => f.path);
    if (staged.length === 0) return;
    try {
      await gitService.unstageFiles(staged);
      await treeProvider.updateChangedFiles();
    } catch (err: any) {
      vscode.window.showErrorMessage(`Unstage all failed: ${err.message}`);
    }
  });

  const undoLastCommit = vscode.commands.registerCommand('gitGroupCommit.undoLastCommit', async () => {
    try {
      const lastMsg = await gitService.getLastCommitMessage();
      const confirm = await vscode.window.showWarningMessage(
        `Undo last commit: "${lastMsg}"?`, { modal: true }, 'Undo'
      );
      if (confirm !== 'Undo') return;
      await gitService.undoLastCommit();
      vscode.window.showInformationMessage(`Undone: "${lastMsg}" — changes moved to staged.`);
      await treeProvider.updateChangedFiles();
    } catch (err: any) {
      vscode.window.showErrorMessage(`Undo failed: ${err.message}`);
    }
  });

  let collapsed = false;
  const toggleCollapse = vscode.commands.registerCommand('gitGroupCommit.toggleCollapse', async () => {
    if (collapsed) {
      // Expand all
      const roots = treeProvider.getRoots();
      for (const root of roots) {
        await treeView.reveal(root, { expand: 3, select: false, focus: false });
      }
    } else {
      // Collapse all
      await vscode.commands.executeCommand('workbench.actions.treeView.gitGroups.collapseAll');
    }
    collapsed = !collapsed;
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
    commitStaged,
    unstageGroup,
    discardGroup,
    stageFile,
    unstageFile,
    discardFile,
    generateGroupName,
    undoLastCommit,
    stageAll,
    unstageAll,
    toggleCollapse,
    refresh,
    openFile,
    openDiff
  );
}

export function deactivate() {}
