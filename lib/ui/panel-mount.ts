/**
 * Keeps a single results panel on the page: appends it the first time (or when
 * the previous one was removed from the DOM) and swaps it in place afterwards.
 */
export const createPanelMount = (parent: () => HTMLElement = () => document.body) => {
  let current: HTMLDivElement | null = null

  return {
    get current() {
      return current
    },
    show(next: HTMLDivElement) {
      const host = parent()
      if (!current || !host.contains(current)) {
        host.appendChild(next)
      } else {
        current.replaceWith(next)
      }
      current = next
    }
  }
}
