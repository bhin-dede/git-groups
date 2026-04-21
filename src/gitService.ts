import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GitFileStatus, GitStatusCode, StashedGroup } from './types';

const execFileAsync = promisify(execFile);

export class GitService {
  private static readonly MANAGED_STASH_PREFIX = '[git-groups:';
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  private async git(...args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, {
      cwd: this.workspaceRoot,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  }

  async getChangedFiles(): Promise<GitFileStatus[]> {
    const output = await this.git('status', '--porcelain', '-uall');
    const files: GitFileStatus[] = [];

    for (const line of output.split('\n')) {
      if (!line.trim()) continue;

      // git status --porcelain: XY format
      // X = staged status, Y = unstaged status
      const x = line[0]; // staged
      const y = line[1]; // unstaged

      const pathPart = line.substring(3);
      const arrowIndex = pathPart.indexOf(' -> ');
      const rawPath = arrowIndex !== -1 ? pathPart.substring(arrowIndex + 4) : pathPart;
      const rawOriginal = arrowIndex !== -1 ? pathPart.substring(0, arrowIndex) : undefined;
      // Strip quotes from filenames with spaces
      const filePath = rawPath.replace(/^"(.*)"$/, '$1');
      const originalPath = rawOriginal?.replace(/^"(.*)"$/, '$1');

      // Staged entry (X has a value, not ' ' or '?')
      if (x !== ' ' && x !== '?') {
        let status: GitStatusCode;
        switch (x) {
          case 'M': status = 'M'; break;
          case 'A': status = 'A'; break;
          case 'D': status = 'D'; break;
          case 'R': status = 'R'; break;
          case 'C': status = 'C'; break;
          case 'U': status = 'U'; break;
          default: status = 'M';
        }
        files.push({ path: filePath, status, staged: true, originalPath });
      }

      // Unstaged entry (Y has a value, not ' ')
      if (y !== ' ') {
        let status: GitStatusCode;
        switch (y) {
          case 'M': status = 'M'; break;
          case 'D': status = 'D'; break;
          case '?': status = '?'; break;
          case 'U': status = 'U'; break;
          default: status = 'M';
        }
        files.push({ path: filePath, status, staged: false });
      }
    }

    return files;
  }

  async stageFiles(files: string[]): Promise<void> {
    if (files.length === 0) return;
    await this.git('add', '--', ...files);
  }

  async commit(message: string): Promise<void> {
    await this.git('commit', '-m', message);
  }

  async unstageFiles(files: string[]): Promise<void> {
    if (files.length === 0) return;
    await this.git('reset', 'HEAD', '--', ...files);
  }

  async discardFiles(files: string[]): Promise<void> {
    if (files.length === 0) return;
    // Separate tracked and untracked files
    const changedFiles = await this.getChangedFiles();
    const untracked = files.filter(f => changedFiles.some(cf => cf.path === f && cf.status === '?'));
    const tracked = files.filter(f => !untracked.includes(f));

    if (tracked.length > 0) {
      await this.git('checkout', '--', ...tracked);
    }
    if (untracked.length > 0) {
      await this.git('clean', '-f', '--', ...untracked);
    }
  }

  async undoLastCommit(): Promise<void> {
    await this.git('reset', '--soft', 'HEAD~1');
  }

  async getLastCommitMessage(): Promise<string> {
    return (await this.git('log', '-1', '--pretty=%s')).trim();
  }

  async getDiff(filePath: string, staged: boolean = false): Promise<string> {
    const args = staged ? ['diff', '--cached', '--', filePath] : ['diff', '--', filePath];
    return this.git(...args);
  }

  private decorateManagedStashMessage(message: string, stashId?: string): string {
    return stashId ? `${GitService.MANAGED_STASH_PREFIX}${stashId}] ${message}` : message;
  }

  private parseManagedStashMessage(message: string): { message: string; stashId?: string } {
    const match = message.match(/^\[git-groups:([^\]]+)\]\s*(.*)$/);
    if (!match) {
      return { message };
    }
    return { stashId: match[1], message: match[2] };
  }

  async stashGroup(files: string[], message: string, stashId?: string): Promise<void> {
    const filtered = files.filter(f =>
      f !== '.vscode/git-groups.json' &&
      !/(^|\/)\.gitignore$/.test(f)
    );
    if (filtered.length === 0) return;
    await this.git('stash', 'push', '-u', '-m', this.decorateManagedStashMessage(message, stashId), '--', ...filtered);
  }

