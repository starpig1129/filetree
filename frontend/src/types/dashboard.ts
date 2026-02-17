import type { FileItemData } from '../components/dashboard/FileItem';
import type { UrlItem } from '../components/dashboard/UrlView';
import type { Folder } from '../components/dashboard/FolderSidebar';

export interface UserDashboardData {
  user?: { 
    username: string; 
    is_locked?: boolean; 
    first_login?: boolean; 
    show_in_list?: boolean 
  };
  usage?: number;
  files?: FileItemData[];
  urls?: UrlItem[];
  folders?: Folder[];
  error?: string;
}

export interface SelectedItem {
  type: 'file' | 'url' | 'folder';
  id: string;
}

export type { FileItemData, UrlItem, Folder };
