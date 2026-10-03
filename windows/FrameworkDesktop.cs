// Standalone .NET Framework helper. No vendor code, PowerShell, keystrokes or clipboard.
// UI Automation providers vary by Framework release: unsupported controls fail closed.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using System.Windows.Automation;

public sealed class ControlInfo {
    public string id, parentId, automationId, name, label, value, type, className;
    public int depth;
    public bool offscreen, hidden, enabled, writable, inOpenErx, inTriage;
    [ScriptIgnore] public AutomationElement element;
}
public sealed class WindowInfo {
    public int pid, handle;
    public string process, started, id, title;
    public bool incomplete, openErx;
    public List<ControlInfo> controls = new List<ControlInfo>();
    public List<GridInfo> grids = new List<GridInfo>();
}
public sealed class EntryWindow {
    public int pid, handle;
    public string started, id, title;
}
public sealed class GridRow {
    public int index;
    public string title, value;
}
public sealed class GridInfo {
    public string id, method = "visible rows";
    public string[] patterns = new string[0];
    public int rowCount = -1, columnCount = -1, pages, initialRows, nullCells, rowFailures;
    public bool complete, expanded, anchorVisible, ponFound;
    public string stopReason = "not-expanded";
    public string reviewPosition = "unchanged";
    public double finalVerticalPercent = -1;
    public string activation = "not-needed";
    public List<GridRow> rows = new List<GridRow>();
    public List<string> issues = new List<string>();
    public List<GridViewport> viewports = new List<GridViewport>();
    public List<object> ponCandidates = new List<object>();
}
public sealed class GridViewport {
    public string stage, view, error = "";
    public int nodes, cells, rows, attempt, elapsedMs;
    public int probes, rejected, nullCells;
    public int retries;
    public double verticalAfterProbe = -1, verticalAfterRecovery = -1;
    public string viewportRestore = "not-needed";
    public object bounds;
    public double horizontalPercent = -1, verticalViewSize = -1;
    public int[] visibleRows = new int[0];
    public double verticalPercent = -1;
    public bool anchorVisible, limited;
    public List<object> sample = new List<object>();
}
sealed class ScanNode {
    public AutomationElement element;
    public string parentId;
    public int depth;
    public bool hidden, inOpenErx, inTriage;
}
public sealed class DesktopSnapshot {
    public string format = "sig-assist-framework-desktop";
    public int schemaVersion = 6;
    public string scanMode;
    public int windowsScanned;
    public EntryWindow entryWindow;
    public bool entryUnavailable;
    public List<WindowInfo> windows = new List<WindowInfo>();
    public List<string> issues = new List<string>();
}
public static class FrameworkDesktop {
    [DllImport("user32.dll")] static extern IntPtr GetTopWindow(IntPtr parent);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr window, uint command);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
    static bool writeAttempted;
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 4 * 1024 * 1024 };
    static readonly Regex PonLabel = new Regex(@"^(?:PON|Prescriber Order (?:Number|No\.?))\s*:?$", RegexOptions.IgnoreCase);
    static readonly Regex PonInline = new Regex(@"^(?:PON|Prescriber Order (?:Number|No\.?))\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9_.:/\-]{0,99})\s*$", RegexOptions.IgnoreCase);
    static readonly Regex GridCellName = new Regex(@"^Row (\d+), Column (\d+):\s*(.*)$", RegexOptions.Singleline);
    static string Text(object value) { return value == null ? "" : Convert.ToString(value); }
    static string Id(AutomationElement element) { return String.Join(".", element.GetRuntimeId().Select(x => x.ToString()).ToArray()); }
    static string Trim(string value) { return (value ?? "").Trim(); }
    static string Label(ControlInfo control) { return Trim(String.IsNullOrWhiteSpace(control.label) ? control.name : control.label).TrimEnd(':').Trim(); }
    // PONs are opaque identifiers. Preserve compound values (including colons)
    // verbatim through detection, lookup and transfer; never split off a suffix.
    static bool ValidPon(string value) { return Regex.IsMatch(value ?? "", @"^[A-Za-z0-9][A-Za-z0-9_.:/\-]{0,99}$") && value != "PON"; }
    static string Pon(ControlInfo control) {
        if (PonLabel.IsMatch(Label(control)) && ValidPon(Trim(control.value))) return Trim(control.value);
        var match = PonInline.Match(Trim(control.name));
        return match.Success ? match.Groups[1].Value : "";
    }
    static bool Field(ControlInfo control, string field) {
        if (control.hidden || control.offscreen || !control.enabled || !control.writable || control.type != "ControlType.Edit") return false;
        var label = Label(control);
        // Do not infer from a substring such as Original SIG, Linked SIG or SIG Preview.
        return field == "sig" ? Regex.IsMatch(label, @"^(?:SIG|Prescription SIG|SIG code)$", RegexOptions.IgnoreCase)
            : Regex.IsMatch(label, @"^(?:Administration times|Admin times)$", RegexOptions.IgnoreCase);
    }
    static ControlInfo Read(AutomationElement element) {
        if (element == null) return null;
        var current = element.Current;
        if (current.IsPassword) return null;
        var item = new ControlInfo { element = element, id = Id(element), automationId = current.AutomationId,
            name = current.Name, className = current.ClassName, type = current.ControlType.ProgrammaticName,
            offscreen = current.IsOffscreen, enabled = current.IsEnabled, label = "", value = "" };
        if (current.LabeledBy != null) item.label = current.LabeledBy.Current.Name;
        object pattern;
        if (element.TryGetCurrentPattern(ValuePattern.Pattern, out pattern)) {
            var value = (ValuePattern)pattern;
            item.value = value.Current.Value;
            item.writable = !value.Current.IsReadOnly;
        }
        return item;
    }
    static bool OpenView(ControlInfo control) {
        return new[] { "ERxWorkQueueWizardView", "ERxWorkQueueView" }.Contains(control.className)
            || control.automationId == "ERxWorkQueueWizardView";
    }
    static bool FrameworkProcess(Process process, string testProcess) {
        return process.SessionId == Process.GetCurrentProcess().SessionId && (testProcess == null
            ? new[] { "FrameworkLTC", "SoftWriters.FrameworkLtc" }.Contains(process.ProcessName, StringComparer.OrdinalIgnoreCase)
            : process.ProcessName == testProcess);
    }
    static EntryWindow Identity(WindowInfo window) {
        return new EntryWindow { pid = window.pid, handle = window.handle, started = window.started, id = window.id, title = window.title };
    }
    static EntryWindow InputWindow(object value) { return value == null ? null : Json.Deserialize<EntryWindow>(Json.Serialize(value)); }
    static AutomationElement RememberedRoot(EntryWindow entry, string testProcess) {
        using (var process = Process.GetProcessById(entry.pid)) {
            if (!FrameworkProcess(process, testProcess) || process.StartTime.ToUniversalTime().Ticks.ToString() != entry.started || entry.handle == 0)
                throw new Exception("The entry window's process was closed or replaced.");
        }
        var root = AutomationElement.FromHandle(new IntPtr(entry.handle));
        if (root == null || root.Current.ProcessId != entry.pid || Id(root) != entry.id) throw new Exception("The entry window was closed or replaced.");
        if (root.Current.IsOffscreen) throw new Exception("The entry window is minimized or not visible.");
        return root;
    }
    static int ZOrder(AutomationElement root, Dictionary<int, int> order) {
        try { int handle = root.Current.NativeWindowHandle; return order.ContainsKey(handle) ? order[handle] : Int32.MaxValue; }
        catch { return Int32.MaxValue; }
    }
    static DesktopSnapshot Scan(string testProcess, bool expandGrids = false, bool positionReview = false, EntryWindow entry = null) {
        var result = new DesktopSnapshot { scanMode = entry == null ? "discover-entry" : "remembered-entry", entryWindow = entry };
        var processes = new Dictionary<int, Process>();
        AutomationElement[] roots;
        if (entry != null) {
            // Fast path: no process enumeration, desktop tree walk or other
            // Framework windows. Validate the remembered handle directly.
            try { roots = new[] { RememberedRoot(entry, testProcess) }; processes.Add(entry.pid, Process.GetProcessById(entry.pid)); }
            catch (Exception error) {
                result.entryUnavailable = true;
                result.issues.Add("Remembered Framework entry window is unavailable. Restore it or use Choose entry window. " + error.Message);
                return result;
            }
        } else {
            foreach (var process in Process.GetProcesses()) {
                try { if (FrameworkProcess(process, testProcess)) processes.Add(process.Id, process); } catch { }
            }
            if (processes.Count == 0) { result.issues.Add("Framework is not running in this Windows session. Start the connector inside the same Citrix session as Framework."); return result; }
            // First discovery prefers the frontmost Framework window. The web
            // browser may now be foreground, so use desktop Z order, not focus.
            var order = new Dictionary<int, int>(); var handle = GetTopWindow(IntPtr.Zero);
            while (handle != IntPtr.Zero && order.Count < 1024) {
                int key = unchecked((int)handle.ToInt64()); if (order.ContainsKey(key)) break;
                order[key] = order.Count; handle = GetWindow(handle, 2); // GW_HWNDNEXT
            }
            roots = AutomationElement.RootElement.FindAll(TreeScope.Children, Condition.TrueCondition).Cast<AutomationElement>().OrderBy(root => ZOrder(root, order)).ToArray();
        }
        foreach (AutomationElement root in roots) {
            int pid;
            try { pid = root.Current.ProcessId; } catch { continue; }
            if (!processes.ContainsKey(pid)) continue;
            WindowInfo window;
            try {
                window = new WindowInfo { pid = pid, handle = root.Current.NativeWindowHandle, process = processes[pid].ProcessName, started = processes[pid].StartTime.ToUniversalTime().Ticks.ToString(), id = Id(root), title = root.Current.Name };
                if (root.Current.IsOffscreen) continue;
            } catch { result.issues.Add("A Framework window could not be inspected."); continue; }
            result.windows.Add(window);
            result.windowsScanned++;
            var pending = new Stack<ScanNode>();
            pending.Push(new ScanNode { element = root, parentId = "" });
            int visited = 0;
            while (pending.Count > 0) {
                if (++visited > 1800) { window.incomplete = true; break; }
                var next = pending.Pop();
                try {
                    var item = Read(next.element);
                    // Do not traverse password controls or their children.
                    if (item == null) continue;
                    item.parentId = next.parentId; item.depth = next.depth;
                    item.hidden = next.hidden || item.offscreen;
                    item.inTriage = next.inTriage || item.className == "ERxTriageManagerView";
                    item.inOpenErx = !item.inTriage && (next.inOpenErx || (!item.hidden && item.enabled && OpenView(item)));
                    if (item.inOpenErx && !item.hidden) window.openErx = true;
                    window.controls.Add(item);
                    if (item.hidden) continue;
                    var child = TreeWalker.ControlViewWalker.GetFirstChild(next.element);
                    if (next.depth >= 24 && child != null) { window.incomplete = true; continue; }
                    int siblings = 0;
                    while (child != null) {
                        if (++siblings > 1800) { window.incomplete = true; break; }
                        pending.Push(new ScanNode { element = child, parentId = item.id, depth = next.depth + 1, hidden = item.hidden, inOpenErx = item.inOpenErx, inTriage = item.inTriage });
                        child = TreeWalker.ControlViewWalker.GetNextSibling(child);
                    }
                } catch { window.incomplete = true; }
            }
            if (entry != null || window.openErx || window.controls.Any(c => !c.hidden && !c.inTriage && Pon(c) != "")) {
                result.entryWindow = Identity(window);
                // Discard discovery candidates and stop before inspecting the
                // remaining instances, including unrelated open E-Rx windows.
                result.windows.Clear(); result.windows.Add(window); break;
            }
        }
        // Only the visible detail grids of an opened wizard are expanded. Triage
        // rows and hidden cached wizard pages belong to other orders.
        var budget = Stopwatch.StartNew();
        foreach (var window in result.windows.Where(w => w.openErx)) {
            foreach (var grid in window.controls.Where(c => c.inOpenErx && !c.hidden && c.enabled && c.type == "ControlType.DataGrid" && c.automationId == "ERxGrid")) {
                window.grids.Add(ReadGrid(grid, expandGrids, positionReview, budget, window.handle));
            }
        }
        if (result.windows.Count == 0) {
            result.entryUnavailable = entry != null;
            result.issues.Add(entry != null ? "The remembered Framework entry window could not be read. Restore it or use Choose entry window."
                : "No accessible Framework window is open. A remote Citrix picture on a local desktop cannot expose the remote fields.");
        }
        return result;
    }
    static bool PonTitle(string title) {
        // Title/value detail rows, not PrescriberOrderNumber columns in a queue.
        return Regex.IsMatch(Regex.Replace(title ?? "", @"[\s_:#.\-]", ""), @"^(?:PON|PrescriberOrder(?:Number|No))$", RegexOptions.IgnoreCase);
    }
    static string CellText(AutomationElement cell) {
        if (cell == null) throw new InvalidOperationException("The grid provider returned a null cell.");
        var item = Read(cell);
        if (item == null) return "";
        if (!String.IsNullOrWhiteSpace(item.value)) return Trim(item.value);
        var match = GridCellName.Match(item.name ?? "");
        if (match.Success) return Trim(match.Groups[3].Value);
        object pattern;
        if (cell.TryGetCurrentPattern(TextPattern.Pattern, out pattern)) return Trim(((TextPattern)pattern).DocumentRange.GetText(2000));
        return Trim(item.name);
    }
    static void AddRow(GridInfo info, int index, string title, string value) {
        if (index < 0 || index >= 512) return;
        var row = info.rows.FirstOrDefault(r => r.index == index);
        if (row == null) { row = new GridRow { index = index }; info.rows.Add(row); }
        row.title = title; row.value = value;
    }
    static object Cached(AutomationElement element, AutomationProperty property) {
        var value = element.GetCachedPropertyValue(property, true);
        return value == AutomationElement.NotSupported ? null : value;
    }
    static bool FillAnchor(GridRow row) {
        return Regex.Replace(row.title ?? "", @"\s+", "").Equals("RxFillIndicator", StringComparison.OrdinalIgnoreCase)
            && Regex.Replace(Trim(row.value), @"\s+", " ").Equals("All Fill Statuses", StringComparison.OrdinalIgnoreCase);
    }
    static List<GridRow> VisibleRows(AutomationElement grid, GridInfo info, string stage, bool raw, int attempt, Stopwatch budget, int deadline) {
        // Bulk snapshots avoid hundreds of individual cross-process property reads.
        // Refresh after every scroll. Raw view includes layout/cell peers omitted
        // from Control view by some DevExpress versions; never leave this grid.
        var viewport = new GridViewport { stage = stage, view = raw ? "raw" : "control", attempt = attempt, elapsedMs = (int)budget.ElapsedMilliseconds };
        info.viewports.Add(viewport);
        var cells = new Dictionary<int, Dictionary<int, string>>();
        try {
            var request = new CacheRequest { TreeScope = TreeScope.Subtree, TreeFilter = raw ? Automation.RawViewCondition : Automation.ControlViewCondition, AutomationElementMode = AutomationElementMode.None };
            foreach (var property in new[] { AutomationElement.NameProperty, AutomationElement.AutomationIdProperty, AutomationElement.ClassNameProperty,
                AutomationElement.ControlTypeProperty, AutomationElement.IsOffscreenProperty, AutomationElement.IsPasswordProperty,
                ValuePattern.ValueProperty, GridItemPattern.RowProperty, GridItemPattern.ColumnProperty }) request.Add(property);
            var pending = new Stack<KeyValuePair<AutomationElement, int>>();
            pending.Push(new KeyValuePair<AutomationElement, int>(grid.GetUpdatedCache(request), 0));
            while (pending.Count > 0 && viewport.nodes < 3000 && budget.ElapsedMilliseconds < deadline) {
                var next = pending.Pop(); viewport.nodes++;
                var element = next.Key;
                if (Object.Equals(Cached(element, AutomationElement.IsPasswordProperty), true)) continue;
                bool offscreen = Object.Equals(Cached(element, AutomationElement.IsOffscreenProperty), true);
                string name = Text(Cached(element, AutomationElement.NameProperty)), automationId = Text(Cached(element, AutomationElement.AutomationIdProperty));
                var type = Cached(element, AutomationElement.ControlTypeProperty) as ControlType;
                // Preserve a bounded sample even when there are no readable cells.
                if (viewport.sample.Count < 16) viewport.sample.Add(new { depth = next.Value, name = name, automationId = automationId,
                    className = Text(Cached(element, AutomationElement.ClassNameProperty)), type = type == null ? "" : type.ProgrammaticName, offscreen = offscreen });
                // Hidden search panels/other pages are excluded. Raw layout wrappers
                // may be offscreen even when their children are visible, so descend
                // through unlabelled panes but accept only visible cell values.
                if (offscreen && (automationId == "SearchPanel" || type == ControlType.DataGrid)) continue;
                if (!offscreen) {
                    var match = GridCellName.Match(name);
                    object rowProperty = Cached(element, GridItemPattern.RowProperty), columnProperty = Cached(element, GridItemPattern.ColumnProperty);
                    int row = -1, col = -1;
                    if (match.Success) { Int32.TryParse(match.Groups[1].Value, out row); Int32.TryParse(match.Groups[2].Value, out col); }
                    else if (rowProperty is int && columnProperty is int) { row = (int)rowProperty; col = (int)columnProperty; }
                    if (row >= 0 && row < 512 && col >= 0 && col < 2) {
                        viewport.cells++;
                        if (!cells.ContainsKey(row)) cells[row] = new Dictionary<int, string>();
                        if (!cells[row].ContainsKey(col) || automationId == "Title" || automationId == "Value") {
                            var value = Cached(element, ValuePattern.ValueProperty);
                            cells[row][col] = value != null ? Trim(Text(value)) : match.Success ? Trim(match.Groups[3].Value) : Trim(name);
                        }
                    }
                }
                var children = element.CachedChildren;
                if (next.Value >= 18) { if (children != null && children.Count > 0) viewport.limited = true; continue; }
                if (children != null) foreach (AutomationElement child in children) pending.Push(new KeyValuePair<AutomationElement, int>(child, next.Value + 1));
            }
            if (pending.Count > 0) viewport.limited = true;
        } catch (Exception error) { viewport.error = error.GetType().Name + ": " + error.Message; }
        var rows = cells.Where(r => r.Value.ContainsKey(0) && r.Value.ContainsKey(1))
            .Select(r => new GridRow { index = r.Key, title = r.Value[0], value = r.Value[1] }).OrderBy(r => r.index).ToList();
        foreach (var row in rows) AddRow(info, row.index, row.title, row.value);
        viewport.rows = rows.Count; viewport.visibleRows = rows.Select(r => r.index).ToArray(); viewport.anchorVisible = rows.Any(FillAnchor);
        return rows;
    }
    static List<GridRow> CaptureRows(AutomationElement grid, GridInfo info, ScrollPattern scroll, string stage, Stopwatch budget, int deadline, bool retry) {
        var rows = new List<GridRow>();
        // Up to 800ms for controls that rebuild peers asynchronously after scrolling.
        for (int attempt = 0; attempt < (retry ? 3 : 1) && budget.ElapsedMilliseconds < deadline; attempt++) {
            if (attempt > 0) Pause(budget, deadline, 400);
            rows = VisibleRows(grid, info, stage, false, attempt, budget, deadline);
            if (rows.Count == 0 && budget.ElapsedMilliseconds < deadline) rows = VisibleRows(grid, info, stage, true, attempt, budget, deadline);
            if (scroll != null) foreach (var viewport in info.viewports.Where(v => v.stage == stage && v.attempt == attempt)) {
                try { viewport.verticalPercent = scroll.Current.VerticalScrollPercent; } catch { }
            }
            if (rows.Count > 0) break;
        }
        return rows;
    }
    static void Pause(Stopwatch budget, int deadline, int milliseconds) {
        int remaining = deadline - (int)budget.ElapsedMilliseconds;
        if (remaining > 0) System.Threading.Thread.Sleep(Math.Min(milliseconds, remaining));
    }
    static ScrollPattern GridScroll(AutomationElement grid) {
        object pattern;
        if (grid.TryGetCurrentPattern(ScrollPattern.Pattern, out pattern)) return (ScrollPattern)pattern;
        // Some providers put scrolling on a child viewer. Never scroll an
        // ancestor/queue, which could change the selected order.
        var children = grid.FindAll(TreeScope.Descendants, new PropertyCondition(AutomationElement.IsScrollPatternAvailableProperty, true));
        foreach (AutomationElement child in children) if (!child.Current.IsOffscreen && child.TryGetCurrentPattern(ScrollPattern.Pattern, out pattern)) return (ScrollPattern)pattern;
        return null;
    }
    static bool CompleteGrid(GridInfo info) {
        return info.rowCount >= 0 && info.rowCount <= 512 && info.rows.Count == info.rowCount;
    }
    static bool HasPon(GridInfo info) { return info.rows.Any(r => PonTitle(r.title) && ValidPon(r.value)); }
    static void DescribeViewport(GridViewport view, AutomationElement element, ScrollPattern scroll) {
        try {
            var rect = element.Current.BoundingRectangle;
            if (!rect.IsEmpty) view.bounds = new { x = rect.X, y = rect.Y, width = rect.Width, height = rect.Height };
            if (scroll != null) {
                view.verticalPercent = scroll.Current.VerticalScrollPercent;
                view.horizontalPercent = scroll.Current.HorizontalScrollPercent;
                view.verticalViewSize = scroll.Current.VerticalViewSize;
            }
        } catch (Exception error) { view.error = error.GetType().Name + ": " + error.Message; }
    }
    static void IndexedViewport(AutomationElement element, GridInfo info, ScrollPattern scroll, string stage, Stopwatch budget, int deadline) {
        // Retry AFTER scrolling. Some providers expose neither tree children nor
        // offscreen indexed cells. Do not abandon them because rows 0..2 were
        // unreadable while the viewport was at the bottom.
        var view = new GridViewport { stage = stage, view = "indexed-viewport", elapsedMs = (int)budget.ElapsedMilliseconds };
        info.viewports.Add(view); DescribeViewport(view, element, scroll);
        var found = new List<int>(); object pattern;
        try {
            if (!element.TryGetCurrentPattern(GridPattern.Pattern, out pattern)) return;
            var grid = (GridPattern)pattern;
            int count = Math.Min(grid.Current.RowCount, 512);
            if (grid.Current.ColumnCount != 2) return;
            int start = 0;
            if (view.verticalPercent >= 0 && view.verticalViewSize > 0 && view.verticalViewSize <= 100)
                start = Math.Max(0, Math.Min(count - 1, (int)Math.Floor(count * (1 - view.verticalViewSize / 100) * view.verticalPercent / 100) - 2));
            // GetItem itself can scroll DevExpress grids, even when it returns
            // null. Probe only near this viewport, allow realization to settle,
            // and stop after three misses instead of racing through every row.
            int span = view.verticalViewSize > 0 ? Math.Min(count, (int)Math.Ceiling(count * view.verticalViewSize / 100) + 4) : Math.Min(count, 32);
            int failures = 0;
            for (int row = start; row < Math.Min(count, start + span) && !HasPon(info) && budget.ElapsedMilliseconds < deadline; row++) {
                view.probes++;
                try {
                    var title = grid.GetItem(row, 0); var value = grid.GetItem(row, 1);
                    if (title == null || value == null) {
                        int missing = (title == null ? 1 : 0) + (value == null ? 1 : 0); view.nullCells += missing; info.nullCells += missing;
                        Pause(budget, deadline, 500); view.retries++;
                        // Refresh peers after the provider's implicit scroll;
                        // this can also recover the PON from a newly drawn row.
                        CaptureRows(element, info, scroll, stage + "-settled-" + row, budget, deadline, false);
                        if (HasPon(info) || budget.ElapsedMilliseconds >= deadline) break;
                        title = grid.GetItem(row, 0); value = grid.GetItem(row, 1);
                        if (title == null || value == null) {
                            missing = (title == null ? 1 : 0) + (value == null ? 1 : 0); view.nullCells += missing; info.nullCells += missing;
                            if (++failures >= 3) break;
                            continue;
                        }
                    }
                    // An indexed provider may realize offscreen rows as a side
                    // effect. The row index still comes from GetItem, not pixels.
                    AddRow(info, row, CellText(title), CellText(value)); found.Add(row); view.cells += 2; failures = 0;
                } catch (Exception error) { info.rowFailures++; if (view.error == "") view.error = error.GetType().Name + ": " + error.Message; if (++failures >= 3) break; }
            }
        } catch (Exception error) { view.error = error.GetType().Name + ": " + error.Message; }
        finally {
            view.rows = found.Count; view.visibleRows = found.ToArray(); view.limited = budget.ElapsedMilliseconds >= deadline;
            try { if (scroll != null) view.verticalAfterProbe = scroll.Current.VerticalScrollPercent; } catch { }
        }
    }
    static ControlInfo PointCell(AutomationElement hit, string gridId, int pid) {
        ControlInfo cell = null;
        // A screen point can hit an overlay or another Framework window. Require
        // the exact grid in its ancestor chain, not just a matching process/label.
        for (int depth = 0; hit != null && depth < 24; depth++) {
            if (hit.Current.ProcessId != pid || hit.Current.IsPassword) return null;
            if (Id(hit) == gridId) return cell;
            var item = Read(hit);
            if (item != null && !item.offscreen && GridCellName.IsMatch(item.name ?? "")) cell = item;
            hit = TreeWalker.RawViewWalker.GetParent(hit);
        }
        return null;
    }
    static void PointViewport(AutomationElement element, GridInfo info, ScrollPattern scroll, string stage, Stopwatch budget, int deadline) {
        var view = new GridViewport { stage = stage, view = "point", elapsedMs = (int)budget.ElapsedMilliseconds };
        info.viewports.Add(view); DescribeViewport(view, element, scroll);
        var cells = new Dictionary<int, Dictionary<int, string>>(); var seen = new HashSet<string>(); var hits = new HashSet<string>();
        try {
            var bounds = element.Current.BoundingRectangle; int pid = element.Current.ProcessId; string gridId = Id(element);
            if (bounds.IsEmpty || bounds.Width < 4 || bounds.Height < 4 || element.Current.IsOffscreen) { view.error = "The selected detail grid has no visible screen area."; return; }
            // Read-only hit testing, never mouse input/OCR. Recompute bounds on
            // each viewport so moves/resizes and display scaling are respected.
            // Sampling both sides of the grid tolerates uneven column widths.
            double[] columns = { 0.08, 0.25, 0.45, 0.65, 0.85, 0.96 };
            for (double y = bounds.Top + 4; y < bounds.Bottom - 2 && view.probes < 900 && !HasPon(info) && budget.ElapsedMilliseconds < deadline; y += 8) {
                foreach (double fraction in columns) {
                    if (budget.ElapsedMilliseconds >= deadline || view.probes >= 900) break;
                    view.probes++;
                    var hit = AutomationElement.FromPoint(new System.Windows.Point(bounds.Left + bounds.Width * fraction, y));
                    if (hit == null || !hits.Add(Id(hit))) continue;
                    var cell = PointCell(hit, gridId, pid);
                    if (cell == null) {
                        view.rejected++;
                        // Log the rejected shape to distinguish an empty data
                        // presenter from occlusion, without reading another PID.
                        if (view.sample.Count < 16) {
                            bool sameProcess = hit.Current.ProcessId == pid;
                            var rejected = sameProcess ? Read(hit) : null;
                            view.sample.Add(new { accepted = false, sameProcess = sameProcess, name = rejected == null ? "" : rejected.name,
                                automationId = rejected == null ? "" : rejected.automationId, type = rejected == null ? "" : rejected.type });
                        }
                        continue;
                    }
                    if (!seen.Add(cell.id)) continue;
                    var match = GridCellName.Match(cell.name ?? ""); int row, col;
                    if (!Int32.TryParse(match.Groups[1].Value, out row) || !Int32.TryParse(match.Groups[2].Value, out col) || row < 0 || row >= Math.Min(info.rowCount, 512) || col < 0 || col > 1) continue;
                    string value = String.IsNullOrWhiteSpace(cell.value) ? Trim(match.Groups[3].Value) : Trim(cell.value);
                    if (!cells.ContainsKey(row)) cells[row] = new Dictionary<int, string>();
                    cells[row][col] = value; view.cells++;
                    if (view.sample.Count < 16) view.sample.Add(new { row = row, column = col, name = cell.name, automationId = cell.automationId });
                    if (cells[row].ContainsKey(0) && cells[row].ContainsKey(1)) AddRow(info, row, cells[row][0], cells[row][1]);
                }
            }
        } catch (Exception error) { view.error = error.GetType().Name + ": " + error.Message; }
        finally {
            view.visibleRows = cells.Where(c => c.Value.ContainsKey(0) && c.Value.ContainsKey(1)).Select(c => c.Key).OrderBy(i => i).ToArray();
            view.rows = view.visibleRows.Length; view.limited = view.probes >= 900 || budget.ElapsedMilliseconds >= deadline;
        }
    }
    static void RecoverViewport(AutomationElement element, GridInfo info, ScrollPattern scroll, string stage, Stopwatch budget, int deadline, int handle) {
        int before = info.rows.Count;
        IndexedViewport(element, info, scroll, stage, budget, Math.Min(deadline, (int)budget.ElapsedMilliseconds + 2200));
        var indexed = info.viewports.Last(v => v.stage == stage && v.view == "indexed-viewport");
        if (HasPon(info)) return;
        // Keep page progression anchored to the viewport being inspected. A
        // failed GetItem call must not skip the remaining pages by leaving the
        // provider at the bottom, as observed in the eOrder diagnostic.
        if (scroll != null && indexed.verticalPercent >= 0) {
            try {
                if (Math.Abs(scroll.Current.VerticalScrollPercent - indexed.verticalPercent) > 0.001) {
                    scroll.SetScrollPercent(ScrollPattern.NoScroll, indexed.verticalPercent);
                    Pause(budget, deadline, 400); indexed.viewportRestore = "restored";
                }
                indexed.verticalAfterRecovery = scroll.Current.VerticalScrollPercent;
                if (Math.Abs(indexed.verticalAfterRecovery - indexed.verticalPercent) > 0.1) throw new InvalidOperationException("The detail grid did not return to the page being inspected.");
            } catch (Exception error) { indexed.viewportRestore = "failed"; throw new InvalidOperationException("Could not restore the scan page after indexed reads: " + error.Message); }
        }
        if (info.rows.Count > before || budget.ElapsedMilliseconds >= deadline) return;
        if (info.activation == "not-needed") {
            info.activation = SetForegroundWindow(new IntPtr(handle)) ? "foreground-request-accepted" : "foreground-request-denied";
            Pause(budget, deadline, 250);
        }
        PointViewport(element, info, scroll, stage, budget, Math.Min(deadline, (int)budget.ElapsedMilliseconds + 2200));
    }
    static void ReviewPosition(AutomationElement element, GridInfo info, ScrollPattern scroll, Stopwatch budget, int deadline) {
        if (scroll == null || !scroll.Current.VerticallyScrollable) return;
        // The technician wants the useful section left visible, not a restoration
        // to the starting viewport. Only move this already identified detail grid.
        try {
            scroll.SetScrollPercent(ScrollPattern.NoScroll, 100);
            Pause(budget, deadline, 500);
            for (int step = 0; step <= 24 && budget.ElapsedMilliseconds < deadline; step++) {
                var visible = CaptureRows(element, info, scroll, "review-" + step, budget, deadline, step == 0);
                if (visible.Any(FillAnchor)) {
                    info.anchorVisible = true; info.reviewPosition = "rxfill-visible"; return;
                }
                double before = scroll.Current.VerticalScrollPercent;
                if (before <= 0 || step == 24) break;
                scroll.Scroll(ScrollAmount.NoAmount, ScrollAmount.SmallDecrement);
                Pause(budget, deadline, 500);
                if (Math.Abs(scroll.Current.VerticalScrollPercent - before) < 0.001) break;
            }
        } catch (Exception error) { info.issues.Add("Review-position scan: " + error.GetType().Name + ": " + error.Message); }
        // If the anchor is absent/unreadable, bottom is an acceptable fallback.
        try {
            scroll.SetScrollPercent(ScrollPattern.NoScroll, 100);
            Pause(budget, deadline, 350);
            info.reviewPosition = scroll.Current.VerticalScrollPercent >= 99.9 ? "bottom" : "unconfirmed";
        } catch (Exception error) { info.reviewPosition = "unconfirmed"; info.issues.Add("Could not leave the details at the bottom: " + error.GetType().Name); }
    }
    static GridInfo ReadGrid(ControlInfo control, bool expand, bool positionReview, Stopwatch budget, int handle) {
        var info = new GridInfo { id = control.id, expanded = expand };
        ScrollPattern scroll = null;
        int readDeadline = Math.Min(26000, (int)budget.ElapsedMilliseconds + 22000);
        int reviewDeadline = Math.Min(34000, readDeadline + 8000);
        try {
            info.patterns = control.element.GetSupportedPatterns().Select(p => p.ProgrammaticName).ToArray();
            object pattern;
            GridPattern grid = control.element.TryGetCurrentPattern(GridPattern.Pattern, out pattern) ? (GridPattern)pattern : null;
            if (grid != null) { info.rowCount = grid.Current.RowCount; info.columnCount = grid.Current.ColumnCount; }
            scroll = GridScroll(control.element);
            CaptureRows(control.element, info, scroll, "initial", budget, readDeadline, expand); info.initialRows = info.rows.Count;
            if (!expand) return info;
            if (info.initialRows == 0) {
                info.method += " + viewport recovery";
                RecoverViewport(control.element, info, scroll, "initial-recovery", budget, readDeadline, handle);
            }
            if (!HasPon(info) && info.initialRows > 0 && grid != null && info.columnCount == 2) {
                info.method += " + GridPattern + refreshed accessibility snapshots";
                int consecutiveFailures = 0;
                for (int row = 0; row < Math.Min(info.rowCount, 512) && !HasPon(info) && budget.ElapsedMilliseconds < readDeadline; row++) {
                    try {
                        AutomationElement title = null, value = null;
                        for (int attempt = 0; attempt < 2 && budget.ElapsedMilliseconds < readDeadline; attempt++) {
                            title = grid.GetItem(row, 0); value = grid.GetItem(row, 1);
                            if (title != null && value != null) break;
                            info.nullCells += (title == null ? 1 : 0) + (value == null ? 1 : 0);
                            Pause(budget, readDeadline, 200);
                        }
                        if (title == null || value == null) throw new InvalidOperationException("GridPattern returned no cell after retry at row " + row + ".");
                        foreach (var cell in new[] { title, value }) {
                            if (cell.TryGetCurrentPattern(VirtualizedItemPattern.Pattern, out pattern)) ((VirtualizedItemPattern)pattern).Realize();
                        }
                        AddRow(info, row, CellText(title), CellText(value)); consecutiveFailures = 0;
                    } catch (Exception error) {
                        info.rowFailures++;
                        if (++consecutiveFailures == 1) info.issues.Add("GridPattern row " + row + ": " + error.GetType().Name + ": " + error.Message);
                        if (consecutiveFailures >= 3) break;
                    }
                }
            }
            if (!HasPon(info) && !CompleteGrid(info) && scroll != null && scroll.Current.VerticallyScrollable && budget.ElapsedMilliseconds < readDeadline) {
                info.method += " + settled scroll";
                scroll.SetScrollPercent(ScrollPattern.NoScroll, 0);
                Pause(budget, readDeadline, 350);
                for (int page = 0; page < 40 && !HasPon(info) && budget.ElapsedMilliseconds < readDeadline; page++) {
                    var visible = CaptureRows(control.element, info, scroll, "page-" + page, budget, readDeadline, true); info.pages++;
                    if (visible.Count == 0 && !HasPon(info)) RecoverViewport(control.element, info, scroll, "page-" + page + "-recovery", budget, readDeadline, handle);
                    if (HasPon(info)) break;
                    double before = scroll.Current.VerticalScrollPercent;
                    if (before >= 99.99) break;
                    scroll.Scroll(ScrollAmount.NoAmount, ScrollAmount.LargeIncrement);
                    Pause(budget, readDeadline, 350);
                    if (Math.Abs(scroll.Current.VerticalScrollPercent - before) < 0.001) { info.issues.Add("Detail grid did not advance when scrolled."); break; }
                }
            }
        } catch (Exception error) { info.issues.Add("Detail grid inspection failed: " + error.GetType().Name + ": " + error.Message); }
        finally {
            if (expand && positionReview) {
                try { ReviewPosition(control.element, info, scroll, budget, reviewDeadline); }
                catch (Exception error) { info.issues.Add("Review-position unavailable: " + error.GetType().Name); }
            }
            try { if (scroll != null) info.finalVerticalPercent = scroll.Current.VerticalScrollPercent; } catch { }
            info.complete = CompleteGrid(info);
            info.ponFound = HasPon(info);
            info.ponCandidates = info.rows.Where(r => PonTitle(r.title)).Select(r => (object)new { index = r.index, title = r.title, value = r.value,
                accepted = ValidPon(r.value), reason = ValidPon(r.value) ? "accepted" : String.IsNullOrWhiteSpace(r.value) ? "empty-value" : "unsupported-identifier-format" }).ToList();
            info.stopReason = info.ponFound ? "pon-found" : !expand ? "not-expanded" : info.complete ? "all-rows-read-no-pon" : "provider-or-scan-limit";
            if (expand && !info.ponFound && !info.complete) info.issues.Add("PON not found. Read " + info.rows.Count + " of " + info.rowCount + " advertised detail rows; see viewport samples, null-cell counts and provider errors.");
            info.rows = info.rows.OrderBy(r => r.index).ToList();
        }
        return info;
    }
    static object FieldInfo(WindowInfo window, ControlInfo control, bool manual) {
        return new { id = control.id, value = control.value, label = Label(control), pid = window.pid,
            started = window.started, window = window.id, handle = window.handle, manual = manual };
    }
    static object Detect(DesktopSnapshot snapshot, string chosenId = null, string chosenField = null) {
        if (snapshot.entryUnavailable) return new { ok = false, error = snapshot.issues.FirstOrDefault(), windowSelectionRequired = true, diagnostics = snapshot };
        var open = snapshot.windows.Where(w => w.openErx).ToArray();
        var scope = open.Length > 0 ? open : snapshot.windows.ToArray();
        var pons = scope.SelectMany(w => w.controls).Where(c => !c.hidden && !c.inTriage && (open.Length == 0 || c.inOpenErx)).Select(c => Pon(c))
            .Concat(scope.SelectMany(w => w.grids).SelectMany(g => g.rows).Where(r => PonTitle(r.title) && ValidPon(r.value)).Select(r => r.value))
            .Where(p => p != "").Distinct(StringComparer.Ordinal).OrderBy(p => p, StringComparer.Ordinal).ToArray();
        var warnings = new List<string>(snapshot.issues);
        if (pons.Length > 1) warnings.Add("Multiple PONs detected: " + String.Join(", ", pons) + ". Match the intended order before sending.");
        if (snapshot.windows.Any(w => w.incomplete)) warnings.Add("Some Framework controls could not be read. Verify the destination in Framework.");
        if (open.Any(w => w.grids.Any(g => g.expanded && !g.ponFound && !g.complete))) warnings.Add("The PON could not be read from an open E-Rx detail grid. Export desktop diagnostics if the order is missing.");
        if (open.Any(w => w.grids.Any(g => g.expanded && g.rows.Count == 0 && g.rowCount > 0))) warnings.Add("The selected E-Rx grid reports rows but exposes no readable cells. Try Choose entry window and keep Framework in front until reading finishes, then download the PON detection report.");
        var positions = open.SelectMany(w => w.grids).Where(g => g.expanded).Select(g => g.reviewPosition).ToArray();
        string viewportStatus = positions.Contains("rxfill-visible") ? "Framework details left at RxFill Indicator / All Fill Statuses. Check the SIG and administration times there."
            : positions.Contains("bottom") ? "Framework details left at the bottom. RxFill Indicator / All Fill Statuses could not be read; scroll up to it if needed."
            : positions.Contains("unconfirmed") ? "The final detail-grid position could not be confirmed. You can position it manually." : null;
        var fields = new Dictionary<string, object>();
        foreach (var field in new[] { "sig", "times" }) {
            var controls = snapshot.windows.SelectMany(w => w.controls.Select(c => new { window = w, control = c }))
                .Where(x => chosenField == field ? x.control.id == chosenId : Field(x.control, field) && !x.control.inTriage && (open.Length == 0 || x.control.inOpenErx)).ToArray();
            if (controls.Length == 1) fields[field] = FieldInfo(controls[0].window, controls[0].control, chosenField == field);
        }
        return new { ok = true, pon = pons.Length == 1 ? pons[0] : null, pons = pons, fields = fields, warnings = warnings,
            instances = snapshot.windows.Select(w => w.pid).Distinct().Count(), openErxWindows = open.Length, viewportStatus = viewportStatus,
            entryWindow = snapshot.entryWindow, scanMode = snapshot.scanMode, diagnostics = snapshot };
    }
    static string Serialize(object value) { return Json.Serialize(value); }
    static Dictionary<string, object> Map(object value) { return (Dictionary<string, object>)value; }
    static EntryWindow FocusedWindow(AutomationElement focused, string testProcess) {
        if (focused == null) throw new Exception("Click inside the Framework entry window and choose it again.");
        var root = focused; string desktopId = Id(AutomationElement.RootElement);
        for (int depth = 0; depth < 40; depth++) {
            var parent = TreeWalker.RawViewWalker.GetParent(root);
            if (parent == null || Id(parent) == desktopId) {
                using (var process = Process.GetProcessById(root.Current.ProcessId)) {
                    if (!FrameworkProcess(process, testProcess) || root.Current.NativeWindowHandle == 0)
                        throw new Exception("Click inside the Framework entry window in this Windows session and choose it again.");
                    return new EntryWindow { pid = process.Id, started = process.StartTime.ToUniversalTime().Ticks.ToString(),
                        handle = root.Current.NativeWindowHandle, id = Id(root), title = root.Current.Name };
                }
            }
            root = parent;
        }
        throw new Exception("The focused Framework window could not be identified. Choose it again.");
    }
    static object ChooseEntryWindow(string testProcess, bool positionReview) {
        System.Threading.Thread.Sleep(8000);
        var entry = FocusedWindow(AutomationElement.FocusedElement, testProcess);
        var snapshot = Scan(testProcess, true, positionReview, entry); snapshot.scanMode = "chosen-entry";
        return Detect(snapshot);
    }
    static object ChooseTarget(string field, string testProcess) {
        if (field != "sig" && field != "times") throw new Exception("Unknown destination field.");
        // Read-only selection. The technician clicks a field during the countdown,
        // then sees its label/current text in Sig-Assist before a separate Send.
        System.Threading.Thread.Sleep(8000);
        var focused = AutomationElement.FocusedElement;
        var selected = Read(focused);
        if (selected == null || selected.offscreen || !selected.enabled || !selected.writable || selected.type != "ControlType.Edit") throw new Exception("The selected field is not an editable text field. Click directly inside the Framework field and choose it again.");
        var snapshot = Scan(testProcess, false, false, FocusedWindow(focused, testProcess));
        if (!snapshot.windows.Any(w => w.controls.Any(c => c.id == selected.id))) throw new Exception("The selected field is outside Framework in this Windows session.");
        return Detect(snapshot, selected.id, field);
    }
    static object Send(Dictionary<string, object> input, DesktopSnapshot snapshot, string testProcess) {
        var expected = Map(input["expected"]);
        string field = Text(input["field"]), value = Text(input["value"]);
        if (field != "sig" && field != "times") throw new Exception("Unknown destination field.");
        if (String.IsNullOrWhiteSpace(value) || value.Length > (field == "sig" ? 4000 : 500) || value.Any(c => Char.IsControl(c) && c != '\n' && c != '\r')) throw new Exception("Invalid field text.");
        var fields = Map(expected["fields"]);
        if (!fields.ContainsKey(field)) throw new Exception("Choose the destination field in Framework first.");
        var info = Map(fields[field]);
        var window = snapshot.windows.SingleOrDefault(w => w.id == Text(info["window"]) && w.pid == Convert.ToInt32(info["pid"]) && w.started == Text(info["started"]));
        if (window == null) throw new Exception("The chosen Framework window is closed or was replaced. Choose the destination field again.");
        var control = window.controls.SingleOrDefault(c => c.id == Text(info["id"]));
        if (control == null) throw new Exception("The chosen field no longer exists. Choose the destination field again.");
        var fresh = Read(control.element);
        if (fresh == null || fresh.offscreen || !fresh.enabled || !fresh.writable || fresh.type != "ControlType.Edit") throw new Exception("The chosen field cannot currently accept text. Make it visible and editable in Framework.");
        var warnings = new List<string>();
        var current = Map(Json.DeserializeObject(Serialize(Detect(snapshot))));
        if (Serialize(current["pons"]) != Serialize(expected["pons"])) warnings.Add("The exposed PONs changed since detection. Verify the intended order in Framework.");
        if (fresh.value != Text(info["value"])) warnings.Add("The destination text changed since it was identified. The technician-approved text replaced its current contents.");
        foreach (object warning in (System.Collections.IEnumerable)current["warnings"]) warnings.Add(Text(warning));
        writeAttempted = true;
        ((ValuePattern)control.element.GetCurrentPattern(ValuePattern.Pattern)).SetValue(value);
        var after = Read(control.element);
        if (after == null || after.id != fresh.id || after.value != value)
            return new { ok = false, uncertain = true, error = "A write was attempted but exact text read-back failed. Inspect Framework before sending again." };
        return new { ok = true, verified = true, field = field, warnings = warnings,
            detected = Detect(Scan(testProcess, false, false, Identity(window)), control.id, field) };
    }
    [STAThread]
    public static int Main(string[] args) {
        Console.InputEncoding = Encoding.UTF8; Console.OutputEncoding = new UTF8Encoding(false);
        try {
            // Only the synthetic Windows test runner uses this argument. The connector never passes it.
            string testProcess = args.Length == 2 && args[0] == "--test-process" ? args[1] : null;
            var input = Map(Json.DeserializeObject(Console.In.ReadToEnd()));
            var action = Text(input["action"]);
            if (action == "target") { Console.WriteLine(Serialize(ChooseTarget(Text(input["field"]), testProcess))); return 0; }
            bool positionReview = input.ContainsKey("positionReview") && Object.Equals(input["positionReview"], true);
            if (action == "window") { Console.WriteLine(Serialize(ChooseEntryWindow(testProcess, positionReview))); return 0; }
            var entry = input.ContainsKey("entryWindow") ? InputWindow(input["entryWindow"]) : null;
            if (action == "send") {
                var fields = Map(Map(input["expected"])["fields"]); string field = Text(input["field"]);
                if (!fields.ContainsKey(field)) throw new Exception("Choose the destination field in Framework first.");
                var destination = Map(fields[field]);
                entry = new EntryWindow { pid = Convert.ToInt32(destination["pid"]), started = Text(destination["started"]),
                    id = Text(destination["window"]), handle = Convert.ToInt32(destination["handle"]) };
            }
            var snapshot = Scan(testProcess, action == "detect" || action == "inspect", positionReview, entry);
            object result = action == "detect" ? Detect(snapshot) : action == "inspect" ? (object)new { ok = true, diagnostics = snapshot } : action == "send" ? Send(input, snapshot, testProcess) : throwUnknown();
            Console.WriteLine(Serialize(result)); return 0;
        } catch (Exception error) { Console.WriteLine(Serialize(new { ok = false, uncertain = writeAttempted, error = error.Message })); return 0; }
    }
    static object throwUnknown() { throw new Exception("Unknown desktop action."); }
}
