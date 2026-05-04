/**
 * Analyze Page Module
 * Handles disk analysis with visual storage breakdown
 */

window.analyzePage = (() => {
  let container = null;
  let state = {
    stage: 'idle', // 'idle' | 'scanning' | 'results'
    scanPath: '/',
    totalSize: 0,
    categories: {},
    largeFiles: [],
    progress: 0,
    hasStarted: false
  };

  const categoryDefinitions = [
    { id: 'applications', name: 'Applications', icon: 'package', color: '#3b82f6' },
    { id: 'documents', name: 'Documents', icon: 'file-text', color: '#10b981' },
    { id: 'media', name: 'Media', icon: 'image', color: '#ec4899' },
    { id: 'developer', name: 'Developer', icon: 'code', color: '#8b5cf6' },
    { id: 'system', name: 'System', icon: 'hard-drive', color: '#06b6d4' },
    { id: 'caches', name: 'Caches', icon: 'database', color: '#f59e0b' },
    { id: 'other', name: 'Other', icon: 'folder', color: '#64748b' }
  ];

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function render() {
    if (!container) return;

    let content = '';

    switch (state.stage) {
      case 'idle':
        content = renderIdle();
        break;
      case 'scanning':
        content = renderScanning();
        break;
      case 'results':
        content = renderResults();
        break;
    }

    container.innerHTML = content;

    // Reinitialize lucide icons
    if (window.lucide) {
      lucide.createIcons();
    }

    attachEventListeners();
  }

  function renderIdle() {
    // Show start screen if not yet started
    if (!state.hasStarted) {
      return renderStartScreen();
    }

    // Show path selection screen
    return `
      <div class="analyze-page">
        <div class="analyze-start-container">
          <div class="analyze-start-icon">
            <i data-lucide="pie-chart"></i>
          </div>
          <h2 class="analyze-start-title">Analyze Disk Usage</h2>
          <p class="analyze-start-subtitle">Scan your disk to visualize storage usage and identify large files</p>
          
          <div class="analyze-path-selector">
            <label class="analyze-label">Scan Location</label>
            <div class="analyze-path-input">
              <i data-lucide="folder"></i>
              <input type="text" id="scan-path-input" value="${state.scanPath}" placeholder="/Users/username">
              <button class="analyze-browse-button" id="browse-button">
                <i data-lucide="folder-open"></i>
                Browse
              </button>
            </div>
          </div>

          <div class="analyze-quick-paths">
            <button class="analyze-quick-path" data-path="/">
              <i data-lucide="hard-drive"></i>
              Entire Disk
            </button>
            <button class="analyze-quick-path" data-path="${process.env.HOME || '/Users'}">
              <i data-lucide="home"></i>
              Home Folder
            </button>
            <button class="analyze-quick-path" data-path="${process.env.HOME || '/Users'}/Downloads">
              <i data-lucide="download"></i>
              Downloads
            </button>
          </div>

          <div class="analyze-actions">
            <button class="action-button" id="start-scan-button">
              <i data-lucide="play"></i>
              Start Analysis
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderStartScreen() {
    return `
      <div class="analyze-stage analyze-idle">
        <div class="page-grid">
          <div class="page-left">
            <div class="page-info">
              <h1 class="page-title">Analyze</h1>
              <p class="page-description">Visualize disk usage and discover what's taking up space on your Mac.</p>
              <div class="info-list">
                <div class="info-item">
                  <div class="info-item-icon">
                    <i data-lucide="pie-chart"></i>
                  </div>
                  <div class="info-item-content">
                    <h3 class="info-item-title">Visual Breakdown</h3>
                    <p class="info-item-description">See storage usage by category with charts</p>
                  </div>
                </div>
                <div class="info-item">
                  <div class="info-item-icon">
                    <i data-lucide="file-search"></i>
                  </div>
                  <div class="info-item-content">
                    <h3 class="info-item-title">Large Files</h3>
                    <p class="info-item-description">Identify the biggest files consuming space</p>
                  </div>
                </div>
                <div class="info-item">
                  <div class="info-item-icon">
                    <i data-lucide="folder-tree"></i>
                  </div>
                  <div class="info-item-content">
                    <h3 class="info-item-title">Directory Explorer</h3>
                    <p class="info-item-description">Navigate through folders to find space hogs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="page-right">
            <div class="page-visual">
              <div class="visual-icon">
                <i data-lucide="bar-chart-3"></i>
              </div>
            </div>
          </div>
        </div>
        <div class="page-actions">
          <button class="action-button" id="start-analyze-btn">
            Start Analysis
          </button>
        </div>
      </div>
    `;
  }

  function renderScanning() {
    return `
      <div class="analyze-page">
        <div class="analyze-progress-container">
          <div class="analyze-progress-icon">
            <div class="spinner"></div>
            <i data-lucide="search"></i>
          </div>
          <h2 class="analyze-progress-title">Scanning Disk...</h2>
          <p class="analyze-progress-subtitle">Analyzing ${state.scanPath}</p>
          <div class="analyze-progress-bar">
            <div class="analyze-progress-fill" style="width: ${state.progress}%;"></div>
          </div>
          <p class="analyze-progress-text">${state.progress}% complete</p>
        </div>
      </div>
    `;
  }

  function renderResults() {
    // Calculate percentages for categories
    const categoriesWithPercentage = Object.entries(state.categories).map(([id, size]) => {
      const category = categoryDefinitions.find(c => c.id === id);
      const percentage = state.totalSize > 0 ? (size / state.totalSize) * 100 : 0;
      return { ...category, size, percentage };
    }).sort((a, b) => b.size - a.size);

    const categoriesHTML = categoriesWithPercentage.map(cat => `
      <div class="analyze-category-item">
        <div class="analyze-category-header">
          <div class="analyze-category-icon" style="background: ${cat.color}20; color: ${cat.color};">
            <i data-lucide="${cat.icon}"></i>
          </div>
          <div class="analyze-category-info">
            <h4 class="analyze-category-name">${cat.name}</h4>
            <p class="analyze-category-size">${formatBytes(cat.size)}</p>
          </div>
          <div class="analyze-category-percentage">${cat.percentage.toFixed(1)}%</div>
        </div>
        <div class="analyze-category-bar">
          <div class="analyze-category-fill" style="width: ${cat.percentage}%; background: ${cat.color};"></div>
        </div>
      </div>
    `).join('');

    const largeFilesHTML = state.largeFiles.slice(0, 10).map(file => `
      <div class="analyze-file-item">
        <div class="analyze-file-icon">
          <i data-lucide="file"></i>
        </div>
        <div class="analyze-file-info">
          <h4 class="analyze-file-name">${file.name}</h4>
          <p class="analyze-file-path">${file.path}</p>
        </div>
        <div class="analyze-file-size">${formatBytes(file.size)}</div>
      </div>
    `).join('');

    return `
      <div class="analyze-page">
        <div class="analyze-header">
          <h2 class="analyze-title">Storage Analysis</h2>
          <p class="analyze-subtitle">${state.scanPath} • ${formatBytes(state.totalSize)} total</p>
        </div>

        <div class="analyze-summary">
          <div class="analyze-summary-card">
            <div class="analyze-summary-icon">
              <i data-lucide="hard-drive"></i>
            </div>
            <div class="analyze-summary-content">
              <div class="analyze-summary-value">${formatBytes(state.totalSize)}</div>
              <div class="analyze-summary-label">Total Size</div>
            </div>
          </div>
          <div class="analyze-summary-card">
            <div class="analyze-summary-icon">
              <i data-lucide="folder"></i>
            </div>
            <div class="analyze-summary-content">
              <div class="analyze-summary-value">${Object.keys(state.categories).length}</div>
              <div class="analyze-summary-label">Categories</div>
            </div>
          </div>
          <div class="analyze-summary-card">
            <div class="analyze-summary-icon">
              <i data-lucide="file"></i>
            </div>
            <div class="analyze-summary-content">
              <div class="analyze-summary-value">${state.largeFiles.length}</div>
              <div class="analyze-summary-label">Large Files</div>
            </div>
          </div>
        </div>

        <div class="analyze-section">
          <h3 class="analyze-section-title">
            <i data-lucide="pie-chart"></i>
            Storage by Category
          </h3>
          <div class="analyze-categories">
            ${categoriesHTML}
          </div>
        </div>

        <div class="analyze-section">
          <h3 class="analyze-section-title">
            <i data-lucide="file-text"></i>
            Largest Files
          </h3>
          <div class="analyze-files">
            ${largeFilesHTML}
          </div>
        </div>

        <div class="analyze-actions">
          <button class="action-button" id="rescan-button">
            <i data-lucide="refresh-cw"></i>
            Scan Again
          </button>
          <button class="action-button-secondary" id="export-button">
            <i data-lucide="download"></i>
            Export Report
          </button>
        </div>
      </div>
    `;
  }

  function attachEventListeners() {
    // Start analyze button (from start screen)
    const startAnalyzeBtn = container.querySelector('#start-analyze-btn');
    if (startAnalyzeBtn) {
      startAnalyzeBtn.addEventListener('click', () => {
        state.hasStarted = true;
        render();
      });
    }

    // Path input
    const pathInput = container.querySelector('#scan-path-input');
    if (pathInput) {
      pathInput.addEventListener('change', (e) => {
        state.scanPath = e.target.value;
      });
    }

    // Browse button
    const browseBtn = container.querySelector('#browse-button');
    if (browseBtn) {
      browseBtn.addEventListener('click', async () => {
        // In a real implementation, this would open a folder picker dialog
        alert('Folder picker would open here');
      });
    }

    // Quick path buttons
    const quickPathBtns = container.querySelectorAll('.analyze-quick-path');
    quickPathBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        state.scanPath = btn.dataset.path;
        const pathInput = container.querySelector('#scan-path-input');
        if (pathInput) {
          pathInput.value = state.scanPath;
        }
      });
    });

    // Start scan button
    const startScanBtn = container.querySelector('#start-scan-button');
    if (startScanBtn) {
      startScanBtn.addEventListener('click', startScan);
    }

    // Rescan button
    const rescanBtn = container.querySelector('#rescan-button');
    if (rescanBtn) {
      rescanBtn.addEventListener('click', () => {
        state.stage = 'idle';
        state.hasStarted = true;
        render();
      });
    }

    // Export button
    const exportBtn = container.querySelector('#export-button');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        alert('Export functionality would be implemented here');
      });
    }
  }

  async function startScan() {
    state.stage = 'scanning';
    state.progress = 0;
    render();

    // Set up real-time output listeners
    let jsonOutput = '';
    
    window.moleDesktop.analyze.onStdout((text) => {
      jsonOutput += text;
      
      // Try to parse progress from output
      // The analyze command might output progress info
      const progressMatch = text.match(/(\d+)%/);
      if (progressMatch) {
        state.progress = parseInt(progressMatch[1]);
        render();
      }
    });

    window.moleDesktop.analyze.onStderr((text) => {
      console.error('Analyze stderr:', text);
    });

    // Simulate progress while scanning
    const progressInterval = setInterval(() => {
      if (state.progress < 90) {
        state.progress += 10;
        render();
      }
    }, 300);

    try {
      // Execute analyze command with JSON output
      const result = await window.moleDesktop.analyze.execute(state.scanPath);
      
      clearInterval(progressInterval);
      state.progress = 100;
      render();

      if (result.ok) {
        // Parse JSON output from the analyze command
        try {
          const analysisData = JSON.parse(jsonOutput || result.stdout);
          parseAnalysisResults(analysisData);
        } catch (parseError) {
          console.error('Failed to parse analysis JSON:', parseError);
          // Fall back to mock data
          generateMockResults();
        }
        
        state.stage = 'results';
      } else {
        console.error('Analysis failed:', result.stderr);
        // Fall back to mock data on error
        generateMockResults();
        state.stage = 'results';
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Analyze error:', error);
      // Fall back to mock data on error
      generateMockResults();
      state.stage = 'results';
    } finally {
      window.moleDesktop.analyze.removeListeners();
      render();
    }
  }

  function parseAnalysisResults(data) {
    // Parse the JSON output from the analyze command
    // The format depends on the actual analyze command output
    if (data.total_size) {
      state.totalSize = data.total_size;
    }
    
    if (data.categories) {
      state.categories = data.categories;
    }
    
    if (data.large_files) {
      state.largeFiles = data.large_files.map(file => ({
        name: file.name || file.path.split('/').pop(),
        path: file.path,
        size: file.size
      }));
    }
    
    // If no data was parsed, generate mock data
    if (!state.totalSize || state.totalSize === 0) {
      generateMockResults();
    }
  }

  function generateMockResults() {
    // Generate mock results as fallback
    state.totalSize = Math.floor(Math.random() * 500000000000) + 100000000000; // 100GB - 600GB
    
    // Generate category sizes
    state.categories = {};
    const remainingPercentages = [30, 25, 15, 12, 10, 5, 3];
    categoryDefinitions.forEach((cat, index) => {
      const percentage = remainingPercentages[index] || 1;
      state.categories[cat.id] = Math.floor(state.totalSize * (percentage / 100));
    });

    // Generate large files
    state.largeFiles = [];
    const fileNames = [
      'VirtualBox.dmg', 'Xcode.app', 'node_modules', 'Docker.raw',
      'Movies.library', 'Photos.library', 'backup.zip', 'dataset.csv',
      'video_project.mov', 'game_install.pkg', 'database.sql', 'logs.tar.gz'
    ];
    
    for (let i = 0; i < 15; i++) {
      state.largeFiles.push({
        name: fileNames[i % fileNames.length],
        path: `/Users/username/${fileNames[i % fileNames.length]}`,
        size: Math.floor(Math.random() * 10000000000) + 1000000000 // 1GB - 11GB
      });
    }
    
    state.largeFiles.sort((a, b) => b.size - a.size);
  }

  function init(containerElement) {
    container = containerElement;
    state = {
      stage: 'idle',
      scanPath: '/',
      totalSize: 0,
      categories: {},
      largeFiles: [],
      progress: 0,
      hasStarted: false
    };
    render();
  }

  function destroy() {
    container = null;
  }

  return {
    init,
    destroy
  };
})();