  async getStashList(): Promise<Array<{ index: number; message: string; stashId?: string }>> {
    const output = await this.git('stash', 'list', '--format=%gd||%s');
    const stashes: Array<{ index: number; message: string; stashId?: string }> = [];
    for (const line of output.split('\n')) {
      if (!line.trim()) continue;
      const [ref, ...msgParts] = line.split('||');
      const match = ref.match(/stash@\{(\d+)\}/);
      if (match) {
        let message = msgParts.join('||');
        // Remove "On branch: " prefix that git adds
        message = message.replace(/^On \S+: /, '');
        const parsed = this.parseManagedStashMessage(message);
        stashes.push({ index: parseInt(match[1]), message: parsed.message, stashId: parsed.stashId });
      }
    }
    return stashes;
  }

  private sameFiles(left: string[], right: string[]): boolean {
    const a = [...new Set(left)].sort();
    const b = [...new Set(right)].sort();
    if (a.length !== b.length) return false;
    return a.every((file, index) => file === b[index]);
  }

  async getDetailedStashList(): Promise<Array<{ index: number; message: string; stashId?: string; files: string[] }>> {
    const stashes = await this.getStashList();
    const detailed: Array<{ index: number; message: string; stashId?: string; files: string[] }> = [];

    for (const stash of stashes) {
      detailed.push({
        ...stash,
        files: await this.getStashFiles(stash.index),
      });
    }

    return detailed;
  }

  async reconcileManagedStashes(
    stashedGroups: StashedGroup[]
  ): Promise<{
    managed: StashedGroup[];
    external: Array<{ index: number; message: string; stashId?: string; files: string[] }>;
  }> {
    const gitStashes = await this.getDetailedStashList();
    const remaining = [...gitStashes];
    const managed: StashedGroup[] = [];

    for (const group of stashedGroups) {
      const idMatch = group.stashId
        ? remaining.find(s => s.stashId === group.stashId)
        : undefined;
      const messageMatches = remaining.filter(s => s.message.includes(group.name));
      const exactMatch = messageMatches.find(
        s => s.index === group.stashIndex && this.sameFiles(s.files, group.files)
      );
      const fileMatch = messageMatches.find(s => this.sameFiles(s.files, group.files));
      const preferredIndexMatch = messageMatches.find(s => s.index === group.stashIndex);
      const fallbackMatch = messageMatches.length === 1 ? messageMatches[0] : undefined;
      const resolved = idMatch ?? exactMatch ?? fileMatch ?? preferredIndexMatch ?? fallbackMatch;

      if (!resolved) {
        continue;
      }

      managed.push({
        ...group,
        stashId: resolved.stashId ?? group.stashId,
        stashIndex: resolved.index,
      });

      const removeIndex = remaining.findIndex(s => s.index === resolved.index);
      if (removeIndex !== -1) {
        remaining.splice(removeIndex, 1);
      }
    }

    return { managed, external: remaining };
  }

  async verifyStashIndex(index: number, expectedName: string): Promise<boolean> {
    const stashes = await this.getStashList();
    const stash = stashes.find(s => s.index === index);
    if (!stash) return false;
    return stash.message.includes(expectedName);
  }

  async stashPop(index: number): Promise<void> {
    await this.git('stash', 'pop', `stash@{${index}}`);
  }

  async stashDrop(index: number): Promise<void> {
    await this.git('stash', 'drop', `stash@{${index}}`);
  }

  async getStashFiles(index: number): Promise<string[]> {
    const output = await this.git('stash', 'show', '--name-only', '--include-untracked', `stash@{${index}}`);
    return output.split('\n').filter(l => l.trim());
  }

  async stageAndCommit(files: string[], message: string): Promise<void> {
    await this.stageFiles(files);
    await this.commit(message);
  }

  async diffUri(filePath: string): Promise<{ left: vscode.Uri; right: vscode.Uri }> {
    const absPath = vscode.Uri.joinPath(vscode.Uri.file(this.workspaceRoot), filePath);
    const gitUri = absPath.with({ scheme: 'git', query: JSON.stringify({ path: filePath, ref: 'HEAD' }) });
    return { left: gitUri, right: absPath };
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }
}
