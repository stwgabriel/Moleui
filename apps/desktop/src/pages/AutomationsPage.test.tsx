import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AutomationsPage } from './AutomationsPage';
import { AUTOMATION_CATALOG } from '@/lib/automationCatalog';
import type { AutomationRecipe, AutomationsState } from '@/types';

// Mirrors AUTOMATION_ALLOWED_CLEAN_SECTIONS in main.mjs. Sections outside this
// list either need sudo, touch backup data, or are report-only hints.
const ALLOWED_SECTIONS = [
  'App caches',
  'Browsers',
  'Cloud & Office',
  'Applications',
  'Application Support',
  'Virtualization',
  'Apple Silicon',
];

const FORBIDDEN_SECTIONS = [
  'System',
  'User essentials',
  'App leftovers',
  'Developer tools',
  'Time Machine',
  'Device backups & firmware',
  'Large files',
  'System Data clues',
  'Project artifacts',
];

function makeRecipe(overrides: Partial<AutomationRecipe> = {}): AutomationRecipe {
  return {
    id: 'recipe-1',
    catalogId: 'browser-app-cache-sweep',
    name: 'Weekly Browser + App Cache Sweep',
    enabled: false,
    invalid: false,
    action: { kind: 'clean', sections: ['App caches', 'Browsers'] },
    schedule: { frequency: 'weekly', hour: 3, minute: 0, weekday: 0 },
    dryRunPassedAt: null,
    dryRunFingerprint: '',
    lastRunAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    nextRunAt: null,
    ...overrides,
  };
}

function makeState(overrides: Partial<AutomationsState> = {}): AutomationsState {
  return {
    version: 1,
    paused: false,
    recipes: [],
    runs: [],
    allowlist: { cleanSections: [...ALLOWED_SECTIONS], actionKinds: ['clean', 'installer'] },
    scheduler: { running: true, active: false },
    ...overrides,
  };
}

