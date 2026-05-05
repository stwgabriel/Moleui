import { StartScreen } from '@/components/common/StartScreen';
import type { PageConfig } from '@/types';

const config: PageConfig = {
  title: 'Optimize',
  description: 'Fine-tune your Mac\'s performance with system optimization and maintenance tasks.',
  icon: 'Zap',
  buttonText: 'Start Optimization',
  items: [
    {
      icon: 'Cpu',
      title: 'System Tuning',
      description: 'Optimize system settings for better performance',
    },
    {
      icon: 'Database',
      title: 'Database Repair',
      description: 'Rebuild and optimize system databases',
    },
    {
      icon: 'RefreshCw',
      title: 'Memory Management',
      description: 'Clear inactive memory and improve responsiveness',
    },
  ],
};

export function OptimizePage() {
  const handleStart = () => {
    console.log('Starting optimization...');
    // TODO: Implement optimize logic (similar to original optimize-page.js)
  };

  return <StartScreen config={config} onStart={handleStart} />;
}
