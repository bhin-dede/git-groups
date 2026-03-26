import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GitFileStatus, GitStatusCode } from './types';

const execFileAsync = promisify(execFile);

export class GitService {
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

  async stashGroup(files: string[], message: string): Promise<void> {
    await this.git('stash', 'push', '-u', '-m', message, '--', ...files);
  }

  async getStashList(): Promise<Array<{ index: number; message: string }>> {
    const output = await this.git('stash', 'list', '--format=%gd||%s');
    const stashes: Array<{ index: number; message: string }> = [];
    for (const line of output.split('\n')) {
      if (!line.trim()) continue;
      const [ref, ...msgParts] = line.split('||');
      const match = ref.match(/stash@\{(\d+)\}/);
      if (match) {
        let message = msgParts.join('||');
        // Remove "On branch: " prefix that git adds
        message = message.replace(/^On \S+: /, '');
        stashes.push({ index: parseInt(match[1]), message });
      }
    }
    return stashes;
  }

  async stashPop(index: number): Promise<void> {
    await this.git('stash', 'pop', '--index', `stash@{${index}}`);
  }

  async stashDrop(index: number): Promise<void> {
    await this.git('stash', 'drop', `stash@{${index}}`);
  }

  async getStashFiles(index: number): Promise<string[]> {
    const output = await this.git('stash', 'show', `stash@{${index}}`, '--name-only');
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
