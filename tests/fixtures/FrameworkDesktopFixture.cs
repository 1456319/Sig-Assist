// Synthetic Windows UI only. No Framework installation or patient data needed.
using System;
using System.IO;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Collections.Generic;
public static class FrameworkDesktopFixture {
    [STAThread] public static void Main(string[] args) {
        var form = new Form { Text = "Synthetic Framework desktop test", Width = 700, Height = 430 };
        var pon = new TextBox { AccessibleName = "PON", Text = "SYNTHETIC-1", Top = 20, Left = 20, Width = 500, ReadOnly = true };
        var sig = new TextBox { AccessibleName = "SIG", Text = "OLD SIG", Top = 60, Left = 20, Width = 500 };
        var times = new TextBox { AccessibleName = "Administration times", Text = "0900, 2100", Top = 100, Left = 20, Width = 500 };
        var second = new TextBox { AccessibleName = "PON", Text = "SYNTHETIC-2", Top = 140, Left = 20, Width = 500, ReadOnly = true, Visible = false };
        var patient = new TextBox { AccessibleName = "Patient ID", Text = "PAT-1", Top = 180, Left = 20, Width = 500, ReadOnly = true };
        var facility = new TextBox { AccessibleName = "Facility ID", Text = "FAC-1", Top = 220, Left = 20, Width = 500, ReadOnly = true };
        var drug = new TextBox { AccessibleName = "Drug name", Text = "Synthetic tablet", Top = 260, Left = 20, Width = 500, ReadOnly = true };
        form.Controls.AddRange(new Control[] { pon, sig, times, second, patient, facility, drug });
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
                if (command.ContainsKey("focus")) { form.Activate(); sig.Focus(); }
                if (command.ContainsKey("sigLabel")) sig.AccessibleName = command["sigLabel"];
                if (command.ContainsKey("readonly")) sig.ReadOnly = command["readonly"] == "true";
                if (command.ContainsKey("duplicate")) second.Visible = command["duplicate"] == "true";
                seen = text; File.WriteAllText(Path.Combine(args[0], "ack.json"), text);
            } catch { }
        };
        form.Shown += delegate { File.WriteAllText(Path.Combine(args[0], "ready"), "ready"); timer.Start(); };
        Application.Run(form);
    }
}
