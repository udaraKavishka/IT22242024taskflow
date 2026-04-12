"use client";

import { useEffect } from "react";
import { Provider } from "react-redux";

import Store from "@/src/Redux/Store";
import { loadUser } from "@/src/Services/userService";

function BootstrapAuth() {
  useEffect(() => {
    loadUser(Store.dispatch);
  }, []);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={Store}>
      <BootstrapAuth />
      {children}
    </Provider>
  );
}
