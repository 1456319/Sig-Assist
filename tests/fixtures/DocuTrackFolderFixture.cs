// Synthetic Windows accessibility shape of the folder tree in the 6.6.4 installer.
using System;
using System.IO;
using System.Windows.Forms;

public class DocuTrackFolderFixture : Control {
    public string Selection = "Process", Unit = "Richmond Pharmacy";

    class FolderNode : AccessibleObject {
        readonly string label;
        readonly AccessibleObject above;
        readonly bool active;
        public FolderNode(string name, AccessibleObject parent, bool selected) {
            label = name; above = parent; active = selected;
        }
        public override string Name { get { return label; } }
        public override AccessibleRole Role { get { return AccessibleRole.OutlineItem; } }
        public override AccessibleStates State { get { return active ? AccessibleStates.Selected : AccessibleStates.None; } }
        public override AccessibleObject Navigate(AccessibleNavigation direction) {
            return direction == AccessibleNavigation.Left ? above : null;
        }
    }

    class FolderTree : ControlAccessibleObject {
        readonly DocuTrackFolderFixture tree;
        public FolderTree(DocuTrackFolderFixture owner) : base(owner) { tree = owner; }
        public override AccessibleRole Role { get { return AccessibleRole.Outline; } }
        public override AccessibleObject GetSelected() {
            var unit = new FolderNode(tree.Unit, null, false);
            var cabinet = new FolderNode("Order Processing", unit, false);
            return new FolderNode(tree.Selection, cabinet, true);
        }
    }

    protected override AccessibleObject CreateAccessibilityInstance() { return new FolderTree(this); }
    // WPF peers represent the UltraGrid column captions and value patterns on the workstation.
    class Segment : System.Windows.Controls.StackPanel {
        public System.Windows.Automation.Peers.AutomationControlType Role;
        public Segment(System.Windows.Automation.Peers.AutomationControlType role, string label = "") {
            Role = role;
            System.Windows.Automation.AutomationProperties.SetName(this, label);
            MinHeight = 12;
        }
        protected override System.Windows.Automation.Peers.AutomationPeer OnCreateAutomationPeer() {
            return new SegmentPeer(this);
        }
    }
    class SegmentPeer : System.Windows.Automation.Peers.FrameworkElementAutomationPeer {
        public SegmentPeer(Segment owner) : base(owner) {}
        protected override System.Windows.Automation.Peers.AutomationControlType GetAutomationControlTypeCore() {
            return ((Segment)Owner).Role;
        }
        protected override bool IsControlElementCore() { return true; }
        protected override bool IsContentElementCore() { return true; }
    }
    static Segment Results() {
        var tree = new Segment(System.Windows.Automation.Peers.AutomationControlType.Tree);
        var header = new Segment(System.Windows.Automation.Peers.AutomationControlType.Header);
        foreach (var name in new[] { "Doc. Type", "Other", "Text 3" })
            header.Children.Add(new Segment(System.Windows.Automation.Peers.AutomationControlType.HeaderItem, name));
        tree.Children.Add(header);
        foreach (bool ambiguous in new[] { false, true }) {
            var row = new Segment(System.Windows.Automation.Peers.AutomationControlType.DataItem);
            // Reverse the headers' order and include a second row with two Text 3 cells.
            foreach (string name in new[] { "Text 3", ambiguous ? "Text 3" : "Other", "Doc. Type" }) {
                var cell = new System.Windows.Controls.TextBox { Text = name == "Text 3" ? "00-SYN-A" : name == "Other" ? "Private Canary" : "E-DC Order" };
                System.Windows.Automation.AutomationProperties.SetName(cell, name);
                row.Children.Add(cell);
            }
            tree.Children.Add(row);
        }
        return tree;
    }
    [STAThread]
    public static void Main(string[] args) {
        var folder = args[0];
        var form = new Form { Text = "Private Canary" };
        var workspace = new Panel { Name = "WorkflowWorkspace", Dock = DockStyle.Fill };
        var tree = new DocuTrackFolderFixture { Name = "_searchFolderTree", Dock = DockStyle.Top, Height = 26 };
        var grid = new System.Windows.Forms.Integration.ElementHost { Name = "_resultsGrid", Dock = DockStyle.Fill, Child = Results() };
        workspace.Controls.Add(grid);
        workspace.Controls.Add(tree);
        form.Controls.Add(workspace);
        var timer = new Timer { Interval = 100 };
        timer.Tick += delegate {
            if (File.Exists(Path.Combine(folder, "unknown-unit"))) {
                tree.Unit = "Private Canary";
                File.WriteAllText(Path.Combine(folder, "unknown-ready"), "");
            } else if (File.Exists(Path.Combine(folder, "select-triage"))) {
                tree.Selection = "Triage";
                File.WriteAllText(Path.Combine(folder, "triage-ready"), "");
            }
        };
        form.Shown += delegate {
            File.WriteAllText(Path.Combine(folder, "outline-ready"), "");
            timer.Start();
        };
        Application.Run(form);
    }
}
