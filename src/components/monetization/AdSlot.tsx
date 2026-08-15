'use client';

import { monetizationConfig } from '@/config/monetization';

interface AdSlotProps {
  slotId: string;
  className?: string;
}

export function AdSlot({ slotId, className = '' }: AdSlotProps) {
  const slot = monetizationConfig.adSlots.find(s => s.id === slotId);

  if (!slot || !slot.enabled) {
    return null;
  }

  if (!slot.placeholder) {
    return null;
  }

  return (
    <div className={`bg-muted/50 border border-dashed rounded-lg p-4 text-center ${className}`}>
      <p className="text-xs text-muted-foreground">
        {slot.placeholder}
      </p>
    </div>
  );
}
