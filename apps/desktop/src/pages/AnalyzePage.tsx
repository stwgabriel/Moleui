import { StartScreen } from '@/components/common/StartScreen';
import type { PageConfig } from '@/types';

const config: PageConfig = {
  title: 'Analyze',
  description: 'Visualize disk usage and identify large files and folders consuming your storage.',
  icon: 'PieChart',
  buttonText: 'Analyze Storage',
  items: [
    {
      icon: 'BarChart3',
      title: 'Disk Usage Map',
      description: 'Interactive visualization of storage usage',
    },
    {
      icon: 'FolderOpen',
      title: 'Large Files',
      description: 'Quickly identify space-hogging files',
    },
    {
      icon: 'Layers',
      title: 'Category Breakdown',
      description: 'See storage by file type and category',
    },
  ],
};

export function AnalyzePage() {
  const handleStart = () => {
    console.log('Starting disk analysis...');
    // TODO: Implement analyze logic (similar to original analyze-page.js)
  };

  return <StartScreen config={config} onStart={handleStart} />;
}
