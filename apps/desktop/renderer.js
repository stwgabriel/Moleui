const pages = {
  smartcare: {
    title: "Smart Care",
    description: "Automatically maintain your Mac with intelligent cleaning and optimization routines.",
    icon: "sparkles",
    buttonText: "Start Smart Care",
    items: [
      {
        icon: "shield-check",
        title: "Safe & Intelligent",
        description: "AI-powered cleaning that protects important files"
      },
      {
        icon: "clock",
        title: "Scheduled Maintenance",
        description: "Set it and forget it with automated care routines"
      },
      {
        icon: "trending-up",
        title: "Performance Boost",
        description: "Keep your Mac running at peak performance"
      }
    ]
  },
  clean: {
    title: "Clean",
    description: "Remove unnecessary files, caches, and temporary data to free up valuable disk space.",
    icon: "trash-2",
    buttonText: "Start Cleaning",
    items: [
      {
        icon: "folder-x",
        title: "System Caches",
        description: "Clear system and application cache files"
      },
      {
        icon: "file-x",
        title: "Temporary Files",
        description: "Remove temporary and log files safely"
      },
      {
        icon: "hard-drive",
        title: "Free Up Space",
        description: "Reclaim gigabytes of wasted disk space"
      }
    ]
  },
  uninstall: {
    title: "Uninstall",
    description: "Completely remove applications and all their associated files from your system.",
    icon: "package-x",
    buttonText: "Scan Applications",
    items: [
      {
        icon: "search",
        title: "Deep Scan",
        description: "Find all app-related files and folders"
      },
      {
        icon: "trash",
        title: "Complete Removal",
        description: "Delete apps with all preferences and caches"
      },
      {
        icon: "shield",
        title: "Safe Uninstall",
        description: "Protected system files remain untouched"
      }
    ]
  },
  optimize: {
    title: "Optimize",
    description: "Fine-tune your Mac's performance with system optimization and maintenance tasks.",
    icon: "zap",
    buttonText: "Start Optimization",
    items: [
      {
        icon: "cpu",
        title: "System Tuning",
        description: "Optimize system settings for better performance"
      },
      {
        icon: "database",
        title: "Database Repair",
        description: "Rebuild and optimize system databases"
      },
      {
        icon: "refresh-cw",
        title: "Memory Management",
        description: "Clear inactive memory and improve responsiveness"
      }
    ]
  },
  analyze: {
    title: "Analyze",
    description: "Visualize disk usage and identify large files and folders consuming your storage.",
    icon: "pie-chart",
    buttonText: "Analyze Storage",
    items: [
      {
        icon: "bar-chart-3",
        title: "Disk Usage Map",
        description: "Interactive visualization of storage usage"
      },
      {
        icon: "folder-open",
        title: "Large Files",
        description: "Quickly identify space-hogging files"
      },
      {
        icon: "layers",
        title: "Category Breakdown",
        description: "See storage by file type and category"
      }
    ]
  },
  status: {
    title: "Status",
    description: "Monitor your Mac's health with real-time system metrics and performance indicators.",
    icon: "activity",
    buttonText: "Refresh Status",
    items: [
      {
        icon: "cpu",
        title: "CPU & Memory",
        description: "Real-time processor and RAM usage"
      },
      {
        icon: "thermometer",
        title: "Temperature",
        description: "Monitor system temperature and fan speed"
      },
      {
        icon: "battery",
        title: "Battery Health",
        description: "Check battery status and cycle count"
      }
    ]
  }
};

const pageOrder = ["smartcare", "clean", "uninstall", "optimize", "analyze", "status"];
const defaultPage = "smartcare";

let currentPageId = null; // Start as null to ensure first render happens
let isTransitioning = false;

const page = document.querySelector("#page");
const shell = document.querySelector("#shell");
const sidebar = document.querySelector("#sidebar");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const sidebarHeaderToggle = document.querySelector("#sidebar-header-toggle");

function getCurrentPageId() {
  const pageId = window.location.hash.replace("#", "").trim().toLowerCase();
  return pages[pageId] ? pageId : defaultPage;
}

function getPageDirection(fromPageId, toPageId) {
  const fromIndex = pageOrder.indexOf(fromPageId);
  const toIndex = pageOrder.indexOf(toPageId);
  return toIndex > fromIndex ? 'down' : 'up';
}

