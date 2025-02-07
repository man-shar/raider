import type { PDFDocumentProxy } from 'pdfjs-dist'

export interface TOCItem {
  title: string
  pdfJsOutlineItem: Awaited<ReturnType<PDFDocumentProxy['getOutline']>>[number]
  pageNumber: number
}

export async function createTOC(
  pdf: PDFDocumentProxy,
  outline: Awaited<ReturnType<PDFDocumentProxy['getOutline']>>
): Promise<TOCItem[]> {
  // ref: https://medium.com/@csofiamsousa/creating-a-table-of-contents-with-pdf-js-4a4316472fff
  const toc: TOCItem[] = []

  for (const item of outline) {
    const dest = item.dest
    if (!dest) continue

    // Get each page ref
    const ref = await pdf.getDestination(dest.toString())
    if (!ref) continue

    // And the page idx
    const idx = await pdf.getPageIndex(ref[0])

    // page number = index + 1
    toc.push({
      title: item.title,
      pdfJsOutlineItem: item,
      pageNumber: idx + 1
    })
  }

  return toc
}
