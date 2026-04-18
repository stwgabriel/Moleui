const runtimeInfo = document.querySelector("#runtime-info");
const output = document.querySelector("#command-output");
const button = document.querySelector("#run-status");
const liveStatus = document.querySelector("#live-status");
const statusDashboard = document.querySelector("#status-dashboard");
const rawOutput = document.querySelector("#command-raw-output");
const minimizeButton = document.querySelector("#window-minimize");
const maximizeButton = document.querySelector("#window-maximize");
const maximizeIcon = document.querySelector("#window-maximize-icon");
const closeButton = document.querySelector("#window-close");

const healthScore = document.querySelector("#health-score");
const healthMessage = document.querySelector("#health-message");
const hostName = document.querySelector("#host-name");
const platformName = document.querySelector("#platform-name");
const cpuCard = document.querySelector("#cpu-card");
const memoryCard = document.querySelector("#memory-card");
const diskCard = document.querySelector("#disk-card");
const powerCard = document.querySelector("#power-card");
const processList = document.querySelector("#process-list");
const networkCard = document.querySelector("#network-card");

const REFRESH_INTERVAL_MS = 2000;

let isRefreshing = false;
let refreshTimeoutId = null;
let lastSnapshotAt = null;
let removeWindowStateListener = null;

function applyWindowState(state) {
  const isMaximized = Boolean(state?.isMaximized);

  maximizeButton.title = isMaximized ? "Restore" : "Maximize";
  maximizeButton.setAttribute("aria-label", isMaximized ? "Restore window" : "Maximize window");
  maximizeIcon.textContent = isMaximized ? "[]" : "+";
}

function renderBlock(value) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function escapeHtml(value) {
  return String(value ?? "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return `${Math.round(value)}%`;
}

function formatRate(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0 MB/s";
  }

  if (value < 0.01) {
    return "0 MB/s";
  }

  if (value < 1) {
    return `${value.toFixed(2)} MB/s`;
  }

  if (value < 10) {
    return `${value.toFixed(1)} MB/s`;
  }

  return `${Math.round(value)} MB/s`;
}

function formatFixed(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return value.toFixed(1);
}

function formatLoad(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  if (Math.abs(value) >= 1000) {
    return value.toExponential(1).replace("e+", "E+");
  }

  return value.toFixed(2);
}

function formatTemperature(value) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return "-";
  }

  return `${value.toFixed(1)}°C`;
}