function buildPageHTML(pageData) {
  const currentHash = window.location.hash;
  
  // Special handling for interactive pages
  if (currentHash === '#uninstall') {
    return `<div id="uninstall-container" class="uninstall-container"></div>`;
  }
  
  if (currentHash === '#status') {
    return `<div id="status-container" class="status-container"></div>`;
  }
  
  if (currentHash === '#clean') {
    return `<div id="clean-container" class="clean-container"></div>`;
  }
  
  if (currentHash === '#optimize') {
    return `<div id="optimize-container" class="optimize-container"></div>`;
  }
  
  if (currentHash === '#analyze') {
    return `<div id="analyze-container" class="analyze-container"></div>`;
  }
  
  const itemsHTML = pageData.items.map(item => `
    <div class="info-item">
      <div class="info-item-icon">
        <i data-lucide="${item.icon}"></i>
      </div>
      <div class="info-item-content">
        <h3 class="info-item-title">${item.title}</h3>
        <p class="info-item-description">${item.description}</p>
      </div>
    </div>
  `).join('');
  
  return `
    <div class="page-grid">
      <div class="page-left">
        <div class="page-info">
          <h1 class="page-title">${pageData.title}</h1>
          <p class="page-description">${pageData.description}</p>
          <div class="info-list">
            ${itemsHTML}
          </div>
        </div>
      </div>
      <div class="page-right">
        <div class="page-visual">
          <div class="visual-icon">
            <i data-lucide="${pageData.icon}"></i>
          </div>
        </div>
      </div>
    </div>
    <div class="page-actions">
      <button class="action-button" id="action-button">
        ${pageData.buttonText}
      </button>
    </div>
  `;
}

function renderPage() {
  if (isTransitioning) return;
  
  const newPageId = getCurrentPageId();
  
  // If it's the same page, just update nav
  if (newPageId === currentPageId) {
    updateActiveNav(newPageId);
    return;
  }
  
  const newPageData = pages[newPageId];
  const direction = getPageDirection(currentPageId, newPageId);
  
  document.title = `Mole Desktop - ${newPageData.title}`;
  page.setAttribute("aria-label", `${newPageData.title} page`);
  
  // Update active nav item
  updateActiveNav(newPageId);
  
  // Get the page content container
  const pageContent = document.querySelector("#page-content");
  
  // If this is the first render, just set the content
  if (!pageContent.querySelector('.page-content-wrapper')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'page-content-wrapper initial-load';
    wrapper.innerHTML = buildPageHTML(newPageData);
    pageContent.appendChild(wrapper);
    
    // Reinitialize lucide icons
    if (window.lucide) {
      lucide.createIcons();
    }
    
    // Initialize page-specific modules
    initializePageModule(newPageId, wrapper);
    
    currentPageId = newPageId;
    return;
  }
  
  // Start transition
  isTransitioning = true;
  pageContent.classList.add('transitioning');
  
  // Get old wrapper and remove any previous animation classes
  const oldWrapper = pageContent.querySelector('.page-content-wrapper');
  oldWrapper.classList.remove('slide-out-down', 'slide-out-up', 'slide-in-down', 'slide-in-up');
  
  // Create new wrapper
  const newWrapper = document.createElement('div');
  newWrapper.className = 'page-content-wrapper';
  newWrapper.innerHTML = buildPageHTML(newPageData);
  
  // Determine animation classes based on direction
  const slideOutClass = direction === 'down' ? 'slide-out-up' : 'slide-out-down';
  const slideInClass = direction === 'down' ? 'slide-in-up' : 'slide-in-down';
  
  // Add new wrapper (initially hidden)
  pageContent.appendChild(newWrapper);
  
  // Force reflow to ensure animations trigger
  void newWrapper.offsetWidth;
  void oldWrapper.offsetWidth;
  
  // Start animations
  requestAnimationFrame(() => {
    newWrapper.classList.add(slideInClass);
    oldWrapper.classList.add(slideOutClass);
  });
  
  // Cleanup old page
  if (currentPageId === 'status' && window.statusPage) {
    window.statusPage.destroy();
  }
  if (currentPageId === 'uninstall' && window.uninstallPage) {
    window.uninstallPage.destroy();
  }
  if (currentPageId === 'clean' && window.cleanPage) {
    window.cleanPage.destroy();
  }
  if (currentPageId === 'optimize' && window.optimizePage) {
    window.optimizePage.destroy();
  }
  if (currentPageId === 'analyze' && window.analyzePage) {
    window.analyzePage.destroy();
  }
  
  // Reinitialize lucide icons for new content
  if (window.lucide) {
    lucide.createIcons();
  }
  
  // Initialize page modules using helper function
  initializePageModule(newPageId, newWrapper);
  
  // Clean up after animation
  setTimeout(() => {
    oldWrapper.remove();
    pageContent.classList.remove('transitioning');
    isTransitioning = false;
    currentPageId = newPageId;
  }, 400);
  
  if (window.location.hash.slice(1) !== newPageId) {
    window.location.hash = newPageId;
  }
}

