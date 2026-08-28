import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AnalyzePage } from './AnalyzePage';

function mockLocalStorage() {
  const storage = new Map<string, string>();

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
  });

  return storage;
}

function mockMoleDesktop() {
  window.moleDesktop = {
    getRuntimeInfo: vi.fn(),
    openExternal: vi.fn(),
    copyText: vi.fn(),
    revealPath: vi.fn(),
    openPathInFinder: vi.fn(),
    deletePath: vi.fn(),
    openActivityMonitor: vi.fn(),
    signalProcess: vi.fn(),
    runStatus: vi.fn(),
    clean: {
      execute: vi.fn(),
      kill: vi.fn(),
      onStdout: vi.fn(),
      onStderr: vi.fn(),
      removeListeners: vi.fn(),
    },
    optimize: {
      execute: vi.fn(),
      kill: vi.fn(),
      onStdout: vi.fn(),
      onStderr: vi.fn(),
      removeListeners: vi.fn(),
    },
    analyze: {
      execute: vi.fn(),
      kill: vi.fn(),
      volumes: vi.fn().mockResolvedValue({ ok: true, volumes: [] }),
      onStdout: vi.fn(),
      onStderr: vi.fn(),
      removeListeners: vi.fn(),
    },
    uninstall: {
      list: vi.fn(),
      killList: vi.fn(),
      getAppIcon: vi.fn(),
      getAppIcons: vi.fn(),
      dryRun: vi.fn(),
      execute: vi.fn(),
      onListStdout: vi.fn(),
      onListStderr: vi.fn(),
      onDryRunStdout: vi.fn(),
      onDryRunStderr: vi.fn(),
      onExecuteStdout: vi.fn(),
      onExecuteStderr: vi.fn(),
      removeListeners: vi.fn(),
    },
  };
}

