export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const backendPath = url.pathname.replace(/^\/api/, '') + url.search;
  const target = 'https://api.zsend.xyz' + backendPath;
  return fetch(new Request(target, request));
}
