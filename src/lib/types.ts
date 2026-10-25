export interface Node {
  id: string;
  parentId: string | null;
  name: string;
  kind: "file" | "folder";
  size: number;
  mime: string | null;
  createdAt: number;
  updatedAt: number;
  trashedAt: number | null;
  childCount?: number | null;
  shared?: boolean;
  parentName?: string;
}

export interface Crumb {
  id: string;
  name: string;
}

export interface FolderListing {
  folder: Node;
  path: Crumb[];
  children: Node[];
}

export interface ShareLink {
  id: string;
  nodeId: string;
  name: string;
  kind: "file" | "folder";
  mime: string | null;
  parentId: string | null;
  hasPassword: boolean;
  expiresAt: number | null;
  createdAt: number;
  downloads: number;
  trashed: boolean;
}

export interface PublicShare {
  id: string;
  locked: boolean;
  expiresAt: number | null;
  root: Node | null;
}

export interface Me {
  authenticated: boolean;
  method: "access" | "password" | null;
  email: string | null;
  /** The sign-in methods that the owner set up. */
  signIn: { password: boolean; access: boolean };
  /** An Access user that is not in MIDDEN_ALLOWED_EMAILS. */
  denied: string | null;
  /** Access values from the request, before midden knows them. Only for the setup page. */
  detected: { teamDomain: string; aud: string } | null;
}
