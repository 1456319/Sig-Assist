// Synthetic provider modeled on the diagnostic's control structure. No patient data.
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
using System.Windows.Automation.Provider;
using System.Windows.Controls;
using System.Windows.Threading;

public class View : StackPanel {
    public string ProviderClass;
    public bool HiddenPage;
    protected override AutomationPeer OnCreateAutomationPeer() { return new ViewPeer(this); }
}
public class ViewPeer : FrameworkElementAutomationPeer {
    View view;
    public ViewPeer(View owner) : base(owner) { view = owner; }
    protected override string GetClassNameCore() { return view.ProviderClass; }
    protected override AutomationControlType GetAutomationControlTypeCore() { return AutomationControlType.Custom; }
    protected override bool IsOffscreenCore() { return view.HiddenPage; }
}
public class DetailGrid : FrameworkElement {
    public string Folder, Pon;
    public bool ScrollOnly, FailScroll, RawOnly, Empty, NoAnchor, IndexedVisible, PointOnly, PointConnected, Ready = true;
    public bool AutoScrollNull, DelayedIndex;
    public bool AccessibilityTest, ScreenReaderRequired, AccessibilityFault;
    public int RequestedRow = -1, PonRow = -1;
    public int IndexedRow = -1;
    public int RowCount = 80;
    public int Start, ScrollCalls, GetCalls;
    public DetailGridPeer Peer;
    DispatcherTimer renderTimer;
    DispatcherTimer accessibilityTimer;
    public bool CellsUnavailable { get { return Empty || !Ready || (ScreenReaderRequired && !ScreenReader.Get()); } }
    public DetailGrid(string folder, string pon, bool scrollOnly) {
        Folder = folder; Pon = pon; ScrollOnly = scrollOnly; Width = 440; Height = 100;
        Start = scrollOnly ? 10 : 0;
        AutomationProperties.SetAutomationId(this, "ERxGrid");
        renderTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(450) };
        renderTimer.Tick += delegate { renderTimer.Stop(); Ready = true; if (Peer != null) Peer.Refresh(); };
        bool lastUnavailable = false;
        accessibilityTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(100) };
        accessibilityTimer.Tick += delegate {
            if (!AccessibilityTest) return;
            if (File.Exists(Path.Combine(Folder, "lose-cells"))) ScreenReaderRequired = true;
            bool unavailable = CellsUnavailable;
            if (unavailable != lastUnavailable) { lastUnavailable = unavailable; if (Peer != null) Peer.Refresh(); }
        };
        accessibilityTimer.Start();
    }
    public void Rendering() { IndexedRow = -1; PointConnected = false; if (!RawOnly && !DelayedIndex) return; Ready = false; renderTimer.Stop(); renderTimer.Start(); }
    public void Save() { File.WriteAllText(Path.Combine(Folder, "state"), Start + "," + ScrollCalls + "," + GetCalls); }
    protected override AutomationPeer OnCreateAutomationPeer() { Peer = new DetailGridPeer(this); return Peer; }
}
public class DetailGridPeer : FrameworkElementAutomationPeer, IGridProvider, IScrollProvider {
    DetailGrid grid;
    CellPeer[,] cells;
    public DetailGridPeer(DetailGrid owner) : base(owner) {
        grid = owner;
        cells = new CellPeer[grid.RowCount, 2];
        for (int row = 0; row < grid.RowCount; row++) for (int col = 0; col < 2; col++) cells[row, col] = new CellPeer(grid, row, col);
    }
    protected override string GetClassNameCore() { return ""; }
    protected override AutomationControlType GetAutomationControlTypeCore() { return AutomationControlType.DataGrid; }
    // Simulate the detail screen disappearing between its initial read and the
    // recovery refresh. Throwing from GetPattern merely removes that pattern;
    // other successful read methods can (correctly) still find its PON.
    protected override bool IsOffscreenCore() { return grid.AccessibilityFault && ScreenReader.Get(); }
    protected override List<AutomationPeer> GetChildrenCore() {
        var result = new List<AutomationPeer>();
        if (grid.CellsUnavailable) return result;
        if (grid.PointOnly && !grid.PointConnected) return result;
        if (grid.IndexedVisible) {
            if (grid.IndexedRow >= 0) { result.Add(cells[grid.IndexedRow, 0]); result.Add(cells[grid.IndexedRow, 1]); }
            return result;
        }
        // Indexed mode exposes connected offscreen peers. Scroll-only mode
        // virtualizes them entirely, matching the observed 30-row provider.
        int first = grid.ScrollOnly ? grid.Start : 0, last = grid.ScrollOnly ? Math.Min(grid.RowCount, grid.Start + 30) : grid.RowCount;
        for (int row = first; row < last; row++) for (int col = 0; col < 2; col++) result.Add(cells[row, col]);
        return result;
    }
    public override object GetPattern(PatternInterface pattern) {
        if (pattern == PatternInterface.Grid || pattern == PatternInterface.Scroll) return this;
        return base.GetPattern(pattern);
    }
    public int RowCount { get { return grid.RowCount; } }
    public int ColumnCount { get { return 2; } }
    public IRawElementProviderSimple GetItem(int row, int column) {
        grid.GetCalls++; grid.Save();
        if (grid.AutoScrollNull || grid.DelayedIndex) {
            if (grid.RequestedRow != row) {
                grid.RequestedRow = row; grid.Start = Math.Max(0, Math.Min(grid.RowCount - 30, row));
                grid.Save(); grid.Rendering(); Refresh();
            }
            if (grid.AutoScrollNull || !grid.Ready) return null;
            GetChildren();
        }
        if (grid.RawOnly || grid.CellsUnavailable || grid.PointOnly) return null;
        if (row < 0 || row >= grid.RowCount || column < 0 || column > 1) throw new ArgumentOutOfRangeException();
        if (grid.IndexedVisible) {
            if (row < grid.Start || row >= grid.Start + 30) return null;
            grid.IndexedRow = row; Refresh(); GetChildren();
        }
        if (grid.ScrollOnly && (row < grid.Start || row >= grid.Start + 30)) throw new InvalidOperationException("Row is not realized.");
        return ProviderFromPeer(cells[row, column]);
    }
    public bool HorizontallyScrollable { get { return false; } }
    public bool VerticallyScrollable { get { return true; } }
    public double HorizontalScrollPercent { get { return -1; } }
    public double VerticalScrollPercent { get { return grid.Start * 100.0 / (grid.RowCount - 30); } }
    public double HorizontalViewSize { get { return 100; } }
    public double VerticalViewSize { get { return 3000.0 / grid.RowCount; } }
    public void Refresh() { ResetChildrenCache(); RaiseAutomationEvent(AutomationEvents.StructureChanged); }
    protected override AutomationPeer GetPeerFromPointCore(Point point) {
        if (!grid.PointOnly) return base.GetPeerFromPointCore(point);
        var local = grid.PointFromScreen(point);
        if (local.X < 0 || local.X >= grid.ActualWidth || local.Y < 0 || local.Y >= grid.ActualHeight) return null;
        grid.PointConnected = true; Refresh(); GetChildren();
        int row = grid.Start + Math.Min(29, (int)(local.Y / (grid.ActualHeight / 30)));
        return cells[row, local.X < grid.ActualWidth * 0.35 ? 0 : 1];
    }
    public void SetScrollPercent(double horizontal, double vertical) {
        if (vertical >= 0) grid.Start = Math.Max(0, Math.Min(grid.RowCount - 30, (int)Math.Round(vertical * (grid.RowCount - 30) / 100.0)));
        grid.ScrollCalls++; grid.Save(); grid.Rendering(); Refresh();
    }
    public void Scroll(ScrollAmount horizontal, ScrollAmount vertical) {
        if (grid.FailScroll) throw new InvalidOperationException("Synthetic scroll failure");
        if (vertical == ScrollAmount.LargeIncrement) SetScrollPercent(-1, Math.Min(100, VerticalScrollPercent + 2500.0 / (grid.RowCount - 30)));
        if (vertical == ScrollAmount.SmallDecrement) SetScrollPercent(-1, Math.Max(0, VerticalScrollPercent - 200.0 / (grid.RowCount - 30)));
    }
}
public class CellPeer : FrameworkElementAutomationPeer, IValueProvider {
    DetailGrid grid;
    int row, col;
    public CellPeer(DetailGrid owner, int rowIndex, int columnIndex) : base(new TextBlock()) { grid = owner; row = rowIndex; col = columnIndex; }
    string TextValue { get {
        if (row == (grid.PonRow >= 0 ? grid.PonRow : grid.RowCount - 13)) return col == 0 ? "Prescriber Order Number" : grid.Pon;
        if (row == grid.RowCount - 42 && !grid.NoAnchor) return col == 0 ? "RxFill Indicator" : "All Fill Statuses";
        if (row == grid.RowCount - 41) return col == 0 ? "Directions" : "Synthetic SIG";
        if (row == grid.RowCount - 40 || row == grid.RowCount - 39) return col == 0 ? "Facility Hours of Administration" : "0900";
        return col == 0 ? "Detail " + row : "Synthetic value " + row;
    } }
    protected override string GetNameCore() { return "Row " + row + ", Column " + col + ": " + TextValue; }
    protected override string GetAutomationIdCore() { return col == 0 ? "Title" : "Value"; }
    protected override string GetClassNameCore() { return "SyntheticCell"; }
    protected override AutomationControlType GetAutomationControlTypeCore() { return AutomationControlType.Custom; }
    protected override bool IsOffscreenCore() { return row < grid.Start || row >= grid.Start + 30; }
    protected override Rect GetBoundingRectangleCore() {
        if (!grid.PointOnly) return base.GetBoundingRectangleCore();
        var point = grid.PointToScreen(new Point(col == 0 ? 0 : grid.ActualWidth * 0.35, (row - grid.Start) * grid.ActualHeight / 30));
        return new Rect(point.X, point.Y, grid.ActualWidth * (col == 0 ? 0.35 : 0.65), grid.ActualHeight / 30);
    }
    protected override bool IsControlElementCore() { return !grid.RawOnly; }
    protected override bool IsContentElementCore() { return !grid.RawOnly; }
    protected override bool IsEnabledCore() { return true; }
    public override object GetPattern(PatternInterface pattern) { return pattern == PatternInterface.Value ? this : null; }
    public bool IsReadOnly { get { return true; } }
    public string Value { get { return TextValue; } }
    public void SetValue(string value) { throw new InvalidOperationException("Read only"); }
}
public static class ScreenReader {
    [DllImport("user32.dll", EntryPoint = "SystemParametersInfoW", SetLastError = true)]
    static extern bool GetParameter(uint action, uint parameter, out int value, uint flags);
    [DllImport("user32.dll", EntryPoint = "SystemParametersInfoW", SetLastError = true)]
    static extern bool SetParameter(uint action, uint parameter, IntPtr value, uint flags);
    public static bool Get() { int value; if (!GetParameter(0x46, 0, out value, 0)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()); return value != 0; }
    public static void Set(bool value) { if (!SetParameter(0x47, value ? 1u : 0u, IntPtr.Zero, 2)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()); }
}
public static class Fixture {
    static TextBox TextField(string name, string value) {
        var field = new TextBox { Text = value, Width = 400, Height = 25 };
        AutomationProperties.SetName(field, name); return field;
    }
    [STAThread] public static void Main(string[] args) {
        if (args.Length == 2 && args[0] == "--screen-reader") {
            if (args[1] != "get") ScreenReader.Set(args[1] == "on");
            Console.WriteLine(ScreenReader.Get() ? "on" : "off"); return;
        }
        var folder = args[0]; var role = args[1]; var mode = args.Length > 2 ? args[2] : "grid";
        var app = new Application();
        var window = new Window { Title = "Synthetic Framework " + role, Width = 500, Height = 400 };
        var root = new StackPanel(); window.Content = root;
        DetailGrid grid = null;
        if (role.StartsWith("open")) {
            var wizard = new View { ProviderClass = "ERxWorkQueueWizardView" }; root.Children.Add(wizard);
            var page = new View { ProviderClass = "ERxWorkQueueView" }; wizard.Children.Add(page);
            grid = new DetailGrid(folder, role == "open-second" ? "SYNTHETIC-SECOND" : "SYNTHETIC-OPEN", mode != "grid");
            grid.FailScroll = mode == "fail"; grid.RawOnly = mode == "raw-delay"; grid.Empty = mode == "empty" || mode == "point-overlay"; grid.NoAnchor = mode == "noanchor";
            grid.IndexedVisible = mode == "indexed-visible"; grid.PointOnly = mode == "point-only" || mode == "point-narrow";
            if (mode.StartsWith("accessibility")) {
                grid.AccessibilityTest = true;
                grid.ScreenReaderRequired = mode != "accessibility-lost";
                grid.AccessibilityFault = mode == "accessibility-fault";
                grid.RowCount = 95; grid.Start = 65;
            }
            if (grid.PointOnly) { grid.Height = 300; window.Height = 500; }
            if (mode == "point-narrow") { grid.Width = 260; window.Width = 320; }
            if (grid.RawOnly || grid.Empty) grid.RowCount = 106;
            if (mode == "compound-pon") { grid.RowCount = 114; grid.PonRow = 113; grid.Pon = "123456789:0000123456"; grid.ScrollOnly = false; }
            if (mode == "auto-scroll-empty" || mode == "auto-scroll-delayed") {
                grid.RowCount = 139; grid.Start = 109;
                grid.AutoScrollNull = mode == "auto-scroll-empty"; grid.Empty = grid.AutoScrollNull;
                grid.DelayedIndex = mode == "auto-scroll-delayed"; grid.Ready = !grid.DelayedIndex;
            }
            if (!grid.DelayedIndex) grid.Rendering(); page.Children.Add(grid);
            page.Children.Add(TextField("SIG", "OLD OPEN SIG"));
            var stale = new View { ProviderClass = "ERxWorkQueueDirectionsView", HiddenPage = true };
            stale.Children.Add(TextField("PON", "STALE-HIDDEN-PON"));
            stale.Children.Add(TextField("SIG", "STALE HIDDEN SIG")); wizard.Children.Add(stale);
            if (mode == "point-overlay") {
                // Convincing row/cell labels from the same PID, but outside the
                // selected grid. Screen hits must not turn them into a PON.
                window.Content = null;
                var layers = new Grid(); layers.Children.Add(root); window.Content = layers;
                var overlay = new StackPanel { Background = System.Windows.Media.Brushes.White, Height = 120, VerticalAlignment = VerticalAlignment.Top };
                foreach (var name in new[] { "Row 1, Column 0: Prescriber Order Number", "Row 1, Column 1: WRONG-OVERLAY-PON" }) {
                    var text = new TextBlock { Text = name, Height = 50 }; AutomationProperties.SetName(text, name); overlay.Children.Add(text);
                }
                layers.Children.Add(overlay);
            }
        } else if (role == "triage") {
            var triage = new View { ProviderClass = "ERxTriageManagerView" }; root.Children.Add(triage);
            // An exact label too: even this must not compete with the open wizard.
            triage.Children.Add(TextField("PON", "QUEUE-PON"));
            for (int i = 0; i < 5; i++) { var field = TextField("Row " + i + ", Column 10: QUEUE-" + i, "QUEUE-" + i); AutomationProperties.SetAutomationId(field, "PrescriberOrderNumber"); triage.Children.Add(field); }
            triage.Children.Add(new DetailGrid(folder, "QUEUE-GRID-PON", false));
        } else root.Children.Add(TextField("SIG", "IDLE SIG"));
        window.ContentRendered += delegate { if (grid != null) grid.Save(); File.WriteAllText(Path.Combine(folder, "ready"), "ready"); };
        app.Run(window);
    }
}
