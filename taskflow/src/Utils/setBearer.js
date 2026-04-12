"use client";

import httpClient from "./httpClient";

const setBearer = (bearerToken) => {
  if (bearerToken) {
    httpClient.defaults.headers.common["Authorization"] = `Bearer ${bearerToken}`;
  } else {
    delete httpClient.defaults.headers.common["Authorization"];
  }
};

export default setBearer;
