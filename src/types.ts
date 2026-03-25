export interface FileGroup {
  id: string;
  name: string;
  files: string[]; // relative file paths
}

export interface GroupStoreData {
  groups: FileGroup[];
}

export type GitStatusCode =
  | 'M'  // Modified
  | 'A'  // Added
  | 'D'  // Deleted
  | 'R'  // Renamed
  | 'C'  // Copied
  | 'U'  // Unmerged
  | '?'; // Untracked

export interface GitFileStatus {
  path: string;
  status: GitStatusCode;
  originalPath?: string; // for renames
}
