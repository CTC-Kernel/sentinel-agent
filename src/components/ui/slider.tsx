/**
 * Slider Component
 *
 * Simple slider/range input component.
 *
 * @module components/ui/slider
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number[];
  onValueChange: (value: number[]) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange([Number(e.target.value)]);
    };

    return (
      <input
        type="range"
        ref={ref}
        value={value[0]}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        className={cn(
          'w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer',
          'accent-primary',
          '[&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:w-4',
          '[&::-webkit-slider-thumb]:h-4',
          '[&::-webkit-slider-thumb]:rounded-full',
          '[&::-webkit-slider-thumb]:bg-primary',
          '[&::-webkit-slider-thumb]:cursor-pointer',
          '[&::-webkit-slider-thumb]:shadow-md',
          '[&::-moz-range-thumb]:w-4',
          '[&::-moz-range-thumb]:h-4',
          '[&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:bg-primary',
          '[&::-moz-range-thumb]:cursor-pointer',
          '[&::-moz-range-thumb]:border-0',
          className
        )}
        {...props}
      />
    );
  }
);

Slider.displayName = 'Slider';

export { Slider };
