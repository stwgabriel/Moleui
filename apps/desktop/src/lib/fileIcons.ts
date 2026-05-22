import {
  Archive,
  AudioLines,
  Binary,
  BookOpen,
  Box,
  Braces,
  Bug,
  Camera,
  CircuitBoard,
  Code2,
  Cpu,
  Database,
  DatabaseZap,
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileCog,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  FolderArchive,
  FolderCode,
  FolderCog,
  Gamepad2,
  HardDrive,
  Image,
  KeyRound,
  Library,
  Music,
  Package,
  Palette,
  Presentation,
  Settings,
  Shield,
  TerminalSquare,
  Trash2,
  Video,
  type LucideIcon,
} from 'lucide-react';

interface EntryLike {
  name: string;
  path: string;
  is_dir?: boolean;
}

interface IconCategory {
  icon: LucideIcon;
  label: string;
  iconClassName: string;
  backgroundClassName: string;
}

interface FolderRule extends IconCategory {
  terms: string[];
}

const DEFAULT_FOLDER_ICON: IconCategory = {
  icon: Folder,
  label: 'Folder',
  iconClassName: 'text-slate-600',
  backgroundClassName: 'bg-white/52',
};

const DEFAULT_FILE_ICON: IconCategory = {
  icon: File,
  label: 'File',
  iconClassName: 'text-slate-600',
  backgroundClassName: 'bg-white/52',
};

const FOLDER_RULES: FolderRule[] = [
  {
    terms: ['dev', 'development', 'developer', 'code', 'coding', 'src', 'source', 'sources', 'repo', 'repos', 'repository', 'repositories', 'github', 'gitlab', 'projects'],
    icon: FolderCode,
    label: 'Development',
    iconClassName: 'text-sky-600',
    backgroundClassName: 'bg-sky-100/70',
  },
  {
    terms: ['cache', 'caches', 'cached', 'chache', 'temporary', 'temp', 'tmp'],
    icon: DatabaseZap,
    label: 'Cache',
    iconClassName: 'text-amber-600',
    backgroundClassName: 'bg-amber-100/75',
  },
  {
    terms: ['game', 'games', 'gaming', 'steam', 'epic games', 'battle.net', 'minecraft', 'roblox'],
    icon: Gamepad2,
    label: 'Games',
    iconClassName: 'text-violet-600',
    backgroundClassName: 'bg-violet-100/75',
  },
  {
    terms: ['app', 'apps', 'applications', 'application support', 'packages', 'node_modules', 'vendor', 'bundle', 'bundles'],
    icon: Package,
    label: 'Applications',
    iconClassName: 'text-fuchsia-600',
    backgroundClassName: 'bg-fuchsia-100/70',
  },
  {
    terms: ['photo', 'photos', 'image', 'images', 'pictures', 'screenshots', 'screenshot', 'camera'],
    icon: Image,
    label: 'Images',
    iconClassName: 'text-emerald-600',
    backgroundClassName: 'bg-emerald-100/70',
  },
  {
    terms: ['video', 'videos', 'movie', 'movies', 'film', 'films', 'cinema'],
    icon: Video,
    label: 'Videos',
    iconClassName: 'text-rose-600',
    backgroundClassName: 'bg-rose-100/70',
  },
  {
    terms: ['music', 'audio', 'podcasts', 'podcast', 'sound', 'sounds'],
    icon: Music,
    label: 'Audio',
    iconClassName: 'text-pink-600',
    backgroundClassName: 'bg-pink-100/70',
  },
  {
    terms: ['document', 'documents', 'docs', 'paper', 'papers', 'books', 'ebooks', 'notes'],
    icon: BookOpen,
    label: 'Documents',
    iconClassName: 'text-blue-600',
    backgroundClassName: 'bg-blue-100/70',
  },
  {
    terms: ['download', 'downloads', 'installer', 'installers', 'dmg', 'archives', 'archive', 'backups', 'backup'],
    icon: FolderArchive,
    label: 'Downloads',
    iconClassName: 'text-orange-600',
    backgroundClassName: 'bg-orange-100/70',
  },
  {
    terms: ['config', 'configs', 'configuration', 'settings', 'preferences', 'preferencespanes'],
    icon: FolderCog,
    label: 'Settings',
    iconClassName: 'text-slate-700',
    backgroundClassName: 'bg-slate-200/70',
  },
  {
    terms: ['database', 'databases', 'db', 'data', 'datasets'],
    icon: Database,
    label: 'Data',
    iconClassName: 'text-cyan-600',
    backgroundClassName: 'bg-cyan-100/70',
  },
  {
    terms: ['log', 'logs', 'crash', 'crashes', 'diagnostics'],
    icon: Bug,
    label: 'Logs',
    iconClassName: 'text-red-600',
    backgroundClassName: 'bg-red-100/70',
  },
  {
    terms: ['keychain', 'keys', 'certificates', 'certificate', 'secrets', 'credentials'],
    icon: KeyRound,
    label: 'Security',
    iconClassName: 'text-yellow-700',
    backgroundClassName: 'bg-yellow-100/75',
  },
  {
    terms: ['library', 'frameworks', 'framework', 'plugins', 'plugin', 'extensions', 'extension'],
    icon: Library,
    label: 'Library',
    iconClassName: 'text-indigo-600',
    backgroundClassName: 'bg-indigo-100/70',
  },
  {
    terms: ['trash', 'bin', 'deleted'],
    icon: Trash2,
    label: 'Trash',
    iconClassName: 'text-zinc-600',
    backgroundClassName: 'bg-zinc-200/70',
  },
  {
    terms: ['system', 'coreservices', 'private', 'usr', 'var', 'etc'],
    icon: HardDrive,
    label: 'System',
    iconClassName: 'text-stone-700',
    backgroundClassName: 'bg-stone-200/70',
  },
];

