import { memo } from 'react';
import { HIGHLIGHT_COLORS, HighlightColor } from '@/hooks/useUserHighlights';
import { Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface HighlightColorPickerProps {
  selectedColor: HighlightColor;
  onColorChange: (color: HighlightColor) => void;
  children: React.ReactNode;
}

export const HighlightColorPicker = memo(function HighlightColorPicker({
  selectedColor,
  onColorChange,
  children,
}: HighlightColorPickerProps) {
  const colors: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="end">
        <div className="flex gap-2">
          {colors.map((color) => {
            const config = HIGHLIGHT_COLORS[color];
            const isSelected = selectedColor === color;
            
            return (
              <button
                key={color}
                onClick={() => onColorChange(color)}
                className={`
                  relative w-8 h-8 rounded-full transition-transform
                  hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
                  ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
                `}
                style={{ backgroundColor: config.border }}
                title={config.label}
              >
                {isSelected && (
                  <Check className="absolute inset-0 m-auto h-4 w-4 text-white" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
});
