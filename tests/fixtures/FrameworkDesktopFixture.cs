// Synthetic Windows UI only. No Framework installation or patient data needed.
using System;
using System.IO;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Collections.Generic;
public static class FrameworkDesktopFixture {
    [STAThread] public static void Main(string[] args) {
        var form = new Form { Text = "Synthetic Framework desktop test", Width = 1100, Height = 700 };
        var entry = new Panel { Name = "RxEntryViewControl", AccessibleName = "RxEntryViewControl", Left = 10, Top = 10, Width = 640, Height = 620 };
        var pon = new TextBox { AccessibleName = "PON", Text = "SYNTHETIC-1", Top = 20, Left = 20, Width = 500, ReadOnly = true };
        var sig = new TextBox { AccessibleName = "SIG", Text = "OLD SIG", Top = 60, Left = 20, Width = 500 };
        var times = new TextBox { AccessibleName = "Administration times", Text = "0900, 2100", Top = 100, Left = 20, Width = 500 };
        var second = new TextBox { AccessibleName = "PON", Text = "SYNTHETIC-2", Top = 140, Left = 20, Width = 500, ReadOnly = true, Visible = false };
        var patient = new TextBox { AccessibleName = "Patient ID", Text = "PAT-1", Top = 180, Left = 20, Width = 500, ReadOnly = true };
        var facility = new TextBox { AccessibleName = "Facility ID", Text = "FAC-1", Top = 220, Left = 20, Width = 500, ReadOnly = true };
        var drug = new TextBox { AccessibleName = "Drug name", Text = "Synthetic tablet", Top = 260, Left = 20, Width = 500, ReadOnly = true };
        var quantity = new TextBox { Name = "RxEntryPrescription_QtyEdit", AccessibleName = "Quantity", Text = "QUANTITY PRIVATE VALUE", Top = 300, Left = 20, Width = 500 };
        var days = new TextBox { Name = "RxEntryPrescription_DaysSupplyEdit", AccessibleName = "Days supply", Text = "DAYS PRIVATE VALUE", Top = 340, Left = 20, Width = 500 };
        var package = new TextBox { AccessibleName = "Package type", Text = "PACKAGE PRIVATE VALUE", Top = 380, Left = 20, Width = 500 };
        var start = new TextBox { AccessibleName = "Start date", Text = "START PRIVATE VALUE", Top = 420, Left = 20, Width = 500 };
        var password = new TextBox { AccessibleName = "Refills", Text = "PASSWORD PRIVATE VALUE", UseSystemPasswordChar = true, Top = 460, Left = 20, Width = 500 };
        var hidden = new TextBox { AccessibleName = "Delivery date", Text = "HIDDEN PRIVATE VALUE", Visible = false, Top = 500, Left = 20, Width = 500 };
        entry.Controls.AddRange(new Control[] { pon, sig, times, second, patient, facility, drug, quantity, days, package, start, password, hidden });
        form.Controls.Add(entry);
        Panel decorations = null;
        var timer = new Timer { Interval = 50 }; string seen = "";
        timer.Tick += delegate {
            try {
                var file = Path.Combine(args[0], "command.json"); if (!File.Exists(file)) return;
                var text = File.ReadAllText(file); if (text == seen) return;
                var command = new JavaScriptSerializer().Deserialize<Dictionary<string, string>>(text);
                if (command.ContainsKey("pon")) pon.Text = command["pon"];
                if (command.ContainsKey("ponLabel")) pon.AccessibleName = command["ponLabel"];
                if (command.ContainsKey("sig")) sig.Text = command["sig"];
                if (command.ContainsKey("patient")) patient.Text = command["patient"];
                if (command.ContainsKey("focus")) { form.Activate(); if (command["focus"] == "quantity") quantity.Focus(); else sig.Focus(); }
                if (command.ContainsKey("quantity")) quantity.Text = command["quantity"];
                if (command.ContainsKey("wide")) {
                    if (command["wide"] == "true" && decorations == null) {
                        decorations = new Panel { AccessibleName = "Decorative controls", Left = 670, Top = 10, Width = 390, Height = 620 };
                        decorations.SuspendLayout();
                        for (int i = 0; i < 1000; i++) decorations.Controls.Add(new Label { Text = "Decoration " + i, AccessibleName = "Decoration " + i, Left = (i % 3) * 120, Top = ((i / 3) % 30) * 20, Width = 110, Height = 18 });
                        decorations.ResumeLayout(); form.Controls.Add(decorations);
                    } else if (command["wide"] != "true" && decorations != null) { form.Controls.Remove(decorations); decorations.Dispose(); decorations = null; }
                }
                if (command.ContainsKey("sigLabel")) sig.AccessibleName = command["sigLabel"];
                if (command.ContainsKey("readonly")) sig.ReadOnly = command["readonly"] == "true";
                if (command.ContainsKey("duplicate")) second.Visible = command["duplicate"] == "true";
                if (command.ContainsKey("snapshot")) File.WriteAllText(Path.Combine(args[0], "state.json"),
                    new JavaScriptSerializer().Serialize(new { focus = sig.Focused ? "sig" : quantity.Focused ? "quantity" : "other", decorativeControls = decorations == null ? 0 : decorations.Controls.Count }));
                seen = text; File.WriteAllText(Path.Combine(args[0], "ack.json"), text);
            } catch { }
        };
        form.Shown += delegate { File.WriteAllText(Path.Combine(args[0], "ready"), "ready"); timer.Start(); };
        Application.Run(form);
    }
}