const FILE_EXTENSION_RULES: Array<IconCategory & { extensions: string[] }> = [
  {
    extensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte', 'html', 'css', 'scss', 'sass', 'less', 'rs', 'go', 'py', 'rb', 'php', 'java', 'kt', 'swift', 'c', 'h', 'cpp', 'hpp', 'cs', 'sh', 'zsh', 'fish', 'sql'],
    icon: FileCode2,
    label: 'Code',
    iconClassName: 'text-sky-600',
    backgroundClassName: 'bg-sky-100/70',
  },
  {
    extensions: ['json', 'jsonc', 'yaml', 'yml', 'toml', 'xml', 'plist', 'ini', 'env', 'conf', 'config', 'lock'],
    icon: FileJson,
    label: 'Config',
    iconClassName: 'text-amber-600',
    backgroundClassName: 'bg-amber-100/70',
  },
  {
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'icns', 'heic', 'tiff', 'bmp', 'psd', 'ai', 'sketch', 'fig'],
    icon: FileImage,
    label: 'Image',
    iconClassName: 'text-emerald-600',
    backgroundClassName: 'bg-emerald-100/70',
  },
  {
    extensions: ['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm', 'wmv', 'flv'],
    icon: FileVideo,
    label: 'Video',
    iconClassName: 'text-rose-600',
    backgroundClassName: 'bg-rose-100/70',
  },
  {
    extensions: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'aiff', 'mid', 'midi'],
    icon: FileAudio,
    label: 'Audio',
    iconClassName: 'text-pink-600',
    backgroundClassName: 'bg-pink-100/70',
  },
  {
    extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'dmg', 'pkg', 'iso'],
    icon: FileArchive,
    label: 'Archive',
    iconClassName: 'text-orange-600',
    backgroundClassName: 'bg-orange-100/70',
  },
  {
    extensions: ['pdf', 'txt', 'md', 'mdx', 'rtf', 'doc', 'docx', 'pages', 'epub'],
    icon: FileText,
    label: 'Document',
    iconClassName: 'text-blue-600',
    backgroundClassName: 'bg-blue-100/70',
  },
  {
    extensions: ['csv', 'tsv', 'xls', 'xlsx', 'numbers'],
    icon: FileSpreadsheet,
    label: 'Spreadsheet',
    iconClassName: 'text-green-600',
    backgroundClassName: 'bg-green-100/70',
  },
  {
    extensions: ['ppt', 'pptx', 'key'],
    icon: Presentation,
    label: 'Presentation',
    iconClassName: 'text-red-600',
    backgroundClassName: 'bg-red-100/70',
  },
  {
    extensions: ['app', 'exe', 'bin', 'command'],
    icon: Binary,
    label: 'Executable',
    iconClassName: 'text-violet-600',
    backgroundClassName: 'bg-violet-100/70',
  },
  {
    extensions: ['sqlite', 'sqlite3', 'db', 'db3', 'mdb'],
    icon: Database,
    label: 'Database',
    iconClassName: 'text-cyan-600',
    backgroundClassName: 'bg-cyan-100/70',
  },
  {
    extensions: ['log', 'crash'],
    icon: Bug,
    label: 'Log',
    iconClassName: 'text-red-600',
    backgroundClassName: 'bg-red-100/70',
  },
  {
    extensions: ['pem', 'key', 'cer', 'crt', 'p12', 'mobileprovision'],
    icon: Shield,
    label: 'Certificate',
    iconClassName: 'text-yellow-700',
    backgroundClassName: 'bg-yellow-100/75',
  },
  {
    extensions: ['ttf', 'otf', 'woff', 'woff2'],
    icon: Palette,
    label: 'Font',
    iconClassName: 'text-fuchsia-600',
    backgroundClassName: 'bg-fuchsia-100/70',
  },
];

