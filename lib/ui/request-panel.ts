import type { RequestListItem } from "~lib/request-list"
import { getRequestTypes } from "~lib/request-list"
import {
  buildRequestListView,
  getRequestPanelSourceItems,
  type RequestControlValues,
  type RequestListView,
  type WaterfallRowView
} from "~lib/request-list-view"

const FIELD_STYLE =
  "font-size:10px;background:#0d141f;color:#d8dde7;border:1px solid #345;border-radius:4px;padding:3px 4px"
const SNAPSHOT_BUTTON_STYLE =
  "border:1px solid #7dff6a;background:transparent;color:#7dff6a;border-radius:4px;padding:2px 6px;font-size:10px;line-height:1.2;cursor:pointer"

export const STATUS_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["all", "All statuses"],
  ["done", "Done"],
  ["pending", "Pending"]
]

export const SORT_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["transferred_desc", "Sort: transferred"],
  ["resources_desc", "Sort: resources"],
  ["url_asc", "Sort: url"]
]

export type RequestPanel = {
  container: HTMLDivElement
  hostInput: HTMLInputElement
  list: HTMLUListElement
  showAllCheckbox: HTMLInputElement
  snapshotInfo: HTMLSpanElement
  snapshotRow: HTMLDivElement
  sortSelect: HTMLSelectElement
  statusSelect: HTMLSelectElement
  summary: HTMLSpanElement
  typeSelect: HTMLSelectElement
  waterfall: HTMLDivElement
}

export type RequestPanelHandlers = {
  onCompareSnapshot: () => void
  /** Any filter/sort control changed. */
  onControlChange: () => void
  onSaveSnapshot: () => void
}

export type RequestPanelUpdate = {
  enabled: boolean
  focusOffenders: boolean
  /** Whether the pointer is over the badge (panel is only shown on hover). */
  hoverActive: boolean
  items: RequestListItem[]
  limitBytes: number
  waterfallEnabled: boolean
}

export const setSelectOptions = (
  select: HTMLSelectElement,
  options: ReadonlyArray<readonly [string, string]>
) => {
  select.textContent = ""
  for (const [value, label] of options) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = label
    select.appendChild(option)
  }
}

const createSelect = (
  options?: ReadonlyArray<readonly [string, string]>
): HTMLSelectElement => {
  const select = document.createElement("select")
  select.setAttribute("style", FIELD_STYLE)
  if (options) {
    setSelectOptions(select, options)
  }
  return select
}

const createSnapshotButton = (label: string): HTMLButtonElement => {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = label
  button.setAttribute("style", SNAPSHOT_BUTTON_STYLE)
  return button
}

/** Builds the hover dropdown: snapshot row, filters, waterfall, request list. */
export const createRequestPanel = (
  handlers: RequestPanelHandlers
): RequestPanel => {
  const container = document.createElement("div")
  container.setAttribute(
    "style",
    [
      "display: none",
      "position: absolute",
      "left: 0",
      "bottom: 100%",
      "width: 100%",
      "max-height: 280px",
      "overflow: auto",
      "box-sizing: border-box",
      "padding: 6px 8px",
      "flex-direction: column",
      "gap: 6px",
      "background: rgba(0, 0, 0, 0.94)",
      "border-top: 1px solid rgba(125, 255, 106, 0.45)"
    ].join(";")
  )

  const snapshotRow = document.createElement("div")
  snapshotRow.setAttribute(
    "style",
    "display:none;align-items:center;gap:6px;flex-wrap:wrap"
  )
  const saveButton = createSnapshotButton("Save")
  const compareButton = createSnapshotButton("Compare")
  const snapshotInfo = document.createElement("span")
  snapshotInfo.textContent = "No snapshot saved"
  snapshotInfo.setAttribute("style", "font-size:10px;color:#d8dde7")
  snapshotRow.append(saveButton, compareButton, snapshotInfo)

  const typeSelect = createSelect()
  const statusSelect = createSelect(STATUS_OPTIONS)
  const sortSelect = createSelect(SORT_OPTIONS)

  const hostInput = document.createElement("input")
  hostInput.type = "text"
  hostInput.placeholder = "Host filter (contains)"
  hostInput.setAttribute("style", FIELD_STYLE)

  const showAllLabel = document.createElement("label")
  showAllLabel.setAttribute(
    "style",
    "display:flex;align-items:center;gap:6px;font-size:10px;color:#d8dde7"
  )
  const showAllCheckbox = document.createElement("input")
  showAllCheckbox.type = "checkbox"
  showAllLabel.append(showAllCheckbox, document.createTextNode("Show all"))

  const summary = document.createElement("span")
  summary.textContent = "0/0 requests"
  summary.setAttribute("style", "justify-self:end;font-size:10px;color:#9db7d2")

  const filtersBar = document.createElement("div")
  filtersBar.setAttribute(
    "style",
    "display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:center"
  )
  filtersBar.append(
    typeSelect,
    statusSelect,
    sortSelect,
    hostInput,
    showAllLabel,
    summary
  )

  const list = document.createElement("ul")
  list.setAttribute(
    "style",
    "margin:0;padding:0;display:flex;flex-direction:column;gap:2px"
  )

  const waterfall = document.createElement("div")
  waterfall.setAttribute(
    "style",
    "display:none;flex-direction:column;gap:4px;padding:4px 0;border-top:1px dashed rgba(125,255,106,0.35)"
  )

  container.append(snapshotRow, filtersBar, waterfall, list)

  typeSelect.addEventListener("change", handlers.onControlChange)
  statusSelect.addEventListener("change", handlers.onControlChange)
  sortSelect.addEventListener("change", handlers.onControlChange)
  hostInput.addEventListener("input", handlers.onControlChange)
  showAllCheckbox.addEventListener("change", handlers.onControlChange)
  saveButton.addEventListener("click", handlers.onSaveSnapshot)
  compareButton.addEventListener("click", handlers.onCompareSnapshot)

  return {
    container,
    hostInput,
    list,
    showAllCheckbox,
    snapshotInfo,
    snapshotRow,
    sortSelect,
    statusSelect,
    summary,
    typeSelect,
    waterfall
  }
}

