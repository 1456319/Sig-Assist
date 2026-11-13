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
    [STAThread]
    public static void Main(string[] args) {
        var folder = args[0];
        var form = new Form { Text = "Private Canary" };
        var tree = new DocuTrackFolderFixture { Name = "_searchFolderTree", Dock = DockStyle.Fill };
        form.Controls.Add(tree);
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
