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
    public string id, automationId, name, label, value, type, className;
    public bool offscreen, enabled, writable;
    [ScriptIgnore] public AutomationElement element;
}
public sealed class WindowInfo {
    public int pid;
    public string process, started, id, title;
    public bool incomplete;
    public List<ControlInfo> controls = new List<ControlInfo>();
}
public sealed class DesktopSnapshot {
    public string format = "sig-assist-framework-desktop";
    public int schemaVersion = 1;
    public List<WindowInfo> windows = new List<WindowInfo>();
    public List<string> issues = new List<string>();
}
public static class FrameworkDesktop {
    static bool writeAttempted;
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 4 * 1024 * 1024 };
    static readonly Regex PonLabel = new Regex(@"^(?:PON|Prescriber Order (?:Number|No\.?))\s*:?$", RegexOptions.IgnoreCase);
    static readonly Regex PonInline = new Regex(@"^(?:PON|Prescriber Order (?:Number|No\.?))\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9_.\-/]{0,99})\s*$", RegexOptions.IgnoreCase);
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
        if (control.offscreen || !control.enabled || !control.writable || control.type != "ControlType.Edit") return false;
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
    static DesktopSnapshot Scan(string testProcess) {
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
            var pending = new Stack<KeyValuePair<AutomationElement, int>>();
            pending.Push(new KeyValuePair<AutomationElement, int>(root, 0));
            int visited = 0;
            while (pending.Count > 0) {
                if (++visited > 1800) { window.incomplete = true; break; }
                var next = pending.Pop();
                try {
                    var item = Read(next.Key);
                    if (item != null) window.controls.Add(item);
                    var child = TreeWalker.ControlViewWalker.GetFirstChild(next.Key);
                    if (next.Value >= 24 && child != null) { window.incomplete = true; continue; }
                    int siblings = 0;
                    while (child != null) {
                        if (++siblings > 1800) { window.incomplete = true; break; }
                        pending.Push(new KeyValuePair<AutomationElement, int>(child, next.Value + 1));
                        child = TreeWalker.ControlViewWalker.GetNextSibling(child);
                    }
                } catch { window.incomplete = true; }
            }
        }
        if (result.windows.Count == 0) result.issues.Add("No accessible Framework window is open. A remote Citrix picture on a local desktop cannot expose the remote fields.");
        return result;
    }
    static object FieldInfo(WindowInfo window, ControlInfo control, bool manual) {
        return new { id = control.id, value = control.value, label = Label(control), pid = window.pid,
            started = window.started, window = window.id, manual = manual };
    }
    static object Detect(DesktopSnapshot snapshot, string chosenId = null, string chosenField = null) {
        var pons = snapshot.windows.SelectMany(w => w.controls).Select(c => Pon(c)).Where(p => p != "").Distinct(StringComparer.Ordinal).ToArray();
        var warnings = new List<string>(snapshot.issues);
        if (pons.Length > 1) warnings.Add("Multiple PONs detected: " + String.Join(", ", pons) + ". Match the intended order before sending.");
        if (snapshot.windows.Any(w => w.incomplete)) warnings.Add("Some Framework controls could not be read. Verify the destination in Framework.");
        var fields = new Dictionary<string, object>();
        foreach (var field in new[] { "sig", "times" }) {
            var controls = snapshot.windows.SelectMany(w => w.controls.Select(c => new { window = w, control = c }))
                .Where(x => chosenField == field ? x.control.id == chosenId : Field(x.control, field)).ToArray();
            if (controls.Length == 1) fields[field] = FieldInfo(controls[0].window, controls[0].control, chosenField == field);
        }
        return new { ok = true, pon = pons.Length == 1 ? pons[0] : null, pons = pons, fields = fields, warnings = warnings, diagnostics = snapshot };
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
            var snapshot = Scan(testProcess);
            object result = action == "detect" ? Detect(snapshot) : action == "inspect" ? (object)new { ok = true, diagnostics = snapshot } : action == "send" ? Send(input, snapshot, testProcess) : throwUnknown();
            Console.WriteLine(Serialize(result)); return 0;
        } catch (Exception error) { Console.WriteLine(Serialize(new { ok = false, uncertain = writeAttempted, error = error.Message })); return 0; }
    }
    static object throwUnknown() { throw new Exception("Unknown desktop action."); }
}
