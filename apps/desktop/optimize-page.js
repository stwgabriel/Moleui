/**
 * Optimize Page Module
 * Handles system optimization tasks with progress tracking
 */

window.optimizePage = (() => {
  let container = null;
  let state = {
    stage: 'idle', // 'idle' | 'optimizing' | 'complete'
    output: '',
    exitCode: null
  };

  function render() {
    if (!container) return;

    let content = '';

    switch (state.stage) {
      case 'idle':
        content = renderIdle();
        break;
      case 'optimizing':
        content = renderOptimizing();
        break;
      case 'complete':
        content = renderComplete();
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
    return `
      <div class="optimize-stage optimize-idle">
        <div class="page-grid">
          <div class="page-left">
            <div class="page-info">
              <h1 class="page-title">Optimize</h1>
              <p class="page-description">Boost your Mac's performance with system optimization tasks.</p>
              <div class="info-list">
                <div class="info-item">
                  <div class="info-item-icon">
                    <i data-lucide="zap"></i>
                  </div>
                  <div class="info-item-content">
                    <h3 class="info-item-title">System Maintenance</h3>
                    <p class="info-item-description">Rebuild indexes and optimize databases</p>
                  </div>
                </div>
                <div class="info-item">
                  <div class="info-item-icon">
                    <i data-lucide="cpu"></i>
                  </div>
                  <div class="info-item-content">
                    <h3 class="info-item-title">Memory Management</h3>
                    <p class="info-item-description">Free up inactive memory for better performance</p>
                  </div>
                </div>
                <div class="info-item">
                  <div class="info-item-icon">
                    <i data-lucide="shield"></i>
                  </div>
                  <div class="info-item-content">
                    <h3 class="info-item-title">Disk Health</h3>
                    <p class="info-item-description">Verify disk integrity and repair permissions</p>
                  </div>
                </div>
                <div class="info-item">
                  <div class="info-item-icon">
                    <i data-lucide="settings"></i>
                  </div>
                  <div class="info-item-content">
                    <h3 class="info-item-title">Security Checks</h3>
                    <p class="info-item-description">Review firewall and system security settings</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="page-right">
            <div class="page-visual">
              <div class="visual-icon">
                <i data-lucide="gauge"></i>
              </div>
            </div>
          </div>
        </div>
        <div class="page-actions">
          <button class="action-button" id="start-optimize-btn">
            <i data-lucide="play"></i>
            Start Optimization
          </button>
        </div>
      </div>
    `;
  }

  function renderOptimizing() {
    return `
      <div class="optimize-stage optimize-running">
        <div class="optimize-progress-container">
          <div class="optimize-progress-icon">
            <div class="spinner"></div>
            <i data-lucide="zap"></i>
          </div>
          <h2 class="optimize-progress-title">Optimizing System...</h2>
          <p class="optimize-progress-subtitle">Running system maintenance and optimization tasks</p>
          
          <div class="optimize-output">
            <pre>${state.output || 'Starting optimization...'}</pre>
          </div>
        </div>
      </div>
    `;
  }

  function renderComplete() {
    const success = state.exitCode === 0;
    
    return `
      <div class="optimize-stage optimize-complete">
        <div class="optimize-complete-container">
          <div class="optimize-complete-icon ${success ? 'success' : 'error'}">
            <i data-lucide="${success ? 'check-circle' : 'alert-circle'}"></i>
          </div>
          <h2 class="optimize-complete-title">${success ? 'Optimization Complete!' : 'Optimization Failed'}</h2>
          <p class="optimize-complete-subtitle">
            ${success ? 'System optimization tasks completed successfully' : 'Some tasks encountered errors'}
          </p>
          
          <div class="optimize-output">
            <pre>${state.output || 'No output available'}</pre>
          </div>

          <div class="optimize-actions">
            <button class="action-button" id="done-button">
              <i data-lucide="check"></i>
              Done
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function attachEventListeners() {
    // Start optimize button
    const startOptimizeBtn = container.querySelector('#start-optimize-btn');
    if (startOptimizeBtn) {
      startOptimizeBtn.addEventListener('click', startOptimization);
    }

    // Done button
    const doneBtn = container.querySelector('#done-button');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => {
        state = {
          stage: 'idle',
          output: '',
          exitCode: null
        };
        render();
      });
    }
  }

  async function startOptimization() {
    state.stage = 'optimizing';
    state.output = '';
    render();

    // Set up real-time output listeners
    window.moleDesktop.optimize.onStdout((text) => {
      state.output += text;
      // Auto-scroll to bottom
      const outputEl = container.querySelector('.optimize-output pre');
      if (outputEl) {
        outputEl.textContent = state.output;
        outputEl.scrollTop = outputEl.scrollHeight;
      }
    });

    window.moleDesktop.optimize.onStderr((text) => {
      state.output += text;
      const outputEl = container.querySelector('.optimize-output pre');
      if (outputEl) {
        outputEl.textContent = state.output;
        outputEl.scrollTop = outputEl.scrollHeight;
      }
    });

    try {
      // Execute optimize command
      const result = await window.moleDesktop.optimize.execute({ dryRun: false });
      
      state.exitCode = result.exitCode;
      state.stage = 'complete';
    } catch (error) {
      console.error('Optimize error:', error);
      state.output += `\n\nError: ${error.message}`;
      state.exitCode = 1;
      state.stage = 'complete';
    } finally {
      window.moleDesktop.optimize.removeListeners();
      render();
    }
  }

  function init(containerElement) {
    container = containerElement;
    state = {
      stage: 'idle',
      output: '',
      exitCode: null
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
