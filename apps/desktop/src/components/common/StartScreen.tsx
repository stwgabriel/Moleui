import * as Icons from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { PageConfig } from '@/types';

interface StartScreenProps {
  config: PageConfig;
  onStart: () => void;
}

// Icon color and animation mapping based on functionality
const iconConfig: Record<string, { color: string; animation: string }> = {
  Trash2: { color: '#06b6d4', animation: 'animate-bounce-gentle' }, // Clean - Cyan
  PieChart: { color: '#ec4899', animation: 'animate-spin-slow' }, // Analyze - Pink
  Zap: { color: '#8b5cf6', animation: 'animate-pulse-glow' }, // Optimize - Purple
  Activity: { color: '#10b981', animation: 'animate-pulse-wave' }, // Status - Green
  PackageX: { color: '#ef4444', animation: 'animate-shake' }, // Uninstall - Red
  Sparkles: { color: '#f59e0b', animation: 'animate-sparkle' }, // Smart Care - Amber
};

export function StartScreen({ config, onStart }: StartScreenProps) {
  // Map icon name to actual component
  const getIcon = (iconName: string) => {
    const Icon = Icons[iconName as keyof typeof Icons] as Icons.LucideIcon;
    return Icon;
  };

  const MainIcon = getIcon(config.icon);
  const iconStyle = iconConfig[config.icon] || { color: '#3b82f6', animation: '' };

  return (
    <div className="h-full flex flex-col items-center">
      {/* Centered content with max-width */}
      <div className="flex-1 w-full max-w-[850px] mx-auto grid grid-cols-2 gap-12 p-12">
        {/* Left side - Info */}
        <div className="flex flex-col justify-center">
          <h1 className="text-4xl font-bold text-text-primary mb-4">{config.title}</h1>
          <p className="text-lg text-text-secondary mb-8">{config.description}</p>

          <div className="space-y-4">
            {config.items.map((item, index) => {
              const ItemIcon = getIcon(item.icon);
              return (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center transition-transform duration-200 hover:scale-110">
                    {ItemIcon && (
                      <ItemIcon 
                        className="w-5 h-5" 
                        style={{ color: iconStyle.color }}
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary mb-1">{item.title}</h3>
                    <p className="text-sm text-text-secondary">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right side - Visual */}
        <div className="flex items-center justify-center">
          <div className="relative">
            {MainIcon && (
              <MainIcon 
                className={`w-64 h-64 ${iconStyle.animation}`}
                style={{ 
                  color: iconStyle.color,
                  strokeWidth: 1.5,
                  filter: 'drop-shadow(0 8px 24px rgba(0, 0, 0, 0.12))'
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-8 flex justify-center w-full max-w-[850px] mx-auto">
        <Button 
          size="lg" 
          onClick={onStart}
          icon={MainIcon}
          iconPosition="left"
          className="rounded-full"
        >
          {config.buttonText}
        </Button>
      </div>
    </div>
  );
}