function updateActiveNav(pageId) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageId);
  });
}

function initializePageModule(pageId, wrapper) {
  // Initialize pages based on route
  try {
    if (pageId === 'uninstall') {
      const uninstallContainer = wrapper.querySelector('#uninstall-container');
      if (uninstallContainer && window.uninstallPage) {
        window.uninstallPage.init(uninstallContainer);
      } else if (uninstallContainer && !window.uninstallPage) {
        console.error('uninstallPage module not loaded');
      }
    }
    
    if (pageId === 'status') {
      const statusContainer = wrapper.querySelector('#status-container');
      if (statusContainer && window.statusPage) {
        window.statusPage.init(statusContainer);
      } else if (statusContainer && !window.statusPage) {
        console.error('statusPage module not loaded');
      }
    }
    
    if (pageId === 'clean') {
      const cleanContainer = wrapper.querySelector('#clean-container');
      if (cleanContainer && window.cleanPage) {
        window.cleanPage.init(cleanContainer);
      } else if (cleanContainer && !window.cleanPage) {
        console.error('cleanPage module not loaded');
      }
    }
    
    if (pageId === 'optimize') {
      const optimizeContainer = wrapper.querySelector('#optimize-container');
      if (optimizeContainer && window.optimizePage) {
        window.optimizePage.init(optimizeContainer);
      } else if (optimizeContainer && !window.optimizePage) {
        console.error('optimizePage module not loaded');
      }
    }
    
    if (pageId === 'analyze') {
      const analyzeContainer = wrapper.querySelector('#analyze-container');
      if (analyzeContainer && window.analyzePage) {
        window.analyzePage.init(analyzeContainer);
      } else if (analyzeContainer && !window.analyzePage) {
        console.error('analyzePage module not loaded');
      }
    }
  } catch (error) {
    console.error(`Error initializing ${pageId} page:`, error);
  }
}

function updateToggleIcons(isCollapsed) {
  const iconName = isCollapsed ? "panel-left-open" : "panel-left-close";
  
  // Update both toggle buttons
  [sidebarToggle, sidebarHeaderToggle].forEach(toggle => {
    const icon = toggle.querySelector("i");
    if (icon) {
      icon.setAttribute("data-lucide", iconName);
    }
  });
  
  // Reinitialize lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function setSidebarCollapsed(isCollapsed) {
  sidebar.classList.toggle("is-collapsed", isCollapsed);
  sidebar.classList.toggle("is-expanded", !isCollapsed);
  shell.style.setProperty("--sidebar-width", isCollapsed ? "76px" : "280px");
  
  [sidebarToggle, sidebarHeaderToggle].forEach(toggle => {
    toggle.setAttribute("aria-expanded", String(!isCollapsed));
    toggle.setAttribute("aria-label", isCollapsed ? "Expand sidebar" : "Collapse sidebar");
  });
  
  updateToggleIcons(isCollapsed);
}

sidebarToggle.addEventListener("click", () => {
  setSidebarCollapsed(!sidebar.classList.contains("is-collapsed"));
});

sidebarHeaderToggle.addEventListener("click", () => {
  setSidebarCollapsed(!sidebar.classList.contains("is-collapsed"));
});

// Initialize page after all scripts are loaded
function initializeApp() {
  // Render immediately - don't wait for all modules
  // Menu pages (smartcare) don't need modules to render
  renderPage();
  window.addEventListener("hashchange", renderPage);
  
  // Log module loading status for debugging
  const checkModulesLoaded = () => {
    const modules = {
      statusPage: !!window.statusPage,
      uninstallPage: !!window.uninstallPage,
      cleanPage: !!window.cleanPage,
      optimizePage: !!window.optimizePage,
      analyzePage: !!window.analyzePage
    };
    
    const allLoaded = Object.values(modules).every(loaded => loaded);
    
    if (!allLoaded) {
      console.warn('Some page modules not loaded:', modules);
    } else {
      console.log('All page modules loaded successfully');
    }
  };
  
  // Check module status after a delay (for debugging)
  setTimeout(checkModulesLoaded, 100);
}

// Initialize lucide icons
if (window.lucide) {
  lucide.createIcons();
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