function mockMoleDesktop(state: AutomationsState) {
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
    automations: {
      list: vi.fn().mockResolvedValue(state),
      saveRecipe: vi.fn().mockResolvedValue({ ok: true, id: 'recipe-1', state }),
      deleteRecipe: vi.fn().mockResolvedValue({ ok: true, state }),
      setEnabled: vi.fn().mockResolvedValue({ ok: true, state }),
      setPaused: vi.fn().mockResolvedValue({ ok: true, state }),
      dryRun: vi.fn().mockResolvedValue({ ok: true, state }),
      runNow: vi.fn().mockResolvedValue({ ok: true, state }),
      cancel: vi.fn().mockResolvedValue({ ok: true, message: '' }),
      onChanged: vi.fn(),
      removeListeners: vi.fn(),
    },
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

async function startAutomations() {
  fireEvent.click(await screen.findByRole('button', { name: /set up automations/i }));
}

describe('automation catalog', () => {
  it('ships only allowlisted actions and never purge', () => {
    for (const template of AUTOMATION_CATALOG) {
      expect(['clean', 'installer']).toContain(template.action.kind);
      for (const section of template.action.sections) {
        expect(ALLOWED_SECTIONS).toContain(section);
      }
    }

    const serialized = JSON.stringify(AUTOMATION_CATALOG);
    expect(serialized).not.toMatch(/purge/i);
    expect(serialized).not.toMatch(/optimize/i);
    expect(serialized).not.toMatch(/uninstall/i);
  });

  it('names every template after the cadence it actually runs on', () => {
    for (const template of AUTOMATION_CATALOG) {
      const claimed = /\b(daily|weekly|monthly)\b/i.exec(template.name)?.[1].toLowerCase();
      if (!claimed) continue;
      expect(claimed).toBe(template.schedule.frequency);
    }
  });

  it('never ships a clean template with an empty section list', () => {
    // A bare `mole clean` would run every section, including the excluded ones.
    for (const template of AUTOMATION_CATALOG) {
      if (template.action.kind !== 'clean') continue;
      expect(template.action.sections.length).toBeGreaterThan(0);
    }
  });
});

describe('AutomationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMoleDesktop(makeState());
  });

  it('offers only the allowlist reported by the main process', async () => {
    render(<AutomationsPage />);
    await startAutomations();

    fireEvent.click(await screen.findByRole('button', { name: /new recipe/i }));

    // The editor is a labelled region inside a modal sheet now, so the sheet has
    // to be the thing that opened.
    expect(screen.getByRole('dialog', { name: /new recipe/i })).toBeInTheDocument();
    const editor = screen.getByRole('region', { name: /new recipe/i });
    for (const section of ALLOWED_SECTIONS) {
      expect(within(editor).getByLabelText(section)).toBeInTheDocument();
    }
    for (const section of FORBIDDEN_SECTIONS) {
      expect(within(editor).queryByLabelText(section)).not.toBeInTheDocument();
    }

    expect(within(editor).getAllByRole('checkbox')).toHaveLength(ALLOWED_SECTIONS.length);
    expect(within(editor).queryByText(/purge/i)).not.toBeInTheDocument();
  });

  it('blocks enabling a recipe until a dry run has passed', async () => {
    mockMoleDesktop(makeState({ recipes: [makeRecipe()] }));

    render(<AutomationsPage />);

    const toggle = await screen.findByLabelText('Enable Weekly Browser + App Cache Sweep');
    expect(toggle).toBeDisabled();
    expect(toggle).not.toBeChecked();
    expect(screen.getByText('Run a dry run before enabling this recipe.')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('unblocks the toggle once the main process reports a passing dry run', async () => {
    const pending = makeRecipe();
    const passed = makeRecipe({
      dryRunPassedAt: '2026-07-20T03:00:00.000Z',
      dryRunFingerprint: 'clean:App caches|Browsers',
    });

    mockMoleDesktop(makeState({ recipes: [pending] }));
    vi.mocked(window.moleDesktop.automations!.dryRun).mockResolvedValue({
      ok: true,
      state: makeState({ recipes: [passed] }),
    });

    render(<AutomationsPage />);

    expect(await screen.findByLabelText('Enable Weekly Browser + App Cache Sweep')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /dry run/i }));

    await waitFor(() => expect(window.moleDesktop.automations!.dryRun).toHaveBeenCalledWith('recipe-1'));
    await waitFor(() =>
      expect(screen.getByLabelText('Enable Weekly Browser + App Cache Sweep')).toBeEnabled(),
    );
  });

  it('keeps a recipe disabled when the main process refuses to enable it', async () => {
    const gated = makeRecipe({
      dryRunPassedAt: '2026-07-20T03:00:00.000Z',
      dryRunFingerprint: 'clean:App caches|Browsers',
    });

    mockMoleDesktop(makeState({ recipes: [gated] }));
    vi.mocked(window.moleDesktop.automations!.setEnabled).mockResolvedValue({
      ok: false,
      message: 'Run a dry run for this recipe before enabling it',
      state: makeState({ recipes: [gated] }),
    });

    render(<AutomationsPage />);

    const toggle = await screen.findByLabelText('Enable Weekly Browser + App Cache Sweep');
    fireEvent.click(toggle);

    await waitFor(() =>
      expect(window.moleDesktop.automations!.setEnabled).toHaveBeenCalledWith('recipe-1', true),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Run a dry run for this recipe before enabling it');
    expect(screen.getByLabelText('Enable Weekly Browser + App Cache Sweep')).not.toBeChecked();
  });

  it('cannot dry run or enable a recipe the main process marked invalid', async () => {
    const invalid = makeRecipe({ invalid: true, action: { kind: 'clean', sections: [] } });
    mockMoleDesktop(makeState({ recipes: [invalid] }));

    render(<AutomationsPage />);

    expect(await screen.findByText('Not runnable')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable Weekly Browser + App Cache Sweep')).toBeDisabled();
    expect(screen.getByRole('button', { name: /dry run/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /run now/i })).toBeDisabled();
  });

  it('adds a library template with its allowlisted action', async () => {
    render(<AutomationsPage />);
    await startAutomations();

    // The catalogue is no longer the landing view: it opens from the header, so a
    // page with no recipes shows the user's own state first.
    fireEvent.click(await screen.findByRole('button', { name: /browse library/i }));
    expect(screen.getByRole('dialog', { name: /recipe library/i })).toBeInTheDocument();

    const card = await screen.findByRole('article', { name: AUTOMATION_CATALOG[0].name });
    fireEvent.click(within(card).getByRole('button', { name: /add recipe/i }));

    await waitFor(() => expect(window.moleDesktop.automations!.saveRecipe).toHaveBeenCalled());

    const [input] = vi.mocked(window.moleDesktop.automations!.saveRecipe).mock.calls[0];
    expect(input.catalogId).toBe(AUTOMATION_CATALOG[0].id);
    expect(input.action.kind).toBe('clean');
    for (const section of input.action.sections) {
      expect(ALLOWED_SECTIONS).toContain(section);
    }
  });

  it('keeps a library card and an identically named recipe from colliding', async () => {
    // A saved recipe carries the template's name verbatim, so both would answer to
    // the same accessible name. The sheet marks the page behind it inert, which is
    // what keeps the two apart.
    mockMoleDesktop(makeState({ recipes: [makeRecipe()] }));
    render(<AutomationsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /browse library/i }));

    await waitFor(() =>
      expect(screen.getAllByRole('article', { name: AUTOMATION_CATALOG[0].name })).toHaveLength(1),
    );
  });

  it('offers Stop while the main process reports a run in flight', async () => {
    mockMoleDesktop(makeState({ scheduler: { running: true, active: true } }));

    render(<AutomationsPage />);
    await startAutomations();

    fireEvent.click(await screen.findByRole('button', { name: /stop current run/i }));

    await waitFor(() => expect(window.moleDesktop.automations!.cancel).toHaveBeenCalled());
  });

  it('hides Stop when no run is in flight', async () => {
    render(<AutomationsPage />);
    await startAutomations();

    await screen.findByRole('button', { name: /pause all/i });
    expect(screen.queryByRole('button', { name: /stop current run/i })).not.toBeInTheDocument();
  });

  it('exposes a pause-all kill switch', async () => {
    render(<AutomationsPage />);
    await startAutomations();

    fireEvent.click(await screen.findByRole('button', { name: /pause all/i }));

    await waitFor(() => expect(window.moleDesktop.automations!.setPaused).toHaveBeenCalledWith(true));
  });
});
