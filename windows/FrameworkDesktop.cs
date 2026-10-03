// Standalone .NET Framework helper. No vendor code, PowerShell, keystrokes or clipboard.
// UI Automation providers vary by Framework release: unsupported controls fail closed.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using System.Windows.Automation;

public sealed class ControlInfo {
    public string id, parentId, automationId, name, label, value, type, className;
    public int depth;
    public bool offscreen, hidden, enabled, writable, inOpenErx;
    [ScriptIgnore] public AutomationElement element;
}
public sealed class WindowInfo {
    public int pid;
    public string process, started, id, title;
    public bool incomplete, openErx;
    public List<ControlInfo> controls = new List<ControlInfo>();
    public List<GridInfo> grids = new List<GridInfo>();
}
public sealed class GridRow {
    public int index;
    public string title, value;
}
public sealed class GridInfo {
    public string id, method = "visible rows";
    public string[] patterns = new string[0];
    public int rowCount = -1, columnCount = -1, pages, initialRows;
    public bool complete, scrollRestored = true;
    public List<GridRow> rows = new List<GridRow>();
    public List<string> issues = new List<string>();
}
sealed class ScanNode {
    public AutomationElement element;
    public string parentId;
    public int depth;
    public bool hidden, inOpenErx;
}
public sealed class DesktopSnapshot {
    public string format = "sig-assist-framework-desktop";
    public int schemaVersion = 2;
    public List<WindowInfo> windows = new List<WindowInfo>();
    public List<string> issues = new List<string>();
}
public static class FrameworkDesktop {
    static bool writeAttempted;
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 4 * 1024 * 1024 };
    static readonly Regex PonLabel = new Regex(@"^(?:PON|Prescriber Order (?:Number|No\.?))\s*:?$", RegexOptions.IgnoreCase);
    static readonly Regex PonInline = new Regex(@"^(?:PON|Prescriber Order (?:Number|No\.?))\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9_.\-/]{0,99})\s*$", RegexOptions.IgnoreCase);
    static readonly Regex GridCellName = new Regex(@"^Row (\d+), Column (\d+):\s*(.*)$", RegexOptions.Singleline);
    static string Text(object value) { return value == null ? "" : Convert.ToString(value); }
    static string Id(AutomationElement element) { return String.Join(".", element.GetRuntimeId().Select(x => x.ToString()).ToArray()); }
    static string Trim(string value) { return (value ?? "").Trim(); }
    static string Label(ControlInfo control) { return Trim(String.IsNullOrWhiteSpace(control.label) ? control.name : control.label).TrimEnd(':').Trim(); }
    static bool ValidPon(string value) { return Regex.IsMatch(value ?? "", @"^[A-Za-z0-9][A-Za-z0-9_.\-/]{0,99}$") && value != "PON"; }
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
    static DesktopSnapshot Scan(string testProcess, bool expandGrids = false) {
        var result = new DesktopSnapshot();
        var session = Process.GetCurrentProcess().SessionId;
        var processes = new Dictionary<int, Process>();
        foreach (var process in Process.GetProcesses()) {
            try {
                bool match = testProcess == null ? new[] { "FrameworkLTC", "SoftWriters.FrameworkLtc" }.Contains(process.ProcessName, StringComparer.OrdinalIgnoreCase) : process.ProcessName == testProcess;
                if (match && process.SessionId == session) processes.Add(process.Id, process);
            } catch { }
        }
        if (processes.Count == 0) { result.issues.Add("Framework is not running in this Windows session. Start the connector inside the same Citrix session as Framework."); return result; }
        var roots = AutomationElement.RootElement.FindAll(TreeScope.Children, Condition.TrueCondition);
        foreach (AutomationElement root in roots) {
            int pid;
            try { pid = root.Current.ProcessId; } catch { continue; }
            if (!processes.ContainsKey(pid)) continue;
            WindowInfo window;
            try {
                window = new WindowInfo { pid = pid, process = processes[pid].ProcessName, started = processes[pid].StartTime.ToUniversalTime().Ticks.ToString(), id = Id(root), title = root.Current.Name };
                if (root.Current.IsOffscreen) continue;
            } catch { result.issues.Add("A Framework window could not be inspected."); continue; }
            result.windows.Add(window);
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
                    item.inOpenErx = next.inOpenErx || (!item.hidden && item.enabled && OpenView(item));
                    if (item.inOpenErx && !item.hidden) window.openErx = true;
                    window.controls.Add(item);
                    var child = TreeWalker.ControlViewWalker.GetFirstChild(next.element);
                    if (next.depth >= 24 && child != null) { window.incomplete = true; continue; }
                    int siblings = 0;
                    while (child != null) {
                        if (++siblings > 1800) { window.incomplete = true; break; }
                        pending.Push(new ScanNode { element = child, parentId = item.id, depth = next.depth + 1, hidden = item.hidden, inOpenErx = item.inOpenErx });
                        child = TreeWalker.ControlViewWalker.GetNextSibling(child);
                    }
                } catch { window.incomplete = true; }
            }
        }
        // Only the visible detail grids of an opened wizard are expanded. Triage
        // rows and hidden cached wizard pages belong to other orders.
        var budget = Stopwatch.StartNew();
        foreach (var window in result.windows.Where(w => w.openErx)) {
            foreach (var grid in window.controls.Where(c => c.inOpenErx && !c.hidden && c.enabled && c.type == "ControlType.DataGrid" && c.automationId == "ERxGrid")) {
                window.grids.Add(ReadGrid(grid, expandGrids, budget));
            }
        }
        if (result.windows.Count == 0) result.issues.Add("No accessible Framework window is open. A remote Citrix picture on a local desktop cannot expose the remote fields.");
        return result;
    }
    static bool PonTitle(string title) {
        // Title/value detail rows, not PrescriberOrderNumber columns in a queue.
        return Regex.IsMatch(Regex.Replace(title ?? "", @"[\s_:#.\-]", ""), @"^(?:PON|PrescriberOrder(?:Number|No))$", RegexOptions.IgnoreCase);
    }
    static string CellText(AutomationElement cell) {
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
    static void VisibleRows(AutomationElement grid, GridInfo info) {
        // Framework's DevExpress provider exposes sibling Title/Value cells,
        // named "Row n, Column n: ...". Pair by row, never traversal adjacency.
        var cells = new Dictionary<int, Dictionary<int, string>>();
        var pending = new Stack<KeyValuePair<AutomationElement, int>>();
        pending.Push(new KeyValuePair<AutomationElement, int>(grid, 0));
        int visited = 0;
        while (pending.Count > 0 && ++visited <= 2200) {
            var next = pending.Pop();
            var item = Read(next.Key);
            if (item == null || item.offscreen) continue;
            var match = GridCellName.Match(item.name ?? "");
            if (match.Success) {
                int row = Int32.Parse(match.Groups[1].Value), col = Int32.Parse(match.Groups[2].Value);
                if (row < 512 && col < 2) {
                    if (!cells.ContainsKey(row)) cells[row] = new Dictionary<int, string>();
                    if (!cells[row].ContainsKey(col) || item.automationId == "Title" || item.automationId == "Value")
                        cells[row][col] = String.IsNullOrEmpty(item.value) ? Trim(match.Groups[3].Value) : Trim(item.value);
                }
            }
            if (next.Value >= 6) continue;
            var child = TreeWalker.ControlViewWalker.GetFirstChild(next.Key);
            int siblings = 0;
            while (child != null && ++siblings <= 2200) {
                pending.Push(new KeyValuePair<AutomationElement, int>(child, next.Value + 1));
                child = TreeWalker.ControlViewWalker.GetNextSibling(child);
            }
        }
        foreach (var row in cells.Where(r => r.Value.ContainsKey(0) && r.Value.ContainsKey(1))) AddRow(info, row.Key, row.Value[0], row.Value[1]);
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
    static GridInfo ReadGrid(ControlInfo control, bool expand, Stopwatch budget) {
        var info = new GridInfo { id = control.id };
        ScrollPattern scroll = null;
        double originalVertical = -1, originalHorizontal = -1;
        bool restore = false;
        try {
            info.patterns = control.element.GetSupportedPatterns().Select(p => p.ProgrammaticName).ToArray();
            VisibleRows(control.element, info); info.initialRows = info.rows.Count;
            object pattern;
            GridPattern grid = control.element.TryGetCurrentPattern(GridPattern.Pattern, out pattern) ? (GridPattern)pattern : null;
            if (grid != null) { info.rowCount = grid.Current.RowCount; info.columnCount = grid.Current.ColumnCount; }
            if (!expand) return info;
            scroll = GridScroll(control.element);
            if (scroll != null) {
                originalVertical = scroll.Current.VerticalScrollPercent; originalHorizontal = scroll.Current.HorizontalScrollPercent;
                restore = true; // GetItem/Realize can also move the viewport.
            }
            if (grid != null && info.columnCount == 2) {
                info.method = "GridPattern";
                int failures = 0;
                for (int row = 0; row < Math.Min(info.rowCount, 512) && budget.ElapsedMilliseconds < 12000; row++) {
                    try {
                        var title = grid.GetItem(row, 0); var value = grid.GetItem(row, 1);
                        // Realize only when the scroll position can be restored.
                        if (restore) foreach (var cell in new[] { title, value }) {
                            if (cell.TryGetCurrentPattern(VirtualizedItemPattern.Pattern, out pattern)) ((VirtualizedItemPattern)pattern).Realize();
                        }
                        AddRow(info, row, CellText(title), CellText(value));
                    } catch (Exception error) {
                        if (++failures == 1) info.issues.Add("GridPattern row read failed: " + error.GetType().Name);
                        if (failures >= 3) break;
                    }
                }
                info.complete = info.rowCount > 0 && info.rows.Count == info.rowCount;
            }
            if (!info.complete && scroll != null && scroll.Current.VerticallyScrollable && budget.ElapsedMilliseconds < 12000) {
                info.method += " + scroll";
                scroll.SetScrollPercent(ScrollPattern.NoScroll, 0);
                System.Threading.Thread.Sleep(100);
                for (int page = 0; page < 40 && budget.ElapsedMilliseconds < 12000; page++) {
                    VisibleRows(control.element, info); info.pages++;
                    double before = scroll.Current.VerticalScrollPercent;
                    if (before >= 99.99) {
                        info.complete = info.rowCount > 0 ? info.rows.Count == info.rowCount : true;
                        break;
                    }
                    scroll.Scroll(ScrollAmount.NoAmount, ScrollAmount.LargeIncrement);
                    System.Threading.Thread.Sleep(100);
                    if (Math.Abs(scroll.Current.VerticalScrollPercent - before) < 0.001) { info.issues.Add("Detail grid did not advance when scrolled."); break; }
                }
            }
            if (!info.complete) info.issues.Add("Detail grid read is partial (provider unsupported, row/page limit or time budget reached).");
        } catch (Exception error) { info.issues.Add("Detail grid inspection failed: " + error.GetType().Name + ": " + error.Message); }
        finally {
            if (restore) {
                try {
                    scroll.SetScrollPercent(originalHorizontal, originalVertical);
                    info.scrollRestored = (originalVertical < 0 || Math.Abs(scroll.Current.VerticalScrollPercent - originalVertical) < 0.5)
                        && (originalHorizontal < 0 || Math.Abs(scroll.Current.HorizontalScrollPercent - originalHorizontal) < 0.5);
                } catch { info.scrollRestored = false; }
                if (!info.scrollRestored) info.issues.Add("The detail grid's original scroll position could not be restored.");
            }
            info.rows = info.rows.OrderBy(r => r.index).ToList();
        }
        return info;
    }
    static object FieldInfo(WindowInfo window, ControlInfo control, bool manual) {
        return new { id = control.id, value = control.value, label = Label(control), pid = window.pid,
            started = window.started, window = window.id, manual = manual };
    }
    static object Detect(DesktopSnapshot snapshot, string chosenId = null, string chosenField = null) {
        var open = snapshot.windows.Where(w => w.openErx).ToArray();
        var scope = open.Length > 0 ? open : snapshot.windows.ToArray();
        var pons = scope.SelectMany(w => w.controls).Where(c => !c.hidden && (open.Length == 0 || c.inOpenErx)).Select(c => Pon(c))
            .Concat(scope.SelectMany(w => w.grids).SelectMany(g => g.rows).Where(r => PonTitle(r.title) && ValidPon(r.value)).Select(r => r.value))
            .Where(p => p != "").Distinct(StringComparer.Ordinal).OrderBy(p => p, StringComparer.Ordinal).ToArray();
        var warnings = new List<string>(snapshot.issues);
        if (pons.Length > 1) warnings.Add("Multiple PONs detected: " + String.Join(", ", pons) + ". Match the intended order before sending.");
        if (snapshot.windows.Any(w => w.incomplete)) warnings.Add("Some Framework controls could not be read. Verify the destination in Framework.");
        if (open.Length > 1) warnings.Add("More than one Framework window has an open E-Rx. Check the intended order; sending remains available after review.");
        if (open.Any(w => w.grids.Any(g => !g.complete))) warnings.Add("Some open E-Rx detail rows could not be read. Export desktop diagnostics if the order is missing.");
        if (open.Any(w => w.grids.Any(g => !g.scrollRestored))) warnings.Add("The E-Rx details scroll position changed during detection and could not be restored.");
        var fields = new Dictionary<string, object>();
        foreach (var field in new[] { "sig", "times" }) {
            var controls = snapshot.windows.SelectMany(w => w.controls.Select(c => new { window = w, control = c }))
                .Where(x => chosenField == field ? x.control.id == chosenId : Field(x.control, field) && (open.Length == 0 || x.control.inOpenErx)).ToArray();
            if (controls.Length == 1) fields[field] = FieldInfo(controls[0].window, controls[0].control, chosenField == field);
        }
        return new { ok = true, pon = pons.Length == 1 ? pons[0] : null, pons = pons, fields = fields, warnings = warnings,
            instances = snapshot.windows.Select(w => w.pid).Distinct().Count(), openErxWindows = open.Length, diagnostics = snapshot };
    }
    static string Serialize(object value) { return Json.Serialize(value); }
    static Dictionary<string, object> Map(object value) { return (Dictionary<string, object>)value; }
    static object ChooseTarget(string field, string testProcess) {
        if (field != "sig" && field != "times") throw new Exception("Unknown destination field.");
        // Read-only selection. The technician clicks a field during the countdown,
        // then sees its label/current text in Sig-Assist before a separate Send.
        System.Threading.Thread.Sleep(8000);
        var focused = AutomationElement.FocusedElement;
        var selected = Read(focused);
        if (selected == null || selected.offscreen || !selected.enabled || !selected.writable || selected.type != "ControlType.Edit") throw new Exception("The selected field is not an editable text field. Click directly inside the Framework field and choose it again.");
        var snapshot = Scan(testProcess);
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
            detected = Detect(Scan(testProcess), control.id, field) };
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
            var snapshot = Scan(testProcess, action == "detect" || action == "inspect");
            object result = action == "detect" ? Detect(snapshot) : action == "inspect" ? (object)new { ok = true, diagnostics = snapshot } : action == "send" ? Send(input, snapshot, testProcess) : throwUnknown();
            Console.WriteLine(Serialize(result)); return 0;
        } catch (Exception error) { Console.WriteLine(Serialize(new { ok = false, uncertain = writeAttempted, error = error.Message })); return 0; }
    }
    static object throwUnknown() { throw new Exception("Unknown desktop action."); }
}
