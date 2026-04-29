import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-4">Sahifa topilmadi</p>
        <Link to="/" className="text-primary hover:underline underline-offset-4">
          Bosh sahifaga qaytish
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
