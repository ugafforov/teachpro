import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.warn('[NotFound] User attempted to access:', location.pathname);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-4">Sahifa topilmadi</p>
        <a href="/" className="text-primary hover:underline underline-offset-4">
          Bosh sahifaga qaytish
        </a>
      </div>
    </div>
  );
};

export default NotFound;
