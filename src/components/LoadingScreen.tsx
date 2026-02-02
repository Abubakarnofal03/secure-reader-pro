import logo from '@/assets/logo.png';

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background safe-top safe-bottom">
      <div className="flex flex-col items-center gap-4">
        <img src={logo} alt="MyCalories" className="h-20 w-auto" />
        <div className="h-1 w-24 overflow-hidden rounded-full bg-muted/50">
          <div className="h-full w-1/2 animate-pulse-soft rounded-full bg-primary" />
        </div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
