/* Text out of a PDF, in the browser.
 *
 * A transcript or a CV is read here, on the student's own machine, and only
 * its text goes to the agent service. The file itself never leaves.
 */

export async function pdfText(file: File, maxPages = 30): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url,
  ).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Group text items into lines by their vertical position, so a transcript
    // row keeps its course name and its grade on the same line.
    const rows = new Map<number, string[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      rows.set(y, [...(rows.get(y) ?? []), item.str]);
    }
    pages.push([...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, parts]) => parts.join(" ")).join("\n"));
  }
  return pages.join("\n\n").trim();
}

export async function fileText(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return pdfText(file);
  }
  return (await file.text()).trim();
}
