// components/platform/PlatformBadge.tsx
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Twitter } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Platform = 'reddit' | 'twitter';

interface PlatformBadgeProps {
  platform: Platform;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showText?: boolean;
  className?: string;
}

export const PlatformBadge: React.FC<PlatformBadgeProps> = ({
  platform,
  size = 'md',
  showIcon = true,
  showText = true,
  className
}) => {
  const config = {
    reddit: {
      icon: MessageSquare,
      label: 'Reddit',
      className: 'bg-[#fef2f2] text-[#991b1b] border-[#fecaca]',
    },
    twitter: {
      icon: Twitter,
      label: 'Twitter',
      className: 'bg-[#eff6ff] text-[#1e40af] border-[#bfdbfe]',
    },
  };

  const platformConfig = config[platform];
  const Icon = platformConfig.icon;

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        platformConfig.className,
        sizeClasses[size],
        'inline-flex items-center gap-1.5',
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {showText && platformConfig.label}
    </Badge>
  );
};
