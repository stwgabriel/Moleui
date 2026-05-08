/**
 * Uninstall Page - Manages the complete uninstall workflow
 * Stages: Loading → Analyzing → Selection → Confirmation → Execution → Results
 */

class UninstallPage {
  constructor() {
    this.apps = [];
    this.selectedApps = new Set();
    this.stage = 'idle'; // idle, loading, selection, confirmation, executing, results
    this.container = null;
    this.setupStreamListeners();
  }

  /**
   * Setup stream listeners for real-time CLI output
   */
  setupStreamListeners() {
    // Note: List command outputs JSON directly, no streaming needed
    
    // Dry-run streaming
    window.moleDesktop.uninstall.onDryRunStdout((data) => {
      this.streamDryRunOutput(data);
    });
    
    window.moleDesktop.uninstall.onDryRunStderr((data) => {
      this.streamDryRunOutput(data);
    });
    
    // Execute streaming
    window.moleDesktop.uninstall.onExecuteStdout((data) => {
      this.streamExecuteOutput(data);
    });
    
    window.moleDesktop.uninstall.onExecuteStderr((data) => {
      this.streamExecuteOutput(data);
    });
  }

  /**
   * Initialize the uninstall page
   */
  async init(container) {
    this.container = container;
    this.render();
  }

  /**
   * Start the scanning process
   */
  async startScan() {
    this.stage = 'loading';
    this.render();

    try {
      const result = await window.moleDesktop.uninstall.list();
      
      if (!result.ok) {
        this.showError('Failed to scan applications', result.stderr);
        return;
      }

      // Parse JSON output
      try {
        // The stdout contains JSON array of apps
        const jsonOutput = result.stdout.trim();
        this.apps = JSON.parse(jsonOutput);
        
        if (!Array.isArray(this.apps)) {
          this.showError('Invalid response format', 'Expected array of applications');
          return;
        }
        
        // Show completion message
        const statusContainer = this.container.querySelector('#scan-status');
        if (statusContainer) {
          statusContainer.innerHTML = `
            <div class="status-item success">
              <i data-lucide="check-circle"></i>
              <span>✓ Found ${this.apps.length} applications</span>
            </div>
          `;
          if (window.lucide) lucide.createIcons();
        }
        
        // Small delay to show completion message
        await new Promise(resolve => setTimeout(resolve, 800));
        
        this.stage = 'selection';
        this.render();
      } catch (e) {
        this.showError('Failed to parse application list', `${e.message}\n\nOutput: ${result.stdout.substring(0, 200)}`);
      }
    } catch (error) {
      this.showError('Scan failed', error.message);
    }
  }

  /**
   * Strip ANSI escape codes from text
   */
  stripAnsi(text) {
    // Remove ANSI escape codes (colors, cursor movements, etc.)
    return text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').replace(/\x1B\[K/g, '');
  }