function formatBytes(bytes, decimals = 1) {
  if (typeof bytes !== "number" || Number.isNaN(bytes) || bytes < 0) {
    return "-";
  }

  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : decimals)} ${units[exponent]}`;
}

function formatShortBytes(bytes) {
  return formatBytes(bytes, 0);
}

function formatBatteryWattage(value) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return null;
  }

  return `${Math.round(value)}W`;
}

function getUsageTone(percent) {
  if (typeof percent !== "number" || Number.isNaN(percent)) {
    return "muted";
  }

  if (percent >= 85) {
    return "danger";
  }

  if (percent >= 60) {
    return "warn";
  }

  return "ok";
}

function getBatteryTone(percent) {
  if (typeof percent !== "number" || Number.isNaN(percent)) {
    return "muted";
  }

  if (percent < 20) {
    return "danger";
  }

  if (percent < 50) {
    return "warn";
  }

  return "ok";
}

function getTemperatureTone(value) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return "muted";
  }

  if (value >= 76) {
    return "danger";
  }

  if (value >= 56) {
    return "warn";
  }

  return "ok";
}

function progressBar(percent, variant = "usage") {
  if (typeof percent !== "number" || Number.isNaN(percent)) {
    return { text: "░░░░░░░░░░░░░░░░", tone: "muted" };
  }

  const normalized = Math.max(0, Math.min(percent, 100));
  const total = 16;
  const filled = Math.round((normalized / 100) * total);
  const tone = variant === "battery" ? getBatteryTone(normalized) : getUsageTone(normalized);

  return {
    text: `${"█".repeat(filled)}${"░".repeat(total - filled)}`,
    tone,
  };
}

function miniBar(percent) {
  if (typeof percent !== "number" || Number.isNaN(percent)) {
    return { text: "▯▯▯▯▯", tone: "muted" };
  }

  const normalized = Math.max(0, Math.min(percent, 100));
  const filled = Math.max(0, Math.min(Math.floor(normalized / 20), 5));
  return {
    text: `${"▮".repeat(filled)}${"▯".repeat(5 - filled)}`,
    tone: getUsageTone(normalized),
  };
}

function ioBar(rate) {
  if (typeof rate !== "number" || Number.isNaN(rate)) {
    return { text: "▯▯▯▯▯", tone: "muted" };
  }

  const filled = Math.max(0, Math.min(Math.floor(rate / 10), 5));
  let tone = "ok";

  if (rate > 80) {
    tone = "danger";
  } else if (rate > 30) {
    tone = "warn";
  }

  return {
    text: `${"▮".repeat(filled)}${"▯".repeat(5 - filled)}`,
    tone,
  };
}

function sparkline(history, current, width = 16) {
  const blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const values = Array.isArray(history) ? history.slice(-width) : [];

  while (values.length < width) {
    values.unshift(0);
  }

  const maxValue = Math.max(0.1, ...values);
  const text = values
    .map((value) => {
      const level = Math.max(
        0,
        Math.min(blocks.length - 1, Math.floor((value / maxValue) * (blocks.length - 1))),
      );
      return blocks[level];
    })
    .join("");

  let tone = "ok";
  if (current > 8) {
    tone = "danger";
  } else if (current > 3) {
    tone = "warn";
  }

  return { text, tone };
}

function toneSpan(text, tone) {
  return `<span class="tone-${tone}">${escapeHtml(text)}</span>`;
}

function valueSpan(text, tone = "default") {
  return `<span class="status-value${tone === "default" ? "" : ` tone-${tone}`}">${escapeHtml(text)}</span>`;
}

function barSpan(bar) {
  return `<span class="status-bar tone-${bar.tone}">${escapeHtml(bar.text)}</span>`;
}

function renderLine(label, content) {
  return `<div class="status-line"><span class="status-label">${escapeHtml(label)}</span><span class="status-content">${content}</span></div>`;
}

function renderPlainLine(text, tone = "default") {
  return `<div class="status-line status-line-plain${tone === "default" ? "" : ` tone-${tone}`}">${escapeHtml(text)}</div>`;
}

function renderJoined(parts, separator = " · ") {
  return parts.filter(Boolean).join(`<span class="tone-subtle">${escapeHtml(separator)}</span>`);
}

function formatProcessLabel(process) {
  const name = String(process?.name ?? "Unknown");
  return name.length > 12 ? `${name.slice(0, 9)}...` : name;
}

function setMessage(message, tone = "muted") {
  output.textContent = message;
  output.dataset.tone = tone;
}

function formatTime(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return "-";
  }

  return value.toLocaleTimeString();
}

function setLiveStatus(message, tone = "muted") {
  liveStatus.textContent = message;
  liveStatus.dataset.tone = tone;
}

function showDashboard() {
  statusDashboard.hidden = false;
}

function hideDashboard() {
  statusDashboard.hidden = true;
}

function renderProcesses(processes) {
  if (!Array.isArray(processes) || processes.length === 0) {
    processList.innerHTML = renderPlainLine("No data", "subtle");
    return;
  }

  processList.innerHTML = processes
    .slice(0, 3)
    .map((process) => {
      const bar = miniBar(process.cpu);
      return renderLine(
        formatProcessLabel(process),
        `${barSpan(bar)} ${valueSpan(`${formatFixed(process.cpu)}%`)}`,
      );
    })
    .join("");
}

function renderCPUCard(cpu, thermal) {
  const totalBar = progressBar(cpu.usage);
  const lines = [
    renderLine(
      "Total",
      `${barSpan(totalBar)} ${valueSpan(`${formatFixed(cpu.usage)}%`)}${
        thermal.cpu_temp > 0
          ? ` <span class="tone-subtle">@</span> ${valueSpan(formatTemperature(thermal.cpu_temp), getTemperatureTone(thermal.cpu_temp))}`
          : ""
      }`,
    ),
  ];

  if (Array.isArray(cpu.per_core) && cpu.per_core.length > 0 && !cpu.per_core_estimated) {
    cpu.per_core
      .map((value, index) => ({ index, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 3)
      .forEach((core) => {
        lines.push(
          renderLine(
            `Core${core.index + 1}`,
            `${barSpan(progressBar(core.value))} ${valueSpan(`${formatFixed(core.value)}%`)}`,
          ),
        );
      });
  } else {
    lines.push(renderPlainLine("Per-core data unavailable, using averaged load", "subtle"));
  }

  const coreSummary =
    cpu.p_core_count > 0 && cpu.e_core_count > 0
      ? `${cpu.p_core_count}P+${cpu.e_core_count}E`
      : `${cpu.logical_cpu ?? cpu.core_count ?? "-"} cores`;

  lines.push(
    renderLine(
      "Load",
      `${valueSpan(`${formatLoad(cpu.load1)} / ${formatLoad(cpu.load5)} / ${formatLoad(cpu.load15)}`)} <span class="tone-subtle">${escapeHtml(`, ${coreSummary}`)}</span>`,
    ),
  );

  cpuCard.innerHTML = lines.join("");
}

function renderMemoryCard(memory) {
  const usedBar = progressBar(memory.used_percent);
  const freePercent = typeof memory.used_percent === "number" ? 100 - memory.used_percent : null;
  const freeBar = progressBar(freePercent);
  const lines = [
    renderLine("Used", `${barSpan(usedBar)} ${valueSpan(`${formatFixed(memory.used_percent)}%`)}`),
    renderLine("Free", `${barSpan(freeBar)} ${valueSpan(`${formatFixed(freePercent)}%`)}`),
  ];

  if ((memory.swap_total ?? 0) > 0 || (memory.swap_used ?? 0) > 0) {
    const swapPercent = memory.swap_total
      ? (memory.swap_used / memory.swap_total) * 100
      : 0;
    lines.push(
      renderLine(
        "Swap",
        `${barSpan(progressBar(swapPercent))} ${valueSpan(`${formatFixed(swapPercent)}%`)} <span class="tone-subtle">${escapeHtml(`${formatBytes(memory.swap_used)} / ${formatBytes(memory.swap_total)}`)}</span>`,
      ),
    );
  }

  lines.push(
    renderLine("Total", valueSpan(`${formatBytes(memory.used)} / ${formatBytes(memory.total)}`)),
  );
  lines.push(
    renderLine(
      "Avail",
      valueSpan(
        typeof memory.total === "number" && typeof memory.used === "number"
          ? formatBytes(Math.max(0, memory.total - memory.used))
          : "-",
      ),
    ),
  );

  if (memory.pressure) {
    const tone = memory.pressure === "critical" ? "danger" : memory.pressure === "warn" ? "warn" : "ok";
    lines.push(renderPlainLine(`Status ${memory.pressure}`, tone));
  }

  memoryCard.innerHTML = lines.join("");
}

function renderDiskCard(disks, diskIo, hardware) {
  const lines = [];
  const diskList = Array.isArray(disks) ? disks : [];
  const internal = diskList.filter((disk) => !disk.external);
  const external = diskList.filter((disk) => disk.external);

  const appendDisks = (prefix, list) => {
    list.forEach((disk, index) => {
      const label = list.length <= 1 ? prefix : `${prefix}${index + 1}`;
      const free = typeof disk.total === "number" && typeof disk.used === "number"
        ? Math.max(0, disk.total - disk.used)
        : null;
      lines.push(
        renderLine(
          label,
          `${barSpan(progressBar(disk.used_percent))} <span>${valueSpan(`${formatShortBytes(disk.used)} used`)}<span class="tone-subtle">,</span> ${valueSpan(`${formatShortBytes(free)} free`)}</span>`,
        ),
      );
    });
  };

  appendDisks("INTR", internal);
  appendDisks("EXTR", external);

  if (lines.length === 0) {
    lines.push(renderPlainLine("Collecting...", "subtle"));
  } else if (diskList.length === 1) {
    const disk = diskList[0];
    const parts = [formatShortBytes(disk.total), disk.fstype ? String(disk.fstype).toUpperCase() : null].filter(Boolean);
    lines.push(renderLine("Total", valueSpan(parts.join(" "))));
  } else if (hardware.disk_size) {
    lines.push(renderLine("Total", valueSpan(hardware.disk_size)));
  }

  lines.push(
    renderLine("Read", `${barSpan(ioBar(diskIo.read_rate))} ${valueSpan(formatRate(diskIo.read_rate))}`),
  );
  lines.push(
    renderLine("Write", `${barSpan(ioBar(diskIo.write_rate))} ${valueSpan(formatRate(diskIo.write_rate))}`),
  );

  diskCard.innerHTML = lines.join("");
}

function renderPowerCard(batteries, thermal) {
  const lines = [];
  const battery = Array.isArray(batteries) ? batteries[0] : null;

  if (!battery) {
    lines.push(renderPlainLine("No battery", "subtle"));
    powerCard.innerHTML = lines.join("");
    return;
  }

  lines.push(
    renderLine(
      "Level",
      `${barSpan(progressBar(battery.percent, "battery"))} ${valueSpan(`${formatFixed(battery.percent)}%`)}`,
    ),
  );

  if (battery.capacity > 0) {
    lines.push(
      renderLine(
        "Health",
        `${barSpan(progressBar(battery.capacity, "battery"))} ${valueSpan(`${battery.capacity}%`)}`,
      ),
    );
  }

  const statusParts = [];
  if (battery.status) {
    const normalizedStatus = `${String(battery.status).charAt(0).toUpperCase()}${String(battery.status).slice(1).toLowerCase()}`;
    statusParts.push(valueSpan(normalizedStatus, getBatteryTone(battery.percent)));
  }
  if (battery.time_left) {
    statusParts.push(valueSpan(battery.time_left, "subtle"));
  }

  if (["charging", "charged"].includes(String(battery.status).toLowerCase())) {
    const wattage = formatBatteryWattage(thermal.system_power) || formatBatteryWattage(thermal.adapter_power);
    if (wattage) {
      statusParts.push(valueSpan(wattage, "ok"));
    }
    statusParts.push('<span class="tone-warn">⚡</span>');
  } else {
    const wattage = formatBatteryWattage(thermal.battery_power);
    if (wattage) {
      statusParts.push(valueSpan(wattage));
    }
  }

  lines.push(renderLine("Charged", renderJoined(statusParts)));

  const healthParts = [];
  if (battery.health) {
    healthParts.push(valueSpan(battery.health, "ok"));
  }
  if (battery.cycle_count > 0) {
    const cycleTone = battery.cycle_count > 900 ? "danger" : battery.cycle_count > 500 ? "warn" : "default";
    healthParts.push(valueSpan(`${battery.cycle_count} cycles`, cycleTone));
  }
  if (thermal.battery_temp > 0) {
    healthParts.push(valueSpan(`Battery ${formatTemperature(thermal.battery_temp)}`, getTemperatureTone(thermal.battery_temp)));
  }

  if (healthParts.length > 0) {
    lines.push(renderLine("Healthy", renderJoined(healthParts)));
  }

  powerCard.innerHTML = lines.join("");
}

function renderNetworkPanel(network, history, proxy) {
  const lines = [];
  const interfaces = Array.isArray(network) ? network : [];
  const totalRx = interfaces.reduce((sum, item) => sum + (item.rx_rate_mbs || 0), 0);
  const totalTx = interfaces.reduce((sum, item) => sum + (item.tx_rate_mbs || 0), 0);

  if (interfaces.length === 0) {
    lines.push(renderPlainLine("Collecting...", "subtle"));
    networkCard.innerHTML = lines.join("");
    return;
  }

  lines.push(
    renderLine(
      "Down",
      `${barSpan(sparkline(history?.rx_history, totalRx))} ${valueSpan(formatRate(totalRx))}`,
    ),
  );
  lines.push(
    renderLine(
      "Up",
      `${barSpan(sparkline(history?.tx_history, totalTx))} ${valueSpan(formatRate(totalTx))}`,
    ),
  );

  const primary = interfaces.find((item) => item.name === "en0" && item.ip) || interfaces.find((item) => item.ip);
  const proxyParts = [];
  if (proxy?.enabled) {
    proxyParts.push(valueSpan(`Proxy ${proxy.type ?? "Enabled"}`));
  }
  if (primary?.ip) {
    proxyParts.push(valueSpan(primary.ip));
  }
  if (proxyParts.length > 0) {
    lines.push(renderLine("Proxy", renderJoined(proxyParts)));
  }

  networkCard.innerHTML = lines.join("");
}

function renderStatusPayload(payload, rawText) {
  const hardware = payload.hardware ?? {};
  const cpu = payload.cpu ?? {};
  const memory = payload.memory ?? {};
  const diskIo = payload.disk_io ?? {};
  const thermal = payload.thermal ?? {};

  healthScore.textContent = String(payload.health_score ?? "-");
  healthMessage.textContent = payload.health_score_msg ?? "No health message returned.";
  hostName.textContent = payload.host ?? "-";
  platformName.textContent = [payload.platform, hardware.model, hardware.cpu_model, hardware.total_ram]
    .filter(Boolean)
    .join(" · ");

  renderCPUCard(cpu, thermal);
  renderMemoryCard(memory);
  renderDiskCard(payload.disks, diskIo, hardware);
  renderPowerCard(payload.batteries, thermal);
  renderNetworkPanel(payload.network, payload.network_history, payload.proxy);

  renderProcesses(payload.top_processes);
  rawOutput.textContent = rawText;
  showDashboard();

  const snapshotTime = payload.collected_at ? new Date(payload.collected_at) : new Date();
  lastSnapshotAt = snapshotTime;
  setMessage(`Rendered ${payload.host ?? "system"} status snapshot.`, "success");
  setLiveStatus(
    `Live refresh every ${REFRESH_INTERVAL_MS / 1000}s. Last update ${formatTime(snapshotTime)}.`,
    "success",
  );
}

async function loadRuntimeInfo() {
  try {
    const info = await window.moleDesktop.getRuntimeInfo();
    runtimeInfo.textContent = renderBlock(info);
  } catch (error) {
    runtimeInfo.textContent = error.message;
  }
}

function clearRefreshTimer() {
  if (refreshTimeoutId !== null) {
    window.clearTimeout(refreshTimeoutId);
    refreshTimeoutId = null;
  }
}

function scheduleNextRefresh() {
  clearRefreshTimer();

  if (document.hidden) {
    return;
  }

  refreshTimeoutId = window.setTimeout(() => {
    void runStatus({ silent: true });
  }, REFRESH_INTERVAL_MS);
}

async function runStatus(options = {}) {
  const { silent = false } = options;

  if (isRefreshing) {
    return;
  }

  isRefreshing = true;
  button.disabled = true;
  clearRefreshTimer();

  if (!silent) {
    setMessage("Running mole status --json...", "pending");
    hideDashboard();
  } else {
    setLiveStatus(
      `Refreshing live status${lastSnapshotAt ? ` from ${formatTime(lastSnapshotAt)}` : ""}...`,
      "pending",
    );
  }

  try {
    const result = await window.moleDesktop.runStatus();

    if (!result.ok) {
      rawOutput.textContent = renderBlock(result);
      setMessage(result.stderr || "Command failed.", "error");
      setLiveStatus("Live refresh failed. Retrying automatically.", "error");
      return;
    }

    const payload = JSON.parse(result.stdout);
    renderStatusPayload(payload, result.stdout);
  } catch (error) {
    rawOutput.textContent = error.message;
    setMessage(error.message, "error");
    setLiveStatus("Live refresh failed. Retrying automatically.", "error");
  } finally {
    isRefreshing = false;
    button.disabled = false;
    scheduleNextRefresh();
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    clearRefreshTimer();
    setLiveStatus(
      `Live refresh paused${lastSnapshotAt ? ` at ${formatTime(lastSnapshotAt)}` : ""}.`,
      "muted",
    );
    return;
  }

  void runStatus({ silent: true });
}

button.addEventListener("click", () => {
  void runStatus();
});

document.addEventListener("visibilitychange", handleVisibilityChange);
window.addEventListener("beforeunload", clearRefreshTimer);

minimizeButton.addEventListener("click", () => {
  void window.moleDesktop.minimizeWindow();
});

maximizeButton.addEventListener("click", async () => {
  const state = await window.moleDesktop.toggleMaximizeWindow();
  applyWindowState(state);
});

closeButton.addEventListener("click", () => {
  void window.moleDesktop.closeWindow();
});

removeWindowStateListener = window.moleDesktop.onWindowStateChange((state) => {
  applyWindowState(state);
});

window.addEventListener("beforeunload", () => {
  removeWindowStateListener?.();
});

void loadRuntimeInfo();
void window.moleDesktop.getWindowState().then(applyWindowState);
void runStatus();
