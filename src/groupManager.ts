import * as vscode from 'vscode';
import * as path from 'path';
import { FileGroup, GroupStoreData } from './types';

export class GroupManager {
  private groups: Map<string, FileGroup> = new Map();
  private storageUri: vscode.Uri;
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private workspaceRoot: string) {
    this.storageUri = vscode.Uri.joinPath(
      vscode.Uri.file(workspaceRoot),
      '.vscode',
      'git-groups.json'
    );
  }

  async load(): Promise<void> {
    try {
      const data = await vscode.workspace.fs.readFile(this.storageUri);
      const parsed: GroupStoreData = JSON.parse(Buffer.from(data).toString('utf-8'));
      this.groups.clear();
      for (const group of parsed.groups) {
        this.groups.set(group.id, group);
      }
    } catch {
      // File doesn't exist yet, start fresh
    }
  }

  async save(): Promise<void> {
    const data: GroupStoreData = {
      groups: Array.from(this.groups.values()),
    };

    // Ensure .vscode directory exists
    const vscodeDir = vscode.Uri.joinPath(vscode.Uri.file(this.workspaceRoot), '.vscode');
    try {
      await vscode.workspace.fs.createDirectory(vscodeDir);
    } catch {
      // Already exists
    }

    const content = JSON.stringify(data, null, 2);
    await vscode.workspace.fs.writeFile(this.storageUri, Buffer.from(content, 'utf-8'));
  }

  createGroup(name: string): FileGroup {
    const id = `group_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const group: FileGroup = { id, name, files: [] };
    this.groups.set(id, group);
    this.saveAndNotify();
    return group;
  }

  deleteGroup(groupId: string): void {
    this.groups.delete(groupId);
    this.saveAndNotify();
  }

  renameGroup(groupId: string, newName: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      group.name = newName;
      this.saveAndNotify();
    }
  }

  addFileToGroup(groupId: string, filePath: string): void {
    // Remove from any other group first
    for (const group of this.groups.values()) {
      const idx = group.files.indexOf(filePath);
      if (idx !== -1) {
        group.files.splice(idx, 1);
      }
    }

    const group = this.groups.get(groupId);
    if (group && !group.files.includes(filePath)) {
      group.files.push(filePath);
      this.saveAndNotify();
    }
  }

  removeFileFromGroup(groupId: string, filePath: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      const idx = group.files.indexOf(filePath);
      if (idx !== -1) {
        group.files.splice(idx, 1);
        this.saveAndNotify();
      }
    }
  }

  getGroup(groupId: string): FileGroup | undefined {
    return this.groups.get(groupId);
  }

  getAllGroups(): FileGroup[] {
    return Array.from(this.groups.values());
  }

  getGroupForFile(filePath: string): FileGroup | undefined {
    for (const group of this.groups.values()) {
      if (group.files.includes(filePath)) {
        return group;
      }
    }
    return undefined;
  }

  getGroupedFiles(): Set<string> {
    const files = new Set<string>();
    for (const group of this.groups.values()) {
      for (const file of group.files) {
        files.add(file);
      }
    }
    return files;
  }

  /** Remove files from groups that no longer appear in git changes */
  pruneStaleFiles(currentChangedFiles: string[]): void {
    const changedSet = new Set(currentChangedFiles);
    let changed = false;

    for (const group of this.groups.values()) {
      const before = group.files.length;
      group.files = group.files.filter(f => changedSet.has(f));
      if (group.files.length !== before) {
        changed = true;
      }
    }

    if (changed) {
      this.saveAndNotify();
    }
  }

  private saveAndNotify(): void {
    this.save().catch(err => console.error('Failed to save groups:', err));
    this._onDidChange.fire();
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
