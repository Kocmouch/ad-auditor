const SVG_NS = "http://www.w3.org/2000/svg"

type IconShape = {
  attrs: Record<string, string>
  tag: "line" | "path" | "polyline"
}

export type IconSpec = {
  rounded: boolean
  shapes: IconShape[]
  viewBox: string
}

export type IconName =
  | "accessibility"
  | "content"
  | "fonts"
  | "open"
  | "quality"

/** Static icon geometry; rendered with createElementNS (no innerHTML). */
export const ICONS: Record<IconName, IconSpec> = {
  open: {
    rounded: true,
    shapes: [
      {
        attrs: {
          d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
        },
        tag: "path"
      },
      { attrs: { points: "15 3 21 3 21 9" }, tag: "polyline" },
      { attrs: { x1: "10", x2: "21", y1: "14", y2: "3" }, tag: "line" }
    ],
    viewBox: "0 0 24 24"
  },
  fonts: {
    rounded: true,
    shapes: [
      { attrs: { points: "4 7 4 4 20 4 20 7" }, tag: "polyline" },
      { attrs: { x1: "9", x2: "15", y1: "20", y2: "20" }, tag: "line" },
      { attrs: { x1: "12", x2: "12", y1: "4", y2: "20" }, tag: "line" }
    ],
    viewBox: "0 0 24 24"
  },
  content: {
    rounded: true,
    shapes: [
      {
        attrs: {
          d: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
        },
        tag: "path"
      },
      { attrs: { points: "4 17 9 12 13 16 16 13 20 17" }, tag: "polyline" },
      { attrs: { d: "M8.5 8.5h.01" }, tag: "path" }
    ],
    viewBox: "0 0 24 24"
  },
  quality: {
    rounded: true,
    shapes: [
      {
        attrs: { d: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" },
        tag: "path"
      },
      { attrs: { points: "8.5 12 11 14.5 15.5 9.5" }, tag: "polyline" }
    ],
    viewBox: "0 0 24 24"
  },
  accessibility: {
    rounded: false,
    shapes: [
      { attrs: { x1: "1", x2: "9", y1: "2", y2: "2" }, tag: "line" },
      { attrs: { x1: "1", x2: "9", y1: "6", y2: "6" }, tag: "line" }
    ],
    viewBox: "0 0 10 8"
  }
}

export const createIcon = (name: IconName, size = 14): SVGSVGElement => {
  const spec = ICONS[name]
  const svg = document.createElementNS(SVG_NS, "svg")
  svg.setAttribute("width", String(size))
  svg.setAttribute("height", String(size))
  svg.setAttribute("viewBox", spec.viewBox)
  svg.setAttribute("fill", "none")
  svg.setAttribute("stroke", "currentColor")
  svg.setAttribute("stroke-width", "2")
  svg.setAttribute("stroke-linecap", "round")
  if (spec.rounded) {
    svg.setAttribute("stroke-linejoin", "round")
  }

  for (const shape of spec.shapes) {
    const element = document.createElementNS(SVG_NS, shape.tag)
    for (const [attr, value] of Object.entries(shape.attrs)) {
      element.setAttribute(attr, value)
    }
    svg.appendChild(element)
  }

  return svg
}
