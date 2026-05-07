import logoKatuu from '@/assets/logo-katuu-oficial.png';

interface AppHeaderProps {
  showLogo?: boolean;
  className?: string;
  version?: string;
}

export function AppHeader({ showLogo = true, className = '', version }: AppHeaderProps) {
  return (
    <header className={`bg-primary py-3 px-4 ${className}`}>
      {showLogo && (
        <div className="flex flex-col items-center">
          <img 
            src={logoKatuu} 
            alt="Katuu" 
            className="h-8 w-auto"
          />
          {version && (
            <span className="text-white/50 text-[10px] mt-0.5">v{version}</span>
          )}
        </div>
      )}
    </header>
  );
}