describe('AnalyzePage', () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    vi.unstubAllGlobals();
    storage = mockLocalStorage();
    mockMoleDesktop();
  });

  it('scans the path shown in the field, not a mode persisted from an earlier session', async () => {
    // A returning user carries 'home' in mole-analyze-selected-mode from before
    // the picker listed disks. That used to override the field and silently scan
    // ~ while the UI showed a disk selected.
    storage.set('mole-analyze-selected-mode', JSON.stringify('home'));
    storage.set('mole-analyze-view', JSON.stringify('pick'));
    storage.set('mole-analyze-path-input', JSON.stringify('/'));

    render(<AnalyzePage />);

    fireEvent.click(screen.getByRole('button', { name: /start analysis/i }));

    expect(window.moleDesktop.analyze.execute).toHaveBeenCalledWith('/', { fresh: false });
  });

  it('offers the mounted disks on the picker and sets the scan path from them', async () => {
    (window.moleDesktop.analyze.volumes as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      volumes: [
        { name: 'Mac SSD', path: '/', fs_type: 'apfs', total: 240_000_000_000, free: 20_000_000_000, used: 220_000_000_000, is_root: true, read_only: true },
        { name: 'Backup HD', path: '/Volumes/Backup HD', fs_type: 'apfs', total: 500_000_000_000, free: 100_000_000_000, used: 400_000_000_000, is_root: false, read_only: false },
      ],
    });

    render(<AnalyzePage />);

    fireEvent.click(screen.getByRole('button', { name: /analyze storage/i }));

    const pathInput = screen.getByPlaceholderText('/path/to/folder');
    expect(pathInput).toHaveValue('/');

    fireEvent.click(await screen.findByRole('button', { name: /Backup HD/i }));
    expect(pathInput).toHaveValue('/Volumes/Backup HD');

    fireEvent.click(screen.getByRole('button', { name: /Mac SSD/i }));
    expect(pathInput).toHaveValue('/');

    // A folder is still reachable, just not suggested.
    fireEvent.change(pathInput, { target: { value: '~/Downloads' } });
    expect(pathInput).toHaveValue('~/Downloads');
  });

  it('filters analyzed results between files and folders across the file map', () => {
    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/Users/example',
      overview: false,
      total_size: 1000,
      entries: [
        { name: 'Documents', path: '/Users/example/Documents', size: 600, is_dir: true, last_access: '2026-05-10T10:00:00Z' },
        { name: 'movie.mov', path: '/Users/example/movie.mov', size: 400, is_dir: false, last_access: '2026-05-12T10:00:00Z' },
        { name: 'archive.zip', path: '/Users/example/archive.zip', size: 100, is_dir: false },
      ],
      large_files: [],
    }));

    render(<AnalyzePage />);

    expect(screen.getByRole('button', { name: /filter results/i })).toBeInTheDocument();
    expect(screen.getAllByTitle(/movie\.mov - 400 b/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/disk usage proportions/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /filter results/i }));
    fireEvent.click(screen.getByRole('button', { name: /files\s*2/i }));

    expect(screen.queryAllByTitle(/movie\.mov - 400 b/i)).toHaveLength(0);
    expect(screen.getAllByTitle(/documents - 600 b/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

  it('folds a flood of small entries into one tile while listing every one of them', () => {
    // 15 tiny entries: past the point where the map can label them.
    const smallEntries = Array.from({ length: 15 }, (_, index) => ({
      name: `note-${index}.txt`,
      path: `/Users/example/note-${index}.txt`,
      size: 2000,
      is_dir: false,
    }));

    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/Users/example',
      overview: false,
      total_size: 10_000_000,
      entries: [
        { name: 'Documents', path: '/Users/example/Documents', size: 9_970_000, is_dir: true },
        ...smallEntries,
      ],
      large_files: [],
    }));

    render(<AnalyzePage />);

    // One tile stands in for all fifteen, sized as their sum.
    expect(screen.getAllByTitle(/15 small items - 29\.3 KB/i).length).toBeGreaterThan(0);

    // The list still holds every entry, so they remain sortable and actionable.
    expect(screen.getAllByTestId('file-management-row')).toHaveLength(16);
    expect(screen.getByTestId('file-list-summary')).toHaveTextContent('16 items');
    smallEntries.forEach((entry) => {
      expect(screen.getByText(entry.name)).toBeInTheDocument();
    });
  });

  it('zooms through nested size tiers instead of showing them side by side', () => {
    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/Users/example',
      overview: false,
      total_size: 200_000_000_000,
      entries: [
        { name: 'Documents', path: '/Users/example/Documents', size: 199_000_000_000, is_dir: true },
        // One entry per tier, plus filler to cross the fold threshold.
        { name: 'big.bin', path: '/Users/example/big.bin', size: 200 * 1024 * 1024, is_dir: false },
        { name: 'mid.bin', path: '/Users/example/mid.bin', size: 50 * 1024 * 1024, is_dir: false },
        { name: 'small.bin', path: '/Users/example/small.bin', size: 5 * 1024 * 1024, is_dir: false },
        ...Array.from({ length: 12 }, (_, index) => ({
          name: `tiny-${index}.txt`,
          path: `/Users/example/tiny-${index}.txt`,
          size: 4096,
          is_dir: false,
        })),
      ],
      large_files: [],
    }));

    render(<AnalyzePage />);

    const groupedTile = screen.getAllByTestId('storage-map-tile')
      .find((tile) => /15 small items/i.test(tile.getAttribute('title') ?? ''));
    fireEvent.click(groupedTile!);

    // Outermost tier: its own item, plus one tile for everything smaller. The
    // other tiers are not on screen yet.
    const atTier = (name: string) => {
      expect(screen.getAllByTestId('small-items-entry').map((el) => el.getAttribute('title')))
        .toEqual([expect.stringContaining(name)]);
    };

    atTier('big.bin');
    expect(screen.getByTestId('small-items-nested')).toHaveAttribute('title', expect.stringContaining('Under 100 MB'));

    fireEvent.click(screen.getByTestId('small-items-nested'));
    atTier('mid.bin');
    expect(screen.getByTestId('small-items-nested')).toHaveAttribute('title', expect.stringContaining('Under 10 MB'));

    fireEvent.click(screen.getByTestId('small-items-nested'));
    atTier('small.bin');
    expect(screen.getByTestId('small-items-nested')).toHaveAttribute('title', expect.stringContaining('Under 1 MB'));

    // Deepest tier: every remaining item, nothing nested below it.
    fireEvent.click(screen.getByTestId('small-items-nested'));
    expect(screen.getAllByTestId('small-items-entry')).toHaveLength(12);
    expect(screen.queryByTestId('small-items-nested')).not.toBeInTheDocument();
  });

  it('unwinds back one tier at a time and lands on the folder map', () => {
    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/Users/example',
      overview: false,
      total_size: 200_000_000_000,
      entries: [
        { name: 'Documents', path: '/Users/example/Documents', size: 199_000_000_000, is_dir: true },
        { name: 'big.bin', path: '/Users/example/big.bin', size: 200 * 1024 * 1024, is_dir: false },
        { name: 'mid.bin', path: '/Users/example/mid.bin', size: 50 * 1024 * 1024, is_dir: false },
        ...Array.from({ length: 13 }, (_, index) => ({
          name: `tiny-${index}.txt`,
          path: `/Users/example/tiny-${index}.txt`,
          size: 4096,
          is_dir: false,
        })),
      ],
      large_files: [],
    }));

    render(<AnalyzePage />);

    fireEvent.click(screen.getAllByTestId('storage-map-tile')
      .find((tile) => /15 small items/i.test(tile.getAttribute('title') ?? ''))!);

    // Down two tiers: Under 100 MB, then Under 1 MB (the 1-10 MB tier is empty
    // here and is skipped rather than shown as a tile with nothing in it).
    fireEvent.click(screen.getByTestId('small-items-nested'));
    fireEvent.click(screen.getByTestId('small-items-nested'));
    expect(screen.getAllByTestId('small-items-entry')).toHaveLength(13);

    // Back climbs one tier per press.
    fireEvent.click(screen.getByTestId('small-items-back'));
    expect(screen.getByTestId('small-items-nested')).toHaveAttribute('title', expect.stringContaining('Under 1 MB'));

    fireEvent.click(screen.getByTestId('small-items-back'));
    expect(screen.getByTestId('small-items-nested')).toHaveAttribute('title', expect.stringContaining('Under 100 MB'));

    // One more press leaves the modal for the folder map.
    fireEvent.click(screen.getByTestId('small-items-back'));
    expect(screen.queryByTestId('small-items-nested')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('storage-map-tile').length).toBeGreaterThan(0);
  });

  it('keeps small entries as their own tiles when there are too few to be clutter', () => {
    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/Users/example',
      overview: false,
      total_size: 1_000_000,
      entries: [
        { name: 'Documents', path: '/Users/example/Documents', size: 996_000, is_dir: true },
        { name: 'a.txt', path: '/Users/example/a.txt', size: 2000, is_dir: false },
        { name: 'b.txt', path: '/Users/example/b.txt', size: 2000, is_dir: false },
      ],
      large_files: [],
    }));

    render(<AnalyzePage />);

    expect(screen.queryByTitle(/small items/i)).not.toBeInTheDocument();
    expect(screen.getAllByTitle(/a\.txt - 1\.95 KB/i).length).toBeGreaterThan(0);
  });

  it('shows used space that no scanned entry accounts for at the top of a volume', () => {
    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-scan-path', JSON.stringify('/'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/',
      overview: false,
      total_size: 100_000_000_000,
      disk_total: 240_000_000_000,
      disk_free: 20_000_000_000,
      entries: [
        { name: 'Users', path: '/Users', size: 70_000_000_000, is_dir: true },
        { name: 'System', path: '/System', size: 30_000_000_000, is_dir: true },
      ],
      large_files: [],
    }));

    render(<AnalyzePage />);

    // 220 GB used, 100 GB attributed: the 120 GB difference is snapshots, the
    // helper volumes, and folders the app cannot read.
    expect(screen.getAllByTitle(/snapshots & unreadable - 111\.76 GB/i).length).toBeGreaterThan(0);
  });

  it('does not claim unaccounted space inside a subfolder', () => {
    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/Users/example',
      overview: false,
      total_size: 100_000_000_000,
      disk_total: 240_000_000_000,
      disk_free: 20_000_000_000,
      entries: [
        { name: 'Documents', path: '/Users/example/Documents', size: 100_000_000_000, is_dir: true },
      ],
      large_files: [],
    }));

    render(<AnalyzePage />);

    expect(screen.queryByTitle(/snapshots & unreadable/i)).not.toBeInTheDocument();
  });

  it('switches to another disk from the top bar', async () => {
    (window.moleDesktop.analyze.volumes as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      volumes: [
        { name: 'Mac SSD', path: '/', fs_type: 'apfs', total: 240_000_000_000, free: 20_000_000_000, used: 220_000_000_000, is_root: true, read_only: true },
        { name: 'Backup HD', path: '/Volumes/Backup HD', fs_type: 'apfs', total: 500_000_000_000, free: 100_000_000_000, used: 400_000_000_000, is_root: false, read_only: false },
      ],
    });

    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/',
      overview: false,
      total_size: 1000,
      entries: [{ name: 'Users', path: '/Users', size: 1000, is_dir: true }],
      large_files: [],
    }));

    render(<AnalyzePage />);

    const switcher = await screen.findByRole('button', { name: /switch disk/i });
    expect(switcher).toHaveTextContent('Mac SSD');

    fireEvent.click(switcher);
    fireEvent.click(await screen.findByText('Backup HD'));

    expect(window.moleDesktop.analyze.execute).toHaveBeenCalledWith('/Volumes/Backup HD', { fresh: false });
  });

  it('shows real app icons in the list panel, not just the grid', async () => {
    (window.moleDesktop.uninstall.getAppIcons as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      icons: { '/Applications/Figma.app': 'data:image/png;base64,FIGMA' },
    });

    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/Applications',
      overview: false,
      total_size: 3000,
      entries: [
        { name: 'Figma.app', path: '/Applications/Figma.app', size: 2000, is_dir: true },
        { name: 'Notes.app', path: '/Applications/Notes.app', size: 1000, is_dir: true },
      ],
      large_files: [],
    }));

    render(<AnalyzePage />);

    // Grid tile and list row both point at the same resolved icon. The images
    // are decorative (alt=""), so they carry no img role to query by.
    await waitFor(() => {
      expect(document.querySelectorAll('img[src="data:image/png;base64,FIGMA"]').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('lists the biggest files under the folder regardless of depth', () => {
    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/Users/example',
      overview: false,
      total_size: 3000,
      entries: [{ name: 'Documents', path: '/Users/example/Documents', size: 3000, is_dir: true }],
      large_files: [
        { name: 'huge.iso', path: '/Users/example/Documents/deep/huge.iso', size: 2000 },
        { name: 'big.zip', path: '/Users/example/Documents/deep/big.zip', size: 900 },
      ],
    }));

    render(<AnalyzePage />);

    fireEvent.click(screen.getByRole('button', { name: /biggest files/i }));

    const rows = screen.getAllByTestId('biggest-file-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('huge.iso');
    expect(rows[0]).toHaveTextContent('/Users/example/Documents/deep/huge.iso');
  });

  it('places the storage map left of the disk usage list and shows the list totals above the rows', () => {
    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/Users/example',
      overview: false,
      total_size: 1000,
      entries: [
        { name: 'Documents', path: '/Users/example/Documents', size: 600, is_dir: true, last_access: '2026-05-10T10:00:00Z' },
        { name: 'movie.mov', path: '/Users/example/movie.mov', size: 400, is_dir: false, last_access: '2026-05-12T10:00:00Z' },
      ],
      large_files: [],
    }));

    render(<AnalyzePage />);

    const storageMap = screen.getByTestId('storage-map-panel');
    const diskUsageList = screen.getByTestId('disk-usage-list-panel');
    expect(storageMap.compareDocumentPosition(diskUsageList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const summary = screen.getByTestId('file-list-summary');
    const firstRow = screen.getAllByTestId('file-management-row')[0];
    expect(summary).toHaveTextContent('2 items');
    expect(summary).toHaveTextContent('1000 B total');
    expect(summary.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.getByText('Total 1000 B')).toBeInTheDocument();
    expect(screen.queryByText(/Total storage/i)).not.toBeInTheDocument();
  });

  it('shows the folder as a proportion of the whole disk when capacity is known', () => {
    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/Users/example',
      overview: false,
      total_size: 100_000_000_000,
      disk_total: 500_000_000_000,
      disk_free: 200_000_000_000,
      entries: [
        { name: 'Documents', path: '/Users/example/Documents', size: 60_000_000_000, is_dir: true },
        { name: 'movie.mov', path: '/Users/example/movie.mov', size: 40_000_000_000, is_dir: false },
      ],
      large_files: [],
    }));

    render(<AnalyzePage />);

    // Whole-disk framing: total capacity, this folder's share, and free space.
    expect(screen.getByText(/GB disk$/)).toBeInTheDocument();
    expect(screen.getByText('This folder')).toBeInTheDocument();
    expect(screen.getByText(/of disk$/)).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
    // Not the directory-relative fallback.
    expect(screen.queryByText(/^Total /)).not.toBeInTheDocument();
  });

  it('falls back to the directory total when disk capacity is unknown', () => {
    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/Users/example',
      overview: false,
      total_size: 1000,
      entries: [
        { name: 'Documents', path: '/Users/example/Documents', size: 600, is_dir: true },
      ],
      large_files: [],
    }));

    render(<AnalyzePage />);

    expect(screen.getByText('Total 1000 B')).toBeInTheDocument();
    expect(screen.queryByText(/of disk$/)).not.toBeInTheDocument();
  });

  it('shows file management rows sorted by size', () => {
    storage.set('mole-analyze-stage', JSON.stringify('results'));
    storage.set('mole-analyze-result', JSON.stringify({
      path: '/Users/example',
      overview: false,
      total_size: 3000000,
      entries: [
        { name: 'Documents', path: '/Users/example/Documents', size: 1500000, is_dir: true, last_access: '2026-05-10T10:00:00Z' },
        { name: 'movie.mov', path: '/Users/example/movie.mov', size: 1200000, is_dir: false, last_access: '2026-05-12T10:00:00Z' },
        { name: 'archive.zip', path: '/Users/example/archive.zip', size: 300000, is_dir: false },
      ],
      large_files: [],
    }));

    render(<AnalyzePage />);

    expect(screen.getByLabelText(/disk usage proportions/i)).toBeInTheDocument();
    expect(screen.queryByText('Date unavailable')).not.toBeInTheDocument();

    const rows = screen.getAllByTestId('file-management-row');
    expect(rows[0]).toHaveTextContent('Documents');
    expect(rows[1]).toHaveTextContent('movie.mov');
    expect(rows[2]).toHaveTextContent('archive.zip');
  });
});
