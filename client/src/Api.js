// Shared helpers for talking to the Express server.

export const API_URL = "http://localhost:9000";

// Sends a request to the backend and always returns { ok, data }.
//   ok   -> true when the HTTP status was 2xx
//   data -> the parsed JSON body (errors look like { message: "..." })
// If the server cannot be reached at all, ok is false and data.message
// explains that, so components only need one code path for errors. 
export async function request(path, options) {
  try {
    const response = await fetch(API_URL + path, options);
    const data = await response.json();
    return { ok: response.ok, data: data };
  } catch {
    return {
      ok: false,
      data: { message: "Could not connect to the server" }
    };
  }
}

// Same as request, but for requests that send a JSON body.
export function sendJson(path, method, body) {
  return request(path, {
    method: method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

// MongoDB ids arrive in the browser as plain strings, so a user's name can be looked up by comparing the strings directly.
export function findUsername(users, userId) {
  const user = users.find((u) => u._id === userId);
  return user ? user.username : "Unknown user";
}