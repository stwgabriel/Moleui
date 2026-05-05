import { StartScreen } from '@/components/common/StartScreen';
import type { PageConfig } from '@/types';

const config: PageConfig = {
  title: 'Status',
  description: 'Monitor your Mac\'s health with real-time system metrics and performance indicators.',
  icon: 'Activity',
  buttonText: 'Start Monitoring',
  items: [
    {
      icon: 'Cpu',
      title: 'CPU & Memory',
      description: 'Real-time processor and RAM usage',
    },
    {
      icon: 'HardDrive',
      title: 'Disk & Network',
      description: 'Monitor storage and network activity',
    },
    {
      icon: 'Battery',
      title: 'Battery Health',
      description: 'Check battery status and cycle count',
    },
  ],
};

export function StatusPage() {
  const handleStart = () => {
    console.log('Starting system monitoring...');
    // TODO: Implement status monitoring logic (similar to original status-page.js)
  };

  return <StartScreen config={config} onStart={handleStart} />;
}
