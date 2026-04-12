"use client";

import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import LoadingScreen from "../Components/LoadingScreen";

// const ProtectedRoute = ({ component: Component, ...rest }) => {
//   const history = useNavigate ();
//   const user = useSelector((state) => state.user);
//   useEffect(() => {
//     if (!user.isAuthenticated && !user.pending) history.push("/");
//   });

//   return (
//     <Route
//       {...rest}
//       render={(props) => {
//         if (user.isAuthenticated && !user.pending) {
//           return <Component {...props} />;
//         } else return <LoadingScreen />;
//       }}
//     />
//   );
// };

const ProtectedRoute = ({ children }) => {
  const router = useRouter();
  const user = useSelector((state) => state.user);

  useEffect(() => {
    if (!user.isAuthenticated && !user.pending) {
      router.replace("/login");
    }
  }, [user, router]);

  if (user.isAuthenticated && !user.pending) {
    return children;
  }

  return <LoadingScreen />;
};

export default ProtectedRoute;
