/**
 * Elements injected by the extension itself (our badge, panels and highlight
 * layer) or by Plasmo (`plasmo-csui` hosts, including its dev-mode loading
 * indicator) must never be audited as part of the creative.
 */
export const EXTENSION_ID_PREFIX = "ad-auditor"
const PLASMO_TAG_PREFIX = "PLASMO-"

const isExtensionNode = (el: Element): boolean =>
  el.id.startsWith(EXTENSION_ID_PREFIX) ||
  el.tagName.toUpperCase().startsWith(PLASMO_TAG_PREFIX)

/** True when the node is, or sits inside (including across shadow roots), extension UI. */
export const isExtensionElement = (node: Node | null | undefined): boolean => {
  let current: Node | null = node ?? null
  while (current) {
    if (current.nodeType === 1 && isExtensionNode(current as Element))
      return true
    const parent: Node | null = current.parentNode
    if (parent) {
      current = parent
    } else {
      // Cross a shadow boundary: ShadowRoot has no parent but has a host.
      current = (current as ShadowRoot).host ?? null
    }
  }
  return false
}
