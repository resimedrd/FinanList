import React from 'react';
import * as Icons from 'lucide-react';

interface DynamicIconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({ name, size = 20, color, className }) => {
  const IconComponent = (Icons as any)[name];

  if (!IconComponent) {
    // Return HelpCircle as fallback
    const FallbackIcon = Icons.HelpCircle;
    return <FallbackIcon size={size} color={color} className={className} />;
  }

  return <IconComponent size={size} color={color} className={className} />;
};
export default DynamicIcon;
