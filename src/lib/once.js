export function hasRunOnce(key) {
  return localStorage.getItem(key) === "1";
}
export function markRunOnce(key) {
  localStorage.setItem(key, "1");
}
