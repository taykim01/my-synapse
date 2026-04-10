import { cn } from '@/lib/utils';

interface SynapseLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-6xl md:text-8xl',
};

export function SynapseLogo({ className, size = 'md' }: SynapseLogoProps) {
  return (
    <span
      className={cn(
        'font-display font-bold tracking-tight text-gradient-synapse',
        sizeClasses[size],
        className
      )}
    >
      Synapse
    </span>
  );
}
