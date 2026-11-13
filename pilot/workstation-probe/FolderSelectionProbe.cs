// PILOT ONLY — REMOVE FROM PRODUCTION. Read-only folder selection diagnostics.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Automation;
using Accessibility;

internal static class FolderSelectionProbe {
    const int ClientObject = -4, Outline = 35, OutlineItem = 36, SelectedState = 2, NavigateLeft = 3;
    const int WindowLimit = 1500, TimeLimitMs = 12000;
    delegate bool EnumWindow(IntPtr handle, IntPtr context);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumWindow visit, IntPtr context);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr window);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("oleacc.dll")] static extern int AccessibleObjectFromWindow(IntPtr handle, int objectId,
        ref Guid interfaceId, [MarshalAs(UnmanagedType.Interface)] out IAccessible result);

    public sealed class TreeReading {
        public bool installerControl, selectedState;
        public string outcome, folder, cabinet, businessUnit;
    }
    public sealed class Report {
        public string format = "sig-assist-folder-selection", version = "0.1.4", buildMode = "PILOT ONLY", app = "docutrack";
        public string outcome;
        public int windowsExamined, namedControls, outlines, unavailable;
        public bool partial;
        public List<TreeReading> trees = new List<TreeReading>();
    }
    static string Match(string raw, params string[] permitted) {
        foreach (var label in permitted)
            if (String.Equals(label, (raw ?? "").Trim(), StringComparison.OrdinalIgnoreCase)) return label;
        return null;
    }
    static int Role(IAccessible item, int child) { return Convert.ToInt32(item.get_accRole(child)); }

    // The shipped Infragistics NodeAccessibleObject maps NAVDIR_LEFT to the parent node.
    // accParent in this build can point straight back to the control, skipping the cabinet.
    static IAccessible Left(IAccessible item, int child) {
        var parent = item.accNavigate(NavigateLeft, child) as IAccessible;
        return parent != null && Role(parent, 0) == OutlineItem ? parent : null;
    }
    static void ReadActiveNode(IAccessible tree, TreeReading reading) {
        object active = tree.accSelection;
        IAccessible node = active as IAccessible;
        int child = 0;
        if (node == null && active is int && (int)active > 0) {
            child = (int)active;
            node = tree.get_accChild(child) as IAccessible;
            if (node != null) child = 0;
            else node = tree;
        }
        if (node == null || Role(node, child) != OutlineItem) {
            reading.outcome = "no-single-folder-node"; return;
        }
        reading.selectedState = (Convert.ToInt32(node.get_accState(child)) & SelectedState) != 0;
        reading.folder = Match(node.get_accName(child), "Process", "Triage");
        if (reading.folder == null) { reading.outcome = "other-folder-or-label"; return; }
        var cabinet = Left(node, child);
        if (cabinet != null) {
            reading.cabinet = Match(cabinet.get_accName(0), "Order Processing");
            if (reading.cabinet != null) {
                var unit = Left(cabinet, 0);
                if (unit != null) reading.businessUnit = Match(unit.get_accName(0), "Richmond Pharmacy");
            }
        }
        reading.outcome = reading.businessUnit != null && reading.selectedState ? "selected-path-observed" : "path-incomplete";
    }

    static bool InstallerAnchor(IntPtr handle, IntPtr window) {
        for (int level = 0; level < 3 && handle != IntPtr.Zero && handle != window; level++) {
            var item = AutomationElement.FromHandle(handle);
            if (item != null && Match(item.Current.AutomationId, "_searchFolderTree", "SearchFolderTree") != null) return true;
            handle = GetParent(handle);
        }
        return false;
    }

    static void Inspect(IntPtr handle, IntPtr window, Report report) {
        var iid = typeof(IAccessible).GUID;
        IAccessible client;
        if (AccessibleObjectFromWindow(handle, ClientObject, ref iid, out client) != 0 || client == null) return;
        if (Role(client, 0) != Outline) return;
        report.outlines++;
        var reading = new TreeReading { outcome = "unavailable" };
        report.trees.Add(reading);
        try {
            reading.installerControl = InstallerAnchor(handle, window);
            if (reading.installerControl) report.namedControls++;
        } catch (ElementNotAvailableException) { report.unavailable++; }
          catch (InvalidOperationException) { report.unavailable++; }
          catch (COMException) { report.unavailable++; }
        ReadActiveNode(client, reading);
    }

    public static Report Capture(string fixtureProcess) {
        var report = new Report();
        var watch = Stopwatch.StartNew();
        int session = Process.GetCurrentProcess().SessionId;
        foreach (var process in Process.GetProcessesByName(fixtureProcess ?? "DocuTrack")) {
            using (process) {
                if (process.SessionId != session) continue;
                var windows = AutomationElement.RootElement.FindAll(TreeScope.Children,
                    new PropertyCondition(AutomationElement.ProcessIdProperty, process.Id));
                foreach (AutomationElement window in windows) {
                    var top = new IntPtr(window.Current.NativeWindowHandle);
                    if (top == IntPtr.Zero || !IsWindowVisible(top)) continue;
                    EnumChildWindows(top, delegate(IntPtr handle, IntPtr unused) {
                        if (watch.ElapsedMilliseconds >= TimeLimitMs || report.windowsExamined >= WindowLimit) {
                            report.partial = true; return false;
                        }
                        uint pid;
                        GetWindowThreadProcessId(handle, out pid);
                        if (pid != process.Id || !IsWindowVisible(handle)) return true;
                        report.windowsExamined++;
                        try { Inspect(handle, top, report); }
                        catch (Exception) { report.unavailable++; } // No provider messages in a shared report.
                        return true;
                    }, IntPtr.Zero);
                    if (report.partial) break;
                }
            }
            if (report.partial) break;
        }
        report.partial |= report.unavailable != 0;
        report.outcome = report.windowsExamined == 0 ? "no-visible-controls" : report.outlines == 0 ? "no-outline" : "observed";
        return report;
    }
}
