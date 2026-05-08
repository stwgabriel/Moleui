/**
 * Status Page - Real-time system monitoring with CLI integration
 */

(function () {
  "use strict";

  const REFRESH_INTERVAL = 2000; // 2 seconds
  const GRAPH_HISTORY_SIZE = 60; // 60 data points (2 minutes at 2s intervals)

  class StatusPage {
    constructor() {
      this.container = null;
      this.refreshTimer = null;
      this.metricsHistory = {
        cpu: [],
        memory: [],
        network_rx: [],
        network_tx: [],
        disk_io_read: [],
        disk_io_write: [],
        timestamps: []
      };
      this.isRefreshing = false;
      this.isMonitoring = false;
    }

    init(container) {
      this.container = container;
      this.renderStartScreen();
    }

    destroy() {
      this.stopAutoRefresh();
      this.isMonitoring = false;
    }

    startMonitoring() {
      this.isMonitoring = true;
      this.renderMonitoringView();
      this.startAutoRefresh();
    }

    stopMonitoring() {
      this.isMonitoring = false;
      this.stopAutoRefresh();
      this.renderStartScreen();
    }

    startAutoRefresh() {
      this.fetchMetrics(); // Initial fetch
      this.refreshTimer = setInterval(() => {
        this.fetchMetrics();
      }, REFRESH_INTERVAL);
    }

    stopAutoRefresh() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
    }

    async fetchMetrics() {
      if (this.isRefreshing) return;
      
      this.isRefreshing = true;
      
      try {
        const result = await window.moleDesktop.runStatus();
        
        if (result.ok && result.stdout) {
          const metrics = JSON.parse(result.stdout);
          this.updateMetrics(metrics);
        } else {
          console.error("Failed to fetch metrics:", result.stderr);
        }
      } catch (error) {
        console.error("Error fetching metrics:", error);
      } finally {
        this.isRefreshing = false;
      }
    }

    updateMetrics(metrics) {
      const now = Date.now();
      
      // Add to history
      this.metricsHistory.timestamps.push(now);
      this.metricsHistory.cpu.push(metrics.cpu.usage);
      this.metricsHistory.memory.push(metrics.memory.used_percent);
      
      // Network rates (sum all interfaces)
      const totalRx = metrics.network.reduce((sum, iface) => sum + iface.rx_rate_mbs, 0);
      const totalTx = metrics.network.reduce((sum, iface) => sum + iface.tx_rate_mbs, 0);
      this.metricsHistory.network_rx.push(totalRx);
      this.metricsHistory.network_tx.push(totalTx);
      
      // Disk I/O
      this.metricsHistory.disk_io_read.push(metrics.disk_io.read_rate);
      this.metricsHistory.disk_io_write.push(metrics.disk_io.write_rate);
      
      // Keep only last N data points
      if (this.metricsHistory.timestamps.length > GRAPH_HISTORY_SIZE) {
        this.metricsHistory.timestamps.shift();
        this.metricsHistory.cpu.shift();
        this.metricsHistory.memory.shift();
        this.metricsHistory.network_rx.shift();
        this.metricsHistory.network_tx.shift();
        this.metricsHistory.disk_io_read.shift();
        this.metricsHistory.disk_io_write.shift();
      }
      
      // Update UI
      this.updateUI(metrics);
    }

    updateUI(metrics) {
      if (!this.container) return;
      
      // Update overview cards
      this.updateOverviewCard('cpu', metrics.cpu.usage, '%');
      this.updateOverviewCard('memory', metrics.memory.used_percent, '%');
      this.updateOverviewCard('disk', metrics.disks[0]?.used_percent || 0, '%');
      this.updateOverviewCard('health', metrics.health_score, '/100');
      
      // Update graphs
      this.updateGraph('cpu-graph', this.metricsHistory.cpu, 'CPU Usage', '%', '#3b82f6');
      this.updateGraph('memory-graph', this.metricsHistory.memory, 'Memory Usage', '%', '#8b5cf6');
      this.updateGraph('network-graph', 
        [this.metricsHistory.network_rx, this.metricsHistory.network_tx], 
        'Network', 'MB/s', ['#10b981', '#f59e0b'], ['RX', 'TX']);
      this.updateGraph('disk-io-graph', 
        [this.metricsHistory.disk_io_read, this.metricsHistory.disk_io_write], 
        'Disk I/O', 'MB/s', ['#06b6d4', '#ec4899'], ['Read', 'Write']);
      
      // Update detailed stats
      this.updateDetailedStats(metrics);
    }

    updateOverviewCard(id, value, unit) {
      const valueEl = this.container.querySelector(`#${id}-value`);
      const progressEl = this.container.querySelector(`#${id}-progress`);
      
      if (valueEl) {
        valueEl.textContent = value.toFixed(1);
      }
      
      if (progressEl) {
        const percentage = unit === '/100' ? value : value;
        progressEl.style.width = `${Math.min(percentage, 100)}%`;
        
        // Color based on value
        let color = 'var(--accent-success)';
        if (percentage > 80) color = 'var(--accent-danger)';
        else if (percentage > 60) color = 'var(--accent-warning)';
        progressEl.style.background = color;
      }
    }

    updateGraph(canvasId, data, label, unit, colors, labels) {
      const canvas = this.container.querySelector(`#${canvasId}`);
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      const padding = 40;
      const graphWidth = width - padding * 2;
      const graphHeight = height - padding * 2;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Handle multiple datasets
      const datasets = Array.isArray(data[0]) ? data : [data];
      const colorArray = Array.isArray(colors) ? colors : [colors];
      const labelArray = labels || [label];
      
      // Find max value across all datasets
      let maxValue = 0;
      datasets.forEach(dataset => {
        const max = Math.max(...dataset, 0);
        if (max > maxValue) maxValue = max;
      });
      
      // Round up to nice number
      maxValue = Math.ceil(maxValue / 10) * 10;
      if (maxValue === 0) maxValue = 100;
      
      // Draw grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
      ctx.lineWidth = 1;
      ctx.font = '11px -apple-system, BlinkMacSystemFont, SF Pro Display';
      ctx.fillStyle = 'var(--text-tertiary)';
      
      for (let i = 0; i <= 4; i++) {
        const y = padding + (graphHeight / 4) * i;
        const value = maxValue - (maxValue / 4) * i;
        
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
        
        ctx.fillText(value.toFixed(0), 5, y + 4);
      }
      
      // Draw each dataset
      datasets.forEach((dataset, datasetIndex) => {
        if (dataset.length < 2) return;
        
        const color = colorArray[datasetIndex] || colorArray[0];
        
        // Draw line
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        dataset.forEach((value, index) => {
          const x = padding + (graphWidth / (dataset.length - 1)) * index;
          const y = padding + graphHeight - (value / maxValue) * graphHeight;
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        
        ctx.stroke();
        
        // Draw area fill
        ctx.lineTo(width - padding, padding + graphHeight);
        ctx.lineTo(padding, padding + graphHeight);
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(0, padding, 0, padding + graphHeight);
        gradient.addColorStop(0, color.replace(')', ', 0.2)').replace('rgb', 'rgba'));
        gradient.addColorStop(1, color.replace(')', ', 0)').replace('rgb', 'rgba'));
        ctx.fillStyle = gradient;
        ctx.fill();
      });
      
      // Draw legend for multiple datasets
      if (datasets.length > 1) {
        let legendX = padding;
        labelArray.forEach((legendLabel, index) => {
          const color = colorArray[index] || colorArray[0];
          
          ctx.fillStyle = color;
          ctx.fillRect(legendX, height - 25, 12, 12);
          
          ctx.fillStyle = 'var(--text-secondary)';
          ctx.font = '12px -apple-system, BlinkMacSystemFont, SF Pro Display';
          ctx.fillText(legendLabel, legendX + 18, height - 15);
          
          legendX += ctx.measureText(legendLabel).width + 40;
        });
      }
    }

    updateDetailedStats(metrics) {
      // CPU details
      this.updateStatValue('cpu-cores', `${metrics.cpu.core_count} cores`);
      this.updateStatValue('cpu-load', `${metrics.cpu.load1.toFixed(2)} / ${metrics.cpu.load5.toFixed(2)} / ${metrics.cpu.load15.toFixed(2)}`);
      
      // Memory details
      const memUsedGB = (metrics.memory.used / 1024 / 1024 / 1024).toFixed(1);
      const memTotalGB = (metrics.memory.total / 1024 / 1024 / 1024).toFixed(1);
      this.updateStatValue('memory-usage', `${memUsedGB} GB / ${memTotalGB} GB`);
      this.updateStatValue('memory-pressure', metrics.memory.pressure || 'normal');
      
      // Disk details
      if (metrics.disks.length > 0) {
        const disk = metrics.disks[0];
        const usedGB = (disk.used / 1024 / 1024 / 1024).toFixed(1);
        const totalGB = (disk.total / 1024 / 1024 / 1024).toFixed(1);
        this.updateStatValue('disk-usage', `${usedGB} GB / ${totalGB} GB`);
        this.updateStatValue('disk-mount', disk.mount);
      }
      
      // Battery details
      if (metrics.batteries.length > 0) {
        const battery = metrics.batteries[0];
        this.updateStatValue('battery-percent', `${battery.percent.toFixed(0)}%`);
        this.updateStatValue('battery-status', battery.status);
        this.updateStatValue('battery-health', `${battery.health} (${battery.cycle_count} cycles)`);
      }
      
      // GPU details
      if (metrics.gpu.length > 0) {
        const gpu = metrics.gpu[0];
        this.updateStatValue('gpu-name', gpu.name);
        this.updateStatValue('gpu-usage', `${gpu.usage.toFixed(1)}%`);
      }
      
      // Network details
      const networkList = this.container.querySelector('#network-interfaces');
      if (networkList) {
        networkList.innerHTML = metrics.network.map(iface => `
          <div class="network-item">
            <div class="network-name">${iface.name}</div>
            <div class="network-stats">
              <span class="stat-rx">↓ ${iface.rx_rate_mbs.toFixed(2)} MB/s</span>
              <span class="stat-tx">↑ ${iface.tx_rate_mbs.toFixed(2)} MB/s</span>
            </div>
          </div>
        `).join('');
      }
      
      // Top processes
      const processList = this.container.querySelector('#top-processes');
      if (processList && metrics.top_processes) {
        processList.innerHTML = metrics.top_processes.slice(0, 10).map(proc => `
          <div class="process-item">
            <div class="process-info">
              <div class="process-name">${proc.name}</div>
              <div class="process-pid">PID: ${proc.pid}</div>
            </div>
            <div class="process-stats">
              <span class="process-cpu">${proc.cpu.toFixed(1)}%</span>
              <span class="process-memory">${proc.memory.toFixed(1)}%</span>
            </div>
          </div>
        `).join('');
      }
    }

    updateStatValue(id, value) {
      const el = this.container.querySelector(`#${id}`);
      if (el) {
        el.textContent = value;
      }
    }

    renderStartScreen() {
      if (!this.container) return;
      
      this.container.innerHTML = `
        <div class="page-grid">
          <div class="page-left">
            <div class="page-info">
              <h1 class="page-title">Status</h1>
              <p class="page-description">Monitor your Mac's health with real-time system metrics and performance indicators.</p>
              <div class="info-list">
                <div class="info-item">
                  <div class="info-item-icon">
                    <i data-lucide="cpu"></i>
                  </div>
                  <div class="info-item-content">
                    <h3 class="info-item-title">CPU & Memory</h3>
                    <p class="info-item-description">Real-time processor and RAM usage</p>
                  </div>
                </div>
                <div class="info-item">
                  <div class="info-item-icon">
                    <i data-lucide="hard-drive"></i>
                  </div>
                  <div class="info-item-content">
                    <h3 class="info-item-title">Disk & Network</h3>
                    <p class="info-item-description">Monitor storage and network activity</p>
                  </div>
                </div>
                <div class="info-item">
                  <div class="info-item-icon">
                    <i data-lucide="battery"></i>
                  </div>
                  <div class="info-item-content">
                    <h3 class="info-item-title">Battery Health</h3>
                    <p class="info-item-description">Check battery status and cycle count</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="page-right">
            <div class="page-visual">
              <div class="visual-icon">
                <i data-lucide="activity"></i>
              </div>
            </div>
          </div>
        </div>
        <div class="page-actions">
          <button class="action-button" id="start-monitoring-btn">
            Start Monitoring
          </button>
        </div>
      `;

      // Initialize lucide icons
      if (window.lucide) {
        lucide.createIcons();
      }

      // Attach event listener
      const startBtn = this.container.querySelector('#start-monitoring-btn');
      if (startBtn) {
        startBtn.addEventListener('click', () => this.startMonitoring());
      }
    }

    renderMonitoringView() {
      if (!this.container) return;
      
      this.container.innerHTML = `
        <div class="status-monitoring-view">
          <div class="monitoring-header">
            <div class="monitoring-title">
              <i data-lucide="activity"></i>
              <h2>System Monitor</h2>
              <span class="live-indicator">
                <span class="live-dot"></span>
                Live
              </span>
            </div>
            <button class="secondary-button" id="stop-monitoring-btn">
              <i data-lucide="square"></i>
              <span>Stop</span>
            </button>
          </div>

          <div class="monitoring-layout">
            <!-- Left Sidebar: Metrics -->
            <div class="metrics-sidebar">
              <!-- Quick Stats -->
              <div class="metrics-card">
                <div class="card-title">Quick Stats</div>
                <div class="quick-stats-list">
                  <div class="quick-stat-item">
                    <i data-lucide="cpu"></i>
                    <div class="quick-stat-content">
                      <div class="quick-stat-label">CPU</div>
                      <div class="quick-stat-value"><span id="cpu-value">0.0</span>%</div>
                    </div>
                    <div class="quick-stat-progress">
                      <div id="cpu-progress" class="progress-bar"></div>
                    </div>
                  </div>

                  <div class="quick-stat-item">
                    <i data-lucide="memory-stick"></i>
                    <div class="quick-stat-content">
                      <div class="quick-stat-label">Memory</div>
                      <div class="quick-stat-value"><span id="memory-value">0.0</span>%</div>
                    </div>
                    <div class="quick-stat-progress">
                      <div id="memory-progress" class="progress-bar"></div>
                    </div>
                  </div>

                  <div class="quick-stat-item">
                    <i data-lucide="hard-drive"></i>
                    <div class="quick-stat-content">
                      <div class="quick-stat-label">Disk</div>
                      <div class="quick-stat-value"><span id="disk-value">0.0</span>%</div>
                    </div>
                    <div class="quick-stat-progress">
                      <div id="disk-progress" class="progress-bar"></div>
                    </div>
                  </div>

                  <div class="quick-stat-item">
                    <i data-lucide="heart-pulse"></i>
                    <div class="quick-stat-content">
                      <div class="quick-stat-label">Health</div>
                      <div class="quick-stat-value"><span id="health-value">0</span>/100</div>
                    </div>
                    <div class="quick-stat-progress">
                      <div id="health-progress" class="progress-bar"></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- System Info -->
              <div class="metrics-card">
                <div class="card-title">System Info</div>
                <div class="info-sections">
                  <div class="info-section">
                    <div class="info-section-title">CPU</div>
                    <div class="info-item">
                      <span class="info-label">Cores</span>
                      <span class="info-value" id="cpu-cores">-</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Load</span>
                      <span class="info-value" id="cpu-load">-</span>
                    </div>
                  </div>

                  <div class="info-section">
                    <div class="info-section-title">Memory</div>
                    <div class="info-item">
                      <span class="info-label">Usage</span>
                      <span class="info-value" id="memory-usage">-</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Pressure</span>
                      <span class="info-value" id="memory-pressure">-</span>
                    </div>
                  </div>

                  <div class="info-section">
                    <div class="info-section-title">Disk</div>
                    <div class="info-item">
                      <span class="info-label">Usage</span>
                      <span class="info-value" id="disk-usage">-</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Mount</span>
                      <span class="info-value" id="disk-mount">-</span>
                    </div>
                  </div>

                  <div class="info-section">
                    <div class="info-section-title">Battery</div>
                    <div class="info-item">
                      <span class="info-label">Charge</span>
                      <span class="info-value" id="battery-percent">-</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Status</span>
                      <span class="info-value" id="battery-status">-</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Health</span>
                      <span class="info-value" id="battery-health">-</span>
                    </div>
                  </div>

                  <div class="info-section">
                    <div class="info-section-title">GPU</div>
                    <div class="info-item">
                      <span class="info-label">Name</span>
                      <span class="info-value" id="gpu-name">-</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Usage</span>
                      <span class="info-value" id="gpu-usage">-</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Network -->
              <div class="metrics-card">
                <div class="card-title">Network</div>
                <div id="network-interfaces" class="network-list">
                  <!-- Populated dynamically -->
                </div>
              </div>

              <!-- Top Processes -->
              <div class="metrics-card">
                <div class="card-title">Top Processes</div>
                <div id="top-processes" class="processes-list">
                  <!-- Populated dynamically -->
                </div>
              </div>
            </div>

            <!-- Right Content: Graphs -->
            <div class="graphs-content">
              <div class="graph-card">
                <h3>CPU Usage</h3>
                <canvas id="cpu-graph" width="600" height="180"></canvas>
              </div>

              <div class="graph-card">
                <h3>Memory Usage</h3>
                <canvas id="memory-graph" width="600" height="180"></canvas>
              </div>

              <div class="graph-card">
                <h3>Network Activity</h3>
                <canvas id="network-graph" width="600" height="180"></canvas>
              </div>

              <div class="graph-card">
                <h3>Disk I/O</h3>
                <canvas id="disk-io-graph" width="600" height="180"></canvas>
              </div>
            </div>
          </div>
        </div>
      `;

      // Initialize lucide icons
      if (window.lucide) {
        lucide.createIcons();
      }

      // Attach event listener
      const stopBtn = this.container.querySelector('#stop-monitoring-btn');
      if (stopBtn) {
        stopBtn.addEventListener('click', () => this.stopMonitoring());
      }
    }
  }

  // Export to global scope
  window.statusPage = new StatusPage();
})();