const FILE_NAME_RULES: Array<IconCategory & { terms: string[] }> = [
  {
    terms: ['dockerfile', 'compose', 'makefile', 'justfile'],
    icon: Box,
    label: 'Build',
    iconClassName: 'text-sky-600',
    backgroundClassName: 'bg-sky-100/70',
  },
  {
    terms: ['package.json', 'bun.lock', 'pnpm-lock.yaml', 'yarn.lock', 'cargo.toml', 'go.mod'],
    icon: Package,
    label: 'Package',
    iconClassName: 'text-fuchsia-600',
    backgroundClassName: 'bg-fuchsia-100/70',
  },
  {
    terms: ['readme', 'license', 'changelog'],
    icon: BookOpen,
    label: 'Documentation',
    iconClassName: 'text-blue-600',
    backgroundClassName: 'bg-blue-100/70',
  },
  {
    terms: ['terminal', 'shell', '.zshrc', '.bashrc', '.profile'],
    icon: TerminalSquare,
    label: 'Shell',
    iconClassName: 'text-zinc-700',
    backgroundClassName: 'bg-zinc-200/70',
  },
  {
    terms: ['settings', 'preferences', 'config'],
    icon: FileCog,
    label: 'Settings',
    iconClassName: 'text-slate-700',
    backgroundClassName: 'bg-slate-200/70',
  },
  {
    terms: ['cache', 'chache'],
    icon: DatabaseZap,
    label: 'Cache',
    iconClassName: 'text-amber-600',
    backgroundClassName: 'bg-amber-100/75',
  },
  {
    terms: ['cpu', 'chip', 'binary'],
    icon: Cpu,
    label: 'System',
    iconClassName: 'text-stone-700',
    backgroundClassName: 'bg-stone-200/70',
  },
  {
    terms: ['api', 'route', 'schema'],
    icon: Braces,
    label: 'Structured Data',
    iconClassName: 'text-cyan-600',
    backgroundClassName: 'bg-cyan-100/70',
  },
  {
    terms: ['archive', 'backup'],
    icon: Archive,
    label: 'Archive',
    iconClassName: 'text-orange-600',
    backgroundClassName: 'bg-orange-100/70',
  },
  {
    terms: ['audio', 'sound'],
    icon: AudioLines,
    label: 'Audio',
    iconClassName: 'text-pink-600',
    backgroundClassName: 'bg-pink-100/70',
  },
  {
    terms: ['camera', 'photo'],
    icon: Camera,
    label: 'Image',
    iconClassName: 'text-emerald-600',
    backgroundClassName: 'bg-emerald-100/70',
  },
  {
    terms: ['circuit', 'board'],
    icon: CircuitBoard,
    label: 'Hardware',
    iconClassName: 'text-indigo-600',
    backgroundClassName: 'bg-indigo-100/70',
  },
  {
    terms: ['script', 'code', 'dev'],
    icon: Code2,
    label: 'Code',
    iconClassName: 'text-sky-600',
    backgroundClassName: 'bg-sky-100/70',
  },
  {
    terms: ['setting', 'preference'],
    icon: Settings,
    label: 'Settings',
    iconClassName: 'text-slate-700',
    backgroundClassName: 'bg-slate-200/70',
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/\.app$/, '').replace(/[._-]+/g, ' ').trim();
}

function getExtension(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith('.tar.gz')) return 'gz';
  const dotIndex = lowerName.lastIndexOf('.');
  return dotIndex > 0 ? lowerName.slice(dotIndex + 1) : '';
}

function matchesTerm(normalizedName: string, terms: string[]) {
  const words = normalizedName.split(/\s+/).filter(Boolean);
  return terms.some((term) => normalizedName === term || normalizedName.includes(term) || words.includes(term));
}

export function getFileIconCategory(entry: EntryLike): IconCategory {
  const normalizedName = normalize(entry.name);
  const normalizedPath = normalize(entry.path);

  if (entry.is_dir) {
    return FOLDER_RULES.find((rule) => (
      matchesTerm(normalizedName, rule.terms) || matchesTerm(normalizedPath, rule.terms)
    )) ?? DEFAULT_FOLDER_ICON;
  }

  const fileNameRule = FILE_NAME_RULES.find((rule) => (
    matchesTerm(normalizedName, rule.terms) || matchesTerm(normalizedPath, rule.terms)
  ));

  if (fileNameRule) return fileNameRule;

  const extension = getExtension(entry.name);
  return FILE_EXTENSION_RULES.find((rule) => rule.extensions.includes(extension)) ?? DEFAULT_FILE_ICON;
}
