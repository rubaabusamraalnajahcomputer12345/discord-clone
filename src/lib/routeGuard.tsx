import { Navigate, Outlet } from "react-router-dom";
import { useConvexAuth } from "convex/react";

/**
 * Gates nested routes behind Convex Auth. Redirects to /login when the
 * caller is not authenticated; renders nothing conclusive while the auth
 * state is still loading, to avoid a flash of the login screen.
 */
export function RouteGuard() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-offline">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
