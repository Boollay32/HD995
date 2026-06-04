namespace HelpDeskNet8.Utilities
{
    public static class AppLogger
    {
        public static void Error(string caller, Exception ex) =>
            Console.Error.WriteLine($"[{caller}] {ex.GetType().Name}: {ex.Message}");

        public static void Debug(string caller, string message) =>
                Console.WriteLine($"[DEBUG][{caller}] {message}");
    }
}