import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store/store";

const PrivateRoute = ({ roles }: { roles?: string[] }) => {
  const { user, accessToken } = useSelector((state: RootState) => state.auth);

  if (!accessToken || !user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <Outlet />;
};

export default PrivateRoute;