  /**
   * Stream dry-run output - Parse CLI output and display as UI cards
   */
  streamDryRunOutput(text) {
    const filesListContainer = this.container.querySelector('#files-to-remove-list');
    const summaryContainer = this.container.querySelector('#dry-run-summary');
    const loadingIndicator = this.container.querySelector('#dry-run-loading');
    
    if (!filesListContainer) return;
    
    // Strip ANSI codes
    const cleanText = this.stripAnsi(text);
    const lines = cleanText.split('\n');
    
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      
      // Parse "Files to be removed:" header
      if (trimmedLine.includes('Files to be removed:')) {
        const header = document.createElement('div');
        header.className = 'files-header';
        header.innerHTML = `
          <i data-lucide="list"></i>
          <span>Files to be removed</span>
        `;
        filesListContainer.appendChild(header);
        if (window.lucide) lucide.createIcons();
        return;
      }
      
      // Parse app header lines: "✓ AppName [Brew], 123 MB"
      const appHeaderMatch = trimmedLine.match(/^[✓✔☑]\s+(.+?)\s*(?:\[Brew\])?\s*,\s*(.+)$/);
      if (appHeaderMatch) {
        const appName = appHeaderMatch[1].trim();
        const size = appHeaderMatch[2].trim();
        
        const appCard = document.createElement('div');
        appCard.className = 'app-card';
        appCard.dataset.appName = appName;
        
        appCard.innerHTML = `
          <div class="app-card-header">
            <div class="app-card-icon">
              <i data-lucide="package"></i>
            </div>
            <div class="app-card-info">
              <div class="app-card-name">${this.escapeHtml(appName)}</div>
              <div class="app-card-size">${this.escapeHtml(size)}</div>
            </div>
            <div class="app-card-status">
              <i data-lucide="clock"></i>
            </div>
          </div>
          <div class="app-card-files"></div>
        `;
        
        filesListContainer.appendChild(appCard);
        if (window.lucide) lucide.createIcons();
        filesListContainer.scrollTop = filesListContainer.scrollHeight;
        return;
      }
      
      // Parse file paths: "  ✓ /path/to/file"
      const fileMatch = trimmedLine.match(/^[✓✔☑]\s+(.+)$/);
      if (fileMatch) {
        const filePath = fileMatch[1].trim();
        
        // Find the current app card
        const appCards = filesListContainer.querySelectorAll('.app-card');
        const currentCard = appCards[appCards.length - 1];
        
        if (currentCard) {
          const filesContainer = currentCard.querySelector('.app-card-files');
          
          // Check for duplicates
          const existingFiles = Array.from(filesContainer.querySelectorAll('.file-item-path'));
          if (existingFiles.some(item => item.textContent === filePath)) {
            return;
          }
          
          const fileItem = document.createElement('div');
          fileItem.className = 'file-item';
          
          // Determine file type
          let icon = 'file';
          let fileType = 'file';
          if (filePath.includes('.app')) {
            icon = 'package';
            fileType = 'app';
          } else if (filePath.includes('Library/Caches') || filePath.includes('/Caches/')) {
            icon = 'database';
            fileType = 'cache';
          } else if (filePath.includes('Library/Preferences') || filePath.includes('.plist')) {
            icon = 'settings';
            fileType = 'preference';
          } else if (filePath.includes('Library/Logs') || filePath.includes('/Logs/')) {
            icon = 'file-text';
            fileType = 'log';
          } else if (filePath.includes('Library/Application Support')) {
            icon = 'folder';
            fileType = 'support';
          }
          
          fileItem.innerHTML = `
            <div class="file-item-icon ${fileType}">
              <i data-lucide="${icon}"></i>
            </div>
            <div class="file-item-path">${this.escapeHtml(filePath.replace(/^\/Users\/[^\/]+/, '~'))}</div>
          `;
          
          filesContainer.appendChild(fileItem);
          if (window.lucide) lucide.createIcons();
        }
        return;
      }
      
      // Parse system files: "  ⚠ System: /path/to/file"
      const systemMatch = trimmedLine.match(/^[⚠!]\s+System:\s+(.+)$/);
      if (systemMatch) {
        const filePath = systemMatch[1].trim();
        
        const appCards = filesListContainer.querySelectorAll('.app-card');
        const currentCard = appCards[appCards.length - 1];
        
        if (currentCard) {
          const filesContainer = currentCard.querySelector('.app-card-files');
          
          const fileItem = document.createElement('div');
          fileItem.className = 'file-item system';
          
          fileItem.innerHTML = `
            <div class="file-item-icon system">
              <i data-lucide="shield-alert"></i>
            </div>
            <div class="file-item-path">${this.escapeHtml(filePath)}</div>
            <span class="system-badge">System</span>
          `;
          
          filesContainer.appendChild(fileItem);
          if (window.lucide) lucide.createIcons();
        }
        return;
      }
      
      // Parse summary: "Would remove X apps, Y MB"
      if (trimmedLine.includes('Would remove') || trimmedLine.includes('DRY RUN')) {
        if (loadingIndicator) {
          loadingIndicator.style.display = 'none';
        }
        
        // Mark all app cards as complete
        const appCards = filesListContainer.querySelectorAll('.app-card');
        appCards.forEach(card => {
          const statusIcon = card.querySelector('.app-card-status i');
          if (statusIcon) {
            statusIcon.setAttribute('data-lucide', 'check-circle');
            card.classList.add('complete');
          }
        });
        
        if (summaryContainer) {
          summaryContainer.style.display = 'flex';
          summaryContainer.innerHTML = `
            <div class="summary-card">
              <div class="summary-icon">
                <i data-lucide="info"></i>
              </div>
              <div class="summary-content">
                <div class="summary-title">Dry Run Complete</div>
                <div class="summary-text">${this.escapeHtml(trimmedLine)}</div>
              </div>
            </div>
          `;
          if (window.lucide) lucide.createIcons();
        }
      }
    });
  }

  /**
   * Stream execute output - Parse CLI output and display as UI cards
   */
  streamExecuteOutput(text) {
    const operationContainer = this.container.querySelector('#current-operation');
    const removedListContainer = this.container.querySelector('#removed-files-list');
    
    if (!operationContainer || !removedListContainer) return;
    
    // Strip ANSI codes
    const cleanText = this.stripAnsi(text);
    const lines = cleanText.split('\n');
    
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      
      // Parse progress indicator: "[1/3] Uninstalling AppName..."
      const progressMatch = trimmedLine.match(/^\[(\d+)\/(\d+)\]\s+Uninstalling\s+(.+?)(?:\[Brew\])?\.\.\./);
      if (progressMatch) {
        const current = progressMatch[1];
        const total = progressMatch[2];
        const appName = progressMatch[3].trim();
        
        operationContainer.innerHTML = `
          <div class="operation-card">
            <div class="operation-progress">
              <div class="operation-progress-bar">
                <div class="operation-progress-fill" style="width: ${(current / total) * 100}%"></div>
              </div>
              <div class="operation-progress-text">${current} of ${total}</div>
            </div>
            <div class="operation-status active">
              <div class="operation-spinner">
                <i data-lucide="loader"></i>
              </div>
              <span>Uninstalling ${this.escapeHtml(appName)}...</span>
            </div>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
      }
      
      // Parse success: "✓ [1/3] AppName" or "✓ AppName"
      const successMatch = trimmedLine.match(/^[✓✔☑]\s+(?:\[(\d+)\/(\d+)\]\s+)?(.+)$/);
      if (successMatch) {
        const current = successMatch[1];
        const total = successMatch[2];
        const appName = successMatch[3].trim();
        
        // Check if already added
        const existingCards = Array.from(removedListContainer.querySelectorAll('.removed-app-card'));
        if (existingCards.some(card => card.dataset.appName === appName)) {
          return;
        }
        
        const appCard = document.createElement('div');
        appCard.className = 'removed-app-card';
        appCard.dataset.appName = appName;
        
        appCard.innerHTML = `
          <div class="removed-app-header">
            <div class="removed-app-icon">
              <i data-lucide="package"></i>
            </div>
            <div class="removed-app-info">
              <div class="removed-app-name">${this.escapeHtml(appName)}</div>
              ${current && total ? `<div class="removed-app-progress">${current} of ${total}</div>` : ''}
            </div>
            <div class="removed-app-status">
              <i data-lucide="check-circle"></i>
            </div>
          </div>
          <div class="removed-app-files"></div>
        `;
        
        removedListContainer.appendChild(appCard);
        if (window.lucide) lucide.createIcons();
        removedListContainer.scrollTop = removedListContainer.scrollHeight;
        
        // Update operation status
        if (current && total) {
          operationContainer.innerHTML = `
            <div class="operation-card">
              <div class="operation-progress">
                <div class="operation-progress-bar">
                  <div class="operation-progress-fill" style="width: ${(current / total) * 100}%"></div>
                </div>
                <div class="operation-progress-text">${current} of ${total}</div>
              </div>
              <div class="operation-status success">
                <div class="operation-icon">
                  <i data-lucide="check"></i>
                </div>
                <span>Removed ${this.escapeHtml(appName)}</span>
              </div>
            </div>
          `;
          if (window.lucide) lucide.createIcons();
        }
        return;
      }
      
      // Parse file removal (indented lines under an app)
      const fileRemovalMatch = trimmedLine.match(/^[✓✔☑]\s+(.+)$/);
      if (fileRemovalMatch && !trimmedLine.match(/^\[/)) {
        const filePath = fileRemovalMatch[1].trim();
        
        // Find the current app card
        const appCards = removedListContainer.querySelectorAll('.removed-app-card');
        const currentCard = appCards[appCards.length - 1];
        
        if (currentCard) {
          const filesContainer = currentCard.querySelector('.removed-app-files');
          
          // Check for duplicates
          const existingFiles = Array.from(filesContainer.querySelectorAll('.removed-file-path'));
          if (existingFiles.some(item => item.textContent === filePath)) {
            return;
          }
          
          const fileItem = document.createElement('div');
          fileItem.className = 'removed-file-item';
          
          // Determine file type
          let icon = 'file';
          let fileType = 'file';
          if (filePath.includes('.app')) {
            icon = 'package';
            fileType = 'app';
          } else if (filePath.includes('Library/Caches')) {
            icon = 'database';
            fileType = 'cache';
          } else if (filePath.includes('Library/Preferences')) {
            icon = 'settings';
            fileType = 'preference';
          } else if (filePath.includes('Library/Logs')) {
            icon = 'file-text';
            fileType = 'log';
          }
          
          fileItem.innerHTML = `
            <div class="removed-file-icon ${fileType}">
              <i data-lucide="${icon}"></i>
            </div>
            <div class="removed-file-path">${this.escapeHtml(filePath.replace(/^\/Users\/[^\/]+/, '~'))}</div>
            <div class="removed-file-check">
              <i data-lucide="check"></i>
            </div>
          `;
          
          filesContainer.appendChild(fileItem);
          if (window.lucide) lucide.createIcons();
        }
        return;
      }
      
      // Parse completion summary: "Removed X apps, freed Y MB"
      const completionMatch = trimmedLine.match(/Removed\s+(\d+)\s+apps?,\s+freed\s+(.+)/i);
      if (completionMatch) {
        const count = completionMatch[1];
        const size = completionMatch[2];
        
        operationContainer.innerHTML = `
          <div class="operation-card complete">
            <div class="operation-status success">
              <div class="operation-icon">
                <i data-lucide="check-circle"></i>
              </div>
              <div class="operation-summary">
                <div class="operation-summary-title">Uninstall Complete</div>
                <div class="operation-summary-text">Removed ${count} app${count > 1 ? 's' : ''}, freed ${this.escapeHtml(size)}</div>
              </div>
            </div>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
      }
      
      // Parse warnings or errors
      if (trimmedLine.includes('Warning:') || trimmedLine.includes('Error:')) {
        const warningCard = document.createElement('div');
        warningCard.className = 'warning-card';
        warningCard.innerHTML = `
          <div class="warning-icon">
            <i data-lucide="alert-triangle"></i>
          </div>
          <div class="warning-text">${this.escapeHtml(trimmedLine)}</div>
        `;
        removedListContainer.appendChild(warningCard);
        if (window.lucide) lucide.createIcons();
      }
    });
  }

  /**
   * Toggle app selection
   */
  toggleApp(index) {
    if (this.selectedApps.has(index)) {
      this.selectedApps.delete(index);
    } else {
      this.selectedApps.add(index);
    }
    this.updateSelectionUI();
  }

  /**
   * Select all apps
   */
  selectAll() {
    this.apps.forEach((_, index) => this.selectedApps.add(index));
    this.updateSelectionUI();
  }

  /**
   * Deselect all apps
   */
  deselectAll() {
    this.selectedApps.clear();
    this.updateSelectionUI();
  }

  /**
   * Proceed to confirmation stage
   */
  async proceedToConfirmation() {
    if (this.selectedApps.size === 0) {
      return;
    }

    this.stage = 'confirmation';
    this.render();

    // Run dry-run to get detailed file list
    const selectedAppNames = Array.from(this.selectedApps).map(i => this.apps[i].uninstall_name);
    
    try {
      const result = await window.moleDesktop.uninstall.dryRun(selectedAppNames);
      
      if (!result.ok) {
        this.showError('Failed to analyze files', result.stderr);
        return;
      }

      // Mark dry-run as complete
      const loadingEl = this.container.querySelector('#dry-run-loading');
      if (loadingEl) {
        loadingEl.style.display = 'none';
      }
    } catch (error) {
      this.showError('Analysis failed', error.message);
    }
  }

  /**
   * Execute the uninstall
   */
  async executeUninstall() {
    this.stage = 'executing';
    this.render();

    const selectedAppNames = Array.from(this.selectedApps).map(i => this.apps[i].uninstall_name);

    try {
      const result = await window.moleDesktop.uninstall.execute(selectedAppNames);
      
      this.stage = 'results';
      this.displayResults(result);
    } catch (error) {
      this.showError('Uninstall failed', error.message);
    }
  }

  /**
   * Cancel and return to selection
   */
  cancelConfirmation() {
    this.stage = 'selection';
    this.render();
  }

  /**
   * Reset to initial state
   */
  reset() {
    this.apps = [];
    this.selectedApps.clear();
    this.stage = 'idle';
    this.render();
  }

  /**
   * Update selection UI elements
   */
  updateSelectionUI() {
    const checkboxes = this.container.querySelectorAll('.app-checkbox');
    checkboxes.forEach((checkbox, index) => {
      checkbox.checked = this.selectedApps.has(index);
    });

    const selectedCount = this.selectedApps.size;
    const totalCount = this.apps.length;
    
    const countEl = this.container.querySelector('#selected-count');
    if (countEl) {
      countEl.textContent = `${selectedCount} of ${totalCount} selected`;
    }

    const proceedBtn = this.container.querySelector('#proceed-btn');
    if (proceedBtn) {
      proceedBtn.disabled = selectedCount === 0;
    }

    const selectAllBtn = this.container.querySelector('#select-all-btn');
    if (selectAllBtn) {
      selectAllBtn.textContent = selectedCount === totalCount ? 'Deselect All' : 'Select All';
    }
  }

  /**
   * Display final results
   */
  displayResults(result) {
    this.render();
    
    const resultsContainer = this.container.querySelector('#execution-results');
    if (!resultsContainer) return;

    const success = result.ok;
    const output = result.stdout || result.stderr;

    resultsContainer.innerHTML = `
      <div class="results-summary ${success ? 'success' : 'error'}">
        <div class="results-icon">
          <i data-lucide="${success ? 'check-circle' : 'x-circle'}"></i>
        </div>
        <h3>${success ? 'Uninstall Complete' : 'Uninstall Failed'}</h3>
        <p>${success ? 'Applications have been successfully removed' : 'An error occurred during uninstallation'}</p>
      </div>
      <div class="results-output">
        <pre>${this.escapeHtml(output)}</pre>
      </div>
    `;

    // Reinitialize lucide icons
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  /**
   * Show error message
   */
  showError(title, message) {
    this.stage = 'error';
    this.render();

    const errorContainer = this.container.querySelector('#error-container');
    if (errorContainer) {
      errorContainer.innerHTML = `
        <div class="error-message">
          <div class="error-icon">
            <i data-lucide="alert-circle"></i>
          </div>
          <h3>${this.escapeHtml(title)}</h3>
          <p>${this.escapeHtml(message)}</p>
          <button class="action-button" onclick="uninstallPage.reset()">
            Try Again
          </button>
        </div>
      `;

      if (window.lucide) {
        lucide.createIcons();
      }
    }
  }

  /**
   * Render the current stage
   */
  render() {
    if (!this.container) return;

    let html = '';

    switch (this.stage) {
      case 'idle':
        html = this.renderIdle();
        break;
      case 'loading':
        html = this.renderLoading();
        break;
      case 'selection':
        html = this.renderSelection();
        break;
      case 'confirmation':
        html = this.renderConfirmation();
        break;
      case 'executing':
        html = this.renderExecuting();
        break;
      case 'results':
        html = this.renderResults();
        break;
      case 'error':
        html = this.renderError();
        break;
    }

    this.container.innerHTML = html;

    // Reinitialize lucide icons
    if (window.lucide) {
      lucide.createIcons();
    }

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Render idle state (initial)
   */
  renderIdle() {
    return `
      <div class="uninstall-stage uninstall-idle">
        <div class="page-grid">
          <div class="page-left">
            <div class="page-info">
              <h1 class="page-title">Uninstall</h1>
              <p class="page-description">Completely remove applications and all their associated files from your system.</p>
              <div class="info-list">
                <div class="info-item">
                  <div class="info-item-icon">
                    <i data-lucide="search"></i>
                  </div>
                  <div class="info-item-content">
                    <h3 class="info-item-title">Deep Scan</h3>
                    <p class="info-item-description">Find all app-related files and folders</p>
                  </div>
                </div>
                <div class="info-item">
                  <div class="info-item-icon">
                    <i data-lucide="trash"></i>
                  </div>
                  <div class="info-item-content">
                    <h3 class="info-item-title">Complete Removal</h3>
                    <p class="info-item-description">Delete apps with all preferences and caches</p>
                  </div>
                </div>
                <div class="info-item">
                  <div class="info-item-icon">
                    <i data-lucide="shield"></i>
                  </div>
                  <div class="info-item-content">
                    <h3 class="info-item-title">Safe Uninstall</h3>
                    <p class="info-item-description">Protected system files remain untouched</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="page-right">
            <div class="page-visual">
              <div class="visual-icon">
                <i data-lucide="package-x"></i>
              </div>
            </div>
          </div>
        </div>
        <div class="page-actions">
          <button class="action-button" id="start-scan-btn">
            Scan Applications
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render loading state
   */
  renderLoading() {
    return `
      <div class="uninstall-stage uninstall-loading">
        <div class="loading-header">
          <div class="loading-spinner">
            <div class="spinner"></div>
          </div>
          <h2>Analyzing Applications...</h2>
          <p>Scanning your system for installed applications</p>
        </div>
        <div class="scan-progress-container">
          <div class="scan-status" id="scan-status">
            <div class="status-item">
              <i data-lucide="folder"></i>
              <span>Scanning directories...</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render selection state
   */
  renderSelection() {
    const appRows = this.apps.map((app, index) => `
      <tr class="app-row" data-index="${index}">
        <td class="app-checkbox-cell">
          <input type="checkbox" class="app-checkbox" data-index="${index}" ${this.selectedApps.has(index) ? 'checked' : ''}>
        </td>
        <td class="app-name-cell">
          <div class="app-name">${this.escapeHtml(app.name)}</div>
          <div class="app-path">${this.escapeHtml(app.path)}</div>
        </td>
        <td class="app-source-cell">
          <span class="app-source-badge ${app.source.toLowerCase()}">${this.escapeHtml(app.source)}</span>
        </td>
        <td class="app-size-cell">${this.escapeHtml(app.size)}</td>
      </tr>
    `).join('');

    return `
      <div class="uninstall-stage uninstall-selection">
        <div class="selection-header">
          <div class="selection-info">
            <h2>Select Applications to Uninstall</h2>
            <p id="selected-count">${this.selectedApps.size} of ${this.apps.length} selected</p>
          </div>
          <div class="selection-actions">
            <button class="secondary-button" id="select-all-btn">
              ${this.selectedApps.size === this.apps.length ? 'Deselect All' : 'Select All'}
            </button>
            <button class="action-button" id="proceed-btn" ${this.selectedApps.size === 0 ? 'disabled' : ''}>
              Continue
              <i data-lucide="arrow-right"></i>
            </button>
          </div>
        </div>
        <div class="apps-table-container">
          <table class="apps-table">
            <thead>
              <tr>
                <th class="checkbox-header"></th>
                <th>Application</th>
                <th>Source</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              ${appRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Render confirmation state
   */
  renderConfirmation() {
    const selectedAppsList = Array.from(this.selectedApps).map(index => {
      const app = this.apps[index];
      return `
        <div class="selected-app-item">
          <div class="app-icon">
            <i data-lucide="package"></i>
          </div>
          <div class="app-details">
            <div class="app-name">${this.escapeHtml(app.name)}</div>
            <div class="app-meta">${this.escapeHtml(app.size)} • ${this.escapeHtml(app.source)}</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="uninstall-stage uninstall-confirmation">
        <div class="confirmation-header">
          <div class="warning-icon">
            <i data-lucide="alert-triangle"></i>
          </div>
          <h2>Confirm Uninstallation</h2>
          <p>The following applications and their associated files will be removed:</p>
        </div>
        <div class="selected-apps-list">
          ${selectedAppsList}
        </div>
        <div class="dry-run-results">
          <div class="dry-run-header">
            <h3>Analyzing files...</h3>
            <div id="dry-run-loading" class="loading-indicator">
              <div class="small-spinner"></div>
              <span>Scanning...</span>
            </div>
          </div>
          <div class="files-to-remove-list" id="files-to-remove-list">
            <!-- App cards with files will be added here as they're analyzed -->
          </div>
          <div class="dry-run-summary" id="dry-run-summary" style="display: none;">
            <!-- Summary card will be shown here -->
          </div>
        </div>
        <div class="confirmation-actions">
          <button class="secondary-button" id="cancel-btn">
            <i data-lucide="x"></i>
            Cancel
          </button>
          <button class="danger-button" id="confirm-uninstall-btn">
            <i data-lucide="trash-2"></i>
            Uninstall ${this.selectedApps.size} App${this.selectedApps.size > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render executing state
   */
  renderExecuting() {
    return `
      <div class="uninstall-stage uninstall-executing">
        <div class="executing-header">
          <h2>Uninstalling Applications</h2>
          <p>Removing selected applications and their files...</p>
          <div class="executing-warning">
            <i data-lucide="info"></i>
            <span>Do not close this window</span>
          </div>
        </div>
        <div class="execution-progress-container">
          <div class="current-operation" id="current-operation">
            <div class="operation-card">
              <div class="operation-status active">
                <div class="operation-spinner">
                  <i data-lucide="loader"></i>
                </div>
                <span>Preparing...</span>
              </div>
            </div>
          </div>
          <div class="removed-files-list" id="removed-files-list">
            <!-- Removed app cards will be shown here in real-time -->
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render results state
   */
  renderResults() {
    return `
      <div class="uninstall-stage uninstall-results">
        <div id="execution-results"></div>
        <div class="results-actions">
          <button class="action-button" id="done-btn">
            <i data-lucide="check"></i>
            Done
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render error state
   */
  renderError() {
    return `
      <div class="uninstall-stage uninstall-error">
        <div id="error-container"></div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Start scan button
    const startScanBtn = this.container.querySelector('#start-scan-btn');
    if (startScanBtn) {
      startScanBtn.addEventListener('click', () => this.startScan());
    }

    // App checkboxes
    const checkboxes = this.container.querySelectorAll('.app-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.toggleApp(index);
      });
    });

    // Select all button
    const selectAllBtn = this.container.querySelector('#select-all-btn');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        if (this.selectedApps.size === this.apps.length) {
          this.deselectAll();
        } else {
          this.selectAll();
        }
      });
    }

    // Proceed button
    const proceedBtn = this.container.querySelector('#proceed-btn');
    if (proceedBtn) {
      proceedBtn.addEventListener('click', () => this.proceedToConfirmation());
    }

    // Cancel button
    const cancelBtn = this.container.querySelector('#cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.cancelConfirmation());
    }

    // Confirm uninstall button
    const confirmBtn = this.container.querySelector('#confirm-uninstall-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.executeUninstall());
    }

    // Done button
    const doneBtn = this.container.querySelector('#done-btn');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => this.reset());
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    // Cleanup listeners if needed
    if (window.moleDesktop && window.moleDesktop.uninstall && window.moleDesktop.uninstall.removeListeners) {
      window.moleDesktop.uninstall.removeListeners();
    }
  }
}

// Global instance
window.uninstallPage = new UninstallPage();
