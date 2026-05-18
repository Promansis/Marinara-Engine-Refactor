function forEachHeader(headers: HeadersInit | undefined, visit: (key: string, value: string) => void): void {
  if (!headers) return;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => visit(key, value));
    return;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) visit(key, value);
    return;
  }
  for (const [key, value] of Object.entries(headers)) visit(key, value);
}

function requestUrl<T extends Blob | ArrayBuffer>(
  url: string,
  responseType: "blob" | "arraybuffer",
  options: { init?: RequestInit; errorMessage?: string } = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.init?.method ?? "GET", url, true);
    xhr.responseType = responseType;

    forEachHeader(options.init?.headers, (key, value) => {
      try {
        xhr.setRequestHeader(key, value);
      } catch {
        // Some browser-managed headers cannot be set manually.
      }
    });

    const abort = () => {
      xhr.abort();
      reject(new DOMException("The request was aborted.", "AbortError"));
    };
    if (options.init?.signal?.aborted) {
      abort();
      return;
    }
    options.init?.signal?.addEventListener("abort", abort, { once: true });

    xhr.onload = () => {
      options.init?.signal?.removeEventListener("abort", abort);
      const ok = (xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.response);
      if (!ok) {
        reject(new Error(options.errorMessage ?? `Failed to load ${url}`));
        return;
      }
      resolve(xhr.response as T);
    };
    xhr.onerror = () => {
      options.init?.signal?.removeEventListener("abort", abort);
      reject(new Error(options.errorMessage ?? `Failed to load ${url}`));
    };
    xhr.onabort = () => {
      options.init?.signal?.removeEventListener("abort", abort);
      reject(new DOMException("The request was aborted.", "AbortError"));
    };
    xhr.send((options.init?.body as XMLHttpRequestBodyInit | Document | null | undefined) ?? null);
  });
}

export async function fetchUrlBlob(
  url: string,
  options: { init?: RequestInit; errorMessage?: string } = {},
): Promise<Blob> {
  return requestUrl<Blob>(url, "blob", options);
}

export async function fetchUrlArrayBuffer(
  url: string,
  options: { init?: RequestInit; errorMessage?: string } = {},
): Promise<ArrayBuffer> {
  return requestUrl<ArrayBuffer>(url, "arraybuffer", options);
}

export async function blobToDataUrl(blob: Blob, errorMessage = "Failed to convert file."): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error(errorMessage));
    };
    reader.onerror = () => reject(reader.error ?? new Error(errorMessage));
    reader.readAsDataURL(blob);
  });
}

export async function urlToDataUrl(url: string, errorMessage = "Failed to read file."): Promise<string> {
  if (url.startsWith("data:")) return url;
  return blobToDataUrl(await fetchUrlBlob(url, { errorMessage }), errorMessage);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
