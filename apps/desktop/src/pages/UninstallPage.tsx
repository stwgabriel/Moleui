import { StartScreen } from '@/components/common/StartScreen';
import type { PageConfig } from '@/types';

const config: PageConfig = {
  title: 'Uninstall',
  description: 'Completely remove applications and all their associated files from your system.',
  icon: 'PackageX',
  buttonText: 'Scan Applications',
  items: [
    {
      icon: 'Search',
      title: 'Deep Scan',
      description: 'Find all app-related files and folders',
    },
    {
      icon: 'Trash',
      title: 'Complete Removal',
      description: 'Delete apps with all preferences and caches',
    },
    {
      icon: 'Shield',
      title: 'Safe Uninstall',
      description: 'Protected system files remain untouched',
    },
  ],
};

export function UninstallPage() {
  const handleStart = () => {
    console.log('Starting uninstall scan...');
    // TODO: Implement uninstall logic (similar to original uninstall-page.js)
  };

  return <StartScreen config={config} onStart={handleStart} />;
}
