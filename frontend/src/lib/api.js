export async function streamTranslation(formData, { onEvent, signal }) {
  let response;
  try {
    response = await fetch('/api/translate', { method: 'POST', body: formData, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Cannot reach the translation server. Is the backend running on port 8000?');
  }

  if (!response.ok) {
    let detail = `Server error (${response.status})`;
    try {
      const body = await response.json();
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onEvent(JSON.parse(line));
      } catch (err) {
        console.error('Bad event line', err, line);
      }
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer));
}

export async function loadSampleFiles() {
  const fetchFile = async (path, name, type) => {
    const res = await fetch(path);
    const blob = await res.blob();
    return new File([blob], name, { type });
  };
  const [file, glossaryFile, styleSheetFile] = await Promise.all([
    fetchFile('/samples/the-lighthouse-keeper.txt', 'the-lighthouse-keeper.txt', 'text/plain'),
    fetchFile('/samples/term-base.csv', 'term-base.csv', 'text/csv'),
    fetchFile('/samples/style-sheet.md', 'style-sheet.md', 'text/markdown'),
  ]);
  return { file, glossaryFile, styleSheetFile };
}
