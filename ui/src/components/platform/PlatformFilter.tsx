// components/platform/PlatformFilter.tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Twitter, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PlatformValue = 'all' | 'reddit' | 'twitter';

interface PlatformFilterProps {
  value: PlatformValue;
  onChange: (value: PlatformValue) => void;
  className?: string;
  disabled?: boolean;
}

export const PlatformFilter: React.FC<PlatformFilterProps> = ({
  value,
  onChange,
  className,
  disabled = false
}) => {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("w-[180px]", className)}>
        <SelectValue placeholder="All Platforms" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            All Platforms
          </div>
        </SelectItem>
        <SelectItem value="reddit">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#ff4500]" />
            Reddit Only
          </div>
        </SelectItem>
        <SelectItem value="twitter">
          <div className="flex items-center gap-2">
            <Twitter className="h-4 w-4 text-[#1da1f2]" />
            Twitter Only
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
};
