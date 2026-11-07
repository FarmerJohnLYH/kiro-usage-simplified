using System;
using System.IO;
using System.Threading;

class FakeKiro {
    static int Main(string[] args) {
        if (String.Join(" ", args) != "chat --no-interactive /usage --v2") return 2;
        string mode = File.ReadAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "mode.txt")).Trim();
        if (mode == "auth") { Console.Error.WriteLine("Not logged in. Run kiro-cli login."); return 1; }
        if (mode == "timeout") Thread.Sleep(30000);
        if (mode == "slow") Thread.Sleep(1000);
        if (mode == "malformed") { Console.WriteLine("unsupported response"); return 0; }
        if (mode == "high") Console.WriteLine("Credits (95 of 100 covered in plan), 95%");
        else Console.WriteLine("Credits (25 of 100 covered in plan), 25%");
        return 0;
    }
}
