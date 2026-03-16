import { main } from '../models';

export function GetLastProjectPath(): Promise<string>;
export function OpenProject(): Promise<main.ProjectData>;
export function ReopenLastProject(): Promise<main.ProjectData>;
export function SaveConfig(arg1: string): Promise<void>;
export function SaveCsv(arg1: string): Promise<void>;
export function GetVersion(): Promise<string>;
export function CheckUpdate(): Promise<main.UpdateInfo>;
export function DownloadAndInstallUpdate(arg1: string, arg2: string): Promise<void>;
export function GetCurrentOS(): Promise<string>;
export function ConfirmClose(arg1: boolean): Promise<void>;

export interface RecentProject {
  name: string;
  path: string;
  icon: string;
  openedAt: string;
}
export function GetRecentProjects(): Promise<RecentProject[]>;
export function OpenProjectPath(arg1: string): Promise<main.ProjectData>;
export function RemoveRecentProject(arg1: string): Promise<void>;
export function SaveRecentAfterOpen(arg1: string): Promise<void>;
