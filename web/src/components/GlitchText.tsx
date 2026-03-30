import { FC, CSSProperties } from 'react';

interface GlitchTextProps {
  children: string;
  speed?: number;
  enableShadows?: boolean;
  enableOnHover?: boolean;
  className?: string;
  style?: CSSProperties;
}

interface CustomCSSProperties extends CSSProperties {
  '--after-duration': string;
  '--before-duration': string;
}

const GlitchText: FC<GlitchTextProps> = ({
  children,
  speed = 0.5,
  enableOnHover = false,
  className = '',
  style = {}
}) => {
  const inlineStyles: CustomCSSProperties = {
    '--after-duration': `${speed * 3}s`,
    '--before-duration': `${speed * 2}s`,
    ...style
  };

  return (
    <div
      style={inlineStyles}
      data-text={children}
      className={`glitch-text ${enableOnHover ? 'glitch-text-hover-only' : ''} ${className}`.trim()}
    >
      {children}
    </div>
  );
};

export default GlitchText;
