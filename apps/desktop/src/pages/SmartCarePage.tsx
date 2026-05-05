import { StartScreen } from '@/components/common/StartScreen';
import type { PageConfig } from '@/types';

const config: PageConfig = {
  title: 'Smart Care',
  description:
    'Automatically maintain your Mac with intelligent cleaning and optimization routines.',
  icon: 'Sparkles',
  buttonText: 'Start Smart Care',
  items: [
    {
      icon: 'ShieldCheck',
      title: 'Safe & Intelligent',
      description: 'AI-powered cleaning that protects important files',
    },
    {
      icon: 'Clock',
      title: 'Scheduled Maintenance',
      description: 'Set it and forget it with automated care routines',
    },
    {
      icon: 'TrendingUp',
      title: 'Performance Boost',
      description: 'Keep your Mac running at peak performance',
    },
  ],
};

export function SmartCarePage() {
  const handleStart = () => {
    console.log('Starting Smart Care...');
    // TODO: Implement smart care logic
  };

  return <StartScreen config={config} onStart={handleStart} />;
}
