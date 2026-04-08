const defaults = {
  headers: {
    common: {},
  },
};

const makeError = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  let data;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text || response.statusText;
  }

  const error = new Error(response.statusText || "Request failed");
  error.response = {
    status: response.status,
    data,
    statusText: response.statusText,
    headers: response.headers,
  };
  throw error;
};

const buildHeaders = (customHeaders) => ({
  ...defaults.headers.common,
  ...(customHeaders || {}),
});

const parseResponseData = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
};

const request = async (method, url, data, config = {}) => {
  const headers = buildHeaders(config.headers);
  const options = {
    method,
    headers,
    signal: config.signal,
  };

  if (data !== undefined) {
    const hasContentType = Object.keys(headers).some(
      (key) => key.toLowerCase() === "content-type"
    );

    if (typeof data === "string" || data instanceof FormData || data instanceof Blob) {
      options.body = data;
    } else {
      if (!hasContentType) {
        options.headers["Content-Type"] = "application/json";
      }
      options.body = JSON.stringify(data);
    }
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    await makeError(response);
  }

  const responseData = await parseResponseData(response);
  return {
    data: responseData,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    config,
  };
};

const create = (config = {}) => {
  const instanceDefaults = {
    headers: {
      common: {
        ...defaults.headers.common,
        ...((config.headers && config.headers.common) || {}),
      },
    },
  };

  return {
    defaults: instanceDefaults,
    get: (url, reqConfig = {}) =>
      request("GET", url, undefined, {
        ...config,
        ...reqConfig,
        headers: {
          ...instanceDefaults.headers.common,
          ...(reqConfig.headers || {}),
        },
      }),
    delete: (url, reqConfig = {}) =>
      request("DELETE", url, undefined, {
        ...config,
        ...reqConfig,
        headers: {
          ...instanceDefaults.headers.common,
          ...(reqConfig.headers || {}),
        },
      }),
    post: (url, body, reqConfig = {}) =>
      request("POST", url, body, {
        ...config,
        ...reqConfig,
        headers: {
          ...instanceDefaults.headers.common,
          ...(reqConfig.headers || {}),
        },
      }),
    put: (url, body, reqConfig = {}) =>
      request("PUT", url, body, {
        ...config,
        ...reqConfig,
        headers: {
          ...instanceDefaults.headers.common,
          ...(reqConfig.headers || {}),
        },
      }),
    patch: (url, body, reqConfig = {}) =>
      request("PATCH", url, body, {
        ...config,
        ...reqConfig,
        headers: {
          ...instanceDefaults.headers.common,
          ...(reqConfig.headers || {}),
        },
      }),
  };
};

const httpClient = {
  defaults,
  get: (url, config) => request("GET", url, undefined, config),
  delete: (url, config) => request("DELETE", url, undefined, config),
  post: (url, data, config) => request("POST", url, data, config),
  put: (url, data, config) => request("PUT", url, data, config),
  patch: (url, data, config) => request("PATCH", url, data, config),
  create,
};

export default httpClient;
