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

      const statusChar = line.substring(0, 2).trim();
      let status: GitStatusCode;

      switch (statusChar) {
        case 'M':
        case 'MM':
        case 'AM':
          status = 'M';
          break;
        case 'A':
          status = 'A';
          break;
        case 'D':
          status = 'D';
          break;
        case 'R':
          status = 'R';
          break;
        case '??':
          status = '?';
          break;
        case 'UU':
        case 'AA':
        case 'DD':
          status = 'U';
          break;
        default:
          status = 'M';
      }

      const pathPart = line.substring(3);
      const arrowIndex = pathPart.indexOf(' -> ');

      if (arrowIndex !== -1) {
        files.push({
          path: pathPart.substring(arrowIndex + 4),
          status,
          originalPath: pathPart.substring(0, arrowIndex),
        });
      } else {
        files.push({ path: pathPart, status });
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