export const readRequestControls = (
  panel: RequestPanel
): RequestControlValues => ({
  hostQuery: panel.hostInput.value,
  showAll: panel.showAllCheckbox.checked,
  sort: panel.sortSelect.value,
  status: panel.statusSelect.value,
  type: panel.typeSelect.value
})

/** Rebuilds the type dropdown, keeping the selection when still available. */
export const syncRequestTypeOptions = (
  select: HTMLSelectElement,
  items: RequestListItem[]
) => {
  const selectedType = select.value || "all"
  const requestTypes = getRequestTypes(items)

  setSelectOptions(select, [
    ["all", "All types"],
    ...requestTypes.map((type) => [type, type] as const)
  ])
  select.value = requestTypes.includes(selectedType) ? selectedType : "all"
}

export const updateSnapshotRow = (
  panel: RequestPanel,
  enabled: boolean,
  infoText: string
) => {
  if (!enabled) {
    panel.snapshotRow.style.display = "none"
    return
  }

  panel.snapshotRow.style.display = "flex"
  panel.snapshotInfo.textContent = infoText
}

const renderWaterfall = (
  container: HTMLDivElement,
  rows: WaterfallRowView[]
) => {
  container.textContent = ""
  if (rows.length === 0) {
    container.style.display = "none"
    return
  }

  container.style.display = "flex"
  for (const entry of rows) {
    const row = document.createElement("div")
    row.setAttribute(
      "style",
      "display:flex;align-items:center;gap:6px;font-size:10px;color:#d8dde7"
    )
    const label = document.createElement("span")
    label.textContent = entry.label
    label.style.width = "130px"
    label.style.flexShrink = "0"
    const barWrap = document.createElement("span")
    barWrap.setAttribute(
      "style",
      "flex:1;height:6px;background:rgba(255,255,255,0.12);border-radius:999px;overflow:hidden"
    )
    const bar = document.createElement("span")
    bar.style.display = "block"
    bar.style.width = `${entry.widthPercent}%`
    bar.style.height = "100%"
    bar.style.background = "#7dff6a"
    barWrap.appendChild(bar)
    const metric = document.createElement("span")
    metric.textContent = entry.metric
    row.append(label, barWrap, metric)
    container.appendChild(row)
  }
}

const renderRequestRows = (list: HTMLUListElement, view: RequestListView) => {
  list.textContent = ""

  for (const item of view.rows) {
    const row = document.createElement("li")
    row.setAttribute(
      "style",
      "display:flex;gap:8px;align-items:flex-start;padding:2px 0;list-style:none"
    )

    const meta = document.createElement("span")
    meta.textContent = item.meta
    meta.style.color = "#7dff6a"
    meta.style.flexShrink = "0"

    const url = document.createElement("span")
    url.textContent = item.url
    url.style.color = "#ffffff"
    url.style.wordBreak = "break-all"

    row.append(meta, url)
    list.appendChild(row)
  }

  if (view.footer) {
    const footer = document.createElement("li")
    footer.textContent = view.footer
    footer.style.color = "#d8dde7"
    footer.style.listStyle = "none"
    list.appendChild(footer)
  }
}

/**
 * Re-renders the whole request panel from the current controls. Returns the
 * source items the panel is showing (after "focus offenders" filtering), or
 * null when the request list is disabled.
 */
export const updateRequestPanel = (
  panel: RequestPanel,
  update: RequestPanelUpdate
): RequestListItem[] | null => {
  if (!update.enabled) {
    panel.container.style.display = "none"
    return null
  }

  const sourceItems = getRequestPanelSourceItems(
    update.items,
    update.focusOffenders,
    update.limitBytes
  )

  syncRequestTypeOptions(panel.typeSelect, sourceItems)
  panel.list.textContent = ""

  const view = buildRequestListView(sourceItems, readRequestControls(panel), {
    focusOffenders: update.focusOffenders,
    waterfallEnabled: update.waterfallEnabled
  })
  panel.summary.textContent = view.summary

  if (sourceItems.length === 0) {
    panel.container.style.display = "none"
    renderWaterfall(panel.waterfall, [])
    return sourceItems
  }

  panel.container.style.display = update.hoverActive ? "flex" : "none"
  renderWaterfall(panel.waterfall, view.waterfall)
  renderRequestRows(panel.list, view)
  return sourceItems
}
