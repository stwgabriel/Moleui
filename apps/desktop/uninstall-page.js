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
   * Stream dry-run output
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
      
      // Parse file paths
      if (trimmedLine.includes('Would remove:') || trimmedLine.includes('Removing:')) {
        const filePath = trimmedLine.replace(/Would remove:\s*/, '').replace(/Removing:\s*/, '');
        
        const fileItem = document.createElement('div');
        fileItem.className = 'file-to-remove-item';
        
        // Determine file type icon
        let icon = 'file';
        if (filePath.includes('.app')) icon = 'package';
        else if (filePath.includes('Library/Caches')) icon = 'database';
        else if (filePath.includes('Library/Preferences')) icon = 'settings';
        else if (filePath.includes('Library/Logs')) icon = 'file-text';
        
        fileItem.innerHTML = `
          <div class="file-icon">
            <i data-lucide="${icon}"></i>
          </div>
          <div class="file-path">${this.escapeHtml(filePath)}</div>
        `;
        
        filesListContainer.appendChild(fileItem);
        if (window.lucide) lucide.createIcons();
        
        // Auto-scroll
        filesListContainer.scrollTop = filesListContainer.scrollHeight;
      }
      
      // Parse summary
      else if (trimmedLine.includes('Total:')) {
        if (loadingIndicator) {
          loadingIndicator.style.display = 'none';
        }
        
        if (summaryContainer) {
          summaryContainer.style.display = 'flex';
          summaryContainer.innerHTML = `
            <div class="summary-stat">
              <i data-lucide="check-circle"></i>
              <span>${this.escapeHtml(trimmedLine)}</span>
            </div>
          `;
          if (window.lucide) lucide.createIcons();
        }
      }
    });
  }

  /**
   * Stream execute output
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
      
      // Update current operation
      if (trimmedLine.includes('Removing')) {
        operationContainer.innerHTML = `
          <div class="operation-status active">
            <i data-lucide="loader"></i>
            <span>${this.escapeHtml(trimmedLine)}</span>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
      }
      
      // Show removed files
      else if (trimmedLine.includes('✓ Removed') || trimmedLine.includes('Removed:')) {
        const filePath = trimmedLine.replace(/✓\s*Removed:?\s*/, '').replace(/Removed:?\s*/, '');
        
        const fileItem = document.createElement('div');
        fileItem.className = 'removed-file-item';
        
        // Determine file type icon
        let icon = 'file';
        if (filePath.includes('.app')) icon = 'package';
        else if (filePath.includes('Library/Caches')) icon = 'database';
        else if (filePath.includes('Library/Preferences')) icon = 'settings';
        else if (filePath.includes('Library/Logs')) icon = 'file-text';
        
        fileItem.innerHTML = `
          <div class="file-icon success">
            <i data-lucide="${icon}"></i>
          </div>
          <div class="file-path">${this.escapeHtml(filePath)}</div>
          <div class="success-indicator">
            <i data-lucide="check"></i>
          </div>
        `;
        
        removedListContainer.appendChild(fileItem);
        if (window.lucide) lucide.createIcons();
        
        // Auto-scroll
        removedListContainer.scrollTop = removedListContainer.scrollHeight;
      }
      
      // Show completion
      else if (trimmedLine.includes('✓') && (trimmedLine.includes('complete') || trimmedLine.includes('Freed'))) {
        operationContainer.innerHTML = `
          <div class="operation-status success">
            <i data-lucide="check-circle"></i>
            <span>${this.escapeHtml(trimmedLine)}</span>
          </div>
        `;
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
            <h3>Files to be removed:</h3>
            <div id="dry-run-loading" class="loading-indicator">
              <div class="small-spinner"></div>
              <span>Analyzing...</span>
            </div>
          </div>
          <div class="files-to-remove-list" id="files-to-remove-list">
            <!-- Files will be added here as they're analyzed -->
          </div>
          <div class="dry-run-summary" id="dry-run-summary" style="display: none;">
            <!-- Summary will be shown here -->
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
          <div class="loading-spinner">
            <div class="spinner"></div>
          </div>
          <h2>Uninstalling Applications...</h2>
          <p>Please wait while we remove the selected applications</p>
          <div class="executing-warning">
            <i data-lucide="info"></i>
            <span>Do not close this window</span>
          </div>
        </div>
        <div class="execution-progress-container">
          <div class="current-operation" id="current-operation">
            <div class="operation-status">
              <i data-lucide="loader"></i>
              <span>Preparing...</span>
            </div>
          </div>
          <div class="removed-files-list" id="removed-files-list">
            <!-- Removed files will be shown here -->
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
}

// Global instance
window.uninstallPage = new UninstallPage();
