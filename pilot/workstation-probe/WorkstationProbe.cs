// PILOT ONLY — REMOVE FROM PRODUCTION. No clinical data model, network transport or UI actions.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Windows.Automation;
using Microsoft.Win32;
using System.Web.Script.Serialization;

public static class WorkstationProbe {
    const int NodeLimit = 900, DepthLimit = 30, BudgetMs = 9000;
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    static readonly HashSet<string> Roles = new HashSet<string>(
        "Button Calendar CheckBox ComboBox Custom DataGrid DataItem Document Edit Group Header HeaderItem Hyperlink Image List ListItem Menu MenuBar MenuItem Pane ProgressBar RadioButton ScrollBar Separator Slider Spinner SplitButton StatusBar Tab TabItem Table Text Thumb TitleBar ToolBar ToolTip Tree TreeItem Window".Split(' '));
    static readonly Dictionary<int,string> Patterns = new Dictionary<int,string> {
        {GridPattern.Pattern.Id,"Grid"}, {GridItemPattern.Pattern.Id,"GridItem"}, {TablePattern.Pattern.Id,"Table"},
        {TableItemPattern.Pattern.Id,"TableItem"}, {InvokePattern.Pattern.Id,"Invoke"}, {ValuePattern.Pattern.Id,"Value"},
        {TextPattern.Pattern.Id,"Text"}, {SelectionPattern.Pattern.Id,"Selection"}, {SelectionItemPattern.Pattern.Id,"SelectionItem"},
        {ScrollPattern.Pattern.Id,"Scroll"}, {ScrollItemPattern.Pattern.Id,"ScrollItem"},
        {ExpandCollapsePattern.Pattern.Id,"ExpandCollapse"}, {TogglePattern.Pattern.Id,"Toggle"},
        {WindowPattern.Pattern.Id,"Window"}, {RangeValuePattern.Pattern.Id,"RangeValue"},
        {VirtualizedItemPattern.Pattern.Id,"VirtualizedItem"}, {ItemContainerPattern.Pattern.Id,"ItemContainer"}
    };
    // Exact matches only, on controls that represent application chrome. No raw provider strings leave this worker.
    static readonly HashSet<string> Labels = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
        "Folders", "Search", "Documents", "Richmond Pharmacy", "Order Processing", "Process", "PV1",
        "Document Type", "Doc. Type", "Doc Type", "Text 3", "Text 4", "List 2", "Source", "Status", "Priority",
        "Document Number", "Document #", "Document ID", "Doc #", "PON", "Prescriber Order Number",
        "E-Prescriber Order Number", "Resident Name", "Facility", "Received", "Association", "Associations",
        "Patient", "Resident", "Associate", "Save", "Save/Next", "Sticky Note", "Refuse Request",
        "Reason for refusal", "E-Rx Triage Manager", "Cancel", "OK"
    };
    static string Known(string raw, HashSet<string> vocabulary) {
        var value = (raw ?? "").Trim().TrimEnd(':').Trim();
        return vocabulary.FirstOrDefault(k => String.Equals(k, value, StringComparison.OrdinalIgnoreCase));
    }
    static bool Chrome(string role) {
        return role == "Button" || role == "TabItem" || role == "HeaderItem" || role == "TreeItem" ||
               role == "MenuItem" || role == "CheckBox" || role == "Group" || role == "Text";
    }
    // No COM activation or registry values. Only presence of the one known ProgID.
    static string Registration(RegistryView view) {
        try {
            using (var root = RegistryKey.OpenBaseKey(RegistryHive.ClassesRoot, view))
            using (var key = root.OpenSubKey(@"DCIDocument.DocumentEngine.1\CLSID", false)) {
                return key == null ? "absent" : "present";
            }
        } catch { return "unavailable"; }
    }
    public sealed class Node {
        public int id, parent, depth;
        public string role, label;
        public string[] patterns;
        public bool offscreen, enabled;
        public bool? selected, readOnly;
        public int? rows, columns;
    }
    public sealed class Report {
        public string format = "sig-assist-workstation-map", version = "0.1.3", buildMode = "PILOT ONLY", app, outcome;
        public int processes, windows, inaccessible, repeatedRowSamplesSkipped, elapsedMs;
        public bool partial;
        public string com32, com64;
        public List<Node> nodes = new List<Node>();
    }
    sealed class Pending {
        public AutomationElement element;
        public int parent, depth;
    }
    static Report Capture(string app, string fixtureProcess) {
        var report = new Report { app = app };
        var time = Stopwatch.StartNew();
        var names = app == "docutrack" ? new[] { "DocuTrack" } : new[] { "FrameworkLTC", "SoftWriters.FrameworkLtc" };
        if (fixtureProcess != null) names = new[] { fixtureProcess };
        if (app == "docutrack") {
            report.com32 = Registration(RegistryView.Registry32);
            report.com64 = Environment.Is64BitOperatingSystem ? Registration(RegistryView.Registry64) : "not-applicable";
        }
        var ids = new HashSet<int>();
        using (var self = Process.GetCurrentProcess()) {
            foreach (var name in names) foreach (var process in Process.GetProcessesByName(name)) {
                using (process) {
                    try { if (process.SessionId == self.SessionId) ids.Add(process.Id); }
                    catch { report.inaccessible++; }
                }
            }
        }
        report.processes = ids.Count;
        var pending = new Queue<Pending>();
        foreach (int id in ids) {
            var matches = AutomationElement.RootElement.FindAll(TreeScope.Children, new PropertyCondition(AutomationElement.ProcessIdProperty, id));
            foreach (AutomationElement item in matches) {
                pending.Enqueue(new Pending { element = item }); report.windows++;
            }
        }
        var walker = TreeWalker.ControlViewWalker;
        while (pending.Count > 0 && time.ElapsedMilliseconds < BudgetMs && report.nodes.Count < NodeLimit) {
            var item = pending.Dequeue();
            try {
                var element = item.element;
                if (!ids.Contains(element.Current.ProcessId)) continue;
                if (element.Current.IsPassword) continue;
                var role = element.Current.ControlType.ProgrammaticName.Split('.').Last();
                var supported = element.GetSupportedPatterns().Where(p => Patterns.ContainsKey(p.Id))
                    .Select(p => Patterns[p.Id]).Distinct().OrderBy(p => p, StringComparer.Ordinal).ToArray();
                var node = new Node { id = report.nodes.Count + 1, parent = item.parent, depth = item.depth,
                    role = Roles.Contains(role) ? role : "Other", patterns = supported,
                    enabled = element.Current.IsEnabled, offscreen = element.Current.IsOffscreen };
                // For editable fields read the label control, never Value, Text, or the field's accessible name.
                if (Chrome(role)) node.label = Known(element.Current.Name, Labels);
                else if (role == "Edit" || role == "ComboBox") {
                    var label = element.Current.LabeledBy;
                    if (label != null) node.label = Known(label.Current.Name, Labels);
                }
                report.nodes.Add(node);
                object pattern;
                if (element.TryGetCurrentPattern(GridPattern.Pattern, out pattern)) {
                    var g = (GridPattern)pattern;
                    node.rows = g.Current.RowCount; node.columns = g.Current.ColumnCount;
                }
                if (element.TryGetCurrentPattern(SelectionItemPattern.Pattern, out pattern)) node.selected = ((SelectionItemPattern)pattern).Current.IsSelected;
                if (element.TryGetCurrentPattern(ValuePattern.Pattern, out pattern)) node.readOnly = ((ValuePattern)pattern).Current.IsReadOnly;
                if (item.depth >= DepthLimit) { report.partial = true; continue; }
                int rowSamples = 0;
                for (var child = walker.GetFirstChild(element); child != null; child = walker.GetNextSibling(child)) {
                    if (time.ElapsedMilliseconds >= BudgetMs || report.nodes.Count + pending.Count >= NodeLimit) {
                        report.partial = true; break;
                    }
                    if (child.Current.ControlType == ControlType.DataItem && ++rowSamples > 2) { report.repeatedRowSamplesSkipped++; continue; }
                    pending.Enqueue(new Pending { element = child, parent = node.id, depth = item.depth + 1 });
                }
            } catch { report.inaccessible++; report.partial = true; }
        }
        report.partial |= pending.Count > 0 || report.inaccessible > 0 || report.repeatedRowSamplesSkipped > 0;
        report.elapsedMs = (int)time.ElapsedMilliseconds;
        report.outcome = ids.Count == 0 ? "process-not-in-session" : report.windows == 0 ? "no-window-exposed" :
            report.nodes.Count == 0 ? "no-controls-exposed" : report.partial ? "sampled" : "observed";
        return report;
    }
    [STAThread]
    public static int Main(string[] args) {
        Console.OutputEncoding = new UTF8Encoding(false);
        if (args.Length == 0 || (args[0] != "docutrack" && args[0] != "framework")) return 2;
        string fixture = null;
#if PROBE_FIXTURE
        if (args.Length == 2) fixture = args[1];
#else
        if (args.Length != 1) return 2;
#endif
        // The provider can hang in a single native call. A background worker lets the coordinator
        // return a fixed failure report and terminate the process even in that case.
        Report result = null;
        var worker = new System.Threading.Thread(delegate() {
            try { result = Capture(args[0], fixture); }
            catch { result = new Report { app = args[0], outcome = "provider-failed", partial = true }; }
        });
        worker.IsBackground = true;
        worker.SetApartmentState(System.Threading.ApartmentState.MTA);
        worker.Start();
        if (!worker.Join(20000)) {
            Console.WriteLine(Json.Serialize(new Report { app = args[0], outcome = "timeout", elapsedMs = 20000, partial = true }));
            return 0;
        }
        Console.WriteLine(Json.Serialize(result));
        return 0;
    }
}
