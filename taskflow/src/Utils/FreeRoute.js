"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";

// const FreeRoute = ({ component: Component, ...rest }) => {
//   if (localStorage.getItem("token")) return <Navigate push to="/boards" />;
//   return (
//     <Route
//       {...rest}
//       render={(props) => {
//         return <Component {...props} />;
//       }}
//     />
//   );
// };

const FreeRoute = ({ children }) => {
  const user = useSelector((state) => state.user);
  const router = useRouter();

  useEffect(() => {
    if (user.isAuthenticated) {
      router.replace("/boards");
    }
  }, [user.isAuthenticated, router]);

  if (user.isAuthenticated) {
    return null;
  }

  return children;
};

export default FreeRoute;
